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

-- ── point-in-polygon against the stored cell boundary (ray casting; no postgis — patch #27) ──
-- boundary is GeoJSON Polygon: { coordinates: [[ [lng,lat], … (closed ring) ]] }. We test the
-- TRUE cell, not a radius around the centroid (which would also match adjacent cells).
CREATE OR REPLACE FUNCTION hexa_point_in_hex(p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION, p_boundary JSONB)
RETURNS BOOLEAN LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE
  ring   JSONB := p_boundary -> 'coordinates' -> 0;
  n      INT;
  i      INT := 0;
  j      INT;
  xi     DOUBLE PRECISION; yi DOUBLE PRECISION;
  xj     DOUBLE PRECISION; yj DOUBLE PRECISION;
  inside BOOLEAN := FALSE;
BEGIN
  IF ring IS NULL THEN RETURN FALSE; END IF;
  n := jsonb_array_length(ring);
  IF n < 4 THEN RETURN FALSE; END IF;  -- need a real ring
  j := n - 1;
  WHILE i < n LOOP
    xi := (ring -> i ->> 0)::DOUBLE PRECISION; yi := (ring -> i ->> 1)::DOUBLE PRECISION;
    xj := (ring -> j ->> 0)::DOUBLE PRECISION; yj := (ring -> j ->> 1)::DOUBLE PRECISION;
    IF ((yi > p_lat) <> (yj > p_lat))
       AND (p_lng < (xj - xi) * (p_lat - yi) / NULLIF(yj - yi, 0) + xi) THEN
      inside := NOT inside;
    END IF;
    j := i;
    i := i + 1;
  END LOOP;
  RETURN inside;
END;
$$;

-- ── capture_hex: the ONLY write path. Validates server-side, then atomically claims. ────────
-- Caller is the authenticated user (auth.uid()). Returns JSON describing the result.
-- NOTE: this validates the supplied coordinate is GEOMETRICALLY inside the cell; it CANNOT tell
-- a real GPS fix from a spoofed/mock one — that's Phase 8 (Play Integrity / mock-loc detection).
CREATE OR REPLACE FUNCTION capture_hex(p_h3 TEXT, p_lat DOUBLE PRECISION, p_lng DOUBLE PRECISION)
RETURNS JSONB
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  v_uid   UUID := auth.uid();
  v_hex   hexes%ROWTYPE;
  v_prev  UUID;
  v_ip    INT := 100;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not_authenticated';
  END IF;

  -- Validate coordinates. NaN would silently bypass the geometry check (NaN comparisons are false),
  -- so reject NULL / NaN / out-of-range explicitly.
  IF p_lat IS NULL OR p_lng IS NULL
     OR p_lat <> p_lat OR p_lng <> p_lng                  -- NaN: NaN <> NaN is TRUE
     OR p_lat NOT BETWEEN -90 AND 90
     OR p_lng NOT BETWEEN -180 AND 180 THEN
    RAISE EXCEPTION 'bad_coords';
  END IF;

  -- Lock the ALWAYS-present parent hex row to serialise concurrent captures of the same hex
  -- (locking the often-absent ownership row would not protect the first capture).
  SELECT * INTO v_hex FROM hexes WHERE h3_index = p_h3 AND is_active = TRUE FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'hex_not_found';
  END IF;

  -- Reported location must be INSIDE the claimed cell (true point-in-polygon, not a radius).
  IF NOT hexa_point_in_hex(p_lat, p_lng, v_hex.boundary) THEN
    RAISE EXCEPTION 'outside_hex';
  END IF;

  -- Current owner (read is now serialised by the hex-row lock above).
  SELECT owner_id INTO v_prev FROM hex_ownership WHERE h3_index = p_h3;
  IF v_prev = v_uid THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  -- Minimal anti-spam guardrail (patch #40): block re-capturing the SAME hex within 60s. The full
  -- Fresh-Paint / 23h-revisit windows are Phase 5 scoring; already_owned covers holding it.
  IF EXISTS (
    SELECT 1 FROM captures
    WHERE h3_index = p_h3 AND user_id = v_uid AND captured_at > now() - interval '60 seconds'
  ) THEN
    RAISE EXCEPTION 'cooldown';
  END IF;

  -- Claim (or steal): upsert ownership.
  INSERT INTO hex_ownership (h3_index, owner_id, captured_at, ip_value)
  VALUES (p_h3, v_uid, now(), v_ip)
  ON CONFLICT (h3_index) DO UPDATE SET owner_id = v_uid, captured_at = now(), ip_value = v_ip;

  -- Log the event.
  INSERT INTO captures (h3_index, user_id, prev_owner_id, ip_awarded)
  VALUES (p_h3, v_uid, v_prev, v_ip);

  -- Points are EARNED (cumulative) → increment; stamp last_capture_at for future throttling/streaks.
  UPDATE users
     SET current_round_points = COALESCE(current_round_points, 0) + v_ip,
         last_capture_at = now()
   WHERE id = v_uid;

  -- Held-count is an OWNERSHIP INVARIANT → recompute from source for both affected users so it
  -- can never drift from COUNT(hex_ownership) (defends against any race/partial-failure).
  UPDATE users u
     SET current_held_hexes = (SELECT count(*) FROM hex_ownership WHERE owner_id = u.id)
   WHERE u.id = v_uid OR u.id = v_prev;

  RETURN jsonb_build_object('ok', TRUE, 'h3', p_h3, 'ip', v_ip, 'stolen_from', v_prev);
END;
$$;

-- Only authenticated users may call it; revoke the default public execute.
REVOKE ALL ON FUNCTION capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION capture_hex(TEXT, DOUBLE PRECISION, DOUBLE PRECISION) TO authenticated;
