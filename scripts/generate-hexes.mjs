// generate-hexes.mjs — Hexa hex-grid seeder (run server-side; service-role key bypasses RLS).
//
//   node scripts/generate-hexes.mjs                 # full active region, public-place anchored
//   node scripts/generate-hexes.mjs --scope=swath   # central swath only (smaller) for testing
//
// The region (bounding box, neighbourhood labels, safety floor) comes from config/region.json —
// the SAME file the app reads for its map centre and signup location field. Re-target a city by
// editing that JSON and re-running this script; no edits here. The OSM/Overpass anchor + no-go
// queries below are geography-agnostic, so they work for any city out of the box.
//
// PLACEMENT MODEL (Sai, 2026-06-04): hexes are NOT a wall-to-wall tessellation. They sit only at
// REACHABLE PUBLIC PLACES pulled from OpenStreetMap — parks, gardens, playgrounds, sports grounds,
// marketplaces, places of worship, community centres/libraries, transit stops/stations, squares,
// attractions — each snapped to its H3 res-10 cell, then thinned so no two hexes are within
// MIN_SPACING_M (~175m), and finally any cell whose centre lands in a NO-GO area (water / lakes /
// reservoirs / rivers / military-army / airport / explicitly-private land) is dropped. Result: a
// sparse, walkable, fair set of capture points with real gaps — not a honeycomb blob.
//
// Reconcile is NON-DESTRUCTIVE: cells no longer in the set are SOFT-DISABLED (is_active=FALSE),
// never DELETEd (hex_ownership + captures FK hexes ON DELETE CASCADE). Currently-OWNED cells are
// kept active so no player loses captured territory when the grid is re-shaped.
//
// Coordinate-order discipline (verified against the installed type defs):
//   • h3-js is [lat,lng]:  latLngToCell(lat,lng,res), cellToLatLng -> [lat,lng]
//   • cellToBoundary(idx, true) -> [lng,lat] closed ring (the TRUE cell; capture validates it)
// Safe to re-run: upsert keyed on the h3_index PK; Overpass tiles are cached on disk.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { latLngToCell, cellToBoundary, cellToLatLng, getHexagonAreaAvg, UNITS } from 'h3-js';
import { booleanPointInPolygon, bbox as turfBbox, polygon as turfPolygon } from '@turf/turf';

// Region config — shared with the app (config/region.json). Resolved relative to THIS file so the
// script works regardless of cwd.
const REGION = JSON.parse(readFileSync(new URL('../config/region.json', import.meta.url), 'utf8'));

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, 'utf8').split('\n')) {
      const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
      if (!m || line.trim().startsWith('#')) continue;
      let v = m[2];
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
      if (!(m[1] in process.env)) process.env[m[1]] = v;
    }
  } catch (err) {
    console.warn(`Could not read ${path}: ${err.message}`);
  }
}
loadEnv('.env.local');

const RES = 10;
const MIN_SPACING_M = 175; // no two hexes closer than this (Sai: ~150-200m apart, with gaps)
const args = process.argv.slice(2);
const SCOPE = (args.find((a) => a.startsWith('--scope=')) ?? '--scope=city').split('=')[1];
const TILE_DEG = 0.05;
const CACHE_DIR = 'scripts/.cache/overpass';

const BBOX = REGION.seed[SCOPE === 'swath' ? 'swath' : 'bbox'] ?? REGION.seed.bbox;

// Region locality labels for the feed ("captured a hex in {neighbourhood}"). [lat,lng] + code
// (stored in the DB `pincode` column — a generic area code, ZIP for the US). From config/region.json.
const AREAS = REGION.areas;

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const OVERPASS_UA = 'Hexa/1.0 (hex-grid seeder; contact bille.sai12@gmail.com)';

