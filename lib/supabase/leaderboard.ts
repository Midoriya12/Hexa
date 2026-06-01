// Leaderboard reads — rank players by Round Points (the competitive number, per spec 2.4).
// Sourced from the public_users view (safe columns only); real data, replaces the Play mocks.
import { supabase } from './client';

export interface LeaderPlayer {
  id: string;
  name: string;
  level: number;
  points: number;
  colour: string | null;
}

export async function fetchTopPlayers(limit = 50): Promise<LeaderPlayer[]> {
  const { data, error } = await supabase
    .from('public_users')
    .select('id, display_name, username, level, current_round_points, hex_colour')
    .order('current_round_points', { ascending: false, nullsFirst: false })
    .limit(limit);
  if (error) throw error;
  return (data ?? []).map((u) => ({
    id: u.id ?? '',
    name: u.display_name || u.username || 'Player',
    level: u.level ?? 1,
    points: u.current_round_points ?? 0,
    colour: u.hex_colour ?? null,
  }));
}
