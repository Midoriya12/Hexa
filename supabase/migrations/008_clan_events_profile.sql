-- 008_clan_events_profile.sql — Hexa social polish (testing feedback round):
--   1. Clan CHAT SYSTEM EVENTS: joined / requested / promoted / demoted / handover / left / kicked
--      / founded are posted as kind='system' lines into clan_messages.
--   2. Join requests carry an optional MESSAGE (shown to officers reviewing).
--   3. user_card(p_id): one definer RPC for the profile screen — public stats + the player's CLAN
--      (name/role, which public_users hides) + the viewer's FRIENDSHIP status with them.
--
-- All mutating RPCs are re-created faithfully from 006 (same locks / role matrix / atomic debit /
-- cap-on-fresh-count) with ONLY the system-message emit (and request message) added. Builds on 006.

-- ════════════════════════════════════════════════════════════════════════════════
-- 1. SCHEMA: message kind + join-request message
-- ════════════════════════════════════════════════════════════════════════════════
ALTER TABLE clan_messages
  ADD COLUMN kind TEXT NOT NULL DEFAULT 'user' CHECK (kind IN ('user','system'));

ALTER TABLE clan_join_requests
  ADD COLUMN message TEXT;

-- Internal logger: posts a system line to a clan's chat. SECURITY DEFINER (bypasses the
-- member-only insert RLS) and NOT granted to clients — only the clan RPCs below call it.
CREATE OR REPLACE FUNCTION clan_log(p_clan_id UUID, p_actor UUID, p_body TEXT)
RETURNS VOID LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  INSERT INTO clan_messages (clan_id, user_id, body, kind)
  VALUES (p_clan_id, p_actor, left(btrim(p_body), 1000), 'system');
$$;
REVOKE ALL ON FUNCTION clan_log(UUID, UUID, TEXT) FROM PUBLIC;

-- Display name helper (used by the emits). STABLE; definer so it reads any user.
CREATE OR REPLACE FUNCTION clan_display_name(p_id UUID)
RETURNS TEXT LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(NULLIF(btrim(display_name), ''), username, 'A player') FROM users WHERE id = p_id;
$$;
REVOKE ALL ON FUNCTION clan_display_name(UUID) FROM PUBLIC;

