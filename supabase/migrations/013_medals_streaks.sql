-- 013_medals_streaks.sql — Hexa Phase 6: MEDALS + daily STREAKS (gamification).
-- Spec §6.1-6.4. All 8 launch medals defined + visible; the 5 achievable-now criteria
-- (capture_count / streak_days / midnight_capture) are auto-awarded on capture; the 3 needing
-- external/complex data (rainy_captures→weather, pincode_top1_days→daily pincode board,
-- special→landmark geo) are DEFINED but not yet auto-evaluated. A single AFTER-INSERT trigger on
-- captures runs streak + medal checks (the spec's "called from execute_capture", as a trigger so
-- capture_hex isn't re-issued). Medal LP rewards go through grant_points (LP-only).

-- ── medal definitions (seeded) ─────────────────────────────────────────────────────────────────
CREATE TABLE medals (
  id                 TEXT PRIMARY KEY,
  name               TEXT NOT NULL,
  tier               TEXT NOT NULL CHECK (tier IN ('bronze', 'silver', 'gold', 'platinum')),
  lp_reward          INT  NOT NULL DEFAULT 0,
  criteria_type      TEXT NOT NULL,
  criteria_threshold INT  NOT NULL DEFAULT 1,
  description        TEXT NOT NULL,
  sort               INT  NOT NULL DEFAULT 0
);
ALTER TABLE medals ENABLE ROW LEVEL SECURITY;
CREATE POLICY medals_select_all ON medals FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON medals TO authenticated;

INSERT INTO medals (id, name, tier, lp_reward, criteria_type, criteria_threshold, description, sort) VALUES
  ('first_blood',        'First Blood',        'bronze', 50,  'capture_count',     1,   'Capture your first hex.',                  1),
  ('week_one',           'Week One',           'bronze', 100, 'streak_days',       7,   'Keep a 7-day capture streak.',             2),
  ('centurion',          'Centurion',          'silver', 200, 'capture_count',     100, 'Capture 100 hexes.',                       3),
  ('insomniac',          'Insomniac',          'bronze', 50,  'midnight_capture',  1,   'Capture a hex after midnight (12–5 AM).',  4),
  ('month_one',          'Month One',          'silver', 500, 'streak_days',       30,  'Keep a 30-day capture streak.',            5),
  ('monsoon_warrior',    'Monsoon Warrior',    'silver', 300, 'rainy_captures',    25,  'Capture 25 hexes in the rain.',            6),
  ('neighbourhood_king', 'Neighbourhood King', 'gold',   50,  'pincode_top1_days', 7,   'Top your pincode for 7 days.',             7),
  ('bridge_crosser',     'Bridge Crosser',     'bronze', 100, 'special',           1,   'Capture across a Bangalore landmark.',     8)
ON CONFLICT (id) DO NOTHING;

-- ── earned medals (public-readable for profile flex; definer-written only) ───────────────────────
CREATE TABLE user_medals (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  medal_id  TEXT NOT NULL REFERENCES medals(id) ON DELETE CASCADE,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, medal_id)
);
ALTER TABLE user_medals ENABLE ROW LEVEL SECURITY;
CREATE POLICY user_medals_select_all ON user_medals FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON user_medals TO authenticated;

-- ── award one medal (idempotent): record it, grant its LP, notify, re-check level ────────────────
CREATE OR REPLACE FUNCTION award_medal(p_uid UUID, p_key TEXT, p_cond BOOLEAN)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_m medals%ROWTYPE;
BEGIN
  IF NOT p_cond THEN RETURN; END IF;
  IF EXISTS (SELECT 1 FROM user_medals WHERE user_id = p_uid AND medal_id = p_key) THEN RETURN; END IF;
  SELECT * INTO v_m FROM medals WHERE id = p_key;
  IF NOT FOUND THEN RETURN; END IF;
  INSERT INTO user_medals (user_id, medal_id) VALUES (p_uid, p_key) ON CONFLICT DO NOTHING;
  PERFORM grant_points(p_uid, 0, v_m.lp_reward); -- LP-only reward
  PERFORM check_level_up(p_uid);
  INSERT INTO notifications (user_id, type, title, body, data)
  VALUES (p_uid, 'medal', 'Medal earned: ' || v_m.name, '+' || v_m.lp_reward || ' lifetime points',
          jsonb_build_object('medal', p_key, 'tier', v_m.tier));
END;
$$;
REVOKE ALL ON FUNCTION award_medal(UUID, TEXT, BOOLEAN) FROM PUBLIC;

