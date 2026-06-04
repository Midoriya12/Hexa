-- 017_anticheat.sql — Hexa Phase 8 (Anti-cheat), part 1: the ENFORCEABLE server core.
-- Scope (Sai 2026-06-04): "Light guardrails + device attestation." This migration ships the part
-- that needs ZERO external setup and enforces immediately: a coarse server speed/teleport filter,
-- a warn-first strikes→ban ladder, a ban gate on capture + rent, and a mock-location advisory hook.
-- Device attestation (Play Integrity / App Attest) is a LATER migration gated on Sai's Firebase +
-- Apple-account setup; the 4th capture_hex arg here is the wire-format placeholder for it.
--
-- HONEST FRAMING (per the design review): capture_hex has NO server-side dwell — a scripted client
-- can call this RPC directly and PACE its hops to stay under the speed ceiling. So this motion check
-- is a coarse displacement-rate filter, NOT proof of walking. The real spoofer defence is
-- attestation (part 2). Thresholds are deliberately FORGIVING to never ban a real player:
--   • flag (log only)        : > 250 m AND > 200 km/h   (above all Bangalore ground transit)
--   • hard reject (too_fast) : > 350 km/h               (no ground transit reaches this)
--   • auto-strike            : ≥ 4 flagged hops / rolling 24h  (a PATTERN, never a single read)
--   • bans                   : strike 1 = warn · strike 2 = 7-day temp · strike 3 = permanent
--   • strike decay           : forgive ≤ 1 prior strike per ~14 clean days

-- ── (a) motion anchor: the raw last validated fix (NOT the hex centroid — adjacent res-10 centroids
--        sit ~130-150m apart and would manufacture phantom speed). Dedicated columns because the
--        streak trigger (013) consumes the prior last_capture_at before we could read it. ─────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lat  DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_lng  DOUBLE PRECISION;
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen TIMESTAMPTZ;

-- ── (b) anti_cheat_events: durable per-signal audit log. Definer-only (RLS on, no policy/grant),
--        same pattern as rent_runs (012). Indexed for the rolling-24h count under the hex lock. ──
CREATE TABLE IF NOT EXISTS anti_cheat_events (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind       TEXT NOT NULL,                 -- 'teleport' | 'mock_advisory' | 'attest_debt'
  dist_m     DOUBLE PRECISION,
  dt_s       DOUBLE PRECISION,
  kmh        DOUBLE PRECISION,
  h3         TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  reviewed   BOOLEAN NOT NULL DEFAULT FALSE
);
ALTER TABLE anti_cheat_events ENABLE ROW LEVEL SECURITY; -- no policy/grant → only definer fns touch it
CREATE INDEX IF NOT EXISTS anti_cheat_events_user_recent_idx
  ON anti_cheat_events (user_id, created_at DESC);

