// Me — matches INTVL's "Me / Level & XP" screenshot: dark header strip over a LIGHT
// body (level + XP-to-next + Next-unlock row + horizontal XP-challenge cards + Friends/
// Medals). Saffron accent, Hexa content. NO "create plan" (we're a game, not a run app).
// Settings opens from the gear. DESIGN PREVIEW: live XP/challenge wiring is Phase 5.
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import {
  IconBell,
  IconCamera,
  IconChevronRight,
  IconClock,
  IconCrown,
  IconGift,
  IconMedal,
  IconPalette,
  IconSettings,
  IconUserPlus,
  IconUsers,
  IconWalk,
} from '@/components/ui/Icon';

import { Avatar, Badge } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/theme';

const CHALLENGES = [
  { key: 'photo', title: 'Add a profile photo', xp: 10, Icon: IconCamera },
  { key: 'colour', title: 'Set your hex colour', xp: 10, Icon: IconPalette },
  { key: 'capture3', title: 'Capture 3 hexes today', xp: 30, Icon: IconWalk },
  { key: 'invite', title: 'Invite a friend', xp: 50, Icon: IconUserPlus },
  { key: 'crown', title: 'Capture a Crown hex', xp: 100, Icon: IconCrown },
  { key: 'hold7', title: 'Hold a hex 7 days', xp: 75, Icon: IconClock },
] as const;

function MenuRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable className="flex-row items-center bg-light-card px-4 py-4" onPress={onPress}>
      <View className="w-7">{icon}</View>
      <Text className="ml-2 flex-1 text-body-lg text-light-ink">{label}</Text>
      <IconChevronRight size={20} color={colors.light.faint} />
    </Pressable>
  );
}

export default function MeScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const level = user?.level ?? 1;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      {/* Dark header strip */}
      <View className="h-12 flex-row items-center justify-between px-4">
        <IconBell size={24} color={colors.ink[900]} />
        <Text className="text-heading-md text-ink-900">Me</Text>
        <IconSettings size={24} color={colors.ink[900]} onPress={() => router.push('/settings' as Href)} />
      </View>

      {/* Light body */}
      <ScrollView className="flex-1 bg-light-bg" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Identity + XP-to-next bar */}
        <View className="flex-row items-center">
          <Avatar size={64} name={user?.display_name ?? user?.username ?? undefined} uri={user?.avatar_url ?? undefined} />
          <View className="ml-4 flex-1">
            <Text className="text-heading-lg text-light-ink">{user?.display_name ?? '—'}</Text>
            <Text className="text-body-md text-light-sub">@{user?.username ?? '—'}</Text>
          </View>
          <Badge tone="saffron" label={`Level ${level}`} />
        </View>
        <View className="mt-4">
          <View className="mb-1 flex-row justify-between">
            <Text className="text-label-sm uppercase text-light-sub">{500} XP to Level {level + 1}</Text>
            <Text className="text-label-sm text-light-sub" style={{ fontVariant: ['tabular-nums'] }}>
              0 / 500
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-light-border">
            <View className="h-full w-[4%] rounded-full bg-saffron-600" />
          </View>
        </View>

        {/* Next unlock */}
        <Pressable className="mt-5 flex-row items-center rounded-md border border-light-border bg-light-card p-4">
          <View className="flex-1">
            <Text className="text-heading-sm text-light-ink">Next unlock: Level 3</Text>
            <Text className="text-body-sm text-light-sub">Friends + custom hex colour</Text>
          </View>
          <IconChevronRight size={22} color={colors.light.faint} />
        </Pressable>

        {/* XP challenges */}
        <Text className="mb-1 mt-6 text-heading-md text-light-ink">Earn XP</Text>
        <Text className="mb-3 text-body-sm text-light-sub">Quick wins to level up faster</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {CHALLENGES.map(({ key, title, xp, Icon }) => (
            <View key={key} className="w-[140px] rounded-md border border-light-border bg-light-card p-4" style={{ height: 160 }}>
              <View className="h-8 w-8 items-center justify-center rounded-md bg-saffron-600/15">
                <Icon size={20} color={colors.saffron[600]} />
              </View>
              <Text className="mt-2 flex-1 text-label-md text-light-ink">{title}</Text>
              <View className="self-start">
                <Badge tone="saffron" label={`+${xp} XP`} />
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Friends + Medals */}
        <View className="mt-6 divide-y divide-light-border overflow-hidden rounded-md border border-light-border">
          <MenuRow
            icon={<IconUsers size={22} color={colors.light.sub} />}
            label="Friends"
            onPress={() => router.push('/friends' as Href)}
          />
          <MenuRow
            icon={<IconMedal size={22} color={colors.light.sub} />}
            label="Medals"
            onPress={() => router.push('/medals' as Href)}
          />
          <MenuRow
            icon={<IconGift size={22} color={colors.light.sub} />}
            label="Invite a friend"
            onPress={() => router.push('/settings' as Href)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
