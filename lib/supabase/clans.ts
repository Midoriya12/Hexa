// Clans — full governance data layer. All mutations go through SECURITY DEFINER RPCs (clans /
// users.clan_id / clan_role are not client-writable); reads are plain selects or definer RPCs
// for cross-user aggregates (stats, leaderboard, roster-with-roles).
import { supabase } from './client';

export type ClanRole = 'president' | 'vp' | 'senior' | 'member';

export interface Clan {
  id: string;
  name: string;
  colour: string | null;
  ownerId: string | null;
  memberCount: number;
  description: string;
  minPoints: number;
  minHexes: number;
}

export interface ClanMember {
  id: string;
  name: string;
  username: string | null;
  level: number;
  points: number;
  colour: string | null;
  role: ClanRole;
  isOwner: boolean;
  you: boolean;
}

export interface ClanStats {
  memberCount: number;
  totalPoints: number;
  totalHexes: number;
}

export interface ClanLbRow {
  rank: number;
  id: string;
  name: string;
  colour: string | null;
  memberCount: number;
  totalPoints: number;
  totalHexes: number;
}

export interface JoinRequest {
  id: number;
  user: { id: string; name: string; username: string | null; level: number; points: number; colour: string | null };
}

export interface ClanMessage {
  id: number;
  userId: string;
  name: string;
  colour: string | null;
  body: string;
  createdAt: string;
}

export const CLAN_COST = 1500;

/** Map an RPC error code to a friendly message for toasts. */
export function clanError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? '';
  if (m.includes('insufficient_points')) return `You need ${CLAN_COST.toLocaleString('en-IN')} points to found a clan.`;
  if (m.includes('clan_full')) return 'That clan is full (100 members).';
  if (m.includes('already_in_clan')) return "You're already in a clan.";
  if (m.includes('below_min_points')) return "You don't meet the clan's points requirement.";
  if (m.includes('below_min_hexes')) return "You don't meet the clan's hex requirement.";
  if (m.includes('bad_name')) return 'Pick a clan name (1–40 characters).';
  if (m.includes('forbidden')) return "You don't have permission for that.";
  if (m.includes('transfer_required')) return 'Transfer the presidency before stepping down.';
  if (m.includes('requester_in_clan')) return 'That player already joined a clan.';
  if (m.includes('23505')) return 'Already requested.';
  return 'Something went wrong. Try again.';
}

// ── Mutations (RPCs) ─────────────────────────────────────────────────────────
export async function createClan(name: string, colour: string, description = '', minPoints = 0, minHexes = 0) {
  const { data, error } = await supabase.rpc('create_clan', {
    p_name: name,
    p_colour: colour,
    p_description: description,
    p_min_points: minPoints,
    p_min_hexes: minHexes,
  });
  if (error) throw error;
  return data as unknown as { clan_id: string };
}

export async function requestToJoin(clanId: string) {
  const { error } = await supabase.rpc('request_to_join', { p_clan_id: clanId });
  if (error) throw error;
}
export async function cancelJoinRequest(requestId: number) {
  const { error } = await supabase.rpc('cancel_join_request', { p_request_id: requestId });
  if (error) throw error;
}
export async function respondJoinRequest(requestId: number, accept: boolean) {
  const { error } = await supabase.rpc('respond_join_request', { p_request_id: requestId, p_accept: accept });
  if (error) throw error;
}
export async function kickMember(targetId: string) {
  const { error } = await supabase.rpc('kick_member', { p_target_user_id: targetId });
  if (error) throw error;
}
export async function setMemberRole(targetId: string, role: ClanRole) {
  const { error } = await supabase.rpc('set_member_role', { p_target_user_id: targetId, p_role: role });
  if (error) throw error;
}
export async function updateClan(patch: { name?: string; description?: string; colour?: string; minPoints?: number; minHexes?: number }) {
  const { error } = await supabase.rpc('update_clan', {
    p_name: patch.name ?? undefined,
    p_description: patch.description ?? undefined,
    p_colour: patch.colour ?? undefined,
    p_min_points: patch.minPoints ?? undefined,
    p_min_hexes: patch.minHexes ?? undefined,
  });
  if (error) throw error;
}
export async function disbandClan() {
  const { error } = await supabase.rpc('disband_clan');
  if (error) throw error;
}
export async function leaveClan() {
  const { error } = await supabase.rpc('leave_clan');
  if (error) throw error;
}

