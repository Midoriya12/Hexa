// Walk history — save a finished walk + read your own (owner-scoped RLS). Personal log only.
import { supabase } from './client';
import type { WalkRow } from '@/types/database';

export async function saveWalk(w: {
  durationS: number;
  distanceM: number;
  hexes: number;
  points: number;
}): Promise<void> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return;
  const { error } = await supabase.from('walks').insert({
    user_id: uid,
    duration_s: Math.round(w.durationS),
    distance_m: Math.round(w.distanceM),
    hexes: w.hexes,
    points: w.points,
  });
  if (error) throw error;
}

export async function fetchMyWalks(limit = 20): Promise<WalkRow[]> {
  const { data } = await supabase.auth.getSession();
  const uid = data.session?.user.id;
  if (!uid) return [];
  const { data: rows, error } = await supabase
    .from('walks')
    .select('*')
    .eq('user_id', uid)
    .order('ended_at', { ascending: false })
    .limit(limit);
  if (error) throw error;
  return rows ?? [];
}
