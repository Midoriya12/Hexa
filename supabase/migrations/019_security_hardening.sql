-- 019_security_hardening.sql — Pre-beta security fixes (audit 2026-10-06, patch #57).
--
-- Three confirmed holes, each reachable with a user's bearer token and curl:
--   (a) users_update_own allowed every column — a user could PATCH their own points, level,
--       strikes, ban flags and motion anchor; users_insert_own let a forged first row start at L5.
--   (b) "Internal" SECURITY DEFINER functions (grant_points, reset_round, add_strike, …) only did
--       REVOKE … FROM PUBLIC. Hosted Supabase grants EXECUTE on new public functions to anon +
--       authenticated by default, and an explicit role grant survives a PUBLIC revoke, so they were
--       callable through PostgREST.
--   (c) capture_hex had no server-side pacing: dwell is client-only and the 250 m teleport filter
--       never fires for adjacent hexes (~175 m apart), so a script could take ~1 hex/second.
--
-- Fixes: a column guard trigger on users (A), a per-user minimum gap + rolling-hour cap inside
-- capture_hex with a per-user advisory lock (C), and an explicit grant model: every function in
-- public is revoked from anon + authenticated, then ONLY the client-facing RPC allowlist is granted
-- back to authenticated (B). Default privileges are changed so future functions are private unless
-- granted on purpose.

-- ════════════════════════════════════════════════════════════════════════════════
-- A. users: clients may only touch cosmetic / preference columns
-- ════════════════════════════════════════════════════════════════════════════════
-- Trigger functions run as the role doing the write: 'authenticated' for a direct PostgREST
-- PATCH/INSERT, the function OWNER (postgres) inside a SECURITY DEFINER RPC. So "current_user is a
-- client role" cleanly separates untrusted writes from the economy engine without a session flag.
CREATE OR REPLACE FUNCTION guard_users_protected_columns()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_jwt_phone TEXT;
BEGIN
  IF current_user NOT IN ('authenticated', 'anon') THEN
    RETURN NEW; -- trusted path (definer RPCs, service role, migrations)
  END IF;

  IF TG_OP = 'INSERT' THEN
    -- Profile creation: the row must belong to the caller and carry the phone Supabase verified.
    v_jwt_phone := NULLIF(auth.jwt() ->> 'phone', '');
    IF v_jwt_phone IS NULL THEN RAISE EXCEPTION 'phone_required'; END IF;
    NEW.phone := '+' || ltrim(v_jwt_phone, '+');
    -- Everything the economy / anti-cheat owns starts at its default, whatever the client sent.
    NEW.level                     := 1;
    NEW.lifetime_points           := 0;
    NEW.current_round_points      := 0;
    NEW.current_streak            := 0;
    NEW.longest_streak            := 0;
    NEW.last_capture_at           := NULL;
    NEW.streak_freezes_available  := 1;
    NEW.vacation_tokens_available := 1;
    NEW.daily_cap_remaining       := 200;
    NEW.daily_cap_reset_at        := NULL;
    NEW.clan_id                   := NULL;
    NEW.clan_role                 := NULL;
    NEW.current_held_hexes        := 0;
    NEW.strikes                   := 0;
    NEW.banned_until              := NULL;
    NEW.banned_permanently        := FALSE;
    NEW.equipped_medal            := NULL;
    NEW.last_lat                  := NULL;
    NEW.last_lng                  := NULL;
    NEW.last_seen                 := NULL;
    NEW.created_at                := now();
    NEW.updated_at                := now();
    RETURN NEW;
  END IF;

  -- UPDATE: any change to a protected column from a client role is rejected outright.
  IF NEW.phone                     IS DISTINCT FROM OLD.phone
  OR NEW.level                     IS DISTINCT FROM OLD.level
  OR NEW.lifetime_points           IS DISTINCT FROM OLD.lifetime_points
  OR NEW.current_round_points      IS DISTINCT FROM OLD.current_round_points
  OR NEW.current_streak            IS DISTINCT FROM OLD.current_streak
  OR NEW.longest_streak            IS DISTINCT FROM OLD.longest_streak
  OR NEW.last_capture_at           IS DISTINCT FROM OLD.last_capture_at
  OR NEW.streak_freezes_available  IS DISTINCT FROM OLD.streak_freezes_available
  OR NEW.vacation_tokens_available IS DISTINCT FROM OLD.vacation_tokens_available
  OR NEW.daily_cap_remaining       IS DISTINCT FROM OLD.daily_cap_remaining
  OR NEW.daily_cap_reset_at        IS DISTINCT FROM OLD.daily_cap_reset_at
  OR NEW.current_held_hexes        IS DISTINCT FROM OLD.current_held_hexes
  OR NEW.strikes                   IS DISTINCT FROM OLD.strikes
  OR NEW.banned_until              IS DISTINCT FROM OLD.banned_until
  OR NEW.banned_permanently        IS DISTINCT FROM OLD.banned_permanently
  OR NEW.equipped_medal            IS DISTINCT FROM OLD.equipped_medal
  OR NEW.last_lat                  IS DISTINCT FROM OLD.last_lat
  OR NEW.last_lng                  IS DISTINCT FROM OLD.last_lng
  OR NEW.last_seen                 IS DISTINCT FROM OLD.last_seen
  OR NEW.created_at                IS DISTINCT FROM OLD.created_at THEN
    RAISE EXCEPTION 'protected_column';
  END IF;
  -- clan_id / clan_role are already guarded by users_guard_clan_id (005/006).
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_guard_protected ON users;
CREATE TRIGGER users_guard_protected
  BEFORE INSERT OR UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_users_protected_columns();

-- ════════════════════════════════════════════════════════════════════════════════
-- C. capture_hex v4 — 017's body + server-side pacing. Uses app_tz() (018) and a region-neutral
--    fallback label. Same signature, so client code and grants are unchanged.
-- ════════════════════════════════════════════════════════════════════════════════
-- Pacing model: a legitimate capture needs the 60 s in-hex dwell (patch #39, shrinking with level)
-- and hexes are >=175 m apart (patch #48), so two real captures are never closer than ~1.5 minutes
-- and a fast walker tops out near 20/hour. Limits are set loose enough never to touch a human:
--   * MIN_GAP  45 s between a user's consecutive captures            -> 'too_soon'
--   * HOUR_CAP 40 captures in any rolling 60 minutes                 -> 'rate_limited'
-- Both are checked under a per-user transaction advisory lock so parallel requests can't race past.
CREATE OR REPLACE FUNCTION capture_hex(
  p_h3 TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_mocked BOOLEAN DEFAULT FALSE
)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_hex   hexes%ROWTYPE;
  v_own   hex_ownership%ROWTYPE;
  v_owner UUID;
  v_type  TEXT := 'neutral';
  v_ip    INT  := 100;
  v_floor INT;
  v_held  INT;
  v_name  TEXT;
  v_perm     BOOLEAN;
  v_until    TIMESTAMPTZ;
  v_prev_lat DOUBLE PRECISION;
  v_prev_lng DOUBLE PRECISION;
  v_prev_t   TIMESTAMPTZ;
  v_last_cap TIMESTAMPTZ;
  v_dist_m   DOUBLE PRECISION;
  v_dt_s     DOUBLE PRECISION;
  v_kmh      DOUBLE PRECISION;
  c_min_gap  CONSTANT INTERVAL := interval '45 seconds';
  c_hour_cap CONSTANT INT := 40;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_lat IS NULL OR p_lng IS NULL OR p_lat <> p_lat OR p_lng <> p_lng
     OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'bad_coords';
  END IF;

  -- Serialise this user's captures for the rest of the transaction (released on commit/rollback).
  PERFORM pg_advisory_xact_lock(hashtext('capture:' || v_uid::text));

  -- (1) Ban gate + motion anchor + pacing read, BEFORE any write.
  SELECT banned_permanently, banned_until, last_lat, last_lng, last_seen, last_capture_at
    INTO v_perm, v_until, v_prev_lat, v_prev_lng, v_prev_t, v_last_cap
    FROM users WHERE id = v_uid;
  IF v_perm THEN RAISE EXCEPTION 'banned_permanently'; END IF;
  IF v_until IS NOT NULL AND v_until > now() THEN RAISE EXCEPTION 'banned'; END IF;

  -- (1b) Pacing: minimum gap, then rolling-hour cap. Rejected calls change nothing else.
  IF v_last_cap IS NOT NULL AND now() - v_last_cap < c_min_gap THEN
    INSERT INTO anti_cheat_events (user_id, kind, dt_s, h3)
      VALUES (v_uid, 'too_soon', EXTRACT(EPOCH FROM (now() - v_last_cap)), p_h3);
    RAISE EXCEPTION 'too_soon';
  END IF;
  IF (SELECT count(*) FROM captures
        WHERE user_id = v_uid AND captured_at > now() - interval '1 hour') >= c_hour_cap THEN
    INSERT INTO anti_cheat_events (user_id, kind, h3) VALUES (v_uid, 'rate_limited', p_h3);
    RAISE EXCEPTION 'rate_limited';
  END IF;

  -- (2) Mock-location: advisory telemetry only until attestation lands.
  IF p_mocked IS TRUE THEN
    INSERT INTO anti_cheat_events (user_id, kind, h3) VALUES (v_uid, 'mock_advisory', p_h3);
  END IF;

  -- Lock the always-present parent hex row to serialise concurrent captures of the same cell.
  SELECT * INTO v_hex FROM hexes WHERE h3_index = p_h3 AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'hex_not_found'; END IF;

  IF NOT hexa_point_in_hex(p_lat, p_lng, v_hex.boundary) THEN RAISE EXCEPTION 'outside_hex'; END IF;

  -- (3) Motion validation — coarse 2-point displacement-rate filter (017 header).
  IF v_prev_lat IS NOT NULL AND v_prev_t IS NOT NULL THEN
    v_dist_m := haversine_m(v_prev_lat, v_prev_lng, p_lat, p_lng);
    v_dt_s   := GREATEST(EXTRACT(EPOCH FROM (now() - v_prev_t)), 1);
    v_kmh    := (v_dist_m / v_dt_s) * 3.6;
    IF v_dist_m > 250 AND v_kmh > 200 THEN
      INSERT INTO anti_cheat_events (user_id, kind, dist_m, dt_s, kmh, h3)
        VALUES (v_uid, 'teleport', v_dist_m, v_dt_s, v_kmh, p_h3);
      IF v_kmh > 350 THEN RAISE EXCEPTION 'too_fast'; END IF;
      IF (SELECT count(*) FROM anti_cheat_events
            WHERE user_id = v_uid AND kind = 'teleport'
              AND created_at > now() - interval '24 hours') >= 4 THEN
        PERFORM add_strike(v_uid, 'teleport_pattern');
      END IF;
    END IF;
  END IF;

  SELECT * INTO v_own FROM hex_ownership WHERE h3_index = p_h3;
  v_owner := v_own.owner_id;

  IF v_owner = v_uid THEN RAISE EXCEPTION 'already_owned'; END IF;

  IF v_own.block_until IS NOT NULL AND v_own.block_until > now() THEN RAISE EXCEPTION 'block_cooldown'; END IF;

  IF v_owner IS NOT NULL THEN
    v_type := 'steal';
    v_ip   := 150;
    IF v_own.fresh_paint_until IS NOT NULL AND v_own.fresh_paint_until > now() THEN
      RAISE EXCEPTION 'fresh_paint';
    END IF;
    SELECT level, current_held_hexes INTO v_floor, v_held FROM users WHERE id = v_owner;
    v_floor := LEAST(GREATEST(COALESCE(v_floor, 1), 1), 5);
    IF COALESCE(v_held, 0) - 1 < v_floor THEN RAISE EXCEPTION 'protected'; END IF;
  END IF;

  INSERT INTO hex_ownership (h3_index, owner_id, captured_at, ip_value, fresh_paint_until, block_until, last_visited_at)
  VALUES (p_h3, v_uid, now(), v_ip, now() + interval '30 minutes', now() + interval '15 minutes', now())
  ON CONFLICT (h3_index) DO UPDATE
    SET owner_id          = v_uid,
        captured_at       = now(),
        ip_value          = v_ip,
        fresh_paint_until = now() + interval '30 minutes',
        block_until       = now() + interval '15 minutes',
        last_visited_at   = now();

  INSERT INTO captures (h3_index, user_id, prev_owner_id, ip_awarded, capture_type, round_id)
  VALUES (p_h3, v_uid, v_owner, v_ip, v_type, to_char(now() AT TIME ZONE app_tz(), 'YYYY-MM'));

  PERFORM grant_points(v_uid, v_ip);

  UPDATE users SET last_capture_at = now(), last_lat = p_lat, last_lng = p_lng, last_seen = now()
   WHERE id = v_uid;

  UPDATE users u SET current_held_hexes = (SELECT count(*) FROM hex_ownership WHERE owner_id = u.id)
   WHERE u.id = v_uid OR u.id = v_owner;

  IF v_type = 'steal' THEN
    SELECT COALESCE(NULLIF(btrim(display_name), ''), username, 'Someone') INTO v_name FROM users WHERE id = v_uid;
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (v_owner, 'steal', 'Hex stolen!',
            v_name || ' took your hex in ' || COALESCE(v_hex.neighbourhood, 'your area'),
            jsonb_build_object('h3', p_h3, 'by', v_uid));
  END IF;

  PERFORM check_level_up(v_uid);

  RETURN jsonb_build_object('ok', TRUE, 'h3', p_h3, 'ip', v_ip, 'type', v_type, 'stolen_from', v_owner);
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- B. Explicit grant model for every function in public
-- ════════════════════════════════════════════════════════════════════════════════
-- Future functions: private by default (the hosted default grants EXECUTE to anon/authenticated).
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public
  REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC, anon, authenticated;

DO $$
DECLARE
  r RECORD;
  -- The ONLY functions the app calls through supabase.rpc() (grep '.rpc(' in lib/ + app/).
  v_client TEXT[] := ARRAY[
    'capture_hex', 'hexes_in_bbox', 'my_rent_rate', 'mark_notifications_read', 'equip_medal',
    'user_card', 'create_clan', 'join_clan', 'leave_clan', 'disband_clan', 'request_to_join',
    'cancel_join_request', 'respond_join_request', 'kick_member', 'set_member_role', 'update_clan',
    'clan_roster', 'clan_members', 'clan_stats', 'clans_leaderboard', 'app_tz'
  ];
  v_sig TEXT;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    v_sig := r.oid::regprocedure::text;
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', v_sig);
    IF r.proname = ANY (v_client) THEN
      EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated', v_sig);
    END IF;
  END LOOP;
END $$;

-- Sanity: list anything a client role can still execute. Expect exactly the allowlist above.
DO $$
DECLARE v_names TEXT;
BEGIN
  SELECT string_agg(DISTINCT p.proname, ', ' ORDER BY p.proname) INTO v_names
  FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public' AND p.prokind = 'f'
    AND (has_function_privilege('authenticated', p.oid, 'EXECUTE')
      OR has_function_privilege('anon', p.oid, 'EXECUTE'));
  RAISE NOTICE 'Client-executable functions: %', v_names;
END $$;

NOTIFY pgrst, 'reload schema';
