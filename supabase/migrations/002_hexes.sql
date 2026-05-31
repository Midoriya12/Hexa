-- 002_hexes.sql — Hexa Phase 2 (Hex Grid), second migration.
-- Authority: Spec Patches > v3 Design Spec > Build Spec PDF.
-- Creates ONLY the static, seed-once `hexes` table + read-only RLS for authenticated users.
-- The grid (H3 res-10 cells over the Bangalore launch area — HSR/Koramangala/Indiranagar now,
-- ~85K Bangalore-wide later per patch #1) is generated and written ONCE by the Node seeding
-- script (scripts/generate-hexes.mjs) using the service-role key, which BYPASSES RLS.
-- The app NEVER writes hexes; clients only ever SELECT.
--
-- Notes / patches honoured here:
--   #27 — postgis + h3 extensions were deferred out of 001. We do NOT take a hard dependency on
--         them: boundary is stored as plain GeoJSON (jsonb) and the H3 index is a TEXT primary
--         key, so this migration applies cleanly even on a project where the h3 / postgis
--         extensions have not been dashboard-enabled. (Spatial-index columns can be layered on in
--         a later migration once the extensions are confirmed available.)
--   #1  — grid is the seeded Bangalore res-10 set, not user-generated.

-- ── hexes ─────────────────────────────────────────────────────────────────────
-- STATIC reference data: one row per playable H3 cell. Seeded once via service role; immutable
-- from the app's perspective. h3_index is the natural key (H3 cell id string), so it is the PK —
-- no surrogate uuid, unlike `users`.
CREATE TABLE hexes (
  h3_index            TEXT PRIMARY KEY,                  -- H3 res-10 cell id, e.g. '8a2a1072b59ffff'
  center_lat          DOUBLE PRECISION NOT NULL,         -- cell centroid (H3 cellToLatLng)
  center_lng          DOUBLE PRECISION NOT NULL,
  capture_lat         DOUBLE PRECISION NOT NULL,         -- snapped, walkable capture point (on/near a footpath)
  capture_lng         DOUBLE PRECISION NOT NULL,
  pincode             TEXT,                              -- Bangalore 560001-560103; nullable for edge cells, enforced in seed/app code (no DB CHECK, matches users.pincode convention)
  neighbourhood       TEXT,                              -- human-readable area name (e.g. 'HSR Layout')
  boundary            JSONB NOT NULL,                    -- GeoJSON Polygon of the 6 cell vertices (patch #27: GeoJSON, not postgis geometry)
  is_active           BOOLEAN DEFAULT TRUE,              -- soft-disable a cell (e.g. restricted/unsafe) without deleting it
  created_at          TIMESTAMPTZ DEFAULT now()
);

-- Lookup indexes. The PK already covers point lookups by h3_index. These support the common
-- read paths: filter a pincode's cells, region/feed queries by neighbourhood, and "only active".
CREATE INDEX hexes_pincode_idx       ON hexes(pincode)       WHERE is_active = TRUE;
CREATE INDEX hexes_neighbourhood_idx ON hexes(neighbourhood) WHERE is_active = TRUE;

-- No updated_at column / trigger: rows are seeded once and never mutated by the app (unlike users,
-- which has a set_updated_at trigger). If the grid is ever re-seeded that is a service-role op.

-- ── Row Level Security ────────────────────────────────────────────────────────
-- Mirror the 001 model: enable RLS, grant table privileges to `authenticated` only (never `anon`),
-- then let policies scope access. Here the table is shared static reference data, so unlike `users`
-- (owner-only rows) every authenticated user may read EVERY row — but read ONLY.
--
-- There are deliberately NO insert/update/delete policies. With RLS enabled, any command without a
-- matching permissive policy is denied; so even though we GRANT only SELECT, the absence of write
-- policies is a second, independent lock. Writes happen exclusively through the seeding script's
-- service-role client, which bypasses RLS entirely. `anon` is granted nothing.
ALTER TABLE hexes ENABLE ROW LEVEL SECURITY;

CREATE POLICY hexes_select_all ON hexes
  FOR SELECT TO authenticated USING (TRUE);

-- Table privileges. RLS scopes rows; GRANT controls whether the role may touch the table at all.
-- SELECT only — no INSERT/UPDATE/DELETE is granted to authenticated, so the client SDK (anon/auth
-- key) physically cannot write hexes regardless of policy.
GRANT SELECT ON TABLE hexes TO authenticated;
