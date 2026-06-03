// generate-hexes.mjs — Hexa hex-grid seeder (run server-side; service-role key bypasses RLS).
//
//   node scripts/generate-hexes.mjs                 # full Bangalore, with the OSM exclude filter
//   node scripts/generate-hexes.mjs --scope=swath   # central swath only (~15-20k cells) for testing
//   node scripts/generate-hexes.mjs --no-osm        # skip the Overpass filter (fast; UNFILTERED)
//
// Fills the chosen Bangalore bbox with H3 res-10 cells, DROPS cells whose centre falls inside an
// OSM "no-go" polygon (water / lakes / reservoirs / rivers / military-army / airport / explicitly-
// private land — the EXCLUDE-ONLY fairness model Sai requires), and upserts the survivors into the
// `hexes` table. Cells the filter excludes that ALREADY exist are SOFT-DISABLED (is_active=FALSE),
// never DELETEd — hex_ownership + captures FK hexes ON DELETE CASCADE, so deleting would wipe
// players' territory + history. Soft-disabled cells vanish from reads (hexes_in_bbox + the index
// are partial on is_active=TRUE) and become uncapturable (capture_hex filters is_active).
//
// Coordinate-order discipline (the #1 seeding bug — verified against the installed type defs):
//   • h3-js is [lat, lng]:  cellToLatLng -> [lat,lng]
//   • turf / GeoJSON is [lng, lat]
//   • cellToBoundary(idx, true) -> [lng,lat] AND a closed ring (pass `true`!)
//   • polygonToCells(ring, res, true) -> `true` = treat ring as GeoJSON [lng,lat]
//
// Safe to re-run: upsert is keyed on the h3_index primary key; Overpass tiles are cached on disk.
import { readFileSync, mkdirSync, existsSync, writeFileSync } from 'node:fs';
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
const args = process.argv.slice(2);
const SCOPE = (args.find((a) => a.startsWith('--scope=')) ?? '--scope=city').split('=')[1];
const NO_OSM = args.includes('--no-osm');
const TILE_DEG = 0.05; // Overpass query tile size (one POST per tile; small + fast + cacheable)
const CACHE_DIR = 'scripts/.cache/overpass';

// ── Scope bboxes [west, south, east, north] ────────────────────────────────────
// CITY ≈ Bengaluru urban core (lat 12.83–13.14, lng 77.46–77.78) → ~85k res-10 cells.
// SWATH ≈ the central built-up belt (the 4 launch clusters + corridor) → ~15-20k cells.
const BBOXES = {
  city: { west: 77.46, south: 12.83, east: 77.78, north: 13.14 },
  swath: { west: 77.56, south: 12.86, east: 77.72, north: 13.02 },
};
const BBOX = BBOXES[SCOPE] ?? BBOXES.city;