// ── Reads ────────────────────────────────────────────────────────────────────
export async function fetchMyClan(clanId: string | null | undefined): Promise<Clan | null> {
  if (!clanId) return null;
  const { data, error } = await supabase
    .from('clans')
    .select('id, name, colour, owner_id, member_count, description, min_points, min_hexes')
    .eq('id', clanId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return {
    id: data.id,
    name: data.name,
    colour: data.colour,
    ownerId: data.owner_id,
    memberCount: data.member_count,
    description: data.description,
    minPoints: data.min_points,
    minHexes: data.min_hexes,
  };
}

export async function listClans(limit = 50): Promise<Clan[]> {
  const { data, error } = await supabase
    .from('clans')
    .select('id, name, colour, owner_id, member_count, description, min_points, min_hexes')
    .order('member_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id, name: c.name, colour: c.colour, ownerId: c.owner_id, memberCount: c.member_count,
    description: c.description, minPoints: c.min_points, minHexes: c.min_hexes,
  }));
}

export async function fetchClanMembers(clan: Clan): Promise<ClanMember[]> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  const { data, error } = await supabase.rpc('clan_roster', { p_clan_id: clan.id });
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id ?? '',
    name: u.display_name || u.username || 'Player',
    username: u.username,
    level: u.level ?? 1,
    points: u.current_round_points ?? 0,
    colour: u.hex_colour,
    role: (u.clan_role ?? 'member') as ClanRole,
    isOwner: u.id === clan.ownerId,
    you: u.id === uid,
  }));
}

export async function fetchClanStats(clanId: string): Promise<ClanStats | null> {
  const { data, error } = await supabase.rpc('clan_stats', { p_clan_id: clanId });
  if (error) throw error;
  const row = data?.[0];
  if (!row) return null;
  return { memberCount: row.member_count, totalPoints: Number(row.total_points), totalHexes: Number(row.total_hexes) };
}

export async function fetchClansLeaderboard(limit = 50): Promise<ClanLbRow[]> {
  const { data, error } = await supabase.rpc('clans_leaderboard', { p_limit: limit, p_offset: 0 });
  if (error) throw error;
  return (data ?? []).map((c) => ({
    rank: Number(c.rank),
    id: c.clan_id,
    name: c.name,
    colour: c.colour,
    memberCount: c.member_count,
    totalPoints: Number(c.total_points),
    totalHexes: Number(c.total_hexes),
  }));
}

export async function listJoinRequests(): Promise<JoinRequest[]> {
  const { data: rows, error } = await supabase
    .from('clan_join_requests')
    .select('id, user_id')
    .eq('status', 'pending')
    .order('created_at', { ascending: true });
  if (error) throw error;
  const ids = (rows ?? []).map((r) => r.user_id);
  if (!ids.length) return [];
  const { data: users } = await supabase
    .from('public_users')
    .select('id, username, display_name, level, hex_colour, current_round_points')
    .in('id', ids);
  const map = new Map((users ?? []).map((u) => [u.id, u]));
  return (rows ?? [])
    .map((r) => {
      const u = map.get(r.user_id);
      return u
        ? {
            id: r.id,
            user: {
              id: u.id ?? r.user_id,
              name: u.display_name || u.username || 'Player',
              username: u.username,
              level: u.level ?? 1,
              points: u.current_round_points ?? 0,
              colour: u.hex_colour,
            },
          }
        : null;
    })
    .filter((x): x is JoinRequest => !!x);
}

// ── Chat ───────────────────────────────────────────────────────────────────
export async function postMessage(clanId: string, body: string): Promise<void> {
  const text = body.trim();
  if (!text) return;
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  if (!uid) return;
  // RLS verifies clan_id matches the caller's own users.clan_id + user_id = auth.uid().
  const { error } = await supabase.from('clan_messages').insert({ clan_id: clanId, user_id: uid, body: text });
  if (error) throw error;
}

export async function fetchMessages(clanId: string, limit = 50): Promise<ClanMessage[]> {
  const { data: rows, error } = await supabase
    .from('clan_messages')
    .select('id, user_id, body, created_at')
    .eq('clan_id', clanId)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  const ids = [...new Set((rows ?? []).map((r) => r.user_id))];
  const { data: users } = ids.length
    ? await supabase.from('public_users').select('id, display_name, username, hex_colour').in('id', ids)
    : { data: [] };
  const map = new Map((users ?? []).map((u) => [u.id, u]));
  return (rows ?? [])
    .map((r) => {
      const u = map.get(r.user_id);
      return {
        id: r.id,
        userId: r.user_id,
        name: u?.display_name || u?.username || 'Player',
        colour: u?.hex_colour ?? null,
        body: r.body,
        createdAt: r.created_at,
      };
    })
    .reverse(); // oldest → newest for chat display
}