-- ════════════════════════════════════════════════════════════════════════════════
-- 2. request_to_join — now takes an optional message + logs "requested to join"
--    (drop the 1-arg version so there's a single canonical signature)
-- ════════════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS request_to_join(UUID);

CREATE OR REPLACE FUNCTION request_to_join(p_clan_id UUID, p_message TEXT DEFAULT NULL)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing UUID; v_pts INT; v_hex INT; v_minp INT; v_minh INT; v_req_id BIGINT;
  v_msg TEXT := NULLIF(left(btrim(COALESCE(p_message, '')), 280), '');
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

  INSERT INTO clan_join_requests (clan_id, user_id, status, message)
  VALUES (p_clan_id, v_uid, 'pending', v_msg)
  ON CONFLICT (clan_id, user_id) WHERE status = 'pending'
    DO UPDATE SET created_at = now(), message = v_msg
  RETURNING id INTO v_req_id;

  PERFORM clan_log(p_clan_id, v_uid, clan_display_name(v_uid) || ' requested to join.');
  RETURN jsonb_build_object('ok', TRUE, 'request_id', v_req_id, 'status', 'pending');
END;
$$;
REVOKE ALL ON FUNCTION request_to_join(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION request_to_join(UUID, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 3. respond_join_request — logs "<name> joined the clan" on accept
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION respond_join_request(p_request_id BIGINT, p_accept BOOLEAN)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_actor_role TEXT; v_actor_clan UUID;
  v_req clan_join_requests%ROWTYPE; v_target_clan UUID; v_count INT; v_new INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);

  SELECT clan_id, clan_role INTO v_actor_clan, v_actor_role FROM users WHERE id = v_uid FOR UPDATE;
  IF v_actor_role IS NULL OR v_actor_role NOT IN ('president','vp') THEN RAISE EXCEPTION 'forbidden'; END IF;

  SELECT * INTO v_req FROM clan_join_requests WHERE id = p_request_id AND status = 'pending' FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'request_not_found'; END IF;
  IF v_req.clan_id <> v_actor_clan THEN RAISE EXCEPTION 'forbidden'; END IF;

  IF NOT p_accept THEN
    UPDATE clan_join_requests SET status = 'rejected', decided_at = now(), decided_by = v_uid WHERE id = p_request_id;
    RETURN jsonb_build_object('ok', TRUE, 'status', 'rejected');
  END IF;

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

  PERFORM clan_log(v_req.clan_id, v_req.user_id, clan_display_name(v_req.user_id) || ' joined the clan.');
  RETURN jsonb_build_object('ok', TRUE, 'status', 'accepted', 'user_id', v_req.user_id, 'member_count', v_new);
END;
$$;
REVOKE ALL ON FUNCTION respond_join_request(BIGINT, BOOLEAN) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION respond_join_request(BIGINT, BOOLEAN) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 4. create_clan — logs "founded the clan"
-- ════════════════════════════════════════════════════════════════════════════════
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

  UPDATE users SET current_round_points = current_round_points - c_cost, clan_id = v_clan_id, clan_role = 'president'
   WHERE id = v_uid AND current_round_points >= c_cost;
  IF NOT FOUND THEN RAISE EXCEPTION 'insufficient_points'; END IF;

  PERFORM clan_log(v_clan_id, v_uid, clan_display_name(v_uid) || ' founded the clan. 🎉');
  RETURN jsonb_build_object('ok', TRUE, 'clan_id', v_clan_id, 'member_count', 1, 'cost', c_cost);
END;
$$;
REVOKE ALL ON FUNCTION create_clan(TEXT, TEXT, TEXT, INT, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_clan(TEXT, TEXT, TEXT, INT, INT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 5. kick_member — logs "<name> was removed"
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION kick_member(p_target_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_actor_role TEXT; v_actor_clan UUID;
  v_tgt_role TEXT; v_tgt_clan UUID; v_new INT; v_tgt_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_target_user_id IS NULL THEN RAISE EXCEPTION 'bad_target'; END IF;
  IF p_target_user_id = v_uid THEN RAISE EXCEPTION 'cannot_kick_self'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);

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

  v_tgt_name := clan_display_name(p_target_user_id);
  UPDATE users SET clan_id = NULL, clan_role = NULL WHERE id = p_target_user_id;
  UPDATE clan_join_requests SET status = 'cancelled', decided_at = now()
    WHERE clan_id = v_actor_clan AND user_id = p_target_user_id AND status = 'pending';
  SELECT count(*) INTO v_new FROM users WHERE clan_id = v_actor_clan;
  UPDATE clans SET member_count = v_new WHERE id = v_actor_clan;

  PERFORM clan_log(v_actor_clan, v_uid, v_tgt_name || ' was removed from the clan.');
  RETURN jsonb_build_object('ok', TRUE, 'kicked', p_target_user_id, 'member_count', v_new);
END;
$$;
REVOKE ALL ON FUNCTION kick_member(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION kick_member(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 6. set_member_role — logs promote / demote / handover
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION set_member_role(p_target_user_id UUID, p_role TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_actor_role TEXT; v_actor_clan UUID; v_tgt_role TEXT; v_tgt_clan UUID;
  v_tgt_name TEXT; v_label TEXT; v_old_rank INT; v_new_rank INT;
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

  v_tgt_name := clan_display_name(p_target_user_id);

  IF p_role = 'president' THEN
    UPDATE users SET clan_role = 'president' WHERE id = p_target_user_id;
    UPDATE users SET clan_role = 'vp' WHERE id = v_uid;
    UPDATE clans SET owner_id = p_target_user_id WHERE id = v_actor_clan;
    PERFORM clan_log(v_actor_clan, v_uid, v_tgt_name || ' is now the President. ' || clan_display_name(v_uid) || ' is now VP.');
    RETURN jsonb_build_object('ok', TRUE, 'role', 'president', 'handover', TRUE, 'new_president', p_target_user_id);
  END IF;

  UPDATE users SET clan_role = p_role WHERE id = p_target_user_id;
  v_label := (CASE p_role WHEN 'vp' THEN 'VP' WHEN 'senior' THEN 'Senior' ELSE 'Member' END);
  v_old_rank := (CASE v_tgt_role WHEN 'president' THEN 3 WHEN 'vp' THEN 2 WHEN 'senior' THEN 1 ELSE 0 END);
  v_new_rank := (CASE p_role WHEN 'president' THEN 3 WHEN 'vp' THEN 2 WHEN 'senior' THEN 1 ELSE 0 END);
  PERFORM clan_log(
    v_actor_clan, v_uid,
    v_tgt_name || ' was ' || (CASE WHEN v_new_rank > v_old_rank THEN 'promoted' ELSE 'demoted' END) || ' to ' || v_label || '.'
  );
  RETURN jsonb_build_object('ok', TRUE, 'role', p_role, 'target', p_target_user_id);
END;
$$;
REVOKE ALL ON FUNCTION set_member_role(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION set_member_role(UUID, TEXT) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 7. leave_clan — logs "<name> left" (unless the clan disbanded)
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION leave_clan()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid(); v_clan_id UUID; v_role TEXT; v_owner_id UUID; v_new_owner UUID; v_new INT;
  v_name TEXT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);
  SELECT clan_id, clan_role INTO v_clan_id, v_role FROM users WHERE id = v_uid FOR UPDATE;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'not_in_clan'; END IF;
  v_name := clan_display_name(v_uid);
  SELECT owner_id INTO v_owner_id FROM clans WHERE id = v_clan_id FOR UPDATE;

  UPDATE users SET clan_id = NULL, clan_role = NULL WHERE id = v_uid; -- detach first

  SELECT count(*) INTO v_new FROM users WHERE clan_id = v_clan_id;
  IF v_new = 0 THEN
    DELETE FROM clans WHERE id = v_clan_id;
    RETURN jsonb_build_object('ok', TRUE, 'disbanded', TRUE);
  END IF;

  PERFORM clan_log(v_clan_id, v_uid, v_name || ' left the clan.');

  IF v_owner_id = v_uid OR v_role = 'president' THEN
    UPDATE users SET clan_role = 'vp' WHERE clan_id = v_clan_id AND clan_role = 'president';
    SELECT id INTO v_new_owner FROM users WHERE clan_id = v_clan_id ORDER BY created_at ASC, id ASC LIMIT 1;
    UPDATE users SET clan_role = 'president' WHERE id = v_new_owner;
    UPDATE clans SET owner_id = v_new_owner, member_count = v_new WHERE id = v_clan_id;
    PERFORM clan_log(v_clan_id, v_new_owner, clan_display_name(v_new_owner) || ' is now the President.');
    RETURN jsonb_build_object('ok', TRUE, 'disbanded', FALSE, 'new_owner', v_new_owner, 'member_count', v_new);
  END IF;

  UPDATE clans SET member_count = v_new WHERE id = v_clan_id;
  RETURN jsonb_build_object('ok', TRUE, 'disbanded', FALSE, 'member_count', v_new);
END;
$$;
REVOKE ALL ON FUNCTION leave_clan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leave_clan() TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- 8. user_card — profile screen data: public stats + clan (name/role) + friendship status
-- ════════════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION user_card(p_id UUID)
RETURNS TABLE (
  id UUID, username TEXT, display_name TEXT, level INT, hex_colour TEXT,
  current_round_points INT, captures BIGINT, ghost_mode BOOLEAN,
  clan_id UUID, clan_name TEXT, clan_role TEXT,
  friendship TEXT, friendship_id BIGINT
)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  RETURN QUERY
  SELECT
    u.id, u.username, u.display_name, u.level, u.hex_colour, u.current_round_points,
    (SELECT count(*) FROM captures c WHERE c.user_id = u.id)::BIGINT,
    u.ghost_mode, u.clan_id, cl.name, u.clan_role,
    CASE
      WHEN v_uid IS NULL OR v_uid = u.id THEN 'none'
      WHEN EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'accepted'
                   AND ((f.requester_id = v_uid AND f.addressee_id = u.id)
                     OR (f.requester_id = u.id AND f.addressee_id = v_uid))) THEN 'friends'
      WHEN EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'pending'
                   AND f.requester_id = u.id AND f.addressee_id = v_uid) THEN 'incoming'
      WHEN EXISTS (SELECT 1 FROM friendships f WHERE f.status = 'pending'
                   AND f.requester_id = v_uid AND f.addressee_id = u.id) THEN 'outgoing'
      ELSE 'none'
    END,
    (SELECT f.id FROM friendships f
      WHERE (f.requester_id = v_uid AND f.addressee_id = u.id)
         OR (f.requester_id = u.id AND f.addressee_id = v_uid)
      ORDER BY f.id LIMIT 1)
  FROM users u LEFT JOIN clans cl ON cl.id = u.clan_id
  WHERE u.id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION user_card(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_card(UUID) TO authenticated;
