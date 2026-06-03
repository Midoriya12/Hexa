-- 009_hex_viewport.sql — Hexa Phase 2.x (full-Bangalore scale): viewport / bbox hex loading.
-- Authority: Spec Patches > v3 Design Spec > Build Spec PDF.
--
-- Why: the grid is going from ~2.7K seeded cells (4 clusters) to full-city res-10 coverage
-- (~85K cells). The app currently fetches EVERY hex + EVERY hex_ownership row on load
-- (lib/supabase/hexes.ts fetchHexes) and renders one FeatureCollection — that does not scale.
-- This migration adds the server side of a VIEWPORT/proximity fetch: a single SECURITY DEFINER
-- RPC that returns only the hexes inside a lat/lng bbox, each already tagged with its owner
-- relative to the caller, plus the index that makes the bbox filter a range scan instead of a
-- seq scan over 85K rows.
--
-- Design notes / patches honoured:
--   #27 — no postgis / h3 extension dependency. The bbox filter is a plain numeric range on the
--         existing center_lat / center_lng DOUBLE PRECISION columns; boundary stays JSONB.
--   #1  — grid is the seeded Bangalore res-10 set (still read-only to clients).
--   RLS — hexes + hex_ownership are both public-read to `authenticated` (002 / 003). We fold the
--         ownership join into ONE definer RPC so the app makes a single round-trip per viewport
--         instead of two SELECTs (hexes-in-bbox, then hex_ownership .in(h3 set)). The RPC exposes
--         nothing private: owner_id is already readable via hex_ownership_select_all, and we only
--         return the caller-relative tag ('you' | 'other' | 'none') — never other users' uuids.
--
-- This migration is additive and idempotent-friendly: it only CREATEs a new index + a new
-- function. It does NOT alter the hexes / hex_ownership tables, RLS, or capture_hex.

-- ── Index: make "hexes in this bbox" a range scan ──────────────────────────────────────────
-- The bbox predicate is `center_lat BETWEEN ? AND ? AND center_lng BETWEEN ? AND ?` over the
-- ACTIVE grid. A composite (center_lat, center_lng) btree lets Postgres range-scan on the
-- leading column (lat) and still evaluate the lng bound on the index tuples; for a small,
-- roughly-square viewport that touches only a few hundred of 85K rows this is far cheaper than a
-- seq scan. We make it a PARTIAL index on is_active = TRUE to match how the data is always read
-- (the inactive minority never participates) and to keep the index small. Leading column is lat
-- because Bangalore spans a wider lng range than lat, so lat is the more selective first cut for a
-- square-ish viewport; either order works, lat-first is marginally better here.
CREATE INDEX IF NOT EXISTS hexes_latlng_idx
  ON hexes (center_lat, center_lng)
  WHERE is_active = TRUE;

-- ── hexes_in_bbox: the ONE viewport read path ──────────────────────────────────────────────
-- Returns every ACTIVE hex whose centre falls inside the [min_lat,max_lat] x [min_lng,max_lng]
-- box, already joined to ownership and tagged relative to the caller (auth.uid()):
--   owner = 'you'   → caller owns it
--           'other' → someone else owns it
--           'none'  → unowned
-- The client maps each row straight into a GeoJSON Feature (boundary is the TRUE, un-inset cell;
-- the app still applies DISPLAY_SCALE=0.88 cosmetically and validates capture against the true
-- cell server-side in capture_hex). No owner_id is returned, so no cross-user identity leaks.
--
-- SECURITY DEFINER is NOT strictly required (both tables are public-read), but we use it to
-- guarantee the LEFT JOIN sees ownership regardless of any future RLS tightening, and to pin
-- search_path — matching every other RPC in this schema (003/005/006/007/008). It is STABLE
-- (reads only; no writes) so Postgres can optimise it within a statement.
--
-- p_limit is a hard payload guard: a pathological/zoomed-out bbox can't drag the whole 85K grid
-- to the device. The client passes a viewport-sized box (zoom >= ~12, where the unowned grid is
-- even drawn — see HexMap hexLineUnowned minZoomLevel={12}); at smaller zooms it simply does not
-- fetch the grid. LEAST/GREATEST clamps keep the limit sane even if the client misbehaves.
CREATE OR REPLACE FUNCTION hexes_in_bbox(
  p_min_lat DOUBLE PRECISION,
  p_min_lng DOUBLE PRECISION,
  p_max_lat DOUBLE PRECISION,
  p_max_lng DOUBLE PRECISION,
  p_limit   INT DEFAULT 4000
)
RETURNS TABLE (
  h3_index   TEXT,
  center_lat DOUBLE PRECISION,
  center_lng DOUBLE PRECISION,
  pincode    TEXT,
  boundary   JSONB,
  owner      TEXT
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    h.h3_index,
    h.center_lat,
    h.center_lng,
    h.pincode,
    h.boundary,
    CASE
      WHEN o.owner_id IS NULL          THEN 'none'
      WHEN o.owner_id = auth.uid()     THEN 'you'
      ELSE                                  'other'
    END AS owner
  FROM hexes h
  LEFT JOIN hex_ownership o ON o.h3_index = h.h3_index
  WHERE h.is_active = TRUE
    AND h.center_lat BETWEEN p_min_lat AND p_max_lat
    AND h.center_lng BETWEEN p_min_lng AND p_max_lng
  ORDER BY h.center_lat, h.center_lng           -- deterministic; lets the limit clip the same edge
  LIMIT LEAST(GREATEST(COALESCE(p_limit, 4000), 1), 8000);
$$;

-- Authenticated only; revoke the default public execute (mirrors capture_hex / clan RPCs).
REVOKE ALL ON FUNCTION hexes_in_bbox(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION hexes_in_bbox(DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, DOUBLE PRECISION, INT) TO authenticated;
