// Me — DARK profile/dashboard. Identity + level/XP, a stats dashboard (Round Points · Hexes
// held · Rent/hr), the hex-colour picker (your captured hexes render in this colour), XP
// challenges, and Friends/Medals. Settings opens from the gear. (Your-walks list is next.)
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
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
import { HexIcon } from '@/components/shared/HexIcon';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { updateOwnUser } from '@/lib/supabase/auth';
import { fetchMyWalks } from '@/lib/supabase/walks';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';
import type { WalkRow } from '@/types/database';

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

function WalkItem({ w }: { w: WalkRow }) {
  const date = w.ended_at
    ? new Date(w.ended_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : '—';
  return (
    <View className="flex-row items-center bg-ink-100 px-4 py-3">
      <View className="flex-1">
        <Text className="text-body-md text-ink-900">{date}</Text>
        <Text className="text-label-sm text-ink-600">
          {mmss(w.duration_s)} · {(w.distance_m / 1000).toFixed(2)} km
        </Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <HexIcon size={14} color={colors.saffron[600]} />
        <Text style={{ fontVariant: ['tabular-nums'] }} className="text-body-md font-semibold text-ink-900">
          {w.hexes}
        </Text>
      </View>
    </View>
  );
}

const CHALLENGES = [
  { key: 'photo', title: 'Add a profile photo', xp: 10, Icon: IconCamera },
  { key: 'colour', title: 'Set your hex colour', xp: 10, Icon: IconPalette },
  { key: 'capture3', title: 'Capture 3 hexes today', xp: 30, Icon: IconWalk },
  { key: 'invite', title: 'Invite a friend', xp: 50, Icon: IconUserPlus },
  { key: 'crown', title: 'Capture a Crown hex', xp: 100, Icon: IconCrown },
  { key: 'hold7', title: 'Hold a hex 7 days', xp: 75, Icon: IconClock },
] as const;

const SWATCHES = Object.values(colors.player); // 8 hex-colour choices

function DashStat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-md border border-ink-400 bg-ink-100 py-3">
      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-lg font-extrabold text-saffron-600">
        {value}
      </Text>
      <Text className="mt-0.5 text-label-sm uppercase tracking-wide text-ink-600">{label}</Text>
    </View>
  );
}

function MenuRow({ icon, label, onPress }: { icon: React.ReactNode; label: string; onPress: () => void }) {
  return (
    <Pressable className="flex-row items-center bg-ink-100 px-4 py-4" onPress={onPress}>
      <View className="w-7">{icon}</View>
      <Text className="ml-2 flex-1 text-body-lg text-ink-900">{label}</Text>
      <IconChevronRight size={20} color={colors.ink[500]} />
    </Pressable>
  );
}

