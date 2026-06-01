// Activity feed — real recent captures (spec: capture/clan activity, NOT free-form posts).
// Joins captures → public_users (capturer) + hexes (neighbourhood) client-side (all three are
// authenticated-readable). No new table needed.
import { supabase } from './client';

export interface FeedItem {
  id: number;
  name: string;
  level: number;
  colour: string | null;
  neighbourhood: string;
  ip: number;
  capturedAt: string;
  stolen: boolean;
}

export async function fetchFeed(limit = 40): Promise<FeedItem[]> {
  const { data: caps, error } = await supabase
    .from('captures')
    .select('id, h3_index, user_id, prev_owner_id, ip_awarded, captured_at')
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  if (!caps?.length) return [];

  const userIds = [...new Set(caps.map((c) => c.user_id))];
  const h3s = [...new Set(caps.map((c) => c.h3_index))];
  const [{ data: users }, { data: hexes }] = await Promise.all([
    supabase.from('public_users').select('id, display_name, username, level, hex_colour').in('id', userIds),
    supabase.from('hexes').select('h3_index, neighbourhood').in('h3_index', h3s),
  ]);
  const uMap = new Map((users ?? []).map((u) => [u.id, u]));
  const hMap = new Map((hexes ?? []).map((h) => [h.h3_index, h.neighbourhood]));

  return caps.map((c) => {
    const u = uMap.get(c.user_id);
    return {
      id: c.id,
      name: u?.display_name || u?.username || 'Player',
      level: u?.level ?? 1,
      colour: u?.hex_colour ?? null,
      neighbourhood: hMap.get(c.h3_index) || 'Bengaluru',
      ip: c.ip_awarded,
      capturedAt: c.captured_at,
      stolen: !!c.prev_owner_id,
    };
  });
}
