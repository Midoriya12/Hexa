// Public profile for any player — used by the tappable profile screen (from friends, feed,
// leaderboard). Only public stats: name, level, Round Points, lifetime hexes captured, colour.
// (current_held_hexes stays private; lifetime captures is the public number.)
import { supabase } from './client';

export interface UserProfile {
  id: string;
  name: string;
  username: string | null;
  level: number;
  points: number;
  colour: string | null;
  captures: number;
}

export async function fetchUserProfile(id: string): Promise<UserProfile | null> {
  const { data: u, error } = await supabase
    .from('public_users')
    .select('id, username, display_name, level, hex_colour, current_round_points')
    .eq('id', id)
    .maybeSingle();
  if (error) throw error;
  if (!u) return null;
  const { count } = await supabase
    .from('captures')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', id);
  return {
    id: u.id ?? id,
    name: u.display_name || u.username || 'Player',
    username: u.username,
    level: u.level ?? 1,
    points: u.current_round_points ?? 0,
    colour: u.hex_colour,
    captures: count ?? 0,
  };
}
