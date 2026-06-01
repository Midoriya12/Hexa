// Friendly row-type aliases derived from the generated Supabase types.
// Regenerate the source with: supabase gen types typescript --linked > types/supabase.ts
import type { Tables } from './supabase';

export type { Database, Json } from './supabase';

/** The current user's own `users` row (owner reads all columns via RLS). */
export type UserRow = Tables<'users'>;

/** The 8 safe columns exposed via the public_users view (cross-user reads). */
export type PublicUserRow = Tables<'public_users'>;

/** One static playable H3 cell (seeded grid; clients read-only). */
export type HexRow = Tables<'hexes'>;

/** A finished walk session (owner-only personal log). */
export type WalkRow = Tables<'walks'>;

/** A clan (read-only to clients; mutated via create/join/leave RPCs). */
export type ClanRow = Tables<'clans'>;

/** A friendship row (pending/accepted; plain RLS'd). */
export type FriendshipRow = Tables<'friendships'>;
