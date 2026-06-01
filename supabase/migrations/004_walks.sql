-- 004_walks.sql — walk session history (the "Your walks" list on the Me screen).
-- A walk is a personal activity log (duration/distance/hexes/points). Unlike captures (which
-- go through the server-validated capture_hex RPC), walks are non-competitive personal records,
-- so the client may insert its OWN walks directly under owner-scoped RLS. Points here are a
-- display total of that session's captures, not a separate score source.
CREATE TABLE walks (
  id          BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  duration_s  INT NOT NULL,
  distance_m  INT NOT NULL,
  hexes       INT NOT NULL,
  points      INT NOT NULL,
  ended_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX walks_user_idx ON walks(user_id, ended_at DESC);

-- RLS: owner-only (your walks are yours to read + insert; no one else sees them).
ALTER TABLE walks ENABLE ROW LEVEL SECURITY;

CREATE POLICY walks_select_own ON walks
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY walks_insert_own ON walks
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT ON TABLE walks TO authenticated;
