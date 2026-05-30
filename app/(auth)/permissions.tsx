// Permission Requests — INTVL has no custom permission screen (it fires the OS
// dialog), so this is the pre-permission priming pattern in the INTVL visual
// language (dark + saffron). OS requests are stubbed in Phase 1 (patch #29).
import { useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconBell, IconMapPin } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';
import { colors } from '@/theme';

type Stage = 'location' | 'notifications';

interface Priming {
  Icon: typeof IconMapPin;
  title: string;
  body: string;
}

const COPY: Record<Stage, Priming> = {
  location: {
    Icon: IconMapPin,
    title: 'Hexa needs your location',
    body: 'To know which hexes you’re standing in. We only check while you’re using the app.',
  },
  notifications: {
    Icon: IconBell,
    title: 'Get notified when it matters',
    body: 'We’ll ping you when someone steals your hex, your streak is at risk, or you level up. Nothing else.',
  },
};

export default function PermissionsScreen() {
  const router = useRouter();
  const [stage, setStage] = useState<Stage>('location');
  const { Icon, title, body } = COPY[stage];

  const finish = () => router.replace('/(tabs)');
  const next = () => (stage === 'location' ? setStage('notifications') : finish());

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="flex-1 items-center justify-center px-6">
        <View className="h-32 w-32 items-center justify-center rounded-full bg-saffron-600/15">
          <Icon size={64} color={colors.saffron[600]} strokeWidth={1.5} />
        </View>
        <Text className="mt-10 text-center text-display-sm font-bold text-ink-900">{title}</Text>
        <Text className="mt-4 max-w-[320px] text-center text-body-lg text-ink-700">{body}</Text>
      </View>

      <View className="gap-3 px-6 pb-6">
        {/* OS permission request lands in Phase 3/4 (patch #29); advance for now. */}
        <Button label="Allow" size="lg" onPress={next} />
        {stage === 'notifications' ? (
          <Button label="Maybe later" variant="ghost" onPress={finish} />
        ) : null}
      </View>
    </SafeAreaView>
  );
}
