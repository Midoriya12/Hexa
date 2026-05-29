// Temporary Phase 0 dev home: a styled landing that links to the component
// gallery so it's reachable on a device. Replaced by the Map (design spec §6.7)
// in Phase 2.
import { useRouter } from 'expo-router';
import { Text, View } from 'react-native';

import { Button } from '@/components/ui';

export default function Home() {
  const router = useRouter();
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-ink-50 px-6">
      <Text className="text-display-sm text-ink-900">Hexa</Text>
      <Text className="text-center text-body-md text-ink-700">
        Phase 0 — design-system library. Screens start in Phase 1; the Map lands in Phase 2.
      </Text>
      <Button label="Open component gallery" onPress={() => router.push('/_devtools/components')} />
    </View>
  );
}
