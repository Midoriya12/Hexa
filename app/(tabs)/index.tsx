// Home (Map tab) — Phase 1 placeholder per build spec §1.5. The real map (§6.7)
// lands in Phase 2. Keeps a dev link to the component gallery (removed in Phase 2).
import { Text } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useCurrentUser } from '@/hooks/useCurrentUser';

export default function HomeScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();

  return (
    <SafeAreaView edges={['top']} className="flex-1 items-center justify-center bg-ink-50 px-6">
      <Text className="text-display-sm text-ink-900">
        Welcome {user?.display_name ?? user?.username ?? 'walker'}
      </Text>
      <Text className="mt-3 text-body-md text-ink-700">Map coming soon</Text>
      <Text
        className="mt-8 text-body-sm text-saffron-600"
        onPress={() => router.push('/_devtools/components')}
      >
        Open component gallery (dev)
      </Text>
    </SafeAreaView>
  );
}
