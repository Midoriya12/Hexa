-- 006_clan_governance.sql — Hexa (Phase 11 social, Step C+): EXTEND clans into a full social/
-- governance feature: ROLES, REQUEST-BASED join, creation COST, role-gated moderation (kick /
-- set role / update settings / disband), clan AGGREGATE stats + leaderboard, and clan CHAT.
-- Authority: Spec Patches > v3 Design Spec > Build Spec PDF. Builds on 005.
--
-- Security model: all mutations via SECURITY DEFINER RPCs (search_path=public, auth.uid()).
-- users.clan_id + users.clan_role are writable ONLY inside a clan RPC (the guard trigger checks a
-- txn-local flag), so a client can never self-grant a role. The 100-cap is checked AT ACCEPT under
-- a clans-row lock against a FRESH COUNT (not the cached counter). Patches: #32, #27, #5/#25.
-- Review fixes applied: non-negative points invariant + atomic debit; actor-row locks (TOCTOU);
-- cap gated on COUNT under lock; handover normalises stray presidents.

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. SCHEMA EXTENSIONS
-- ════════════════════════════════════════════════════════════════════════════════
ALTER TABLE users
  ADD COLUMN clan_role TEXT CHECK (clan_role IS NULL OR clan_role IN ('president','vp','senior','member'));
ALTER TABLE users
  ADD CONSTRAINT users_clan_role_consistency CHECK ((clan_id IS NULL) = (clan_role IS NULL));
-- Review fix #1: a hard floor so creation cost (and any future spend) can never go negative.
ALTER TABLE users
  ADD CONSTRAINT users_round_points_nonneg CHECK (COALESCE(current_round_points, 0) >= 0);

ALTER TABLE clans ADD COLUMN description TEXT NOT NULL DEFAULT '';
ALTER TABLE clans ADD COLUMN min_points  INT  NOT NULL DEFAULT 0 CHECK (min_points >= 0);
ALTER TABLE clans ADD COLUMN min_hexes   INT  NOT NULL DEFAULT 0 CHECK (min_hexes  >= 0);

-- Backfill roles for any 005-era clans (owner=president, rest=member) before the constraint matters.
UPDATE users u SET clan_role = 'president'
  FROM clans c WHERE u.clan_id = c.id AND c.owner_id = u.id AND u.clan_role IS NULL;
UPDATE users SET clan_role = 'member' WHERE clan_id IS NOT NULL AND clan_role IS NULL;

-- Extend the 005 guard to also cover clan_role (trigger users_guard_clan_id already calls this fn).
CREATE OR REPLACE FUNCTION guard_users_clan_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF (NEW.clan_id IS DISTINCT FROM OLD.clan_id OR NEW.clan_role IS DISTINCT FROM OLD.clan_role)
     AND COALESCE(current_setting('hexa.clan_write', true), '') <> '1' THEN
    RAISE EXCEPTION 'clan_id is managed by clan actions';
  END IF;
  RETURN NEW;
END;
$$;

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. JOIN REQUESTS
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE clan_join_requests (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clan_id     UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected','cancelled')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  decided_at  TIMESTAMPTZ,
  decided_by  UUID REFERENCES users(id) ON DELETE SET NULL
);
CREATE INDEX clan_join_requests_clan_idx ON clan_join_requests(clan_id, status);
CREATE INDEX clan_join_requests_user_idx ON clan_join_requests(user_id, status);
CREATE UNIQUE INDEX clan_join_requests_active_uidx ON clan_join_requests(clan_id, user_id) WHERE status = 'pending';

ALTER TABLE clan_join_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY cjr_select_own ON clan_join_requests
  FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR clan_id = (SELECT u.clan_id FROM users u WHERE u.id = auth.uid() AND u.clan_role IN ('president','vp'))
  );
GRANT SELECT ON TABLE clan_join_requests TO authenticated;