// One combined query per tile: PUBLIC POIs (anchors) + NO-GO areas (exclusions). Classified on parse.
const tileQuery = (b) => `[out:json][timeout:90];
(
  nwr["leisure"~"^(park|garden|playground|pitch|sports_centre|stadium|recreation_ground|common)$"](${b});
  nwr["amenity"~"^(marketplace|place_of_worship|community_centre|library|townhall|social_facility)$"](${b});
  node["highway"="bus_stop"](${b});
  nwr["railway"~"^(station|halt|tram_stop)$"](${b});
  node["public_transport"="station"](${b});
  nwr["place"="square"](${b});
  node["tourism"~"^(attraction|viewpoint|artwork)$"](${b});
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["landuse"~"^(reservoir|military)$"](${b});
  relation["landuse"~"^(reservoir|military)$"](${b});
  way["waterway"="riverbank"](${b});
  relation["waterway"="riverbank"](${b});
  way["military"](${b});
  relation["military"](${b});
  way["aeroway"="aerodrome"](${b});
  relation["aeroway"="aerodrome"](${b});
  way["access"~"^(private|no)$"]["landuse"](${b});
  way["access"="private"]["leisure"](${b});
);
out geom;`;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const EARTH_M_PER_DEG = 111_320;
function haversineM(aLat, aLng, bLat, bLng) {
  const dLat = (aLat - bLat) * EARTH_M_PER_DEG;
  const dLng = (aLng - bLng) * EARTH_M_PER_DEG * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

const isNoGo = (t) =>
  !!t &&
  (t.natural === 'water' ||
    t.landuse === 'reservoir' ||
    t.landuse === 'military' ||
    t.military !== undefined ||
    t.aeroway === 'aerodrome' ||
    t.waterway === 'riverbank' ||
    ((t.access === 'private' || t.access === 'no') && (t.landuse !== undefined || t.leisure !== undefined)));

const isPoi = (t) => {
  if (!t) return false;
  if (['park', 'garden', 'playground', 'pitch', 'sports_centre', 'stadium', 'recreation_ground', 'common'].includes(t.leisure)) return true;
  if (['marketplace', 'place_of_worship', 'community_centre', 'library', 'townhall', 'social_facility'].includes(t.amenity)) return true;
  if (t.highway === 'bus_stop') return true;
  if (['station', 'halt', 'tram_stop'].includes(t.railway)) return true;
  if (t.public_transport === 'station') return true;
  if (t.place === 'square') return true;
  if (['attraction', 'viewpoint', 'artwork'].includes(t.tourism)) return true;
  return false;
};

function ringFromGeom(geom) {
  if (!Array.isArray(geom) || geom.length < 4) return null;
  const ring = geom.map((p) => [p.lon, p.lat]);
  const [fx, fy] = ring[0];
  const [lx, ly] = ring[ring.length - 1];
  if (fx !== lx || fy !== ly) ring.push([fx, fy]);
  if (ring.length < 4) return null;
  try {
    return turfPolygon([ring]);
  } catch {
    return null;
  }
}

// Representative point for a POI element: node coords, or the average of a way/relation's geometry.
function poiPoint(el) {
  if (el.type === 'node' && el.lat != null) return { lat: el.lat, lng: el.lon };
  const pts = [];
  if (Array.isArray(el.geometry)) for (const p of el.geometry) pts.push(p);
  if (Array.isArray(el.members)) for (const m of el.members) if (Array.isArray(m.geometry)) for (const p of m.geometry) pts.push(p);
  if (!pts.length) return null;
  const lat = pts.reduce((s, p) => s + p.lat, 0) / pts.length;
  const lng = pts.reduce((s, p) => s + p.lon, 0) / pts.length;
  return { lat, lng };
}

async function fetchTile(s, w, n, e) {
  const key = `poi_${s.toFixed(2)}_${w.toFixed(2)}_${n.toFixed(2)}_${e.toFixed(2)}`.replace(/\./g, 'p');
  const cachePath = `${CACHE_DIR}/${key}.json`;
  if (existsSync(cachePath)) {
    try {
      return JSON.parse(readFileSync(cachePath, 'utf8')).elements ?? [];
    } catch {
      /* refetch */
    }
  }
  const body = 'data=' + encodeURIComponent(tileQuery(`${s},${w},${n},${e}`));
  for (let attempt = 0; attempt < OVERPASS_ENDPOINTS.length; attempt++) {
    const endpoint = OVERPASS_ENDPOINTS[attempt];
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 95_000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': OVERPASS_UA, Accept: 'application/json' },
        body,
        signal: controller.signal,
      });
      if (res.status === 429 || res.status === 504) throw new Error(`HTTP ${res.status} (busy)`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      mkdirSync(CACHE_DIR, { recursive: true });
      writeFileSync(cachePath, JSON.stringify(json));
      return json.elements ?? [];
    } catch (err) {
      console.warn(`    tile ${key} via ${new URL(endpoint).host} failed (${err.message})`);
      await sleep(2000 * (attempt + 1));
    } finally {
      clearTimeout(timer);
    }
  }
  console.warn(`    ⚠ tile ${key}: all mirrors failed — that tile contributes no POIs/exclusions.`);
  return [];
}