-- ── (c) haversine helper (metres). search_path '' + pg_catalog-qualified so it's linter-clean. ──
CREATE OR REPLACE FUNCTION haversine_m(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
                                       lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE sql IMMUTABLE SET search_path = '' AS $$
  SELECT 6371000 * 2 * pg_catalog.asin(pg_catalog.sqrt(
    pg_catalog.power(pg_catalog.sin(pg_catalog.radians(lat2 - lat1) / 2), 2)
    + pg_catalog.cos(pg_catalog.radians(lat1)) * pg_catalog.cos(pg_catalog.radians(lat2))
    * pg_catalog.power(pg_catalog.sin(pg_catalog.radians(lng2 - lng1) / 2), 2)));
$$;

-- ── (d) add_strike: warn-first escalation with gamed-proof decay. Definer-only (called via PERFORM
--        from capture_hex). The whole body is wrapped so an anti-cheat bookkeeping failure can NEVER
--        abort a legitimate capture write. strikes is clamped to the CHECK(0-3) ceiling. ──────────
CREATE OR REPLACE FUNCTION add_strike(p_uid UUID, p_reason TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_strikes INT;
  v_last    TIMESTAMPTZ;
  v_decay   INT;
  v_new     INT;
BEGIN
  BEGIN
    SELECT strikes, NULLIF(flags->>'last_strike_at', '')::timestamptz
      INTO v_strikes, v_last
      FROM users WHERE id = p_uid FOR UPDATE;

    -- Decay the EFFECTIVE level by ≤1 per ~14 clean days since the last strike, then add this one.
    -- (A slow-drip cheater — one impossible hop every fortnight — still escalates, never resets.)
    v_decay := CASE WHEN v_last IS NULL THEN 0
                    ELSE floor(EXTRACT(EPOCH FROM (now() - v_last)) / (14 * 86400))::int END;
    v_strikes := GREATEST(0, COALESCE(v_strikes, 0) - v_decay);
    v_new := LEAST(v_strikes + 1, 3); -- never violate users.strikes CHECK (would abort the capture)

    UPDATE users
       SET strikes = v_new,
           flags = jsonb_set(COALESCE(flags, '{}'::jsonb), '{last_strike_at}', to_jsonb(now()::text)),
           banned_until       = CASE WHEN v_new = 2 THEN now() + interval '7 days' ELSE banned_until END,
           banned_permanently = CASE WHEN v_new >= 3 THEN TRUE ELSE banned_permanently END
     WHERE id = p_uid;

    IF v_new = 1 THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (p_uid, 'warning', 'Unusual movement detected',
              'We saw movement that looked impossible for walking. This is a friendly warning — keep it fair and you''re all set.',
              jsonb_build_object('reason', p_reason, 'strike', 1));
    ELSIF v_new = 2 THEN
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (p_uid, 'ban', 'Account suspended for 7 days',
              'Repeated impossible movement was detected, so your account is suspended for 7 days. Email bille.sai12@gmail.com if you think this is a mistake.',
              jsonb_build_object('reason', p_reason, 'strike', 2));
    ELSE
      INSERT INTO notifications (user_id, type, title, body, data)
      VALUES (p_uid, 'ban', 'Account banned',
              'Your account has been permanently banned for repeated cheating. Email bille.sai12@gmail.com to appeal.',
              jsonb_build_object('reason', p_reason, 'strike', 3));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'add_strike(%, %) failed: %', p_uid, p_reason, SQLERRM; -- swallow: never block capture
  END;
END;
$$;
REVOKE ALL ON FUNCTION add_strike(UUID, TEXT) FROM PUBLIC; -- internal only; no client grant

-- ── (e) capture_hex v3 — 011's body verbatim + four anti-cheat insertions. ───────────────────────
-- CRITICAL: drop the ungated 3-arg overload FIRST. If it survives, a client can call it directly via
-- PostgREST and bypass every gate below. After this migration exactly ONE capture_hex is grantable.
DROP FUNCTION IF EXISTS capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION);

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
  -- Phase 8 anti-cheat locals
  v_perm     BOOLEAN;
  v_until    TIMESTAMPTZ;
  v_prev_lat DOUBLE PRECISION;
  v_prev_lng DOUBLE PRECISION;
  v_prev_t   TIMESTAMPTZ;
  v_dist_m   DOUBLE PRECISION;
  v_dt_s     DOUBLE PRECISION;
  v_kmh      DOUBLE PRECISION;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_lat IS NULL OR p_lng IS NULL OR p_lat <> p_lat OR p_lng <> p_lng
     OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'bad_coords';
  END IF;

  -- (1) Ban gate + motion anchor read, BEFORE any write. One read covers capture AND steal (steal is
  --     folded into this function — there is no separate steal_hex).
  SELECT banned_permanently, banned_until, last_lat, last_lng, last_seen
    INTO v_perm, v_until, v_prev_lat, v_prev_lng, v_prev_t
    FROM users WHERE id = v_uid;
  IF v_perm THEN RAISE EXCEPTION 'banned_permanently'; END IF;
  IF v_until IS NOT NULL AND v_until > now() THEN RAISE EXCEPTION 'banned'; END IF;

  -- (2) Mock-location: advisory telemetry only. The client blocks a mocked fix before it ever calls
  --     this; a client-asserted bit is forgeable until attestation lands, so we NEVER reject/strike.
  IF p_mocked IS TRUE THEN
    INSERT INTO anti_cheat_events (user_id, kind, h3) VALUES (v_uid, 'mock_advisory', p_h3);
  END IF;

  -- Lock the always-present parent hex row to serialise concurrent captures of the same cell.
  SELECT * INTO v_hex FROM hexes WHERE h3_index = p_h3 AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'hex_not_found'; END IF;

  IF NOT hexa_point_in_hex(p_lat, p_lng, v_hex.boundary) THEN RAISE EXCEPTION 'outside_hex'; END IF;

  -- (3) Motion validation — coarse 2-point displacement-rate filter (see header). Runs after the
  --     point-in-hex check and before any mutation, so a rejected hop changes nothing. First capture
  --     (NULL anchor) is never evaluated; a long gap is mathematically slow (km/h = dist/dt).
  IF v_prev_lat IS NOT NULL AND v_prev_t IS NOT NULL THEN
    v_dist_m := haversine_m(v_prev_lat, v_prev_lng, p_lat, p_lng);
    v_dt_s   := GREATEST(EXTRACT(EPOCH FROM (now() - v_prev_t)), 1); -- clamp ≥1s (no divide-by-~0)
    v_kmh    := (v_dist_m / v_dt_s) * 3.6;
    IF v_dist_m > 250 AND v_kmh > 200 THEN
      INSERT INTO anti_cheat_events (user_id, kind, dist_m, dt_s, kmh, h3)
        VALUES (v_uid, 'teleport', v_dist_m, v_dt_s, v_kmh, p_h3); -- soft flag; capture proceeds
      IF v_kmh > 350 THEN RAISE EXCEPTION 'too_fast'; END IF;       -- hard reject band only
      -- Pattern → strike (the only auto-strike trigger): ≥4 flagged hops in a rolling 24h.
      IF (SELECT count(*) FROM anti_cheat_events
            WHERE user_id = v_uid AND kind = 'teleport'
              AND created_at > now() - interval '24 hours') >= 4 THEN
        PERFORM add_strike(v_uid, 'teleport_pattern');
      END IF;
    END IF;
  END IF;

  SELECT * INTO v_own FROM hex_ownership WHERE h3_index = p_h3; -- read serialised by the hex lock
  v_owner := v_own.owner_id;

  IF v_owner = v_uid THEN RAISE EXCEPTION 'already_owned'; END IF;

  -- Block: 15 min after ANY capture nobody may take this hex (subsumes the old 60s same-hex guard).
  IF v_own.block_until IS NOT NULL AND v_own.block_until > now() THEN RAISE EXCEPTION 'block_cooldown'; END IF;

  IF v_owner IS NOT NULL THEN
    v_type := 'steal';
    v_ip   := 150; -- round(100 * 1.5)
    -- Fresh Paint: a hex captured < 30 min ago can't be stolen (the owner gets a window to defend).
    IF v_own.fresh_paint_until IS NOT NULL AND v_own.fresh_paint_until > now() THEN
      RAISE EXCEPTION 'fresh_paint';
    END IF;
    -- Farm-to-zero floor: a steal can't drop the victim below their level-scaled held floor (L1:1..L5:5).
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
  VALUES (p_h3, v_uid, v_owner, v_ip, v_type, to_char(now() AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM'));

  PERFORM grant_points(v_uid, v_ip);                       -- RP + LP + daily ledger (single path)

  -- (4) Persist the motion anchor alongside last_capture_at (the streak trigger reads the OLD
  --     last_capture_at on the captures INSERT above; last_seen is a parallel column so it's safe).
  UPDATE users SET last_capture_at = now(), last_lat = p_lat, last_lng = p_lng, last_seen = now()
   WHERE id = v_uid;

  -- Held-count invariant: recompute from source for both affected users (drift-proof).
  UPDATE users u SET current_held_hexes = (SELECT count(*) FROM hex_ownership WHERE owner_id = u.id)
   WHERE u.id = v_uid OR u.id = v_owner;

  IF v_type = 'steal' THEN
    SELECT COALESCE(NULLIF(btrim(display_name), ''), username, 'Someone') INTO v_name FROM users WHERE id = v_uid;
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (v_owner, 'steal', 'Hex stolen!',
            v_name || ' took your hex in ' || COALESCE(v_hex.neighbourhood, 'Bengaluru'),
            jsonb_build_object('h3', p_h3, 'by', v_uid));
  END IF;

  PERFORM check_level_up(v_uid); -- after LP moved

  RETURN jsonb_build_object('ok', TRUE, 'h3', p_h3, 'ip', v_ip, 'type', v_type, 'stolen_from', v_owner);
END;
$$;
REVOKE ALL ON FUNCTION capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION, BOOLEAN) TO authenticated;

-- ── (f) run_hourly_economy — re-issue 012's body with a ban-skip so banned owners earn no passive
--        rent. The predicate lives inside the ranked CTE's JOIN so it excludes them from the amount,
--        the daily_activity ledger AND the level-up loop in one place. ──────────────────────────────
CREATE OR REPLACE FUNCTION run_hourly_economy()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hour  TIMESTAMPTZ := date_trunc('hour', now());
  v_users INT := 0;
  v_total BIGINT := 0;
  r RECORD;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended('hexa-rent:' || v_hour::text, 0));
  IF EXISTS (SELECT 1 FROM rent_runs WHERE run_hour = v_hour) THEN
    RETURN jsonb_build_object('ok', TRUE, 'skipped', TRUE, 'hour', v_hour);
  END IF;

  CREATE TEMP TABLE _payout ON COMMIT DROP AS
  WITH ranked AS (
    SELECT o.owner_id,
           COALESCE(h.pph_value, 5) AS rate,
           row_number() OVER (PARTITION BY o.owner_id
                              ORDER BY COALESCE(o.last_visited_at, o.captured_at) DESC, o.h3_index) AS rn
    FROM hex_ownership o
    JOIN hexes h ON h.h3_index = o.h3_index AND h.is_active = TRUE
    JOIN users u ON u.id = o.owner_id
                AND COALESCE(u.banned_permanently, FALSE) = FALSE
                AND (u.banned_until IS NULL OR u.banned_until <= now())   -- banned owners earn no rent
  )
  SELECT owner_id, SUM(rate)::INT AS amount, count(*)::INT AS hexes
  FROM ranked WHERE rn <= 500
  GROUP BY owner_id
  HAVING SUM(rate) > 0;

  UPDATE users u
     SET current_round_points = current_round_points + p.amount,
         lifetime_points      = lifetime_points + p.amount
  FROM _payout p WHERE u.id = p.owner_id;

  INSERT INTO daily_activity (user_id, ist_day, rp_earned)
  SELECT owner_id, (now() AT TIME ZONE 'Asia/Kolkata')::date, amount FROM _payout
  ON CONFLICT (user_id, ist_day) DO UPDATE SET rp_earned = daily_activity.rp_earned + EXCLUDED.rp_earned;

  -- Visible-but-quiet rent receipt (pre-read so it never bumps the unread badge) — from 015.
  INSERT INTO notifications (user_id, type, title, body, data, read_at)
  SELECT owner_id, 'rent', 'Rent collected',
         '+' || amount || ' points from ' || hexes || ' hex' || CASE WHEN hexes = 1 THEN '' ELSE 'es' END,
         jsonb_build_object('amount', amount, 'hexes', hexes), now()
  FROM _payout;

  FOR r IN SELECT owner_id FROM _payout LOOP
    PERFORM check_level_up(r.owner_id);
  END LOOP;

  SELECT count(*), COALESCE(SUM(amount), 0) INTO v_users, v_total FROM _payout;
  INSERT INTO rent_runs (run_hour, users_paid, total_minted) VALUES (v_hour, v_users, v_total);
  RETURN jsonb_build_object('ok', TRUE, 'hour', v_hour, 'users_paid', v_users, 'total_minted', v_total);
END;
$$;
REVOKE ALL ON FUNCTION run_hourly_economy() FROM PUBLIC; -- service-role / cron only
