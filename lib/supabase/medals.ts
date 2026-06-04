// Medals — real definitions (migration 013 `medals`) + which the user has earned (`user_medals`).
// Replaces the old hardcoded mock. Used by the Medals screen + profile.
import { supabase } from './client';

export type MedalTier = 'bronze' | 'silver' | 'gold' | 'platinum';

export interface UserMedal {
  id: string;
  name: string;
  tier: MedalTier;
  lpReward: number;
  description: string;
  earned: boolean;
  earnedAt: string | null;
}

/** Medal definitions tagged with the given user's progress (defaults to the signed-in user). */
export async function fetchMedals(userId?: string): Promise<UserMedal[]> {
  let uid = userId ?? null;
  if (!uid) {
    const { data: s } = await supabase.auth.getSession();
    uid = s.session?.user.id ?? null;
  }
  const [{ data: defs }, earnedRes] = await Promise.all([
    supabase.from('medals').select('id, name, tier, lp_reward, description, sort').order('sort'),
    uid
      ? supabase.from('user_medals').select('medal_id, earned_at').eq('user_id', uid)
      : Promise.resolve({ data: [] as { medal_id: string; earned_at: string }[] }),
  ]);
  const earnedMap = new Map((earnedRes.data ?? []).map((e) => [e.medal_id, e.earned_at]));
  return (defs ?? []).map((d) => ({
    id: d.id,
    name: d.name,
    tier: d.tier as MedalTier,
    lpReward: d.lp_reward,
    description: d.description,
    earned: earnedMap.has(d.id),
    earnedAt: earnedMap.get(d.id) ?? null,
  }));
}
