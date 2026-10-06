// add-home-hex.mjs — seed a small patch of hexes at a location (default: the active region's
// testHex from config/region.json), bypassing the OSM exclude filter, so you can test capture
// from a known spot.
//   node scripts/add-home-hex.mjs                 # geocode the region testHex
//   node scripts/add-home-hex.mjs 40.7308 -73.997 # explicit lat lng
import { readFileSync } from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { latLngToCell, cellToLatLng, cellToBoundary, gridDisk } from 'h3-js';

const REGION = JSON.parse(readFileSync(new URL('../config/region.json', import.meta.url), 'utf8'));

for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
  const m = line.match(/^\s*([\w.]+)\s*=\s*(.*?)\s*$/);
  if (m && !line.trim().startsWith('#') && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^['"]|['"]$/g, '');
}
const sb = createClient(process.env.EXPO_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function geocode(q) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`;
  const res = await fetch(url, { headers: { 'User-Agent': 'Hexa/1.0 (contact bille.sai12@gmail.com)' } });
  const j = await res.json();
  if (!j.length) return null;
  return { lat: parseFloat(j[0].lat), lng: parseFloat(j[0].lon), label: j[0].display_name };
}

async function main() {
  let lat, lng, label;
  if (process.argv[2] && process.argv[3]) {
    lat = parseFloat(process.argv[2]);
    lng = parseFloat(process.argv[3]);
    label = 'explicit coords';
  } else {
    const g = await geocode(REGION.testHex.query);
    if (g) {
      ({ lat, lng, label } = g);
    } else {
      // Geocode down? Fall back to the region's testHex coords so the test seed still runs.
      ({ lat, lng } = REGION.testHex);
      label = `${REGION.testHex.query} (config fallback)`;
    }
  }
  console.log(`Seeding hexes around: ${lat}, ${lng}  (${label})`);

  const center = latLngToCell(lat, lng, 10);
  const cells = gridDisk(center, 3); // center + 3 rings ≈ 37 cells (~390m radius)
  const rows = cells.map((h3) => {
    const [clat, clng] = cellToLatLng(h3);
    const boundary = cellToBoundary(h3, true); // [lng,lat] closed
    return {
      h3_index: h3,
      center_lat: clat,
      center_lng: clng,
      capture_lat: clat,
      capture_lng: clng,
      pincode: REGION.testHex.code,
      neighbourhood: REGION.testHex.neighbourhood,
      boundary: { type: 'Polygon', coordinates: [boundary] },
      is_active: true,
    };
  });

  const { error } = await sb.from('hexes').upsert(rows, { onConflict: 'h3_index' });
  if (error) {
    console.error('Upsert failed:', error.message);
    process.exit(1);
  }
  console.log(`✓ Upserted ${rows.length} hexes. Centre cell: ${center} @ ${lat.toFixed(5)},${lng.toFixed(5)}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