// ── Nearest-centroid labelling for pincode + neighbourhood ([lat,lng]). ─────────
// City-wide so the activity feed ("captured a hex in {neighbourhood}") labels correctly — a sparse
// list would mislabel e.g. all of Whitefield as "HSR Layout". Coords are area centroids (approx);
// pincode is the area's representative code (nullable per 002, so approximate is acceptable).
const AREAS = [
  { name: 'HSR Layout', pincode: '560102', lat: 12.9116, lng: 77.6446 },
  { name: 'Koramangala', pincode: '560034', lat: 12.9352, lng: 77.6245 },
  { name: 'Indiranagar', pincode: '560038', lat: 12.9719, lng: 77.6412 },
  { name: 'BTM Layout', pincode: '560076', lat: 12.9166, lng: 77.6101 },
  { name: 'Jayanagar', pincode: '560041', lat: 12.9250, lng: 77.5938 },
  { name: 'JP Nagar', pincode: '560078', lat: 12.9063, lng: 77.5857 },
  { name: 'Banashankari', pincode: '560070', lat: 12.9255, lng: 77.5468 },
  { name: 'Basavanagudi', pincode: '560004', lat: 12.9417, lng: 77.5730 },
  { name: 'Bellandur', pincode: '560103', lat: 12.9304, lng: 77.6784 },
  { name: 'Marathahalli', pincode: '560037', lat: 12.9569, lng: 77.7011 },
  { name: 'Whitefield', pincode: '560066', lat: 12.9698, lng: 77.7500 },
  { name: 'Sarjapur Road', pincode: '560035', lat: 12.9009, lng: 77.6974 },
  { name: 'Electronic City', pincode: '560100', lat: 12.8452, lng: 77.6602 },
  { name: 'Bommanahalli', pincode: '560068', lat: 12.8997, lng: 77.6186 },
  { name: 'Bannerghatta Road', pincode: '560076', lat: 12.8918, lng: 77.5972 },
  { name: 'Rajarajeshwari Nagar', pincode: '560098', lat: 12.9279, lng: 77.5191 },
  { name: 'Kengeri', pincode: '560060', lat: 12.9080, lng: 77.4828 },
  { name: 'Vijayanagar', pincode: '560040', lat: 12.9719, lng: 77.5305 },
  { name: 'Rajajinagar', pincode: '560010', lat: 12.9914, lng: 77.5526 },
  { name: 'Malleshwaram', pincode: '560003', lat: 13.0035, lng: 77.5709 },
  { name: 'Yeshwanthpur', pincode: '560022', lat: 13.0284, lng: 77.5400 },
  { name: 'Peenya', pincode: '560058', lat: 13.0287, lng: 77.5200 },
  { name: 'Mathikere', pincode: '560054', lat: 13.0330, lng: 77.5610 },
  { name: 'Hebbal', pincode: '560024', lat: 13.0358, lng: 77.5970 },
  { name: 'RT Nagar', pincode: '560032', lat: 13.0238, lng: 77.5938 },
  { name: 'Yelahanka', pincode: '560064', lat: 13.1007, lng: 77.5963 },
  { name: 'Jakkur', pincode: '560064', lat: 13.0760, lng: 77.6060 },
  { name: 'Hennur', pincode: '560043', lat: 13.0280, lng: 77.6410 },
  { name: 'Banaswadi', pincode: '560043', lat: 13.0140, lng: 77.6510 },
  { name: 'Kalyan Nagar', pincode: '560043', lat: 13.0240, lng: 77.6390 },
  { name: 'Kammanahalli', pincode: '560084', lat: 13.0140, lng: 77.6370 },
  { name: 'Ramamurthy Nagar', pincode: '560016', lat: 13.0150, lng: 77.6780 },
  { name: 'KR Puram', pincode: '560036', lat: 13.0070, lng: 77.6960 },
  { name: 'Mahadevapura', pincode: '560048', lat: 12.9920, lng: 77.6870 },
  { name: 'CV Raman Nagar', pincode: '560093', lat: 12.9870, lng: 77.6630 },
  { name: 'Frazer Town', pincode: '560005', lat: 12.9990, lng: 77.6150 },
  { name: 'Shivajinagar', pincode: '560001', lat: 12.9850, lng: 77.6050 },
  { name: 'MG Road', pincode: '560001', lat: 12.9750, lng: 77.6060 },
  { name: 'Domlur', pincode: '560071', lat: 12.9610, lng: 77.6380 },
  { name: 'Ulsoor', pincode: '560008', lat: 12.9810, lng: 77.6260 },
  { name: 'Wilson Garden', pincode: '560027', lat: 12.9490, lng: 77.5970 },
  { name: 'Girinagar', pincode: '560085', lat: 12.9420, lng: 77.5430 },
  { name: 'Uttarahalli', pincode: '560061', lat: 12.9070, lng: 77.5460 },
  { name: 'Hulimavu', pincode: '560076', lat: 12.8780, lng: 77.6020 },
  { name: 'Begur', pincode: '560068', lat: 12.8730, lng: 77.6320 },
  { name: 'Hoodi', pincode: '560048', lat: 12.9920, lng: 77.7160 },
  { name: 'Kadugodi', pincode: '560067', lat: 12.9930, lng: 77.7600 },
];

