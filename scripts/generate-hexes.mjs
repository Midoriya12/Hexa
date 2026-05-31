// generate-hexes.mjs — Phase 2 hex-grid seeder (run once, server-side).
//
//   node scripts/generate-hexes.mjs
//
// Fills the Bangalore launch area (HSR / Koramangala / Indiranagar) with H3 res-10 cells,
// drops cells whose CENTRE falls inside an OSM "no-go" polygon (water / military / airport /
// explicitly-private land — the EXCLUDE-ONLY model Sai chose), and upserts the survivors into
// the `hexes` table using the service-role key (bypasses RLS — the only write path).
//
// Coordinate-order discipline (the #1 seeding bug — verified against the installed type defs):
//   • h3-js is [lat, lng]:  latLngToCell(lat,lng,res), cellToLatLng -> [lat,lng]
//   • turf / GeoJSON is [lng, lat]
//   • cellToBoundary(idx, true) -> [lng,lat] AND a closed ring (pass `true`!)
//   • polygonToCells(ring, res, true) -> `true` = treat ring as GeoJSON [lng,lat]
//
// Safe to re-run: upsert is keyed on the h3_index primary key.
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { cellToBoundary, cellToLatLng, polygonToCells, getHexagonAreaAvg, UNITS } from 'h3-js';
import { booleanPointInPolygon, bbox as turfBbox, polygon as turfPolygon } from '@turf/turf';

// Minimal .env.local loader (no dotenv dep). KEY=VALUE, strips matching quotes, skips comments.
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

// ── Launch area ──────────────────────────────────────────────────────────────
// Bounding box covering HSR Layout / Koramangala / Indiranagar (+~500m padding).
// [west, south, east, north] in degrees.
const LAUNCH = { west: 77.610, south: 12.895, east: 77.665, north: 12.985 };

// Nearest-centroid labelling for pincode + neighbourhood. [lat, lng].
const AREAS = [
  { pincode: '560102', name: 'HSR Layout', lat: 12.9116, lng: 77.6446 },
  { pincode: '560034', name: 'Koramangala', lat: 12.9352, lng: 77.6245 },
  { pincode: '560038', name: 'Indiranagar', lat: 12.9719, lng: 77.6412 },
];

// ── Overpass: fetch no-go AREAS for the launch bbox (exclude-only) ─────────────
// bbox order for Overpass is south,west,north,east (lat,lon).
// Public instances reject UA-less requests (HTTP 406) and throttle, so we send a proper
// User-Agent and fall back across mirrors.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const OVERPASS_UA = 'Hexa/1.0 (hex-grid seeder; contact bille.sai12@gmail.com)';
const overpassQuery = (b) => `[out:json][timeout:60];
(
  way["natural"="water"](${b});
  relation["natural"="water"](${b});
  way["landuse"="reservoir"](${b});
  relation["landuse"="reservoir"](${b});
  way["waterway"="riverbank"](${b});
  relation["waterway"="riverbank"](${b});
  way["landuse"="military"](${b});
  relation["landuse"="military"](${b});
  way["military"](${b});
  relation["military"](${b});
  way["aeroway"="aerodrome"](${b});
  relation["aeroway"="aerodrome"](${b});
  way["access"="private"]["landuse"](${b});
  relation["access"="private"]["landuse"](${b});
  way["access"="no"]["landuse"](${b});
  way["access"="private"]["leisure"](${b});
);
out geom;`;

/** Build closed GeoJSON [lng,lat] rings (turf polygons) from Overpass `out geom;` elements.
 *  Conservative: every closed way (and every closed way-member of a relation) becomes a solid
 *  polygon. We only point-test to DROP cells, so treating outers as solid is safe. */
function elementsToPolygons(elements) {
  const polys = [];
  const ringFromGeom = (geom) => {
    if (!Array.isArray(geom) || geom.length < 4) return null;
    const ring = geom.map((p) => [p.lon, p.lat]); // -> [lng,lat]
    const [fx, fy] = ring[0];
    const [lx, ly] = ring[ring.length - 1];
    if (fx !== lx || fy !== ly) ring.push([fx, fy]); // close it
    if (ring.length < 4) return null;
    try {
      return turfPolygon([ring]);
    } catch {
      return null; // degenerate ring
    }
  };
  for (const el of elements) {
    if (el.type === 'way' && el.geometry) {
      const p = ringFromGeom(el.geometry);
      if (p) polys.push(p);
    } else if (el.type === 'relation' && Array.isArray(el.members)) {
      for (const m of el.members) {
        if ((m.type === 'way' || m.role === 'outer') && m.geometry) {
          const p = ringFromGeom(m.geometry);
          if (p) polys.push(p);
        }
      }
    }
  }
  return polys;
}

