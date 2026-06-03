// Public profile for any player — used by the tappable profile screen (from friends, feed,
// leaderboard, clan roster). Backed by the user_card RPC (SECURITY DEFINER) so we can show the
// player's CLAN (name/role — hidden from public_users) and the viewer's FRIENDSHIP status in one
// round-trip, alongside public stats. current_held_hexes stays private; lifetime captures is public.
import { supabase } from './client';

export type FriendStatus = 'none' | 'friends' | 'incoming' | 'outgoing';

export interface UserProfile {
  id: string;
  name: string;
  username: string | null;
  level: number;
  points: number;
  colour: string | null;
  captures: number;
  clanId: string | null;
  clanName: string | null;
  clanRole: string | null;
  /** Relationship of the SIGNED-IN viewer to this profile. */
  friendship: FriendStatus;
  /** The friendships row id (for accepting an incoming request); null if none. */
  friendshipId: number | null;
  /** True when you're looking at your own profile. */
  isYou: boolean;
}

export async function fetchUserProfile(id: string): Promise<UserProfile | null> {
  const { data: s } = await supabase.auth.getSession();
  const me = s.session?.user.id ?? null;

  const { data, error } = await supabase.rpc('user_card', { p_id: id });
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;

  return {
    id: row.id ?? id,
    name: row.display_name || row.username || 'Player',
    username: row.username,
    level: row.level ?? 1,
    points: row.current_round_points ?? 0,
    colour: row.hex_colour,
    captures: Number(row.captures ?? 0),
    clanId: row.clan_id ?? null,
    clanName: row.clan_name ?? null,
    clanRole: row.clan_role ?? null,
    friendship: (row.friendship ?? 'none') as FriendStatus,
    friendshipId: row.friendship_id != null ? Number(row.friendship_id) : null,
    isYou: me != null && me === (row.id ?? id),
  };
}
