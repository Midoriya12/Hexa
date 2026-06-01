// Friends — plain RLS'd `friendships` table (no RPC). Rows carry only ids + status; names are
// resolved via public_users. requester sends 'pending'; addressee accepts (UPDATE) or declines
// (DELETE); either party can unfriend (DELETE).
import { supabase } from './client';

export interface FriendUser {
  id: string;
  name: string;
  username: string | null;
  level: number;
  points: number;
  colour: string | null;
}
export interface FriendRequest {
  friendshipId: number;
  from: FriendUser;
}

interface PubRow {
  id: string | null;
  username: string | null;
  display_name: string | null;
  level: number | null;
  hex_colour: string | null;
  current_round_points: number | null;
}

const COLS = 'id, username, display_name, level, hex_colour, current_round_points';

function mapPublic(u: PubRow): FriendUser {
  return {
    id: u.id ?? '',
    name: u.display_name || u.username || 'Player',
    username: u.username,
    level: u.level ?? 1,
    points: u.current_round_points ?? 0,
    colour: u.hex_colour,
  };
}

async function myId(): Promise<string | null> {
  const { data } = await supabase.auth.getSession();
  return data.session?.user.id ?? null;
}

async function resolve(ids: string[]): Promise<Map<string, PubRow>> {
  if (!ids.length) return new Map();
  const { data } = await supabase.from('public_users').select(COLS).in('id', ids);
  return new Map((data ?? []).map((u) => [u.id ?? '', u as PubRow]));
}

export async function searchUsers(query: string): Promise<FriendUser[]> {
  const q = query.trim().replace(/[,()%]/g, ''); // sanitise for the PostgREST or-filter
  if (q.length < 2) return [];
  const uid = await myId();
  const { data, error } = await supabase
    .from('public_users')
    .select(`${COLS}, ghost_mode`)
    .or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
    .eq('ghost_mode', false)
    .limit(20);
  if (error) throw error;
  return (data ?? []).filter((u) => u.id !== uid).map((u) => mapPublic(u as PubRow));
}

export async function sendRequest(addresseeId: string): Promise<void> {
  const uid = await myId();
  if (!uid) return;
  const { error } = await supabase
    .from('friendships')
    .insert({ requester_id: uid, addressee_id: addresseeId, status: 'pending' });
  if (error) throw error; // 23505 (unique pair) = already friends/requested
}

export async function respondToRequest(friendshipId: number, accept: boolean): Promise<void> {
  const { error } = accept
    ? await supabase.from('friendships').update({ status: 'accepted' }).eq('id', friendshipId)
    : await supabase.from('friendships').delete().eq('id', friendshipId);
  if (error) throw error;
}

export async function listFriends(): Promise<FriendUser[]> {
  const uid = await myId();
  if (!uid) return [];
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('requester_id, addressee_id')
    .eq('status', 'accepted')
    .or(`requester_id.eq.${uid},addressee_id.eq.${uid}`);
  if (error) throw error;
  const ids = (rows ?? []).map((r) => (r.requester_id === uid ? r.addressee_id : r.requester_id));
  const map = await resolve(ids);
  return ids.map((id) => map.get(id)).filter((u): u is PubRow => !!u).map(mapPublic);
}

export async function listIncomingRequests(): Promise<FriendRequest[]> {
  const uid = await myId();
  if (!uid) return [];
  const { data: rows, error } = await supabase
    .from('friendships')
    .select('id, requester_id')
    .eq('status', 'pending')
    .eq('addressee_id', uid);
  if (error) throw error;
  const map = await resolve((rows ?? []).map((r) => r.requester_id));
  return (rows ?? [])
    .map((r) => {
      const u = map.get(r.requester_id);
      return u ? { friendshipId: r.id, from: mapPublic(u) } : null;
    })
    .filter((x): x is FriendRequest => !!x);
}
