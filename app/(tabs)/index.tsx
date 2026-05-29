// Home (Map tab) — Phase 1 placeholder per build spec §1.5. The real map (§6.7)
// lands in Phase 2. Dark, saffron hex motif (interim INTVL-blueprint styling).
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { HexIcon } from '@/components/shared/HexIcon';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/theme';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const name = user?.display_name ?? user?.username ?? 'walker';

  return (
    <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-ink-50 px-6">
      <View className="h-24 w-24 items-center justify-center rounded-2xl bg-saffron-600/15">
        <HexIcon size={56} color={colors.saffron[600]} filled />
      </View>
      <Text className="mt-6 text-display-sm text-ink-900">Welcome, {name}</Text>
      <Text className="mt-2 text-center text-body-md text-ink-700">
        Your map of Bangalore is coming next. Soon you&apos;ll walk to hexes and capture them.
      </Text>
      <Text
        className="mt-10 text-body-sm text-saffron-600"
        onPress={() => router.push('/_devtools/components')}
      >
        Open component gallery (dev)
      </Text>
    </SafeAreaView>
  );
}