export default function MeScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const setUser = useUserStore((s) => s.setUser);
  const level = user?.level ?? 1;

  const points = user?.current_round_points ?? 0;
  const hexes = user?.current_held_hexes ?? 0;
  const rentPerHr = hexes * 3; // flat PPH for now (rarity tiers + hourly engine = Phase 5)
  const myColour = user?.hex_colour || colors.player.saffron;

  const [walks, setWalks] = useState<WalkRow[]>([]);
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMyWalks()
        .then((w) => alive && setWalks(w))
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, []),
  );

  const pickColour = async (hex: string) => {
    if (!user?.id || hex === user.hex_colour) return;
    setUser({ ...user, hex_colour: hex }); // optimistic
    try {
      const row = await updateOwnUser(user.id, { hex_colour: hex });
      setUser(row);
    } catch {
      /* keep optimistic; will reconcile on next profile fetch */
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="h-12 flex-row items-center justify-between px-4">
        <IconBell size={24} color={colors.ink[900]} />
        <Text className="text-heading-md text-ink-900">Me</Text>
        <IconSettings size={24} color={colors.ink[900]} onPress={() => router.push('/settings' as Href)} />
      </View>

      <ScrollView className="flex-1 bg-ink-50" contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
        {/* Identity */}
        <View className="flex-row items-center">
          <Avatar size={64} name={user?.display_name ?? user?.username ?? undefined} uri={user?.avatar_url ?? undefined} />
          <View className="ml-4 flex-1">
            <Text className="text-heading-lg text-ink-900">{user?.display_name ?? '—'}</Text>
            <Text className="text-body-md text-ink-700">@{user?.username ?? '—'}</Text>
          </View>
          <Badge tone="saffron" label={`Level ${level}`} />
        </View>

        {/* Dashboard: points · hexes · rent */}
        <View className="mt-4 flex-row gap-3">
          <DashStat value={points.toLocaleString('en-IN')} label="Points" />
          <DashStat value={String(hexes)} label="Hexes" />
          <DashStat value={`${rentPerHr}/hr`} label="Rent" />
        </View>

        {/* XP-to-next bar */}
        <View className="mt-4">
          <View className="mb-1 flex-row justify-between">
            <Text className="text-label-sm uppercase text-ink-700">{500} XP to Level {level + 1}</Text>
            <Text className="text-label-sm text-ink-700" style={{ fontVariant: ['tabular-nums'] }}>
              0 / 500
            </Text>
          </View>
          <View className="h-2 overflow-hidden rounded-full bg-ink-300">
            <View className="h-full w-[4%] rounded-full bg-saffron-600" />
          </View>
        </View>

        {/* Hex colour picker */}
        <Text className="mb-1 mt-6 text-heading-md text-ink-900">Your hex colour</Text>
        <Text className="mb-3 text-body-sm text-ink-700">Captured hexes show in this colour on the map.</Text>
        <View className="flex-row flex-wrap gap-3">
          {SWATCHES.map((c) => {
            const selected = myColour === c;
            return (
              <Pressable
                key={c}
                onPress={() => pickColour(c)}
                style={{
                  backgroundColor: c,
                  borderWidth: selected ? 3 : 0,
                  borderColor: '#FFFFFF',
                }}
                className="h-11 w-11 rounded-full"
              />
            );
          })}
        </View>

        {/* XP challenges */}
        <Text className="mb-1 mt-6 text-heading-md text-ink-900">Earn XP</Text>
        <Text className="mb-3 text-body-sm text-ink-700">Quick wins to level up faster</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 12 }}>
          {CHALLENGES.map(({ key, title, xp, Icon }) => (
            <View key={key} className="w-[140px] rounded-md border border-ink-400 bg-ink-100 p-4" style={{ height: 160 }}>
              <View className="h-8 w-8 items-center justify-center rounded-md bg-saffron-600/15">
                <Icon size={20} color={colors.saffron[600]} />
              </View>
              <Text className="mt-2 flex-1 text-label-md text-ink-900">{title}</Text>
              <View className="self-start">
                <Badge tone="saffron" label={`+${xp} XP`} />
              </View>
            </View>
          ))}
        </ScrollView>

        {/* Your walks */}
        <Text className="mb-3 mt-6 text-heading-md text-ink-900">Your walks</Text>
        {walks.length === 0 ? (
          <View className="rounded-md border border-ink-400 bg-ink-100 p-4">
            <Text className="text-center text-body-sm text-ink-700">No walks yet — hit Start and capture a hex.</Text>
          </View>
        ) : (
          <View className="divide-y divide-ink-400 overflow-hidden rounded-md border border-ink-400">
            {walks.map((w) => (
              <WalkItem key={w.id} w={w} />
            ))}
          </View>
        )}

        {/* Friends + Medals */}
        <View className="mt-6 divide-y divide-ink-400 overflow-hidden rounded-md border border-ink-400">
          <MenuRow
            icon={<IconUsers size={22} color={colors.ink[600]} />}
            label="Friends"
            onPress={() => router.push('/friends' as Href)}
          />
          <MenuRow
            icon={<IconMedal size={22} color={colors.ink[600]} />}
            label="Medals"
            onPress={() => router.push('/medals' as Href)}
          />
          <MenuRow
            icon={<IconGift size={22} color={colors.ink[600]} />}
            label="Invite a friend"
            onPress={() => router.push('/settings' as Href)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
