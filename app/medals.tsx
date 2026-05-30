// Medals Gallery — design spec §6.14 (INTVL has no medals screen; Hexa-original in
// the INTVL visual language). Grid of earned/locked medals. DESIGN PREVIEW: mock.
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconChevronLeft, IconLock, IconMedal } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';

import { Badge } from '@/components/ui';
import { colors } from '@/theme';

interface Medal {
  name: string;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum';
  earned: boolean;
}

const MEDALS: Medal[] = [
  { name: 'First Capture', tier: 'bronze', earned: true },
  { name: 'Week One', tier: 'silver', earned: true },
  { name: 'Night Owl', tier: 'silver', earned: false },
  { name: 'Crown Hunter', tier: 'gold', earned: false },
  { name: 'Month One', tier: 'gold', earned: false },
  { name: 'Streak x30', tier: 'platinum', earned: false },
  { name: 'Lake Walker', tier: 'silver', earned: false },
  { name: 'Park Ranger', tier: 'bronze', earned: false },
  { name: 'Pincode King', tier: 'gold', earned: false },
];

const TIER_COLOUR: Record<Medal['tier'], string> = {
  bronze: '#CD7F32',
  silver: '#C0C0C0',
  gold: colors.saffron[500],
  platinum: '#E5E4E2',
};

export default function MedalsScreen() {
  const router = useRouter();
  const earnedCount = MEDALS.filter((m) => m.earned).length;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="h-14 flex-row items-center px-2">
        <IconChevronLeft size={26} color={colors.ink[900]} strokeWidth={1.75} onPress={() => router.back()} />
        <Text className="ml-1 text-heading-md text-ink-900">Medals</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text className="mb-4 text-body-md text-ink-700">
          {earnedCount} of {MEDALS.length} earned
        </Text>

        <View className="flex-row flex-wrap" style={{ gap: 12 }}>
          {MEDALS.map((m) => (
            <View
              key={m.name}
              className="items-center rounded-md bg-ink-200 p-3"
              style={{ width: '31%' }}
            >
              <View
                className="h-16 w-16 items-center justify-center rounded-full"
                style={{ backgroundColor: m.earned ? `${TIER_COLOUR[m.tier]}22` : colors.ink[300] }}
              >
                {m.earned ? (
                  <IconMedal size={32} color={TIER_COLOUR[m.tier]} strokeWidth={1.75} />
                ) : (
                  <IconLock size={28} color={colors.ink[500]} strokeWidth={1.75} />
                )}
              </View>
              <Text
                numberOfLines={2}
                className={`mt-2 text-center text-label-sm ${m.earned ? 'text-ink-900' : 'text-ink-600'}`}
              >
                {m.name}
              </Text>
            </View>
          ))}
        </View>

        <View className="mt-6 self-center">
          <Badge tone="neutral" label="Mock medals — live in Phase 6" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
