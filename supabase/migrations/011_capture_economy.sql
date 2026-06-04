-- 011_capture_economy.sql — Hexa Phase 5 (Economy), part 2: CAPTURE v2 + STEAL.
-- Extends capture_hex (003) with the steal economy. Decisions (Sai 2026-06-04): steal ×1.5 (150 vs
-- neutral 100); Fresh-Paint 30 min (a fresh hex can't be stolen); Block 15 min (nobody can take a
-- just-captured hex — anti ping-pong); farm-to-zero floor (a steal can't drop the victim below a
-- level-scaled held floor). Revisit + Assist DEFERRED (no client path). Points go through
-- grant_points (010) so RP+LP never drift; check_level_up runs last.

-- ── Schema additions ──────────────────────────────────────────────────────────────────────────
ALTER TABLE hexes ADD COLUMN pph_value INT; -- rarity rent hook; NULL ⇒ flat fallback (see 012 rent)

ALTER TABLE hex_ownership ADD COLUMN fresh_paint_until TIMESTAMPTZ; -- steal-immune until this (nullable = none)
ALTER TABLE hex_ownership ADD COLUMN block_until       TIMESTAMPTZ; -- nobody can capture until this
ALTER TABLE hex_ownership ADD COLUMN last_visited_at   TIMESTAMPTZ; -- for the rent soft-cap recency order

-- Index for the rent engine's per-owner "most-recently-touched 500" window (012).
CREATE INDEX hex_ownership_recency_idx
  ON hex_ownership (owner_id, (COALESCE(last_visited_at, captured_at)) DESC, h3_index);

ALTER TABLE captures
  ADD COLUMN capture_type TEXT NOT NULL DEFAULT 'neutral'
  CHECK (capture_type IN ('neutral', 'steal', 'revisit', 'assist')); -- revisit/assist forward-compat only
UPDATE captures SET capture_type = 'steal' WHERE prev_owner_id IS NOT NULL AND prev_owner_id <> user_id;

-- ── capture_hex v2 ──────────────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION capture_hex(p_h3 TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
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
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;

  IF p_lat IS NULL OR p_lng IS NULL OR p_lat <> p_lat OR p_lng <> p_lng
     OR p_lat NOT BETWEEN -90 AND 90 OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'bad_coords';
  END IF;

  -- Lock the always-present parent hex row to serialise concurrent captures of the same cell.
  SELECT * INTO v_hex FROM hexes WHERE h3_index = p_h3 AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'hex_not_found'; END IF;

  IF NOT hexa_point_in_hex(p_lat, p_lng, v_hex.boundary) THEN RAISE EXCEPTION 'outside_hex'; END IF;

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
  UPDATE users SET last_capture_at = now() WHERE id = v_uid;

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
REVOKE ALL ON FUNCTION capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
