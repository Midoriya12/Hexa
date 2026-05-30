// Home (Map tab) — Phase 1 placeholder per build spec §1.5. The real map (§6.7)
// lands in Phase 2. Dark, saffron hex motif (interim INTVL-blueprint styling).
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, type Href } from 'expo-router';
import { IconChevronRight, IconTrophy } from '@/components/ui/Icon';

import { HexIcon } from '@/components/shared/HexIcon';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/theme';

// Play tab (INTVL "Play"). Map placeholder until Mapbox; Leaderboard is reached from
// here (INTVL surfaces it in Play's "My Club" sheet).
export default function PlayScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const name = user?.display_name ?? user?.username ?? 'walker';

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50 px-6">
      <View className="flex-1 items-center justify-center">
        <View className="h-24 w-24 items-center justify-center rounded-2xl bg-saffron-600/15">
          <HexIcon size={56} color={colors.saffron[600]} filled />
        </View>
        <Text className="mt-6 text-display-sm text-ink-900">Welcome, {name}</Text>
        <Text className="mt-2 text-center text-body-md text-ink-700">
          Your map of Bangalore is coming next. Soon you&apos;ll walk to hexes and capture them.
        </Text>
      </View>

      <View className="pb-6">
        <Pressable
          className="flex-row items-center rounded-md bg-ink-200 p-4"
          onPress={() => router.push('/leaderboard' as Href)}
        >
          <IconTrophy size={24} color={colors.saffron[600]} />
          <Text className="ml-3 flex-1 text-body-lg text-ink-900">Leaderboard</Text>
          <IconChevronRight size={20} color={colors.ink[600]} />
        </Pressable>
        <Text
          className="mt-4 self-center text-body-sm text-saffron-600"
          onPress={() => router.push('/_devtools/components')}
        >
          Open component gallery (dev)
        </Text>
      </View>
    </SafeAreaView>
  );
}
