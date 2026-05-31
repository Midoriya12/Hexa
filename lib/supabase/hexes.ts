// Hex grid reads. The playable grid is static (scripts/generate-hexes.mjs); ownership is
// dynamic (hex_ownership, written only by the capture_hex RPC). We fetch both and tag each
// hex feature with `owner` ('you' | 'other' | 'none') so the map can colour territory.
import { supabase } from './client';
import type { HexRow } from '@/types/database';

/** Per-feature properties on each hex polygon. `owner` drives the fill/outline colour on the
 *  map; `h3` is the cell id used for capture + feature-state. */
export interface HexFeatureProps {
  h3: string;
  owner: 'none' | 'you' | 'other';
  pincode: string | null;
  clat: number; // cell centre (for "find nearest hex")
  clng: number;
}

export type HexCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon, HexFeatureProps>;

// Cosmetic gap: draw each hex shrunk toward its centroid so cells read as DISTINCT spaced
// hexagons instead of a continuous tessellation. Cosmetic only — capture uses the full cell.
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

/** Fetch the playable hex grid + current ownership as a GeoJSON FeatureCollection.
 *  `myId` lets us mark the caller's own hexes as 'you' (saffron) vs 'other'. */
export async function fetchHexes(myId: string | null): Promise<HexCollection> {
  const [hexRes, ownRes] = await Promise.all([
    supabase.from('hexes').select('h3_index, boundary, pincode, center_lat, center_lng').eq('is_active', true),
    supabase.from('hex_ownership').select('h3_index, owner_id'),
  ]);
  if (hexRes.error) throw hexRes.error;
  if (ownRes.error) throw ownRes.error;

  const ownerById = new Map<string, string>();
  for (const o of ownRes.data ?? []) ownerById.set(o.h3_index, o.owner_id);

  type Row = Pick<HexRow, 'h3_index' | 'boundary' | 'pincode' | 'center_lat' | 'center_lng'>;
  const features = (hexRes.data ?? []).map((h: Row) => {
    const ownerId = ownerById.get(h.h3_index);
    const owner: HexFeatureProps['owner'] = !ownerId ? 'none' : ownerId === myId ? 'you' : 'other';
    return {
      type: 'Feature' as const,
      geometry: insetPolygon(h.boundary as unknown as GeoJSON.Polygon, DISPLAY_SCALE),
      properties: { h3: h.h3_index, owner, pincode: h.pincode, clat: h.center_lat, clng: h.center_lng },
    };
  });

  return { type: 'FeatureCollection', features };
}