async function fetchNoGoPolygons() {
  const b = `${LAUNCH.south},${LAUNCH.west},${LAUNCH.north},${LAUNCH.east}`;
  const body = 'data=' + encodeURIComponent(overpassQuery(b));
  for (const endpoint of OVERPASS_ENDPOINTS) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 65_000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': OVERPASS_UA,
          Accept: 'application/json',
        },
        body,
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      const polys = elementsToPolygons(json.elements ?? []);
      console.log(`  (no-go via ${new URL(endpoint).host}: ${json.elements?.length ?? 0} OSM elements)`);
      // Precompute each polygon's bbox for a cheap reject before point-in-polygon.
      return polys.map((p) => ({ poly: p, box: turfBbox(p) }));
    } catch (err) {
      console.warn(`  Overpass ${new URL(endpoint).host} failed (${err.message}); trying next…`);
    } finally {
      clearTimeout(timer);
    }
  }
  console.warn(
    '⚠ All Overpass mirrors failed; seeding the FULL grid with NO exclusions. ' +
      'Re-run later to apply the water/military/private filter.',
  );
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

async function main() {
  const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !serviceKey) {
    console.error('Missing SUPABASE_URL / EXPO_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
  }

  console.log(`Hexa hex-grid seeder · res ${RES} (~${Math.round(getHexagonAreaAvg(RES, UNITS.m2))} m²/cell)`);
  console.log(`Launch bbox: ${JSON.stringify(LAUNCH)}`);

  // 1) Candidate cells: fill the launch bbox. polygonToCells wants a [lng,lat] ring + isGeoJson=true.
  const ring = [
    [LAUNCH.west, LAUNCH.south],
    [LAUNCH.east, LAUNCH.south],
    [LAUNCH.east, LAUNCH.north],
    [LAUNCH.west, LAUNCH.north],
    [LAUNCH.west, LAUNCH.south],
  ];
  const candidates = polygonToCells(ring, RES, true);
  console.log(`Candidate cells in bbox: ${candidates.length}`);

  // 2) No-go polygons from OSM (graceful empty on failure).
  const noGo = await fetchNoGoPolygons();
  console.log(`No-go polygons fetched: ${noGo.length}`);

  // 3) Keep cells whose centre is inside ZERO no-go polygons; build rows.
  const rows = [];
  const excludedIds = [];
  for (const h3 of candidates) {
    let lat, lng, boundary;
    try {
      [lat, lng] = cellToLatLng(h3); // [lat,lng]
      boundary = cellToBoundary(h3, true); // [lng,lat], closed ring
    } catch {
      continue; // skip a bad cell rather than abort the whole run
    }
    const pt = [lng, lat]; // GeoJSON [lng,lat]
    let blocked = false;
    for (const { poly, box } of noGo) {
      if (lng < box[0] || lng > box[2] || lat < box[1] || lat > box[3]) continue; // bbox reject
      if (booleanPointInPolygon(pt, poly)) {
        blocked = true;
        break;
      }
    }
    if (blocked) {
      excludedIds.push(h3);
      continue;
    }
    const area = nearestArea(lat, lng);
    rows.push({
      h3_index: h3,
      center_lat: lat,
      center_lng: lng,
      capture_lat: lat, // = centre for now; footpath-snapping is a later refinement
      capture_lng: lng,
      pincode: area.pincode,
      neighbourhood: area.name,
      boundary: { type: 'Polygon', coordinates: [boundary] },
      is_active: true,
    });
  }
  console.log(`Excluded by no-go filter: ${excludedIds.length}`);
  console.log(`Playable cells to upsert: ${rows.length}`);

  // 4) Upsert in chunks (idempotent on the h3_index PK).
  const supabase = createClient(url, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const CHUNK = 1000;
  let written = 0;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const batch = rows.slice(i, i + CHUNK);
    const { error } = await supabase.from('hexes').upsert(batch, { onConflict: 'h3_index' });
    if (error) {
      console.error(`Upsert failed at chunk ${i / CHUNK}:`, error.message);
      process.exit(1);
    }
    written += batch.length;
    console.log(`  upserted ${written}/${rows.length}`);
  }

  // 5) Reconcile: remove any no-go cells a prior (unfiltered) run may have inserted, so the
  //    table converges to exactly the playable set. Chunked .in() to stay within limits.
  if (excludedIds.length) {
    let removed = 0;
    for (let i = 0; i < excludedIds.length; i += 200) {
      const ids = excludedIds.slice(i, i + 200);
      const { error } = await supabase.from('hexes').delete().in('h3_index', ids);
      if (error) {
        console.error('Delete of excluded cells failed:', error.message);
        break;
      }
      removed += ids.length;
    }
    console.log(`Removed ${removed} no-go cells from the table.`);
  }

  const { count } = await supabase.from('hexes').select('*', { count: 'exact', head: true });
  console.log(`✓ Done. hexes table now holds ${count} rows.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
