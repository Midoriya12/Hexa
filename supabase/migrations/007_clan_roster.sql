-- 007_clan_roster.sql — clan roster WITH roles. The 005 clan_members() RPC returns public_users
-- (no clan_role), but the governance UI needs each member's role. clan_roster returns the same
-- public-equivalent columns PLUS clan_role, ordered by role then points. SECURITY DEFINER so it
-- can read users.clan_role across the owner-only users RLS; it exposes only already-public columns
-- (id/name/level/points/colour) + role (clan membership is not secret), so no private leak.
CREATE OR REPLACE FUNCTION clan_roster(p_clan_id UUID)
RETURNS TABLE (
  id UUID, username TEXT, display_name TEXT, level INT,
  hex_colour TEXT, current_round_points INT, clan_role TEXT
)
LANGUAGE sql SECURITY DEFINER SET search_path = public AS $$
  SELECT u.id, u.username, u.display_name, u.level, u.hex_colour, u.current_round_points, u.clan_role
  FROM users u
  WHERE u.clan_id = p_clan_id
  ORDER BY CASE u.clan_role
             WHEN 'president' THEN 3 WHEN 'vp' THEN 2 WHEN 'senior' THEN 1 WHEN 'member' THEN 0 ELSE -1
           END DESC,
           u.current_round_points DESC NULLS LAST;
$$;
REVOKE ALL ON FUNCTION clan_roster(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION clan_roster(UUID) TO authenticated;
