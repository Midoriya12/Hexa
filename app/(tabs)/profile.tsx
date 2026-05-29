// Profile tab — INTVL "Me / Level & XP" blueprint (P5 layout, Phase 1 placeholder).
// Hero card (avatar + name + level badge) + metric row; full stats land in Phase 5.
// Sign out is here for Phase 1 (relocates into Settings §6.15 when that ships).
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Badge, Button, Card, MetricRow } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserStore } from '@/stores/userStore';

export default function ProfileScreen() {
  const { user } = useCurrentUser();
  const signOut = useUserStore((s) => s.signOut);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50 px-4">
      <Text className="mb-6 mt-2 text-display-sm text-ink-900">Profile</Text>

      <Card contentHeavy>
        <View className="items-center">
          <Avatar
            size={96}
            name={user?.display_name ?? user?.username ?? undefined}
            uri={user?.avatar_url ?? undefined}
          />
          <Text className="mt-3 text-heading-lg text-ink-900">{user?.display_name ?? '—'}</Text>
          <Text className="mt-1 text-body-md text-ink-700">@{user?.username ?? '—'}</Text>
          <View className="mt-3">
            <Badge tone="saffron" label={`Level ${user?.level ?? 1}`} />
          </View>
        </View>

        <View className="mt-6 border-t border-ink-400 pt-4">
          <MetricRow
            dividers
            metrics={[
              { value: String(user?.current_held_hexes ?? 0), label: 'Hexes' },
              { value: String(user?.current_streak ?? 0), label: 'Streak' },
              { value: '—', label: 'Rank' },
            ]}
          />
        </View>
      </Card>

      <Card className="mt-4">
        <Text className="text-body-md text-ink-700">
          Your stats, medals, and capture history fill in as you play. The full profile lands in a later phase.
        </Text>
      </Card>

      <View className="flex-1" />
      <View className="pb-6">
        <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
      </View>
    </SafeAreaView>
  );
}
