-- 003_capture.sql — Hexa Step B (Phase 3/4): hex ownership + capture events + the
-- server-validated capture_hex() RPC. Authority: Spec Patches > v3 Design Spec > Build Spec.
--
-- Model (patches #34, #39, #40):
--   • Full H3 res-10 tessellation; a player captures the ONE hex they're standing in.
--   • Capture is SERVER-VALIDATED via capture_hex() — clients NEVER write ownership directly,
--     so the API can't be hit to claim hexes you aren't near. (Deeper anti-cheat = Phase 8.)
--   • Caps relaxed (#40): no daily/held caps enforced here. Dwell is client-side for now (#39);
--     server validates location proximity. Flat IP=100 for now (rarity tiers are a later refinement).

-- ── hex_ownership: who currently holds each hex (rows exist only for owned hexes) ──────────
CREATE TABLE hex_ownership (
  h3_index     TEXT PRIMARY KEY REFERENCES hexes(h3_index) ON DELETE CASCADE,
  owner_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  captured_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ip_value     INT NOT NULL DEFAULT 100   -- Instant Points this hex awarded on capture
);
CREATE INDEX hex_ownership_owner_idx ON hex_ownership(owner_id);

-- ── captures: append-only event log (feed, history, steal tracking) ────────────────────────
CREATE TABLE captures (
  id             BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  h3_index       TEXT NOT NULL REFERENCES hexes(h3_index) ON DELETE CASCADE,
  user_id        UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  prev_owner_id  UUID REFERENCES users(id) ON DELETE SET NULL,  -- who we stole it from (null = neutral)
  ip_awarded     INT NOT NULL,
  captured_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX captures_user_idx ON captures(user_id, captured_at DESC);
CREATE INDEX captures_hex_idx  ON captures(h3_index, captured_at DESC);

-- ── RLS: everyone authenticated may READ ownership + captures (to render the map / feed);
--    NO client writes — only capture_hex() (SECURITY DEFINER) mutates these tables. ──────────
ALTER TABLE hex_ownership ENABLE ROW LEVEL SECURITY;
CREATE POLICY hex_ownership_select_all ON hex_ownership FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON hex_ownership TO authenticated;

ALTER TABLE captures ENABLE ROW LEVEL SECURITY;
CREATE POLICY captures_select_all ON captures FOR SELECT TO authenticated USING (TRUE);
GRANT SELECT ON captures TO authenticated;

-- ── haversine distance in metres (no postgis dependency — patch #27) ────────────────────────
CREATE OR REPLACE FUNCTION hexa_distance_m(lat1 DOUBLE PRECISION, lng1 DOUBLE PRECISION,
                                           lat2 DOUBLE PRECISION, lng2 DOUBLE PRECISION)
RETURNS DOUBLE PRECISION LANGUAGE sql IMMUTABLE AS $$
  SELECT 6371000 * 2 * asin(sqrt(
    power(sin(radians(lat2 - lat1) / 2), 2) +
    cos(radians(lat1)) * cos(radians(lat2)) * power(sin(radians(lng2 - lng1) / 2), 2)
  ));
$$;

-- ── capture_hex: the ONLY write path. Validates server-side, then atomically claims. ────────
-- Caller is the authenticated user (auth.uid()). Returns JSON describing the result.
CREATE OR REPLACE FUNCTION capture_hex(p_h3 TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_hex   hexes%ROWTYPE;
  v_dist  DOUBLE PRECISION;
  v_prev  UUID;
  v_ip    INT := 100;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Hex must exist + be active.
  SELECT * INTO v_hex FROM hexes WHERE h3_index = p_h3 AND is_active = TRUE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'hex_not_found';
  END IF;

  -- Reported location must be inside/near the hex (res-10 circumradius ~75m + GPS tolerance).
  -- This blocks claiming a hex you aren't standing in by calling the API directly.
  v_dist := hexa_distance_m(p_lat, p_lng, v_hex.center_lat, v_hex.center_lng);
  IF v_dist > 95 THEN
    RAISE EXCEPTION 'too_far:%', round(v_dist)::TEXT;
  END IF;

  -- Lock the ownership row (if any) to serialise concurrent captures of the same hex.
  SELECT owner_id INTO v_prev FROM hex_ownership WHERE h3_index = p_h3 FOR UPDATE;
  IF v_prev = v_uid THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  -- Claim (or steal): upsert ownership.
  INSERT INTO hex_ownership (h3_index, owner_id, captured_at, ip_value)
  VALUES (p_h3, v_uid, now(), v_ip)
  ON CONFLICT (h3_index) DO UPDATE SET owner_id = v_uid, captured_at = now(), ip_value = v_ip;

  -- Log the event.
  INSERT INTO captures (h3_index, user_id, prev_owner_id, ip_awarded)
  VALUES (p_h3, v_uid, v_prev, v_ip);

  -- Stats: capturer +1 held, +IP points.
  UPDATE users
     SET current_held_hexes  = COALESCE(current_held_hexes, 0) + 1,
         current_round_points = COALESCE(current_round_points, 0) + v_ip
   WHERE id = v_uid;

  -- Steal: previous owner loses the hex from their held count.
  IF v_prev IS NOT NULL THEN
    UPDATE users
       SET current_held_hexes = GREATEST(COALESCE(current_held_hexes, 0) - 1, 0)
     WHERE id = v_prev;
  END IF;

  RETURN jsonb_build_object('ok', TRUE, 'h3', p_h3, 'ip', v_ip, 'stolen_from', v_prev);
END;
$$;

-- Only authenticated users may call it; revoke the default public execute.
REVOKE ALL ON FUNCTION capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
