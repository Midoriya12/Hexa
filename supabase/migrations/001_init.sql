-- 001_init.sql — Hexa Phase 1 (Foundation & Auth), first migration.
-- Authority: Spec Patches > v3 Design Spec > Build Spec PDF.
-- Creates ONLY what Phase 1 needs: the users table + RLS + the public_users view.
-- Later tables (hexes, zone_ownership, captures, medals, clans, paths, …) land in their phases.
--
-- Patches applied here:
--   #5  — users RLS rewrite: no broad SELECT; owner-only base access; public_users view for cross-user reads.
--   #7  — daily_cap_remaining default 200 (L1 cap, not a flat 800).
--   #23 — language_pref CHECK closing paren fixed (build spec §4 line ~515 was malformed).
--   #25 — public_users security model: definer view, 8-col allowlist, GRANT to authenticated only (never anon);
--         users_insert_own policy added; set_updated_at search_path pinned.
--   #27 — postgis + h3 extensions deferred to the Phase 3 migration (users needs only uuid-ossp; h3 is not
--         reliably available on Supabase without dashboard enablement, and must not be able to abort signup).

-- ── Extensions ───────────────────────────────────────────────────────────────
-- Only uuid-ossp here (uuid_generate_v4() default for users.id). postgis + h3 → Phase 3 (patch #27).
CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA extensions;

-- ── users ────────────────────────────────────────────────────────────────────
-- id IS the Supabase Auth user id (auth.users.id), 1:1, cascade on auth delete.
-- This makes auth.uid() = users.id, which every RLS policy below relies on.
CREATE TABLE users (
  id                         UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  phone                      TEXT UNIQUE NOT NULL,
  username                   TEXT UNIQUE,
  display_name               TEXT,
  avatar_url                 TEXT,
  hex_colour                 TEXT DEFAULT '#FF6F00',                       -- saffron default
  level                      INT DEFAULT 1 CHECK (level BETWEEN 1 AND 5),
  lifetime_points            BIGINT DEFAULT 0,
  current_round_points       INT DEFAULT 0,
  current_streak             INT DEFAULT 0,
  longest_streak             INT DEFAULT 0,
  last_capture_at            TIMESTAMPTZ,
  streak_freezes_available   INT DEFAULT 1,
  vacation_tokens_available  INT DEFAULT 1,
  pincode                    TEXT,                                         -- Bangalore 560001-560103, enforced in app code (no DB CHECK per spec)
  home_neighbourhood         TEXT,
  -- patch #23: build spec §4 omitted the CHECK closing paren + trailing comma. Corrected here.
  language_pref              TEXT DEFAULT 'en' CHECK (language_pref IN ('en','hi','kn','ta','te')),
  ghost_mode                 BOOLEAN DEFAULT FALSE,
  notification_prefs         JSONB DEFAULT '{"steal":true,"streak":true,"daily":true}',
  daily_cap_remaining        INT DEFAULT 200,                              -- patch #7: L1 cap = 200
  daily_cap_reset_at         TIMESTAMPTZ,
  clan_id                    UUID,                                         -- no FK: clans table ships Phase 11 (intentional)
  current_held_hexes         INT DEFAULT 0,
  strikes                    INT DEFAULT 0 CHECK (strikes BETWEEN 0 AND 3),
  banned_until               TIMESTAMPTZ,
  banned_permanently         BOOLEAN DEFAULT FALSE,
  device_fingerprint         TEXT,
  flags                      JSONB DEFAULT '{}',
  created_at                 TIMESTAMPTZ DEFAULT now(),
  updated_at                 TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX users_pincode_idx      ON users(pincode) WHERE banned_permanently = FALSE;
CREATE INDEX users_round_points_idx ON users(current_round_points DESC);
CREATE INDEX users_clan_idx         ON users(clan_id);

-- ── updated_at trigger ───────────────────────────────────────────────────────
-- The column DEFAULT only covers INSERT; this keeps updated_at honest on UPDATE.
-- search_path pinned to '' (patch #25 / Supabase linter function_search_path_mutable);
-- now() resolves from pg_catalog, which is always on the path.
CREATE OR REPLACE FUNCTION set_updated_at()
  RETURNS TRIGGER
  LANGUAGE plpgsql
  SET search_path = ''
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER users_set_updated_at
  BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ── Row Level Security (patches #5, #25) ─────────────────────────────────────
-- Build spec §4 had users_read_own + users_read_others_limited USING(TRUE); permissive SELECT
-- policies OR together, so USING(TRUE) leaks phone/ban status/device_fingerprint to every reader.
-- Here: the base table is OWNER-ONLY for all of SELECT/INSERT/UPDATE; cross-user reads go through
-- the public_users view (8 safe columns). Table privileges are granted to `authenticated` only;
-- RLS then scopes every row to auth.uid() = id. `anon` gets nothing on users.
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

CREATE POLICY users_select_own ON users
  FOR SELECT TO authenticated USING (auth.uid() = id);

CREATE POLICY users_update_own ON users
  FOR UPDATE TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

-- Without this, the client-side profile-setup INSERT is rejected by RLS. WITH CHECK ties the new
-- row to the caller's auth uid, so a user cannot forge another user's row. (Build spec omitted it.)
CREATE POLICY users_insert_own ON users
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- No DELETE policy for MVP (account deletion is a later, service-role flow).

-- Table privileges. RLS filters rows; GRANT controls whether the role may touch the table at all.
-- authenticated may read/insert/update ONLY their own row (enforced by the policies above).
GRANT SELECT, INSERT, UPDATE ON TABLE users TO authenticated;

-- ── public_users view (patches #5, #25) ──────────────────────────────────────
-- The SOLE cross-user read surface. Exposes exactly 8 columns deemed safe for cross-user reads —
-- no phone, no ban status, no device_fingerprint, no flags. Runs with the view owner's rights
-- (definer; the default for views) so it bypasses the owner-only base-table RLS; the column
-- allowlist IS the privacy boundary. Granted to `authenticated` ONLY — never `anon`.
-- ghost_mode is exposed (per patch #5) so leaderboard/feed queries can filter WHERE ghost_mode = FALSE;
-- those cross-user surfaces MUST apply that filter (first one lands in Phase 7).
CREATE VIEW public_users AS
  SELECT
    id,
    username,
    display_name,
    avatar_url,
    level,
    hex_colour,
    current_round_points,
    ghost_mode
  FROM users;

GRANT SELECT ON public_users TO authenticated;