-- ── evaluate the achievable medals for a user ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION check_medals(p_uid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_caps INT; v_streak INT; v_midnight BOOLEAN;
BEGIN
  SELECT count(*) INTO v_caps FROM captures WHERE user_id = p_uid;
  SELECT GREATEST(current_streak, longest_streak) INTO v_streak FROM users WHERE id = p_uid;
  SELECT EXISTS (
    SELECT 1 FROM captures
    WHERE user_id = p_uid
      AND extract(hour FROM captured_at AT TIME ZONE 'Asia/Kolkata') < 5
  ) INTO v_midnight;
  PERFORM award_medal(p_uid, 'first_blood', v_caps >= 1);
  PERFORM award_medal(p_uid, 'centurion',   v_caps >= 100);
  PERFORM award_medal(p_uid, 'week_one',    COALESCE(v_streak, 0) >= 7);
  PERFORM award_medal(p_uid, 'month_one',   COALESCE(v_streak, 0) >= 30);
  PERFORM award_medal(p_uid, 'insomniac',   v_midnight);
END;
$$;
REVOKE ALL ON FUNCTION check_medals(UUID) FROM PUBLIC;

-- ── streak update (spec §6.3, IST days + freeze; with NULL/first-capture handling) ───────────────
CREATE OR REPLACE FUNCTION update_streak_if_needed(p_uid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last TIMESTAMPTZ; v_last_day DATE; v_today DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
BEGIN
  SELECT last_capture_at INTO v_last FROM users WHERE id = p_uid;  -- prior value (capture_hex sets it AFTER the insert)
  IF v_last IS NULL THEN
    UPDATE users SET current_streak = 1, longest_streak = GREATEST(longest_streak, 1) WHERE id = p_uid;
    RETURN;
  END IF;
  v_last_day := (v_last AT TIME ZONE 'Asia/Kolkata')::date;
  IF v_last_day = v_today THEN
    RETURN; -- already captured today
  ELSIF v_last_day = v_today - 1 THEN
    UPDATE users SET current_streak = current_streak + 1 WHERE id = p_uid; -- consecutive day
  ELSE
    -- streak broken: a freeze bridges it, else reset to 1
    IF (SELECT streak_freezes_available FROM users WHERE id = p_uid) > 0 THEN
      UPDATE users SET streak_freezes_available = streak_freezes_available - 1 WHERE id = p_uid;
    ELSE
      UPDATE users SET current_streak = 1 WHERE id = p_uid;
    END IF;
  END IF;
  UPDATE users SET longest_streak = GREATEST(longest_streak, current_streak) WHERE id = p_uid;
END;
$$;
REVOKE ALL ON FUNCTION update_streak_if_needed(UUID) FROM PUBLIC;

-- ── one trigger on captures: bump streak THEN evaluate medals (spec's per-capture hook) ──────────
CREATE OR REPLACE FUNCTION on_capture_gamify()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  PERFORM update_streak_if_needed(NEW.user_id);
  PERFORM check_medals(NEW.user_id);
  RETURN NEW;
END;
$$;
CREATE TRIGGER captures_gamify AFTER INSERT ON captures FOR EACH ROW EXECUTE FUNCTION on_capture_gamify();

-- ── backfill: record already-earned medals for existing players (no LP/notification — those are
--    for future earns; this just reflects history so nobody starts with an empty case). ──────────
INSERT INTO user_medals (user_id, medal_id)
  SELECT DISTINCT user_id, 'first_blood' FROM captures ON CONFLICT DO NOTHING;
INSERT INTO user_medals (user_id, medal_id)
  SELECT user_id, 'centurion' FROM captures GROUP BY user_id HAVING count(*) >= 100 ON CONFLICT DO NOTHING;
INSERT INTO user_medals (user_id, medal_id)
  SELECT DISTINCT user_id, 'insomniac' FROM captures
  WHERE extract(hour FROM captured_at AT TIME ZONE 'Asia/Kolkata') < 5 ON CONFLICT DO NOTHING;
INSERT INTO user_medals (user_id, medal_id)
  SELECT id, 'week_one' FROM users WHERE longest_streak >= 7 ON CONFLICT DO NOTHING;
INSERT INTO user_medals (user_id, medal_id)
  SELECT id, 'month_one' FROM users WHERE longest_streak >= 30 ON CONFLICT DO NOTHING;

-- ── 9 PM IST streak nudge (best-effort; pg_cron) ─────────────────────────────────────────────────
DO $$
BEGIN
  PERFORM cron.schedule('hexa-streak-nudge', '30 15 * * *', $cron$
    INSERT INTO notifications (user_id, type, title, body)
    SELECT id, 'streak_at_risk', current_streak || '-day streak at risk!',
           'Capture one hex before midnight to keep it alive.'
    FROM users
    WHERE current_streak >= 3
      AND (last_capture_at AT TIME ZONE 'Asia/Kolkata')::date < (now() AT TIME ZONE 'Asia/Kolkata')::date
      AND COALESCE(notification_prefs->>'streak', 'true') = 'true'
      AND banned_permanently = FALSE
  $cron$);
  RAISE NOTICE 'Scheduled hexa-streak-nudge (9 PM IST).';
EXCEPTION WHEN OTHERS THEN
  RAISE NOTICE 'Could not schedule streak nudge (%). Enable pg_cron, then schedule manually.', SQLERRM;
END $$;
