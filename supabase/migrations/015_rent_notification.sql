-- 015_rent_notification.sql — Hexa Phase 5 polish: rent payouts are now VISIBLE.
-- run_hourly_economy posts a "Rent collected: +N" notification per paid user so the player can see
-- their hourly income in the bell's Activity. Created read_at=now() (PRE-READ) so it shows in the
-- log WITHOUT bumping the unread badge 24×/day (rent is ambient; steals/level-ups/medals still badge).
-- Only change from 012: _payout also counts hexes, and the notification INSERT. Idempotency,
-- soft-cap, RP+LP credit, daily ledger + level promotion are unchanged.
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

  -- Visible-but-quiet rent receipt (pre-read so it never bumps the unread badge).
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
REVOKE ALL ON FUNCTION run_hourly_economy() FROM PUBLIC;
