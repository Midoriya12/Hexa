-- 005_clans_friendships.sql — Hexa Step C (Phase 11 social): CLANS + FRIENDSHIPS.
-- Authority: Spec Patches > v3 Design Spec > Build Spec PDF.
--
-- Model:
--   • One clan per user via the EXISTING users.clan_id column (index users_clan_idx, 001).
--   • Clans are mutated ONLY through SECURITY DEFINER RPCs (create/join/leave) — and crucially,
--     users.clan_id is GUARDED by a trigger so it can ONLY be changed inside those RPCs. That
--     closes the cap-bypass where a client could `UPDATE users SET clan_id` directly (the
--     users_update_own policy from 001 otherwise allows it).
--   • member_count is RECOMPUTED from the actual membership inside the row-locked section on
--     every join/leave, so it can never drift from COUNT(users WHERE clan_id = X).
--   • clan rosters are exposed via the clan_members() RPC (public_users has no clan_id, and base
--     users is owner-only RLS, so a clan's member list isn't otherwise client-reachable).
--   • Friendships use plain RLS'd table ops + an immutability trigger pinning the two parties.
--
-- Patches honoured: #32 (100-member cap, race-proof) · #27 (no postgis/h3) · #5/#25 (authenticated-only grants).

-- ════════════════════════════════════════════════════════════════════════════════
-- CLANS
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE clans (
  id            UUID PRIMARY KEY DEFAULT extensions.uuid_generate_v4(),
  name          TEXT NOT NULL,
  colour        TEXT NOT NULL DEFAULT '#FF6F00',
  owner_id      UUID REFERENCES users(id) ON DELETE SET NULL,
  member_count  INT NOT NULL DEFAULT 1 CHECK (member_count BETWEEN 0 AND 100),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX clans_owner_idx ON clans(owner_id);

-- Formalise the FK 001 deferred. ON DELETE SET NULL: disbanding clears ex-members' clan_id.
ALTER TABLE users
  ADD CONSTRAINT users_clan_id_fkey FOREIGN KEY (clan_id) REFERENCES clans(id) ON DELETE SET NULL;

ALTER TABLE clans ENABLE ROW LEVEL SECURITY;
CREATE POLICY clans_select_all ON clans FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON TABLE clans TO authenticated;

-- ── Guard: users.clan_id may ONLY change inside a clan RPC (which sets the txn-local flag). ──
-- Blocks the cap-bypass: a direct client `UPDATE users SET clan_id = X` (allowed by
-- users_update_own) would skip the cap check; this trigger rejects it unless hexa.clan_write='1'.
CREATE OR REPLACE FUNCTION guard_users_clan_id()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.clan_id IS DISTINCT FROM OLD.clan_id
     AND COALESCE(current_setting('hexa.clan_write', true), '') <> '1' THEN
    RAISE EXCEPTION 'clan_id is managed by clan actions';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER users_guard_clan_id BEFORE UPDATE ON users
  FOR EACH ROW EXECUTE FUNCTION guard_users_clan_id();

-- ── create_clan: creator becomes owner + sole member (one clan per user). ───────────────────
CREATE OR REPLACE FUNCTION create_clan(p_name TEXT, p_colour TEXT)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clan_id UUID;
  v_existing UUID;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true); -- allow this txn to touch users.clan_id

  p_name := btrim(COALESCE(p_name, ''));
  IF length(p_name) = 0 OR length(p_name) > 40 THEN RAISE EXCEPTION 'bad_name'; END IF;
  p_colour := NULLIF(btrim(COALESCE(p_colour, '')), '');

  SELECT clan_id INTO v_existing FROM users WHERE id = v_uid FOR UPDATE;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'already_in_clan'; END IF;

  INSERT INTO clans (name, colour, owner_id, member_count)
  VALUES (p_name, COALESCE(p_colour, '#FF6F00'), v_uid, 1)
  RETURNING id INTO v_clan_id;

  UPDATE users SET clan_id = v_clan_id WHERE id = v_uid;
  RETURN jsonb_build_object('ok', TRUE, 'clan_id', v_clan_id, 'member_count', 1);
