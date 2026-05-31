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

async function load(): Promise<HexCollection> {
  const { data, error } = await supabase
    .from('hexes')
    .select('h3_index, boundary, pincode')
    .eq('is_active', true);
  if (error) throw error;

  const features = (data ?? []).map((h: Pick<HexRow, 'h3_index' | 'boundary' | 'pincode'>) => ({
    type: 'Feature' as const,
    // boundary is stored as a GeoJSON Polygon ({ type, coordinates:[[ [lng,lat]… ]] }).
    geometry: h.boundary as unknown as GeoJSON.Polygon,
    properties: { h3: h.h3_index, owner: 'none' as const, pincode: h.pincode },
  }));

  return { type: 'FeatureCollection', features };
}

/** Fetch the playable hex grid as a GeoJSON FeatureCollection (cached for the session). */
export function fetchHexes(force = false): Promise<HexCollection> {
  if (!cache || force) cache = load();
  return cache;
}
