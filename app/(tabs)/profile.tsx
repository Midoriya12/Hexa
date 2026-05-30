// Profile tab — full INTVL "Me / Level & XP" layout (screen 14), saffron.
// Hero + XP bar + Next-unlock row + horizontal challenge cards + stat grid.
// DESIGN PREVIEW: shows the INTVL direction with real user data + the §6.11 launch
// challenges. Live XP/challenge wiring is Phase 5; this is the visual target.
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import {
  IconCamera,
  IconChevronRight,
  IconClock,
  IconCrown,
  IconGift,
  IconMedal,
  IconPalette,
  IconSettings,
  IconUserPlus,
  IconWalk,
} from '@/components/ui/Icon';

import { Avatar, Badge, Button, Card, LinearProgress, MetricRow } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

// §6.11 launch XP challenges (horizontal scroll cards).
const CHALLENGES = [
  { key: 'photo', title: 'Add a profile photo', xp: 10, Icon: IconCamera },
  { key: 'colour', title: 'Set your hex colour', xp: 10, Icon: IconPalette },
  { key: 'capture3', title: 'Capture 3 hexes today', xp: 30, Icon: IconWalk },
  { key: 'invite', title: 'Invite a friend', xp: 50, Icon: IconUserPlus },
  { key: 'referral', title: 'Enter a referral code', xp: 20, Icon: IconGift },
  { key: 'crown', title: 'Capture a Crown hex', xp: 100, Icon: IconCrown },
  { key: 'hold7', title: 'Hold a hex for 7 days', xp: 75, Icon: IconClock },
] as const;

export default function ProfileScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const signOut = useUserStore((s) => s.signOut);
  const level = user?.level ?? 1;

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <Text className="text-display-sm text-ink-900">Profile</Text>
          <IconSettings
            size={26}
            color={colors.ink[700]}
            strokeWidth={1.75}
            onPress={() => router.push('/settings' as Href)}
          />
        </View>

        {/* Hero card: identity + level + XP-to-next-level bar */}
        <Card contentHeavy>
          <View className="flex-row items-center">
            <Avatar size={64} name={user?.display_name ?? user?.username ?? undefined} uri={user?.avatar_url ?? undefined} />
            <View className="ml-4 flex-1">
              <Text className="text-heading-lg text-ink-900">{user?.display_name ?? '—'}</Text>
              <Text className="text-body-md text-ink-700">@{user?.username ?? '—'}</Text>
            </View>
            <Badge tone="saffron" label={`Level ${level}`} />
          </View>
          <View className="mt-4">
            <View className="mb-1 flex-row justify-between">
              <Text className="text-label-sm uppercase text-ink-600">XP to Level {level + 1}</Text>
              <Text className="text-label-sm text-ink-700" style={{ fontVariant: ['tabular-nums'] }}>
                0 / 500
              </Text>
            </View>
            <LinearProgress progress={0.04} />
          </View>
        </Card>

        {/* Next unlock row */}
        <Card className="mt-4 border border-saffron-600/25" onPress={() => undefined}>
          <View className="flex-row items-center">
            <View className="h-10 w-10 items-center justify-center rounded-full bg-saffron-600/15">
              <IconGift size={20} color={colors.saffron[600]} strokeWidth={1.75} />
            </View>
            <View className="ml-3 flex-1">
              <Text className="text-label-sm uppercase text-saffron-600" style={{ letterSpacing: 1 }}>
                Next unlock
              </Text>
              <Text className="text-heading-sm text-ink-900">Level 3 — Friends + hex colour</Text>
              <Text className="text-body-sm text-ink-700">Capture hexes to level up</Text>
            </View>
            <IconChevronRight size={20} color={colors.ink[600]} strokeWidth={1.75} />
          </View>
        </Card>

        {/* XP challenges — horizontal scroll (the iconic INTVL element) */}
        <Text className="mb-1 mt-6 text-heading-md text-ink-900">Earn XP</Text>
        <Text className="mb-3 text-body-sm text-ink-700">Quick wins to level up faster</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {CHALLENGES.map(({ key, title, xp, Icon }) => (
            <View key={key} className="w-[140px] rounded-md bg-ink-200 p-4" style={{ height: 160 }}>
              <View className="h-8 w-8 items-center justify-center rounded-md bg-saffron-600/15">
                <Icon size={20} color={colors.saffron[600]} strokeWidth={1.75} />
              </View>
              <Text className="mt-2 flex-1 text-label-md text-ink-900">{title}</Text>
              <View className="self-start">
                <Badge tone="saffron" label={`+${xp} XP`} />
              </View>
            </View>
          ))}
        </ScrollView>

        {/* This month stats */}
        <Text className="mb-3 mt-6 text-heading-md text-ink-900">This month</Text>
        <Card>
          <MetricRow
            dividers
            metrics={[
              { value: String(user?.current_held_hexes ?? 0), label: 'Hexes' },
              { value: String(user?.current_streak ?? 0), label: 'Streak' },
              { value: String(user?.current_round_points ?? 0), label: 'Points' },
            ]}
          />
        </Card>

        {/* Medals entry (design spec §6.11 → §6.14). */}
        <View className="mt-6 overflow-hidden rounded-md bg-ink-200">
          <Pressable className="flex-row items-center px-4 py-3" onPress={() => router.push('/medals' as Href)}>
            <IconMedal size={22} color={colors.ink[700]} />
            <Text className="ml-3 flex-1 text-body-lg text-ink-900">Medals</Text>
            <IconChevronRight size={20} color={colors.ink[600]} />
          </Pressable>
        </View>

        <View className="mt-8">
          <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
