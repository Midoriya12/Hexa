// Levels — the rank ladder (Walker → Mayor): the lifetime-points needed for each, what it unlocks,
// and your current position + progress. Reached from the Me XP bar. Mirrors lib/points thresholds
// + the real perks (dwell speed from useHexTracker, the steal-protection floor from capture_hex).
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { IconChevronLeft } from '@/components/ui/Icon';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { LEVEL_NAMES, LEVEL_THRESHOLDS, levelName, xpProgress } from '@/lib/points';
import { colors } from '@/theme';

// Per-level perks (real): dwell = 60-(level-1)*10s (useHexTracker); protected = level hexes a steal
// can't take (capture_hex farm-to-zero floor); +1000 points on every promotion.
const PERKS = [
  { dwell: 60, protect: 1 },
  { dwell: 50, protect: 2 },
  { dwell: 40, protect: 3 },
  { dwell: 30, protect: 4 },
  { dwell: 20, protect: 5 },
];

export default function LevelsScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const level = user?.level ?? 1;
  const lp = Number(user?.lifetime_points ?? 0);
  const xp = xpProgress(lp, level);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="h-14 flex-row items-center px-2">
        <IconChevronLeft size={26} color={colors.ink[900]} strokeWidth={1.75} onPress={() => router.back()} />
        <Text className="ml-1 text-heading-md text-ink-900">Levels</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {/* Current standing */}
        <View className="mb-5 rounded-2xl bg-ink-100 p-5">
          <Text className="text-label-sm uppercase tracking-wide text-ink-600">You are</Text>
          <Text className="text-display-sm font-extrabold text-saffron-600">{levelName(level)}</Text>
          <Text className="mt-1 text-body-sm text-ink-700" style={{ fontVariant: ['tabular-nums'] }}>
            {lp.toLocaleString('en-IN')} lifetime points
            {xp.atMax ? ' · max rank' : ` · ${xp.toNext.toLocaleString('en-IN')} to ${levelName(level + 1)}`}
          </Text>
          {!xp.atMax ? (
            <View className="mt-3 h-2 overflow-hidden rounded-full bg-ink-300">
              <View className="h-full rounded-full bg-saffron-600" style={{ width: `${Math.round(xp.pct * 100)}%` }} />
            </View>
          ) : null}
        </View>

        {/* The ladder */}
        {LEVEL_NAMES.map((name, i) => {
          const lvl = i + 1;
          const here = lvl === level;
          const reached = lvl <= level;
          const p = PERKS[i];
          return (
            <View
              key={name}
              className="mb-3 rounded-2xl border bg-ink-100 p-4"
              style={{ borderColor: here ? colors.saffron[600] : colors.ink[400] }}
            >
              <View className="flex-row items-center">
                <View
                  className="h-10 w-10 items-center justify-center rounded-full"
                  style={{ backgroundColor: reached ? colors.saffron[600] : colors.ink[300] }}
                >
                  <Text className={`text-body-lg font-extrabold ${reached ? 'text-white' : 'text-ink-600'}`}>{lvl}</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className={`text-heading-sm ${reached ? 'text-ink-900' : 'text-ink-600'}`}>{name}</Text>
                  <Text className="text-label-sm text-ink-600" style={{ fontVariant: ['tabular-nums'] }}>
                    {LEVEL_THRESHOLDS[i] === 0 ? 'Starting rank' : `${LEVEL_THRESHOLDS[i].toLocaleString('en-IN')} lifetime points`}
                  </Text>
                </View>
                {here ? (
                  <View className="rounded-full bg-saffron-600 px-2 py-0.5">
                    <Text className="text-label-sm font-bold text-white">YOU</Text>
                  </View>
                ) : null}
              </View>
              <View className="mt-2">
                <Text className="text-body-sm text-ink-700">
                  ⚡ Capture in {p.dwell}s · 🛡 {p.protect} hex{p.protect === 1 ? '' : 'es'} safe from steals
                  {lvl > 1 ? ' · +1000 points on promotion' : ''}
                </Text>
              </View>
            </View>
          );
        })}

        <Text className="mt-2 text-center text-label-sm text-ink-600">
          Lifetime points come from captures, steals, rent + medals — they never reset.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