function nearestArea(lat, lng) {
  let best = AREAS[0];
  let bestD = Infinity;
  for (const a of AREAS) {
    const d = (a.lat - lat) ** 2 + (a.lng - lng) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}

// Greedy spacing thin-out: keep a cell only if no already-kept cell is within MIN_SPACING_M.
// Bucketed (3x3 neighbourhood) so it's ~O(n), not O(n^2).
function spaceOut(cells) {
  const kept = [];
  const buckets = new Map();
  const cellDeg = MIN_SPACING_M / EARTH_M_PER_DEG;
  const bkey = (lat, lng) => `${Math.floor(lat / cellDeg)}_${Math.floor(lng / cellDeg)}`;
  for (const c of cells) {
    const bi = Math.floor(c.lat / cellDeg);
    const bj = Math.floor(c.lng / cellDeg);
    let tooClose = false;
    outer: for (let di = -1; di <= 1 && !tooClose; di++) {
      for (let dj = -1; dj <= 1; dj++) {
        const arr = buckets.get(`${bi + di}_${bj + dj}`);
        if (!arr) continue;
        for (const k of arr) {
          if (haversineM(c.lat, c.lng, k.lat, k.lng) < MIN_SPACING_M) {
            tooClose = true;
            break outer;
          }
        }
      }
    }
    if (tooClose) continue;
    kept.push(c);
    const kk = bkey(c.lat, c.lng);
    if (!buckets.has(kk)) buckets.set(kk, []);
    buckets.get(kk).push(c);
  }
  return kept;
}

async function fetchColumn(supabase, table, filterActive) {
  const out = [];
  const PAGE = 1000;
  let from = 0;
  for (;;) {
    let q = supabase.from(table).select('h3_index').range(from, from + PAGE - 1);
    if (filterActive) q = q.eq('is_active', true);
    const { data, error } = await q;
    if (error) {
      console.error(`fetch ${table} failed:`, error.message);
      break;
    }
    out.push(...data.map((r) => r.h3_index));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return out;
}

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }
  console.log(`Hexa seeder · ${REGION.name} · res ${RES} (~${Math.round(getHexagonAreaAvg(RES, UNITS.m2))} m²/cell) · public-place anchored, ${MIN_SPACING_M}m spacing`);
  console.log(`Scope: ${SCOPE}  bbox: ${JSON.stringify(BBOX)}`);

  // 1) Sweep tiles → collect POI points + no-go polygons.
  const tiles = [];
  for (let s = BBOX.south; s < BBOX.north; s += TILE_DEG)
    for (let w = BBOX.west; w < BBOX.east; w += TILE_DEG)
      tiles.push({ s, w, n: Math.min(s + TILE_DEG, BBOX.north), e: Math.min(w + TILE_DEG, BBOX.east) });
  console.log(`Overpass: sweeping ${tiles.length} tiles (cached in ${CACHE_DIR})…`);

  const poiPoints = [];
  const noGo = [];
  let i = 0;
  for (const t of tiles) {
    i++;
    const els = await fetchTile(t.s, t.w, t.n, t.e);
    for (const el of els) {
      const tags = el.tags;
      if (isNoGo(tags)) {
        const p = ringFromGeom(el.geometry);
        if (p) noGo.push({ poly: p, box: turfBbox(p) });
      } else if (isPoi(tags)) {
        const pt = poiPoint(el);
        if (pt) poiPoints.push(pt);
      }
    }
    if (i % 10 === 0) console.log(`  …${i}/${tiles.length} tiles (${poiPoints.length} POIs, ${noGo.length} no-go so far)`);
    await sleep(1200);
  }
  console.log(`Public POIs: ${poiPoints.length} · no-go polygons: ${noGo.length}`);

  // 2) Snap POIs to res-10 cells (dedupe per cell).
  const byCell = new Map();
  for (const p of poiPoints) {
    let h3;
    try {
      h3 = latLngToCell(p.lat, p.lng, RES);
    } catch {
      continue;
    }
    if (!byCell.has(h3)) {
      const [clat, clng] = cellToLatLng(h3);
      byCell.set(h3, { h3, lat: clat, lng: clng });
    }
  }
  console.log(`Distinct POI cells: ${byCell.size}`);

  // 3) Drop cells whose centre is inside a no-go polygon.
  const reachable = [];
  for (const c of byCell.values()) {
    let blocked = false;
    if (noGo.length) {
      const pt = [c.lng, c.lat];
      for (const { poly, box } of noGo) {
        if (c.lng < box[0] || c.lng > box[2] || c.lat < box[1] || c.lat > box[3]) continue;
        if (booleanPointInPolygon(pt, poly)) {
          blocked = true;
          break;
        }
      }
    }
    if (!blocked) reachable.push(c);
  }
  console.log(`After no-go exclusion: ${reachable.length}`);

  // 4) Enforce ~${MIN_SPACING_M}m spacing.
  const kept = spaceOut(reachable);
  console.log(`After ${MIN_SPACING_M}m spacing: ${kept.length} hexes`);

  // 5) Build rows.
  const rows = kept.map((c) => {
    const boundary = cellToBoundary(c.h3, true);
    const area = nearestArea(c.lat, c.lng);
    return {
      h3_index: c.h3,
      center_lat: c.lat,
      center_lng: c.lng,
      capture_lat: c.lat,
      capture_lng: c.lng,
      pincode: area.code,
      neighbourhood: area.name,
      boundary: { type: 'Polygon', coordinates: [boundary] },
      is_active: true,
    };
  });

  // SAFEGUARD: an empty/near-empty result almost always means Overpass was unreachable, NOT that
  // the city has no public places. Abort BEFORE any upsert/soft-disable so a network failure can
  // never wipe the existing grid. (Floor scales with scope.)
  const FLOOR = SCOPE === 'swath' ? REGION.seed.swathFloor : REGION.seed.floor;
  if (kept.length < FLOOR) {
    console.error(
      `Only ${kept.length} hexes produced (< ${FLOOR} floor) — Overpass likely failed. ` +
        'Aborting before any write so the existing grid is untouched. Check the network / cache and re-run.',
    );
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });
  const keptSet = new Set(kept.map((c) => c.h3));

  // 6) Upsert the kept set (active).
  const CHUNK = 1000;
  let written = 0;
  for (let k = 0; k < rows.length; k += CHUNK) {
    const batch = rows.slice(k, k + CHUNK);
    const { error } = await supabase.from('hexes').upsert(batch, { onConflict: 'h3_index' });
    if (error) {
      console.error(`Upsert failed at chunk ${k / CHUNK}:`, error.message);
      process.exit(1);
    }
    written += batch.length;
  }
  console.log(`Upserted ${written} hexes (active).`);

  // 7) Reconcile: soft-disable any currently-active cell NOT in the new set, EXCEPT owned cells
  //    (preserve captured territory). Never DELETE.
  const owned = new Set(await fetchColumn(supabase, 'hex_ownership', false));
  const active = await fetchColumn(supabase, 'hexes', true);
  const toDisable = active.filter((h) => !keptSet.has(h) && !owned.has(h));
  if (toDisable.length) {
    let disabled = 0;
    for (let k = 0; k < toDisable.length; k += 500) {
      const ids = toDisable.slice(k, k + 500);
      const { error } = await supabase.from('hexes').update({ is_active: false }).in('h3_index', ids);
      if (error) {
        console.error('Soft-disable failed:', error.message);
        break;
      }
      disabled += ids.length;
    }
    console.log(`Soft-disabled ${disabled} non-anchored cells (kept ${owned.size} owned cells active).`);
  }

  const { count: total } = await supabase.from('hexes').select('*', { count: 'exact', head: true });
  const { count: activeCount } = await supabase.from('hexes').select('*', { count: 'exact', head: true }).eq('is_active', true);
  console.log(`✓ Done. hexes: ${total} total, ${activeCount} active (playable).`);
  console.log('⚠ Run `ANALYZE hexes;` (or let autovacuum catch up) so the planner uses hexes_latlng_idx.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
