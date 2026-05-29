// Hand-written row types for Phase 1. Will be replaced by `supabase gen types
// typescript --linked > types/database.ts` once the CLI is linked to the project.

/** The current user's own `users` row (full — owner reads all columns via RLS). */
export interface UserRow {
  id: string;
  phone: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  hex_colour: string;
  level: number;
  lifetime_points: number;
  current_round_points: number;
  current_streak: number;
  longest_streak: number;
  last_capture_at: string | null;
  streak_freezes_available: number;
  vacation_tokens_available: number;
  pincode: string | null;
  home_neighbourhood: string | null;
  language_pref: 'en' | 'hi' | 'kn' | 'ta' | 'te';
  ghost_mode: boolean;
  notification_prefs: Record<string, boolean>;
  daily_cap_remaining: number;
  daily_cap_reset_at: string | null;
  clan_id: string | null;
  current_held_hexes: number;
  strikes: number;
  banned_until: string | null;
  banned_permanently: boolean;
  device_fingerprint: string | null;
  flags: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

/** The 8 safe columns exposed via the public_users view (cross-user reads). */
export interface PublicUserRow {
  id: string;
  username: string | null;
  display_name: string | null;
  avatar_url: string | null;
  level: number;
  hex_colour: string;
  current_round_points: number;
  ghost_mode: boolean;
}
