// Medals Gallery — real medals (migration 013): earned ones light up in their tier colour with
// the date; locked ones show the lock + how to earn them. Reached from Me → Medals.
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { IconChevronLeft, IconLock, IconMedal } from '@/components/ui/Icon';

import { fetchMedals, type MedalTier, type UserMedal } from '@/lib/supabase/medals';
import { colors } from '@/theme';

const TIER_COLOUR: Record<MedalTier, string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: colors.saffron[500],
  platinum: '#E5E4E2',
};

export default function MedalsScreen() {
  const router = useRouter();
  const [medals, setMedals] = useState<UserMedal[]>([]);

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

  const earned = medals.filter((m) => m.earned).length;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="h-14 flex-row items-center px-2">
        <IconChevronLeft size={26} color={colors.ink[900]} strokeWidth={1.75} onPress={() => router.back()} />
        <Text className="ml-1 text-heading-md text-ink-900">Medals</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text className="mb-4 text-body-md text-ink-700">
          {earned} of {medals.length} earned
        </Text>

        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {medals.map((m) => (
            <View key={m.id} className="items-center rounded-md bg-ink-200 p-3" style={{ width: '31%' }}>
              <View
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: m.earned ? `${TIER_COLOUR[m.tier]}22` : colors.ink[300] }}
              >
                {m.earned ? (
                  <IconMedal size={32} color={TIER_COLOUR[m.tier]} strokeWidth={1.75} />
                ) : (
                  <IconLock size={26} color={colors.ink[500]} strokeWidth={1.75} />
                )}
              </View>
              <Text
                numberOfLines={2}
                className={`mt-2 text-center text-label-sm font-semibold ${m.earned ? 'text-ink-900' : 'text-ink-600'}`}
              >
                {m.name}
              </Text>
              <Text numberOfLines={2} className="mt-0.5 text-center text-label-sm text-ink-600" style={{ minHeight: 28 }}>
                {m.earned ? `+${m.lpReward} LP` : m.description}
              </Text>
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
