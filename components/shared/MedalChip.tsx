// MedalChip — the small tier-coloured medal badge shown beside a player's name (their EQUIPPED
// medal). Renders nothing when no medal is equipped. Tier colour comes from the static id→tier map.
import { View } from 'react-native';

import { IconMedal } from '@/components/ui/Icon';
import { MEDAL_TIER, type MedalTier } from '@/lib/supabase/medals';
import { colors } from '@/theme';

const TIER_COLOUR: Record<MedalTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: colors.saffron[500],
  platinum: '#E5E4E2',
};

export function MedalChip({ medalId, size = 16 }: { medalId?: string | null; size?: number }) {
  if (!medalId) return null;
  const colour = TIER_COLOUR[MEDAL_TIER[medalId] ?? 'bronze'];
  const box = size + 8;
  return (
    <View
      style={{ width: box, height: box, borderRadius: 999, backgroundColor: `${colour}26` }}
      className="items-center justify-center"
    >
      <IconMedal size={size} color={colour} strokeWidth={2} />
    </View>
  );
}

export default MedalChip;
