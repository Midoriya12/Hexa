-- 014_streak_fix.sql — Hexa Phase 6 FIX: restore update_streak_if_needed to CLAUDE.md Patch #16.
-- 013 transcribed the spec §6.3 version, which re-introduced the two bugs Patch #16 exists to kill:
--   (b) the freeze branch didn't increment current_streak for today's capture (it "preserved" the
--       old value instead of advancing it); and
--   (c) one freeze bridged an arbitrarily large gap (3-day, 10-day) — it should cover EXACTLY one
--       missed day; 2+ missed days (or no freeze) resets to 1.
-- Also: COALESCE the nullable freeze count, and treat current_streak=0 as a fresh start.
-- (Trigger ordering is already correct: capture_hex INSERTs the capture row — firing the
--  captures_gamify trigger that calls this — BEFORE it updates users.last_capture_at, so this reads
--  the PRIOR day, per Patch #16's note.)
CREATE OR REPLACE FUNCTION update_streak_if_needed(p_uid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_last    TIMESTAMPTZ;
  v_streak  INT;
  v_freezes INT;
  v_last_day DATE;
  v_today    DATE := (now() AT TIME ZONE 'Asia/Kolkata')::date;
  v_missed   INT;
BEGIN
  SELECT last_capture_at, current_streak, COALESCE(streak_freezes_available, 0)
    INTO v_last, v_streak, v_freezes
  FROM users WHERE id = p_uid;

  -- First capture ever, or the streak was zeroed → start at 1.
  IF v_last IS NULL OR COALESCE(v_streak, 0) = 0 THEN
    UPDATE users SET current_streak = 1, longest_streak = GREATEST(longest_streak, 1) WHERE id = p_uid;
    RETURN;
  END IF;

  v_last_day := (v_last AT TIME ZONE 'Asia/Kolkata')::date;
  v_missed   := v_today - v_last_day; -- 0 today, 1 consecutive, 2 = one day missed, >2 bigger gap

  IF v_missed <= 0 THEN
    RETURN; -- already captured today
  ELSIF v_missed = 1 THEN
    UPDATE users SET current_streak = current_streak + 1,
                     longest_streak = GREATEST(longest_streak, current_streak + 1)
     WHERE id = p_uid;
  ELSIF v_missed = 2 AND v_freezes >= 1 THEN
    -- exactly one day missed + a freeze available → bridge it AND advance for today's capture
    UPDATE users SET streak_freezes_available = streak_freezes_available - 1,
                     current_streak = current_streak + 1,
                     longest_streak = GREATEST(longest_streak, current_streak + 1)
     WHERE id = p_uid;
  ELSE
    UPDATE users SET current_streak = 1 WHERE id = p_uid; -- 2+ day gap (or no freeze) → reset
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION update_streak_if_needed(UUID) FROM PUBLIC;
