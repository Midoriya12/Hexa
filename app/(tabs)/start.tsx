// Start — INTVL 23 "Start Run" layout, adapted to Hexa walking. Big zeroed metrics +
// Start Walk CTA. Dark (Sai's theme: only Me/Settings are light). Real tracking is the
// Walk Session feature (Phase 10); this is a shell.
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/ui';

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-display-xl font-extrabold text-ink-900">
        {value}
      </Text>
      <Text className="mt-1 text-label-md uppercase tracking-wide text-ink-600">{label}</Text>
    </View>
  );
}

export default function StartScreen() {
  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="flex-1 items-center justify-center gap-8 px-6">
        <Metric value="0.00" label="Distance · km" />
        <Metric value="00:00" label="Duration" />
        <View className="flex-row gap-16">
          <Metric value="0" label="Hexes" />
          <Metric value="0:00" label="Avg pace" />
        </View>
      </View>

      <View className="items-center gap-3 px-6 pb-8">
        <View className="w-full">
          <Button label="Start Walk" size="lg" onPress={() => undefined} />
        </View>
        <Text className="text-body-sm text-ink-600">Live tracking arrives with Walk Sessions (Phase 10)</Text>
      </View>
    </SafeAreaView>
  );
}
