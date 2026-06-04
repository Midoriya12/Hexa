// Medals Gallery — earned medals glow in their tier colour (gradient cards); tap an earned one to
// EQUIP it beside your name (tap again to unequip). Locked medals show how to earn them. Real data
// from migration 013 (+ equip via 016).
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useFocusEffect, useRouter } from 'expo-router';
import { IconChevronLeft, IconLock, IconMedal } from '@/components/ui/Icon';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchOwnUser } from '@/lib/supabase/auth';
import { equipMedal, fetchMedals, type MedalTier, type UserMedal } from '@/lib/supabase/medals';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

const TIER_GRADIENT: Record<MedalTier, [string, string]> = {
  bronze: ['#C8843E', '#7A4A1E'],
  silver: ['#CFCFCF', '#7C7C7C'],
  gold: [colors.saffron[400], colors.saffron[700]],
  platinum: ['#EDEDED', '#9AA3AD'],
};
const TIER_SOLID: Record<MedalTier, string> = { bronze: '#CD7F32', silver: '#C0C0C0', gold: colors.saffron[500], platinum: '#E5E4E2' };

export default function MedalsScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const setUser = useUserStore((s) => s.setUser);
  const [medals, setMedals] = useState<UserMedal[]>([]);
  const [busy, setBusy] = useState(false);
  const equipped = user?.equipped_medal ?? null;

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchMedals()
        .then((m) => alive && setMedals(m))
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, []),
  );

  const onEquip = async (m: UserMedal) => {
    if (!m.earned || busy || !user?.id) return;
    const next = equipped === m.id ? null : m.id; // tap the equipped one to unequip
    setBusy(true);
    try {
      await equipMedal(next);
      setUser(await fetchOwnUser(user.id)); // refresh so the name-badge updates app-wide
    } catch {
      /* ignore */
    } finally {
      setBusy(false);
    }
  };

  const earned = medals.filter((m) => m.earned).length;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="h-14 flex-row items-center px-2">
        <IconChevronLeft size={26} color={colors.ink[900]} strokeWidth={1.75} onPress={() => router.back()} />
        <Text className="ml-1 text-heading-md text-ink-900">Medals</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {/* Hero */}
        <View className="mb-5 items-center rounded-2xl bg-ink-100 py-6">
          <Text style={{ fontVariant: ['tabular-nums'] }} className="text-display-lg font-extrabold text-saffron-600">
            {earned}
            <Text className="text-heading-md text-ink-600"> / {medals.length}</Text>
          </Text>
          <Text className="mt-1 text-body-sm text-ink-700">medals earned · tap one to show it by your name</Text>
        </View>

        <View className="flex-row flex-wrap justify-between">
          {medals.map((m) => {
            const isEquipped = equipped === m.id;
            if (!m.earned) {
              return (
                <View key={m.id} className="mb-3 items-center rounded-2xl border border-ink-400 bg-ink-100 p-4" style={{ width: '48%' }}>
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-ink-300">
                    <IconLock size={26} color={colors.ink[500]} strokeWidth={1.75} />
                  </View>
                  <Text numberOfLines={1} className="mt-2 text-center text-label-md font-semibold text-ink-600">{m.name}</Text>
                  <Text numberOfLines={2} className="mt-0.5 text-center text-label-sm text-ink-600" style={{ minHeight: 28 }}>
                    {m.description}
                  </Text>
                </View>
              );
            }
            return (
              <Pressable
                key={m.id}
                onPress={() => onEquip(m)}
                style={{ width: '48%', borderWidth: 2, borderColor: isEquipped ? colors.saffron[500] : 'transparent', borderRadius: 18 }}
                className="mb-3 overflow-hidden"
              >
                <LinearGradient colors={TIER_GRADIENT[m.tier]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ padding: 16, alignItems: 'center' }}>
                  {isEquipped ? (
                    <View className="absolute right-2 top-2 rounded-full bg-black/30 px-2 py-0.5">
                      <Text className="text-label-sm font-bold text-white">EQUIPPED</Text>
                    </View>
                  ) : null}
                  <View className="h-16 w-16 items-center justify-center rounded-full bg-white/25">
                    <IconMedal size={34} color="#FFFFFF" strokeWidth={1.75} />
                  </View>
                  <Text numberOfLines={1} className="mt-2 text-center text-label-md font-extrabold text-white">{m.name}</Text>
                  <Text className="mt-0.5 text-center text-label-sm text-white/90">+{m.lpReward} LP</Text>
                  <Text className="mt-1 text-center text-label-sm font-semibold text-white/90">
                    {isEquipped ? 'Tap to remove' : 'Tap to equip'}
                  </Text>
                </LinearGradient>
              </Pressable>
            );
          })}
        </View>

        <View className="mt-2 self-center rounded-full bg-ink-200 px-3 py-1.5">
          <Text className="text-label-sm text-ink-600">{TIER_SOLID.bronze ? 'Bronze · Silver · Gold tiers' : ''}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