CREATE OR REPLACE FUNCTION request_to_join(p_clan_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing UUID; v_pts INT; v_hex INT; v_minp INT; v_minh INT; v_req_id BIGINT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_clan_id IS NULL THEN RAISE EXCEPTION 'bad_clan'; END IF;

  SELECT clan_id, COALESCE(current_round_points,0), COALESCE(current_held_hexes,0)
    INTO v_existing, v_pts, v_hex FROM users WHERE id = v_uid;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'already_in_clan'; END IF;

  SELECT min_points, min_hexes INTO v_minp, v_minh FROM clans WHERE id = p_clan_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'clan_not_found'; END IF;
  IF v_pts < v_minp THEN RAISE EXCEPTION 'below_min_points'; END IF;
  IF v_hex < v_minh THEN RAISE EXCEPTION 'below_min_hexes'; END IF;

  INSERT INTO clan_join_requests (clan_id, user_id, status)
  VALUES (p_clan_id, v_uid, 'pending')
  ON CONFLICT (clan_id, user_id) WHERE status = 'pending' DO UPDATE SET created_at = now()
  RETURNING id INTO v_req_id;
  RETURN jsonb_build_object('ok', TRUE, 'request_id', v_req_id, 'status', 'pending');
END;
$$;
REVOKE ALL ON FUNCTION request_to_join(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_to_join(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION cancel_join_request(p_request_id BIGINT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_owner UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT user_id INTO v_owner FROM clan_join_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_owner <> v_uid THEN RAISE EXCEPTION 'not_your_request'; END IF;
  UPDATE clan_join_requests SET status = 'cancelled', decided_at = now() WHERE id = p_request_id;
  RETURN jsonb_build_object('ok', TRUE, 'status', 'cancelled');
END;
$$;
REVOKE ALL ON FUNCTION cancel_join_request(BIGINT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION cancel_join_request(BIGINT) TO authenticated;

CREATE OR REPLACE FUNCTION respond_join_request(p_request_id BIGINT, p_accept BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_actor_role TEXT; v_actor_clan UUID;
  v_req clan_join_requests%ROWTYPE; v_target_clan UUID; v_count INT; v_new INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);

  -- Review fix #2/#4: lock the actor row so a concurrent demotion can't be raced (TOCTOU).
  SELECT clan_id, clan_role INTO v_actor_clan, v_actor_role FROM users WHERE id = v_uid FOR UPDATE;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('president','vp') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_req FROM clan_join_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.clan_id <> v_actor_clan THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF NOT p_accept THEN
    UPDATE clan_join_requests SET status = 'rejected', decided_at = now(), decided_by = v_uid WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', TRUE, 'status', 'rejected');
  END IF;

  -- ACCEPT: lock the clan row (serialise), then gate on a FRESH COUNT (review fix #3 — not the cache).
  PERFORM 1 FROM clans WHERE id = v_req.clan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'clan_not_found'; END IF;
  SELECT count(*) INTO v_count FROM users WHERE clan_id = v_req.clan_id;
  IF v_count >= 100 THEN RAISE EXCEPTION 'clan_full'; END IF;

  SELECT clan_id INTO v_target_clan FROM users WHERE id = v_req.user_id FOR UPDATE;
  IF v_target_clan IS NOT NULL THEN
    UPDATE clan_join_requests SET status = 'rejected', decided_at = now(), decided_by = v_uid WHERE id = p_request_id;
    RAISE EXCEPTION 'requester_in_clan';
  END IF;

  UPDATE users SET clan_id = v_req.clan_id, clan_role = 'member' WHERE id = v_req.user_id;
  UPDATE clan_join_requests SET status = 'accepted', decided_at = now(), decided_by = v_uid WHERE id = p_request_id;
  SELECT count(*) INTO v_new FROM users WHERE clan_id = v_req.clan_id;
  UPDATE clans SET member_count = v_new WHERE id = v_req.clan_id;
  RETURN jsonb_build_object('ok', TRUE, 'status', 'accepted', 'user_id', v_req.user_id, 'member_count', v_new);
END;
$$;
REVOKE ALL ON FUNCTION respond_join_request(BIGINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION respond_join_request(BIGINT, BOOLEAN) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 3. CREATE_CLAN (v2) — 1500-point cost, atomic + floor-protected (review fix #1)
-- ════════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS create_clan(TEXT, TEXT);

CREATE OR REPLACE FUNCTION create_clan(
  p_name TEXT, p_colour TEXT, p_description TEXT DEFAULT '',
  p_min_points INT DEFAULT 0, p_min_hexes INT DEFAULT 0)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_clan_id UUID; v_existing UUID; v_pts INT;
  c_cost CONSTANT INT := 1500;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);

  p_name := btrim(COALESCE(p_name, ''));
  IF length(p_name) = 0 OR length(p_name) > 40 THEN RAISE EXCEPTION 'bad_name'; END IF;
  p_colour := NULLIF(btrim(COALESCE(p_colour, '')), '');
  p_description := left(btrim(COALESCE(p_description, '')), 280);
  IF COALESCE(p_min_points,0) < 0 OR COALESCE(p_min_hexes,0) < 0 THEN RAISE EXCEPTION 'bad_requirements'; END IF;

  SELECT clan_id, COALESCE(current_round_points,0) INTO v_existing, v_pts FROM users WHERE id = v_uid FOR UPDATE;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'already_in_clan'; END IF;
  IF v_pts < c_cost THEN RAISE EXCEPTION 'insufficient_points'; END IF;

  INSERT INTO clans (name, colour, owner_id, member_count, description, min_points, min_hexes)
  VALUES (p_name, COALESCE(p_colour, '#FF6F00'), v_uid, 1, p_description, COALESCE(p_min_points,0), COALESCE(p_min_hexes,0))
  RETURNING id INTO v_clan_id;

  -- Conditional atomic debit (review fix #1): the WHERE floor + the table CHECK guarantee the
  -- cost is always paid even under concurrent spend; a miss RAISEs and rolls back the clan insert.
  UPDATE users SET current_round_points = current_round_points - c_cost, clan_id = v_clan_id, clan_role = 'president'
   WHERE id = v_uid AND current_round_points >= c_cost;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_points'; END IF;

  RETURN jsonb_build_object('ok', TRUE, 'clan_id', v_clan_id, 'member_count', 1, 'cost', c_cost);
END;
$$;
REVOKE ALL ON FUNCTION create_clan(TEXT, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_clan(TEXT, TEXT, TEXT, INT, INT) TO authenticated;

-- Retire the old instant join_clan: keep it but un-granted + loud failure (join is request-based now).
CREATE OR REPLACE FUNCTION join_clan(p_clan_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN RAISE EXCEPTION 'join_is_request_based'; END;
$$;
REVOKE ALL ON FUNCTION join_clan(UUID) FROM PUBLIC;

-- ════════════════════════════════════════════════════════════════════════════════
-- 4. MODERATION
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION kick_member(p_target_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_actor_role TEXT; v_actor_clan UUID;
  v_tgt_role TEXT; v_tgt_clan UUID; v_new INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_target_user_id IS NULL THEN RAISE EXCEPTION 'bad_target'; END IF;
  IF p_target_user_id = v_uid THEN RAISE EXCEPTION 'cannot_kick_self'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);

  -- Review fix #2: lock the actor row so the role-matrix decision can't be made on a stale role.
  SELECT clan_id, clan_role INTO v_actor_clan, v_actor_role FROM users WHERE id = v_uid FOR UPDATE;
  IF v_actor_clan IS NULL THEN RAISE EXCEPTION 'not_in_clan'; END IF;

  SELECT clan_id, clan_role INTO v_tgt_clan, v_tgt_role FROM users WHERE id = p_target_user_id FOR UPDATE;
  IF NOT FOUND OR v_tgt_clan IS DISTINCT FROM v_actor_clan THEN RAISE EXCEPTION 'not_same_clan'; END IF;

  IF v_actor_role = 'president' THEN
    NULL;
  ELSIF v_actor_role = 'vp' THEN
    IF v_tgt_role IN ('president','vp') THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSIF v_actor_role = 'senior' THEN
    IF v_tgt_role <> 'member' THEN RAISE EXCEPTION 'forbidden'; END IF;
  ELSE
    RAISE EXCEPTION 'forbidden';
  END IF;

  UPDATE users SET clan_id = NULL, clan_role = NULL WHERE id = p_target_user_id;
  UPDATE clan_join_requests SET status = 'cancelled', decided_at = now()
    WHERE clan_id = v_actor_clan AND user_id = p_target_user_id AND status = 'pending';
  SELECT count(*) INTO v_new FROM users WHERE clan_id = v_actor_clan;
  UPDATE clans SET member_count = v_new WHERE id = v_actor_clan;
  RETURN jsonb_build_object('ok', TRUE, 'kicked', p_target_user_id, 'member_count', v_new);
END;
$$;
REVOKE ALL ON FUNCTION kick_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kick_member(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION set_member_role(p_target_user_id UUID, p_role TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_actor_role TEXT; v_actor_clan UUID; v_tgt_role TEXT; v_tgt_clan UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_role IS NULL OR p_role NOT IN ('president','vp','senior','member') THEN RAISE EXCEPTION 'bad_role'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);

  SELECT clan_id, clan_role INTO v_actor_clan, v_actor_role FROM users WHERE id = v_uid FOR UPDATE;
  IF v_actor_clan IS NULL THEN RAISE EXCEPTION 'not_in_clan'; END IF;
  IF v_actor_role <> 'president' THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_target_user_id = v_uid THEN
    IF p_role = 'president' THEN RETURN jsonb_build_object('ok', TRUE, 'role', 'president', 'noop', TRUE); END IF;
    RAISE EXCEPTION 'transfer_required';
  END IF;

  SELECT clan_id, clan_role INTO v_tgt_clan, v_tgt_role FROM users WHERE id = p_target_user_id FOR UPDATE;
  IF NOT FOUND OR v_tgt_clan IS DISTINCT FROM v_actor_clan THEN RAISE EXCEPTION 'not_same_clan'; END IF;

  IF p_role = 'president' THEN
    UPDATE users SET clan_role = 'president' WHERE id = p_target_user_id;
    UPDATE users SET clan_role = 'vp' WHERE id = v_uid;
    UPDATE clans SET owner_id = p_target_user_id WHERE id = v_actor_clan;
    RETURN jsonb_build_object('ok', TRUE, 'role', 'president', 'handover', TRUE, 'new_president', p_target_user_id);
  END IF;

  UPDATE users SET clan_role = p_role WHERE id = p_target_user_id;
  RETURN jsonb_build_object('ok', TRUE, 'role', p_role, 'target', p_target_user_id);
END;
$$;
REVOKE ALL ON FUNCTION set_member_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_member_role(UUID, TEXT) TO authenticated;

CREATE OR REPLACE FUNCTION update_clan(
  p_name TEXT DEFAULT NULL, p_description TEXT DEFAULT NULL, p_colour TEXT DEFAULT NULL,
  p_min_points INT DEFAULT NULL, p_min_hexes INT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_actor_role TEXT; v_actor_clan UUID; v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  SELECT clan_id, clan_role INTO v_actor_clan, v_actor_role FROM users WHERE id = v_uid;
  IF v_actor_clan IS NULL THEN RAISE EXCEPTION 'not_in_clan'; END IF;
  IF v_actor_role NOT IN ('president','vp') THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF p_name IS NOT NULL THEN
    v_name := btrim(p_name);
    IF length(v_name) = 0 OR length(v_name) > 40 THEN RAISE EXCEPTION 'bad_name'; END IF;
  END IF;
  IF p_min_points IS NOT NULL AND p_min_points < 0 THEN RAISE EXCEPTION 'bad_requirements'; END IF;
  IF p_min_hexes  IS NOT NULL AND p_min_hexes  < 0 THEN RAISE EXCEPTION 'bad_requirements'; END IF;

  UPDATE clans SET
    name        = COALESCE(v_name, name),
    description = CASE WHEN p_description IS NULL THEN description ELSE left(btrim(p_description), 280) END,
    colour      = COALESCE(NULLIF(btrim(COALESCE(p_colour,'')), ''), colour),
    min_points  = COALESCE(p_min_points, min_points),
    min_hexes   = COALESCE(p_min_hexes, min_hexes)
  WHERE id = v_actor_clan;
  RETURN jsonb_build_object('ok', TRUE, 'clan_id', v_actor_clan);
END;
$$;
REVOKE ALL ON FUNCTION update_clan(TEXT, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION update_clan(TEXT, TEXT, TEXT, INT, INT) TO authenticated;

CREATE OR REPLACE FUNCTION disband_clan()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid(); v_actor_role TEXT; v_actor_clan UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);
  SELECT clan_id, clan_role INTO v_actor_clan, v_actor_role FROM users WHERE id = v_uid FOR UPDATE;
  IF v_actor_clan IS NULL THEN RAISE EXCEPTION 'not_in_clan'; END IF;
  IF v_actor_role <> 'president' THEN RAISE EXCEPTION 'forbidden'; END IF;

  PERFORM 1 FROM clans WHERE id = v_actor_clan FOR UPDATE;
  UPDATE users SET clan_id = NULL, clan_role = NULL WHERE clan_id = v_actor_clan;
  DELETE FROM clans WHERE id = v_actor_clan;
  RETURN jsonb_build_object('ok', TRUE, 'disbanded', TRUE, 'clan_id', v_actor_clan);
END;
$$;
REVOKE ALL ON FUNCTION disband_clan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION disband_clan() TO authenticated;

CREATE OR REPLACE FUNCTION leave_clan()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_clan_id UUID; v_role TEXT; v_owner_id UUID; v_new_owner UUID; v_new INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);
  SELECT clan_id, clan_role INTO v_clan_id, v_role FROM users WHERE id = v_uid FOR UPDATE;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'not_in_clan'; END IF;
  SELECT owner_id INTO v_owner_id FROM clans WHERE id = v_clan_id FOR UPDATE;

  UPDATE users SET clan_id = NULL, clan_role = NULL WHERE id = v_uid; -- detach first

  SELECT count(*) INTO v_new FROM users WHERE clan_id = v_clan_id;
  IF v_new = 0 THEN
    DELETE FROM clans WHERE id = v_clan_id;
    RETURN jsonb_build_object('ok', TRUE, 'disbanded', TRUE);
  END IF;

  IF v_owner_id = v_uid OR v_role = 'president' THEN
    -- Review fix #5: normalise any stray presidents among remaining members, then promote one.
    UPDATE users SET clan_role = 'vp' WHERE clan_id = v_clan_id AND clan_role = 'president';
    SELECT id INTO v_new_owner FROM users WHERE clan_id = v_clan_id ORDER BY created_at ASC, id ASC LIMIT 1;
    UPDATE users SET clan_role = 'president' WHERE id = v_new_owner;
    UPDATE clans SET owner_id = v_new_owner, member_count = v_new WHERE id = v_clan_id;
    RETURN jsonb_build_object('ok', TRUE, 'disbanded', FALSE, 'new_owner', v_new_owner, 'member_count', v_new);
  END IF;

  UPDATE clans SET member_count = v_new WHERE id = v_clan_id;
  RETURN jsonb_build_object('ok', TRUE, 'disbanded', FALSE, 'member_count', v_new);
END;
$$;
REVOKE ALL ON FUNCTION leave_clan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leave_clan() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 5. AGGREGATE STATS + CLAN-VS-CLAN LEADERBOARD (SECURITY DEFINER; aggregates only)
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION clan_stats(p_clan_id UUID)
RETURNS TABLE (clan_id UUID, name TEXT, member_count INT, total_points BIGINT, total_hexes BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT c.id, c.name, c.member_count,
         COALESCE(SUM(u.current_round_points), 0)::BIGINT,
         COALESCE(SUM(u.current_held_hexes), 0)::BIGINT
  FROM clans c LEFT JOIN users u ON u.clan_id = c.id
  WHERE c.id = p_clan_id GROUP BY c.id, c.name, c.member_count;
$$;
REVOKE ALL ON FUNCTION clan_stats(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clan_stats(UUID) TO authenticated;

CREATE OR REPLACE FUNCTION clans_leaderboard(p_limit INT DEFAULT 50, p_offset INT DEFAULT 0)
RETURNS TABLE (rank BIGINT, clan_id UUID, name TEXT, colour TEXT, member_count INT, total_points BIGINT, total_hexes BIGINT)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  WITH agg AS (
    SELECT c.id, c.name, c.colour, c.member_count,
           COALESCE(SUM(u.current_round_points), 0)::BIGINT AS total_points,
           COALESCE(SUM(u.current_held_hexes), 0)::BIGINT   AS total_hexes
    FROM clans c LEFT JOIN users u ON u.clan_id = c.id
    GROUP BY c.id, c.name, c.colour, c.member_count
  )
  SELECT ROW_NUMBER() OVER (ORDER BY total_points DESC, total_hexes DESC, name ASC),
         id, name, colour, member_count, total_points, total_hexes
  FROM agg ORDER BY total_points DESC, total_hexes DESC, name ASC
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200) OFFSET GREATEST(COALESCE(p_offset, 0), 0);
$$;
REVOKE ALL ON FUNCTION clans_leaderboard(INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clans_leaderboard(INT, INT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 6. CLAN CHAT — membership-scoped RLS (current members only)
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE clan_messages (
  id         BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  clan_id    UUID NOT NULL REFERENCES clans(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL CHECK (length(btrim(body)) BETWEEN 1 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clan_messages_clan_idx ON clan_messages(clan_id, created_at DESC);

ALTER TABLE clan_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY clan_messages_select_member ON clan_messages
  FOR SELECT TO authenticated
  USING (clan_id = (SELECT u.clan_id FROM users u WHERE u.id = auth.uid()));
CREATE POLICY clan_messages_insert_member ON clan_messages
  FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND clan_id = (SELECT u.clan_id FROM users u WHERE u.id = auth.uid()));
GRANT SELECT, INSERT ON TABLE clan_messages TO authenticated;
