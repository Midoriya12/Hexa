// Permission Requests — design spec §6.6. Sequential explainers.
// Location is non-skippable; Notifications is skippable. The actual OS permission
// requests are no-op stubs in Phase 1 (expo-location → Phase 3, expo-notifications
// → Phase 4); these screens ship the explainer UI + navigation only (patch #29).
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconBell, IconMapPin } from '@tabler/icons-react-native';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';
import { colors } from '@/theme';

type Stage = 'location' | 'notifications';

export default function PermissionsScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('location');

  const finish = () => router.replace('/(tabs)');

  if (stage === 'location') {
    return (
      <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
        <View className="flex-1 items-center justify-center px-6">
          <IconMapPin size={96} color={colors.saffron[600]} />
          <Text className="mt-8 text-center text-display-sm text-ink-900">Hexa needs your location</Text>
          <Text className="mt-4 max-w-[320px] text-center text-body-lg text-ink-700">
            To know which hexes you&apos;re in. We only check while you&apos;re using the app.
          </Text>
        </View>
        <View className="px-4 pb-6">
          {/* OS permission request lands in Phase 3 (expo-location); advance for now. */}
          <Button label="Continue" onPress={() => setStage('notifications')} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="flex-1 items-center justify-center px-6">
        <IconBell size={96} color={colors.saffron[600]} />
        <Text className="mt-8 text-center text-display-sm text-ink-900">Get notified when it matters</Text>
        <Text className="mt-4 max-w-[320px] text-center text-body-lg text-ink-700">
          We&apos;ll ping you when someone steals your hex, your streak is at risk, or you level up. Nothing else.
        </Text>
      </View>
      <View className="gap-3 px-4 pb-6">
        {/* OS request lands in Phase 4 (expo-notifications); explainer + nav only. */}
        <Button label="Continue" onPress={finish} />
        <Button label="Maybe later" variant="ghost" onPress={finish} />
      </View>
    </SafeAreaView>
  );
}
