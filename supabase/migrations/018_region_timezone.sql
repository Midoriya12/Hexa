-- 018_region_timezone.sql — Launch region moved from Bangalore to the US (NYC / NJ) — patch #56.
--
-- Every day-boundary computation (streak days, daily_activity ledger, rent receipts, the
-- "insomniac" night-owl medal, round ids) was hardcoded to 'Asia/Kolkata'. For US players that
-- flips the "day" at 2:30 PM local time, so streaks would break and daily caps would reset
-- mid-afternoon. This migration:
--   1. Introduces app_tz() — the ONE place the region timezone lives in SQL. It must match
--      config/region.json → "timezone" (the client mirrors it in lib/config/region regionDayIndex).
--   2. Rewrites every public function whose body contains the literal 'Asia/Kolkata' to call
--      app_tz() instead, by regenerating its definition from the catalog (pg_get_functiondef keeps
--      SECURITY DEFINER / search_path / grants intact). Doing it from the catalog rather than by
--      hand means no function body is re-typed and nothing drifts from what is actually deployed.
--   3. Re-schedules the 9 PM streak nudge for the new zone.
--
-- Existing daily_activity / rent-receipt rows keyed by IST dates are left as-is (test data only).

CREATE OR REPLACE FUNCTION app_tz()
RETURNS TEXT LANGUAGE sql IMMUTABLE PARALLEL SAFE AS $$ SELECT 'America/New_York'::text $$;
COMMENT ON FUNCTION app_tz() IS
  'IANA timezone of the active launch region. Keep in sync with config/region.json "timezone". New code: use (ts AT TIME ZONE app_tz())::date, never a literal zone.';
REVOKE ALL ON FUNCTION app_tz() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION app_tz() TO authenticated, service_role;

DO $$
DECLARE
  r RECORD;
  v_def TEXT;
  v_n INT := 0;
BEGIN
  FOR r IN
    SELECT p.oid, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prokind = 'f'
      AND pg_get_functiondef(p.oid) LIKE '%''Asia/Kolkata''%'
  LOOP
    v_def := replace(pg_get_functiondef(r.oid), '''Asia/Kolkata''', 'app_tz()');
    EXECUTE v_def;
    v_n := v_n + 1;
    RAISE NOTICE 'Re-targeted % to app_tz()', r.proname;
  END LOOP;
  RAISE NOTICE 'Re-targeted % function(s). Expected: grant_points, reset_round, capture_hex, run_hourly_economy, check_medals, update_streak_if_needed.', v_n;
END $$;

-- Streak nudge: pg_cron schedules are UTC. 9 PM America/New_York = 01:00 UTC in daylight time and
-- 02:00 UTC in standard time; pg_cron has no per-job zone, so we pin 01:00 UTC (9 PM EDT / 8 PM
-- EST). An hour early in winter is acceptable for a "capture before midnight" reminder.
DO $$
BEGIN
  PERFORM cron.unschedule('hexa-streak-nudge');
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'No existing hexa-streak-nudge job to unschedule (%).', SQLERRM;
END $$;

DO $$
BEGIN
  PERFORM cron.schedule('hexa-streak-nudge', '0 1 * * *', $cron$
    INSERT INTO notifications (user_id, type, title, body)
    SELECT id, 'streak_at_risk', current_streak || '-day streak at risk!',
           'Capture one hex before midnight to keep it alive.'
    FROM users
    WHERE current_streak >= 3
      AND (last_capture_at AT TIME ZONE app_tz())::date < (now() AT TIME ZONE app_tz())::date
      AND COALESCE(notification_prefs->>'streak', 'true') = 'true'
      AND banned_permanently = FALSE
  $cron$);
  RAISE NOTICE 'Scheduled hexa-streak-nudge (9 PM America/New_York, DST-approximate).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule streak nudge (%). Enable pg_cron, then schedule manually.', SQLERRM;
END $$;
