// Clans — create/join/leave go through SECURITY DEFINER RPCs (clans table is read-only to
// clients; the 100-cap is enforced server-side). Reads (my clan, discovery list) are plain
// table selects; the roster comes from the clan_members() RPC (public_users has no clan_id).
import { supabase } from './client';

export interface Clan {
  id: string;
  name: string;
  colour: string | null;
  ownerId: string | null;
  memberCount: number;
}

export interface ClanMember {
  id: string;
  name: string;
  level: number;
  points: number;
  colour: string | null;
  isOwner: boolean;
  you: boolean;
}

type ClanRpc = { ok: boolean; clan_id?: string; member_count?: number; disbanded?: boolean };

export async function createClan(name: string, colour: string): Promise<ClanRpc> {
  const { data, error } = await supabase.rpc('create_clan', { p_name: name, p_colour: colour });
  if (error) throw error; // 'already_in_clan' | 'bad_name'
  return data as unknown as ClanRpc;
}

export async function joinClan(clanId: string): Promise<ClanRpc> {
  const { data, error } = await supabase.rpc('join_clan', { p_clan_id: clanId });
  if (error) throw error; // 'already_in_clan' | 'clan_not_found' | 'clan_full'
  return data as unknown as ClanRpc;
}

export async function leaveClan(): Promise<ClanRpc> {
  const { data, error } = await supabase.rpc('leave_clan');
  if (error) throw error; // 'not_in_clan'
  return data as unknown as ClanRpc;
}

/** The caller's clan, or null if they're not in one. `clanId` may be passed from the user store. */
export async function fetchMyClan(clanId: string | null | undefined): Promise<Clan | null> {
  if (!clanId) return null;
  const { data, error } = await supabase
    .from('clans')
    .select('id, name, colour, owner_id, member_count')
    .eq('id', clanId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  return { id: data.id, name: data.name, colour: data.colour, ownerId: data.owner_id, memberCount: data.member_count };
}

export async function listClans(limit = 50): Promise<Clan[]> {
  const { data, error } = await supabase
    .from('clans')
    .select('id, name, colour, owner_id, member_count')
    .order('member_count', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    colour: c.colour,
    ownerId: c.owner_id,
    memberCount: c.member_count,
  }));
}

export async function fetchClanMembers(clan: Clan): Promise<ClanMember[]> {
  const { data: s } = await supabase.auth.getSession();
  const uid = s.session?.user.id;
  const { data, error } = await supabase.rpc('clan_members', { p_clan_id: clan.id });
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id ?? '',
    name: u.display_name || u.username || 'Player',
    level: u.level ?? 1,
    points: u.current_round_points ?? 0,
    colour: u.hex_colour ?? null,
    isOwner: u.id === clan.ownerId,
    you: u.id === uid,
  }));
}
