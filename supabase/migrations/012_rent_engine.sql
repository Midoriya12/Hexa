-- 012_rent_engine.sql — Hexa Phase 5 (Economy), part 3: HOURLY RENT.
-- Exactly ONE hourly job credits passive income for held hexes. Decisions (Sai 2026-06-04):
-- rent 5/hr per hex, soft cap = your 500 most-recently-touched hexes, NO decay (Phase 10). Rent
-- feeds RP + LP (so passive holding levels you) and is strictly idempotent (a retry/overlap is a
-- no-op via a per-hour run row + advisory lock) so it can never double-pay.

-- ── rent_runs: one row per settled hour (the idempotency barrier + an income audit log) ─────────
CREATE TABLE rent_runs (
  run_hour     TIMESTAMPTZ PRIMARY KEY,
  users_paid   INT    NOT NULL,
  total_minted BIGINT NOT NULL,
  ran_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE rent_runs ENABLE ROW LEVEL SECURITY; -- no policies/grant → clients can't read; definer bypasses

-- ── run_hourly_economy: the ONE hourly cron entrypoint ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION run_hourly_economy()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_hour  TIMESTAMPTZ := date_trunc('hour', now());
  v_users INT := 0;
  v_total BIGINT := 0;
  r RECORD;
BEGIN
  -- Serialise concurrent runs of the same hour, then bail if this hour is already settled.
  PERFORM pg_advisory_xact_lock(hashtextextended('hexa-rent:' || v_hour::text, 0));
  IF EXISTS (SELECT 1 FROM rent_runs WHERE run_hour = v_hour) THEN
    RETURN jsonb_build_object('ok', TRUE, 'skipped', TRUE, 'hour', v_hour);
  END IF;

  -- Each owner is paid for their 500 most-recently-touched ACTIVE hexes (soft cap), rate 5/hex
  -- (COALESCE so a future rarity pph_value just works). Frozen snapshot in a temp table.
  CREATE TEMP TABLE _payout ON COMMIT DROP AS
  WITH ranked AS (
    SELECT o.owner_id,
           COALESCE(h.pph_value, 5) AS rate,
           row_number() OVER (PARTITION BY o.owner_id
                              ORDER BY COALESCE(o.last_visited_at, o.captured_at) DESC, o.h3_index) AS rn
    FROM hex_ownership o
    JOIN hexes h ON h.h3_index = o.h3_index AND h.is_active = TRUE
  )
  SELECT owner_id, SUM(rate)::INT AS amount
  FROM ranked WHERE rn <= 500
  GROUP BY owner_id
  HAVING SUM(rate) > 0;

  -- Credit RP + LP together (the single sanctioned set-based exception to grant_points, mirrored
  -- below by the daily ledger so the two stay consistent).
  UPDATE users u
     SET current_round_points = current_round_points + p.amount,
         lifetime_points      = lifetime_points + p.amount
  FROM _payout p WHERE u.id = p.owner_id;

  INSERT INTO daily_activity (user_id, ist_day, rp_earned)
  SELECT owner_id, (now() AT TIME ZONE 'Asia/Kolkata')::date, amount FROM _payout
  ON CONFLICT (user_id, ist_day) DO UPDATE SET rp_earned = daily_activity.rp_earned + EXCLUDED.rp_earned;

  -- Promote anyone rent pushed over a level threshold (+1000 + notification, single-step).
  FOR r IN SELECT owner_id FROM _payout LOOP
    PERFORM check_level_up(r.owner_id);
  END LOOP;

  SELECT count(*), COALESCE(SUM(amount), 0) INTO v_users, v_total FROM _payout;
  INSERT INTO rent_runs (run_hour, users_paid, total_minted) VALUES (v_hour, v_users, v_total);
  RETURN jsonb_build_object('ok', TRUE, 'hour', v_hour, 'users_paid', v_users, 'total_minted', v_total);
END;
$$;
REVOKE ALL ON FUNCTION run_hourly_economy() FROM PUBLIC; -- service-role / cron only

-- ── my_rent_rate: authoritative per-user hourly rent for the client (replaces held×3 estimate) ──
CREATE OR REPLACE FUNCTION my_rent_rate()
RETURNS INT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  WITH ranked AS (
    SELECT COALESCE(h.pph_value, 5) AS rate,
           row_number() OVER (ORDER BY COALESCE(o.last_visited_at, o.captured_at) DESC, o.h3_index) AS rn
    FROM hex_ownership o
    JOIN hexes h ON h.h3_index = o.h3_index AND h.is_active = TRUE
    WHERE o.owner_id = auth.uid()
  )
  SELECT COALESCE(SUM(rate), 0)::INT FROM ranked WHERE rn <= 500;
$$;
REVOKE ALL ON FUNCTION my_rent_rate() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION my_rent_rate() TO authenticated;

-- ── Schedule it (best-effort: if pg_cron isn't enabled the migration still applies; enable it in
--    the dashboard and run the cron.schedule line below). cron.schedule upserts by job name. ─────
DO $$
BEGIN
  CREATE EXTENSION IF NOT EXISTS pg_cron;
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'pg_cron extension not available (%). Enable it in the Supabase dashboard.', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule('hexa-hourly-economy', '0 * * * *', 'SELECT run_hourly_economy();');
  RAISE NOTICE 'Scheduled hexa-hourly-economy (0 * * * *).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule cron (%). After enabling pg_cron run: SELECT cron.schedule(''hexa-hourly-economy'', ''0 * * * *'', ''SELECT run_hourly_economy();'');', SQLERRM;
END $$;
