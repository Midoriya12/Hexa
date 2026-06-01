// Activity feed — real recent captures (spec: capture/clan activity, NOT free-form posts).
// Joins captures → public_users (capturer) + hexes (neighbourhood) client-side (all three are
// authenticated-readable). No new table needed.
import { supabase } from './client';

export interface FeedItem {
  id: number;
  userId: string;
  name: string;
  level: number;
  colour: string | null;
  neighbourhood: string;
  ip: number;
  capturedAt: string;
  stolen: boolean;
}

interface CaptureRow {
  id: number;
  h3_index: string;
  user_id: string;
  prev_owner_id: string | null;
  ip_awarded: number;
  captured_at: string;
}

/** Resolve capture rows → feed items (capturer name + hex neighbourhood). Shared by both feeds. */
async function mapCaptures(caps: CaptureRow[]): Promise<FeedItem[]> {
  if (!caps.length) return [];
  const userIds = [...new Set(caps.map((c) => c.user_id))];
  const h3s = [...new Set(caps.map((c) => c.h3_index))];
  const [{ data: users }, { data: hexes }] = await Promise.all([
    supabase.from('public_users').select('id, display_name, username, level, hex_colour, ghost_mode').in('id', userIds),
    supabase.from('hexes').select('h3_index, neighbourhood').in('h3_index', h3s),
  ]);
  const uMap = new Map((users ?? []).map((u) => [u.id, u]));
  const hMap = new Map((hexes ?? []).map((h) => [h.h3_index, h.neighbourhood]));
  return caps
    .filter((c) => !uMap.get(c.user_id)?.ghost_mode) // ghost mode hides you from the feed
    .map((c) => {
      const u = uMap.get(c.user_id);
      return {
        id: c.id,
        userId: c.user_id,
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

export async function fetchFeed(limit = 40): Promise<FeedItem[]> {
  const { data: caps, error } = await supabase
    .from('captures')
    .select('id, h3_index, user_id, prev_owner_id, ip_awarded, captured_at')
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return mapCaptures(caps ?? []);
}

/** Following feed — captures by your accepted friends. */
export async function fetchFollowingFeed(limit = 40): Promise<FeedItem[]> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return [];
  const { data: rows } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
  const friendIds = (rows ?? []).map((r) => (r.requester_id === uid ? r.addressee_id : r.requester_id));
  if (!friendIds.length) return [];
  const { data: caps, error } = await supabase
    .from('captures')
    .select('id, h3_index, user_id, prev_owner_id, ip_awarded, captured_at')
    .in('user_id', friendIds)
    .order('captured_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return mapCaptures(caps ?? []);
}
