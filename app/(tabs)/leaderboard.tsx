// Leaderboard tab — built in Phase 7 (§6.12). Phase 1 placeholder.
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

export default function LeaderboardScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-ink-50 px-6">
      <Text className="text-heading-md text-ink-900">Leaderboard</Text>
      <Text className="mt-3 text-body-md text-ink-700">Coming soon</Text>
    </SafeAreaView>
  );
}
