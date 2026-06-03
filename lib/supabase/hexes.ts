// Hex grid reads. The playable grid is static (scripts/generate-hexes.mjs); ownership is dynamic
// (hex_ownership, written only by the capture_hex RPC). At full-Bangalore scale (~85K cells) we do
// NOT load the whole grid — we fetch only the hexes inside the current map VIEWPORT via the
// hexes_in_bbox RPC (migration 009), which tags each hex's owner relative to the caller in ONE
// round-trip — PLUS a bounds-independent fetch of the caller's OWN hexes so your territory renders
// at every zoom no matter where the camera is. stores/hexStore.ts windows + merges these.
import { supabase } from './client';

/** Per-feature properties on each hex polygon. `owner` drives the fill/outline colour on the map;
 *  `h3` is the cell id used for capture + nearest-hex resolution; clat/clng are the TRUE centre. */
export interface HexFeatureProps {
  h3: string;
  owner: 'none' | 'you' | 'other';
  pincode: string | null;
  clat: number;
  clng: number;
}

export type HexFeature = GeoJSON.Feature<GeoJSON.Polygon, HexFeatureProps>;
export type HexCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon, HexFeatureProps>;

/** A lat/lng bounding box (the map viewport, padded). */
export interface Bounds {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

// Cosmetic gap: draw each hex shrunk toward its centroid so cells read as DISTINCT spaced
// hexagons. COSMETIC ONLY — capture validates server-side against the full TRUE cell boundary.
const DISPLAY_SCALE = 0.88;

function insetPolygon(poly: GeoJSON.Polygon, scale: number): GeoJSON.Polygon {
  const ring = poly.coordinates[0] ?? [];
  const pts = ring.slice(0, -1); // drop the closing duplicate vertex
  const n = pts.length || 1;
  const cx = pts.reduce((s, p) => s + p[0], 0) / n;
  const cy = pts.reduce((s, p) => s + p[1], 0) / n;
  const shrunk = pts.map(([x, y]) => [cx + (x - cx) * scale, cy + (y - cy) * scale]);
  if (shrunk.length) shrunk.push(shrunk[0]); // re-close
  return { type: 'Polygon', coordinates: [shrunk] };
}

/** Map a DB row (boundary is always the TRUE, un-inset cell) into a display Feature. The inset is
 *  applied here in exactly ONE place; capture (003 point-in-polygon) uses the true cell and is
 *  unaffected by this cosmetic shrink. */
function rowToFeature(r: {
  h3_index: string;
  boundary: GeoJSON.Polygon;
  pincode: string | null;
  center_lat: number;
  center_lng: number;
  owner: HexFeatureProps['owner'];
}): HexFeature {
  return {
    type: 'Feature',
    geometry: insetPolygon(r.boundary, DISPLAY_SCALE),
    properties: { h3: r.h3_index, owner: r.owner, pincode: r.pincode, clat: r.center_lat, clng: r.center_lng },
  };
}

/** VIEWPORT fetch — the single bbox read path (migration 009 RPC). One round-trip; ownership is
 *  joined + tagged server-side ('you' | 'other' | 'none') via auth.uid(). The caller MUST pad the
 *  box by ~one cell radius so cells whose centre sits just off-screen aren't clipped, and keep the
 *  box small enough that the result stays under PostgREST max_rows (p_limit mirrors it). */
export async function fetchHexesInBounds(b: Bounds): Promise<HexFeature[]> {
  const { data, error } = await supabase.rpc('hexes_in_bbox', {
    p_min_lat: b.minLat,
    p_min_lng: b.minLng,
    p_max_lat: b.maxLat,
    p_max_lng: b.maxLng,
    p_limit: 1000,
  });
  if (error) throw error;
  return (data ?? []).map((r) =>
    rowToFeature({
      h3_index: r.h3_index,
      boundary: r.boundary as unknown as GeoJSON.Polygon,
      pincode: r.pincode ?? null,
      center_lat: r.center_lat,
      center_lng: r.center_lng,
      owner: (r.owner as HexFeatureProps['owner']) ?? 'none',
    }),
  );
}

/** OWNED-EVERYWHERE fetch — bounds-independent, small set (the hexes YOU hold). Embedded join via
 *  the hex_ownership → hexes FK. Tagged 'you' by definition. Merged into every viewport so your
 *  territory shows at all zooms regardless of camera position. */
export async function fetchOwnHexes(myId: string): Promise<HexFeature[]> {
  const { data, error } = await supabase
    .from('hex_ownership')
    .select('h3_index, hexes!inner(boundary, center_lat, center_lng, pincode)')
    .eq('owner_id', myId);
  if (error) throw error;
  return (data ?? []).map((o) => {
    const h = (Array.isArray(o.hexes) ? o.hexes[0] : o.hexes) as {
      boundary: unknown;
      center_lat: number;
      center_lng: number;
      pincode: string | null;
    };
    return rowToFeature({
      h3_index: o.h3_index,
      boundary: h.boundary as GeoJSON.Polygon,
      pincode: h.pincode ?? null,
      center_lat: h.center_lat,
      center_lng: h.center_lng,
      owner: 'you',
    });
  });
}
