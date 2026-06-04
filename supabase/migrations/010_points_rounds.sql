-- 010_points_rounds.sql — Hexa Phase 5 (Economy), part 1: the POINTS FOUNDATION.
-- The single source of truth for point/level movement, so RP (round) and LP (lifetime) never drift.
-- Authority: Spec Patches > v3 Design Spec > Build Spec. Decisions (Sai 2026-06-04): levels driven
-- by LP (curve Walker/Strider/Patroller/Conqueror/Mayor), +1000 RP-only promotion bonus, monthly
-- rounds reset MANUALLY for now, decay + anti-coasting demotion DEFERRED.
--
-- Built on top of: 001 (users.lifetime_points BIGINT exists but was never written; level 1-5),
-- 003 (captures.ip_awarded). This migration is the SOLE owner of the LP backfill.

-- ── grant_points: the ONE awards-only points path (RP + equal LP, + daily ledger) ─────────────
-- Every positive point award (capture, rent, steal) goes through this so RP and LP move together.
-- p_lp_extra lets a grant add LP beyond RP (e.g. medal LP-only bonuses later). Negative = error:
-- the ONLY sanctioned RP-only debit is clan creation (006/008), which writes users directly and
-- must never touch LP. Internal-only (no GRANT to authenticated).
CREATE OR REPLACE FUNCTION grant_points(p_uid UUID, p_rp INT, p_lp_extra INT DEFAULT 0)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF p_rp < 0 OR p_lp_extra < 0 THEN RAISE EXCEPTION 'grant_points_negative'; END IF;
  UPDATE users
     SET current_round_points = current_round_points + p_rp,
         lifetime_points      = lifetime_points + p_rp + p_lp_extra
   WHERE id = p_uid;
  INSERT INTO daily_activity (user_id, ist_day, rp_earned)
  VALUES (p_uid, (now() AT TIME ZONE 'Asia/Kolkata')::date, p_rp)
  ON CONFLICT (user_id, ist_day) DO UPDATE SET rp_earned = daily_activity.rp_earned + EXCLUDED.rp_earned;
END;
$$;
REVOKE ALL ON FUNCTION grant_points(UUID, INT, INT) FROM PUBLIC;

-- ── daily_activity: per-IST-day RP ledger (drives the future demotion gate; also a nice stat) ──
CREATE TABLE daily_activity (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  ist_day   DATE NOT NULL,
  rp_earned INT  NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, ist_day)
);
ALTER TABLE daily_activity ENABLE ROW LEVEL SECURITY;
CREATE POLICY daily_activity_select_own ON daily_activity
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON daily_activity TO authenticated;

-- ── level_name + check_level_up (LP-driven, single-step, +1000 RP-only bonus) ──────────────────
CREATE OR REPLACE FUNCTION level_name(p_level INT)
RETURNS TEXT IMMUTABLE LANGUAGE sql AS $$
  SELECT CASE p_level
           WHEN 1 THEN 'Walker' WHEN 2 THEN 'Strider' WHEN 3 THEN 'Patroller'
           WHEN 4 THEN 'Conqueror' WHEN 5 THEN 'Mayor' ELSE 'Walker' END;
$$;

CREATE OR REPLACE FUNCTION level_for_lp(p_lp BIGINT)
RETURNS INT IMMUTABLE LANGUAGE sql AS $$
  SELECT CASE
           WHEN p_lp >= 30000 THEN 5
           WHEN p_lp >= 10000 THEN 4
           WHEN p_lp >= 2500  THEN 3
           WHEN p_lp >= 500   THEN 2
           ELSE 1 END;
$$;

-- Promote at most ONE level per call (single celebration); +1000 RP bonus (RP ONLY — adding LP
-- could cross the next threshold in the same call and skip a level). Catches up on the next award.
CREATE OR REPLACE FUNCTION check_level_up(p_uid UUID)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_lp BIGINT; v_level INT;
BEGIN
  SELECT lifetime_points, level INTO v_lp, v_level FROM users WHERE id = p_uid FOR UPDATE;
  IF NOT FOUND THEN RETURN; END IF;
  IF v_level < 5 AND level_for_lp(v_lp) > v_level THEN
    UPDATE users SET level = v_level + 1, current_round_points = current_round_points + 1000 WHERE id = p_uid;
    INSERT INTO notifications (user_id, type, title, body, data)
    VALUES (p_uid, 'level_up', 'Level up!',
            'You reached ' || level_name(v_level + 1) || ' — +1000 points',
            jsonb_build_object('level', v_level + 1));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION check_level_up(UUID) FROM PUBLIC;

-- ── notifications: event surface (level-ups, steals) — owner-only read, marked read via RPC ────
CREATE TABLE notifications (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type       TEXT NOT NULL,
  title      TEXT NOT NULL,
  body       TEXT,
  data       JSONB NOT NULL DEFAULT '{}',
  read_at    TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY notifications_select_own ON notifications
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
GRANT SELECT ON notifications TO authenticated; -- no client INSERT/UPDATE; definer fns write, RPC marks read

CREATE OR REPLACE FUNCTION mark_notifications_read()
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  UPDATE notifications SET read_at = now() WHERE user_id = auth.uid() AND read_at IS NULL;
$$;
REVOKE ALL ON FUNCTION mark_notifications_read() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION mark_notifications_read() TO authenticated;

-- ── round_id on captures + index ──────────────────────────────────────────────────────────────
ALTER TABLE captures ADD COLUMN round_id TEXT;
UPDATE captures SET round_id = to_char(captured_at AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') WHERE round_id IS NULL;
CREATE INDEX captures_round_idx ON captures(round_id, captured_at DESC);

-- ── LP backfill (run ONCE here, BEFORE any LP-writing RPC exists, so nothing double-counts) ─────
-- LP was declared in 001 but never written. Seed it from the existing capture log, then recompute
-- everyone's level so existing players land at the right level immediately (multi-step, one-time).
UPDATE users u
   SET lifetime_points = GREATEST(u.lifetime_points,
                                  COALESCE((SELECT SUM(c.ip_awarded) FROM captures c WHERE c.user_id = u.id), 0));
UPDATE users SET level = level_for_lp(lifetime_points);

-- ── round_results: snapshot standings before a monthly reset zeroes RP (audit + Phase-6 medals) ─
CREATE TABLE round_results (
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  round_id    TEXT NOT NULL,
  points      INT  NOT NULL,
  rank        INT  NOT NULL,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, round_id)
);
ALTER TABLE round_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY round_results_select_all ON round_results FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON round_results TO authenticated;

-- reset_round: snapshot → zero RP (LP / ownership / held / captures untouched). MANUAL for now
-- (service-role / SQL editor only); cron at launch. Idempotent (re-run zeroes nothing new).
CREATE OR REPLACE FUNCTION reset_round(p_round_id TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_round TEXT := COALESCE(p_round_id, to_char((now() AT TIME ZONE 'Asia/Kolkata') - interval '1 day', 'YYYY-MM'));
  v_n INT;
BEGIN
  INSERT INTO round_results (user_id, round_id, points, rank)
  SELECT id, v_round, current_round_points, rank() OVER (ORDER BY current_round_points DESC)
  FROM users WHERE current_round_points > 0
  ON CONFLICT (user_id, round_id) DO NOTHING;

  UPDATE users SET current_round_points = 0 WHERE current_round_points <> 0;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN jsonb_build_object('ok', TRUE, 'round', v_round, 'users_reset', v_n);
END;
$$;
REVOKE ALL ON FUNCTION reset_round(TEXT) FROM PUBLIC; -- service-role / cron only; never granted to clients
