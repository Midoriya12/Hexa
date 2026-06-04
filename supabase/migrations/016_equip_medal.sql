-- 016_equip_medal.sql — Hexa Phase 6 polish: EQUIP a medal to show beside your name.
-- Adds users.equipped_medal + an equip_medal RPC (you can only equip a medal you've earned), and
-- exposes equipped_medal on the cross-user surfaces (public_users view + user_card RPC) so other
-- players see your flex on profiles + leaderboards.

ALTER TABLE users ADD COLUMN IF NOT EXISTS equipped_medal TEXT REFERENCES medals(id) ON DELETE SET NULL;

-- Equip (or unequip with NULL). Only a medal you OWN can be equipped.
CREATE OR REPLACE FUNCTION equip_medal(p_medal_id TEXT)
RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE v_uid UUID := auth.uid();
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'not_authenticated'; END IF;
  IF p_medal_id IS NULL THEN
    UPDATE users SET equipped_medal = NULL WHERE id = v_uid;
    RETURN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM user_medals WHERE user_id = v_uid AND medal_id = p_medal_id) THEN
    RAISE EXCEPTION 'medal_not_earned';
  END IF;
  UPDATE users SET equipped_medal = p_medal_id WHERE id = v_uid;
END;
$$;
REVOKE ALL ON FUNCTION equip_medal(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION equip_medal(TEXT) TO authenticated;

-- public_users: expose equipped_medal (cosmetic, non-sensitive) for leaderboard/feed name badges.
CREATE OR REPLACE VIEW public_users AS
  SELECT id, username, display_name, avatar_url, level, hex_colour, current_round_points, ghost_mode, equipped_medal
  FROM users;
GRANT SELECT ON public_users TO authenticated;

-- user_card: add equipped_medal. DROP first — CREATE OR REPLACE can't change a RETURNS TABLE shape.
DROP FUNCTION IF EXISTS user_card(UUID);
CREATE OR REPLACE FUNCTION user_card(p_id UUID)
RETURNS TABLE (
  id UUID, username TEXT, display_name TEXT, level INT, hex_colour TEXT,
  current_round_points INT, captures BIGINT, ghost_mode BOOLEAN,
  clan_id UUID, clan_name TEXT, clan_role TEXT,
  friendship TEXT, friendship_id BIGINT, equipped_medal TEXT
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
      ORDER BY f.id LIMIT 1),
    u.equipped_medal
  FROM users u LEFT JOIN clans cl ON cl.id = u.clan_id
  WHERE u.id = p_id;
END;
$$;
REVOKE ALL ON FUNCTION user_card(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION user_card(UUID) TO authenticated;