// ── Overpass: no-go AREAS (exclude-only). bbox order = south,west,north,east. ──
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://maps.mail.ru/osm/tools/overpass/api/interpreter',
];
const OVERPASS_UA = 'Hexa/1.0 (hex-grid seeder; contact bille.sai12@gmail.com)';
const overpassQuery = (b) => `[out:json][timeout:90];
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Build closed GeoJSON [lng,lat] rings (turf polygons) from Overpass `out geom;` elements. */
function elementsToPolygons(elements) {
  const polys = [];
  const ringFromGeom = (geom) => {
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

/** Fetch one tile's OSM elements (disk-cached), trying each mirror with backoff. Returns []. */
async function fetchTile(s, w, n, e) {
  const key = `${s.toFixed(2)}_${w.toFixed(2)}_${n.toFixed(2)}_${e.toFixed(2)}`.replace(/\./g, 'p');
  const cachePath = `${CACHE_DIR}/${key}.json`;
  if (existsSync(cachePath)) {
    try {
      return JSON.parse(readFileSync(cachePath, 'utf8')).elements ?? [];
    } catch {
      /* fall through and refetch */
    }
  }
  const body = 'data=' + encodeURIComponent(overpassQuery(`${s},${w},${n},${e}`));
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
      await sleep(2000 * (attempt + 1)); // backoff before the next mirror
    } finally {
      clearTimeout(timer);
    }
  }
  console.warn(`    ⚠ tile ${key}: all mirrors failed — that tile is left UNFILTERED.`);
  return [];
}

/** Sweep the bbox in TILE_DEG tiles, collecting no-go polygons (with precomputed bboxes). */
async function fetchNoGoPolygons() {
  const tiles = [];
  for (let s = BBOX.south; s < BBOX.north; s += TILE_DEG) {
    for (let w = BBOX.west; w < BBOX.east; w += TILE_DEG) {
      tiles.push({ s, w, n: Math.min(s + TILE_DEG, BBOX.north), e: Math.min(w + TILE_DEG, BBOX.east) });
    }
  }
  console.log(`Overpass: sweeping ${tiles.length} tiles (cached in ${CACHE_DIR})…`);
  const noGo = [];
  let i = 0;
  for (const t of tiles) {
    i++;
    const els = await fetchTile(t.s, t.w, t.n, t.e);
    for (const p of elementsToPolygons(els)) noGo.push({ poly: p, box: turfBbox(p) });
    if (i % 10 === 0) console.log(`  …${i}/${tiles.length} tiles (${noGo.length} no-go polygons so far)`);
    await sleep(1200); // be polite to the public mirrors
  }
  return noGo;
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
  console.log(`Scope: ${SCOPE}  bbox: ${JSON.stringify(BBOX)}  OSM filter: ${NO_OSM ? 'OFF (--no-osm)' : 'ON'}`);

  // 1) Candidate cells filling the bbox. polygonToCells wants a [lng,lat] ring + isGeoJson=true.
  const ring = [
    [BBOX.west, BBOX.south],
    [BBOX.east, BBOX.south],
    [BBOX.east, BBOX.north],
    [BBOX.west, BBOX.north],
    [BBOX.west, BBOX.south],
  ];
  const candidates = polygonToCells(ring, RES, true);
  console.log(`Candidate cells in bbox: ${candidates.length}`);

  // 2) No-go polygons from OSM (tiled + cached; graceful empty on total failure).
  const noGo = NO_OSM ? [] : await fetchNoGoPolygons();
  console.log(`No-go polygons: ${noGo.length}`);

  // 3) Keep cells whose centre is inside ZERO no-go polygons.
  const rows = [];
  const excludedIds = [];
  for (const h3 of candidates) {
    let lat, lng, boundary;
    try {
      [lat, lng] = cellToLatLng(h3);
      boundary = cellToBoundary(h3, true); // [lng,lat], closed ring — the TRUE cell
    } catch {
      continue;
    }
    let blocked = false;
    if (noGo.length) {
      const pt = [lng, lat];
      for (const { poly, box } of noGo) {
        if (lng < box[0] || lng > box[2] || lat < box[1] || lat > box[3]) continue; // bbox reject
        if (booleanPointInPolygon(pt, poly)) {
          blocked = true;
          break;
        }
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
      capture_lat: lat, // reserved for a future footpath-snap UX; not consumed today
      capture_lng: lng,
      pincode: area.pincode,
      neighbourhood: area.name,
      boundary: { type: 'Polygon', coordinates: [boundary] },
      is_active: true,
    });
  }
  console.log(`Excluded by no-go filter: ${excludedIds.length}`);
  console.log(`Playable cells to upsert: ${rows.length}`);

  const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

  // 4) Upsert survivors in chunks (idempotent on the h3_index PK). is_active=TRUE re-activates any
  //    previously soft-disabled cell that is now playable.
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
    if ((written / CHUNK) % 5 === 0 || written === rows.length) console.log(`  upserted ${written}/${rows.length}`);
  }

  // 5) Reconcile excluded cells by SOFT-DISABLE (never DELETE — FK cascade would wipe ownership +
  //    captures). Only cells that already exist are affected; new excluded cells are simply not
  //    inserted. Chunked to stay within request limits.
  if (excludedIds.length) {
    let disabled = 0;
    for (let i = 0; i < excludedIds.length; i += 500) {
      const ids = excludedIds.slice(i, i + 500);
      const { error } = await supabase.from('hexes').update({ is_active: false }).in('h3_index', ids);
      if (error) {
        console.error('Soft-disable of excluded cells failed:', error.message);
        break;
      }
      disabled += ids.length;
    }
    console.log(`Soft-disabled ${disabled} no-go cells (is_active=FALSE; ownership/history preserved).`);
  }

  const { count: total } = await supabase.from('hexes').select('*', { count: 'exact', head: true });
  const { count: active } = await supabase.from('hexes').select('*', { count: 'exact', head: true }).eq('is_active', true);
  console.log(`✓ Done. hexes table: ${total} rows total, ${active} active (playable).`);
  console.log('⚠ Run `ANALYZE hexes;` (or let autovacuum catch up) so the planner uses hexes_latlng_idx on the grown table.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
