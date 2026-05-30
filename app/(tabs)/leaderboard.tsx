// Leaderboard tab — built in Phase 7 (§6.12). Phase 1 saffron empty-state per blueprint.
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconTrophy } from '@tabler/icons-react-native';

import { EmptyState } from '@/components/ui';
import { colors } from '@/theme';

export default function LeaderboardScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="flex-1">
        <EmptyState
          icon={<IconTrophy size={48} color={colors.ink[500]} strokeWidth={1.75} />}
          title="No rankings yet"
          body="Capture hexes to climb your pincode and city leaderboards. Live in a later phase."
        />
      </View>
    </SafeAreaView>
  );
}