END;
$$;
REVOKE ALL ON FUNCTION create_clan(TEXT, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION create_clan(TEXT, TEXT) TO authenticated;

-- ── join_clan: race-proof 100-member cap (patch #32); member_count recomputed from truth. ────
CREATE OR REPLACE FUNCTION join_clan(p_clan_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_existing UUID;
  v_count INT;
  v_new INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_clan_id IS NULL THEN RAISE EXCEPTION 'bad_clan'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);

  SELECT clan_id INTO v_existing FROM users WHERE id = v_uid FOR UPDATE;
  IF v_existing IS NOT NULL THEN RAISE EXCEPTION 'already_in_clan'; END IF;

  -- Lock the clan row — the serialisation point that makes the cap race-proof.
  SELECT member_count INTO v_count FROM clans WHERE id = p_clan_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'clan_not_found'; END IF;
  IF v_count >= 100 THEN RAISE EXCEPTION 'clan_full'; END IF;

  UPDATE users SET clan_id = p_clan_id WHERE id = v_uid;
  -- Recompute from truth so member_count can never drift.
  SELECT count(*) INTO v_new FROM users WHERE clan_id = p_clan_id;
  UPDATE clans SET member_count = v_new WHERE id = p_clan_id;
  RETURN jsonb_build_object('ok', TRUE, 'clan_id', p_clan_id, 'member_count', v_new);
END;
$$;
REVOKE ALL ON FUNCTION join_clan(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION join_clan(UUID) TO authenticated;

-- ── leave_clan: decrement (recompute); handle owner leaving (transfer or disband). ───────────
CREATE OR REPLACE FUNCTION leave_clan()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid UUID := auth.uid();
  v_clan_id UUID;
  v_owner_id UUID;
  v_new_owner UUID;
  v_new INT;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  PERFORM set_config('hexa.clan_write', '1', true);

  SELECT clan_id INTO v_clan_id FROM users WHERE id = v_uid FOR UPDATE;
  IF v_clan_id IS NULL THEN RAISE EXCEPTION 'not_in_clan'; END IF;

  SELECT owner_id INTO v_owner_id FROM clans WHERE id = v_clan_id FOR UPDATE;

  UPDATE users SET clan_id = NULL WHERE id = v_uid; -- detach first

  SELECT count(*) INTO v_new FROM users WHERE clan_id = v_clan_id;
  IF v_new = 0 THEN
    DELETE FROM clans WHERE id = v_clan_id; -- disband (FK SET NULL clears any stragglers)
    RETURN jsonb_build_object('ok', TRUE, 'disbanded', TRUE);
  END IF;

  IF v_owner_id = v_uid THEN
    -- Owner left, others remain → promote the longest-standing member.
    SELECT id INTO v_new_owner FROM users WHERE clan_id = v_clan_id ORDER BY created_at ASC, id ASC LIMIT 1;
    UPDATE clans SET owner_id = v_new_owner, member_count = v_new WHERE id = v_clan_id;
    RETURN jsonb_build_object('ok', TRUE, 'disbanded', FALSE, 'new_owner', v_new_owner, 'member_count', v_new);
  END IF;

  UPDATE clans SET member_count = v_new WHERE id = v_clan_id;
  RETURN jsonb_build_object('ok', TRUE, 'disbanded', FALSE, 'member_count', v_new);
END;
$$;
REVOKE ALL ON FUNCTION leave_clan() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION leave_clan() TO authenticated;

-- ── clan_members: a clan's roster as public_users-shaped rows, ranked by points. ─────────────
-- Needed because public_users has no clan_id and base users is owner-only RLS. SECURITY DEFINER
-- so it can read users.clan_id; returns only the already-public columns.
CREATE OR REPLACE FUNCTION clan_members(p_clan_id UUID)
RETURNS SETOF public_users
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT pu.* FROM public_users pu
  JOIN users u ON u.id = pu.id
  WHERE u.clan_id = p_clan_id
  ORDER BY pu.current_round_points DESC NULLS LAST;
$$;
REVOKE ALL ON FUNCTION clan_members(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clan_members(UUID) TO authenticated;

-- ════════════════════════════════════════════════════════════════════════════════
-- FRIENDSHIPS  (plain RLS'd table + immutability trigger)
-- ════════════════════════════════════════════════════════════════════════════════
CREATE TABLE friendships (
  id            BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  requester_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  addressee_id  UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status        TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (requester_id <> addressee_id)
);
-- Direction-agnostic uniqueness: {A,B} and {B,A} collide (no dup / reverse-dup).
CREATE UNIQUE INDEX friendships_pair_uidx
  ON friendships (LEAST(requester_id, addressee_id), GREATEST(requester_id, addressee_id));
CREATE INDEX friendships_requester_idx ON friendships(requester_id);
CREATE INDEX friendships_addressee_idx ON friendships(addressee_id);

ALTER TABLE friendships ENABLE ROW LEVEL SECURITY;

CREATE POLICY friendships_select_party ON friendships
  FOR SELECT TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);
CREATE POLICY friendships_insert_requester ON friendships
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = requester_id AND status = 'pending');
CREATE POLICY friendships_update_addressee ON friendships
  FOR UPDATE TO authenticated
  USING (auth.uid() = addressee_id AND status = 'pending')
  WITH CHECK (auth.uid() = addressee_id AND status = 'accepted');
CREATE POLICY friendships_delete_party ON friendships
  FOR DELETE TO authenticated USING (auth.uid() = requester_id OR auth.uid() = addressee_id);

-- Pin the parties: an accept (UPDATE) may change status only, never who's in the relationship.
CREATE OR REPLACE FUNCTION guard_friendship_parties()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.requester_id <> OLD.requester_id OR NEW.addressee_id <> OLD.addressee_id THEN
    RAISE EXCEPTION 'friendship parties are immutable';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER friendships_guard BEFORE UPDATE ON friendships
  FOR EACH ROW EXECUTE FUNCTION guard_friendship_parties();

GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE friendships TO authenticated;
