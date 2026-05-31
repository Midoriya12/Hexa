// Hex grid reads. The playable grid is static seeded data (scripts/generate-hexes.mjs),
// so we fetch it once and cache the resulting GeoJSON for the app session — both the Play
// and Start maps share this single fetch.
import { supabase } from './client';
import type { HexRow } from '@/types/database';

/** Per-feature properties carried on each hex polygon. `owner` drives the fill/outline
 *  colour expression on the map; for now every hex is unowned ('none'). Ownership is wired
 *  in Step B (capture). `h3` is promoted to the Mapbox feature id for feature-state later. */
export interface HexFeatureProps {
  h3: string;
  owner: 'none' | 'you' | 'other';
  pincode: string | null;
}

export type HexCollection = GeoJSON.FeatureCollection<GeoJSON.Polygon, HexFeatureProps>;

let cache: Promise<HexCollection> | null = null;

// Cosmetic gap: draw each hex shrunk toward its centroid so cells read as DISTINCT spaced
// hexagons instead of a continuous H3 tessellation (which shares edges and looks like a mesh).
// Purely visual — the true full cell is what gets captured, so the gaps aren't dead space.
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

async function load(): Promise<HexCollection> {
  const { data, error } = await supabase
    .from('hexes')
    .select('h3_index, boundary, pincode')
    .eq('is_active', true);
  if (error) throw error;

  const features = (data ?? []).map((h: Pick<HexRow, 'h3_index' | 'boundary' | 'pincode'>) => ({
    type: 'Feature' as const,
    // boundary is stored as a GeoJSON Polygon ({ type, coordinates:[[ [lng,lat]… ]] }); inset for display.
    geometry: insetPolygon(h.boundary as unknown as GeoJSON.Polygon, DISPLAY_SCALE),
    properties: { h3: h.h3_index, owner: 'none' as const, pincode: h.pincode },
  }));

  return { type: 'FeatureCollection', features };
}

/** Fetch the playable hex grid as a GeoJSON FeatureCollection (cached for the session). */
export function fetchHexes(force = false): Promise<HexCollection> {
  if (!cache || force) cache = load();
  return cache;
}
