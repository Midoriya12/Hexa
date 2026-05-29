// FeatureGate — design spec §3.13. Locked-feature card with explicit unlock steps.
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Badge } from './Badge';
import { Button } from './Button';

interface FeatureGateProps {
  title: string; // e.g. "Reach Level 3 to unlock Clans"
  progressLabel: string; // e.g. "Level 2 — 850 / 2,500 XP"
  steps: string[]; // up to 3 most-impactful actions
  actionLabel?: string;
  onAction?: () => void;
  icon?: ReactNode; // 32px lock icon (Tabler, added Phase 1)
}

export function FeatureGate({ title, progressLabel, steps, actionLabel, onAction, icon }: FeatureGateProps) {
  return (
    <View className="rounded-lg border border-saffron-600/20 bg-ink-200 p-6">
      <View className="items-center">
        {icon ?? <View className="h-8 w-8 rounded-full bg-saffron-600/20" />}
      </View>
      <Text className="mt-2 text-center text-heading-md text-ink-900">{title}</Text>
      <View className="mt-2 items-center">
        <Badge tone="saffron" label={progressLabel} />
      </View>
      <Text className="mt-4 text-label-md text-ink-700">How to level up</Text>
      <View className="mt-3">
        {steps.slice(0, 3).map((step, index) => (
          // eslint-disable-next-line react/no-array-index-key
          <View key={index} className="mb-3 flex-row items-center">
            <View className="mr-3 h-6 w-6 items-center justify-center rounded-full bg-saffron-600">
              <Text className="text-label-sm font-semibold text-ink-50">{index + 1}</Text>
            </View>
            <Text className="flex-1 text-body-md text-ink-800">{step}</Text>
          </View>
        ))}
      </View>
      {actionLabel && onAction ? (
        <View className="mt-6">
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export default FeatureGate;
