// EmptyState — design spec §3.10. Centered icon/illustration + heading + body + CTA.
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { Button } from './Button';

interface EmptyStateProps {
  title: string;
  body?: string;
  icon?: ReactNode; // spec: 96px icon in ink.500, or an illustration
  actionLabel?: string;
  onAction?: () => void;
}

export function EmptyState({ title, body, icon, actionLabel, onAction }: EmptyStateProps) {
  return (
    <View className="flex-1 items-center justify-center px-6">
      {icon ? <View className="mb-6">{icon}</View> : null}
      <Text className="text-center text-heading-md text-ink-900">{title}</Text>
      {body ? <Text className="mt-3 max-w-[280px] text-center text-body-md text-ink-700">{body}</Text> : null}
      {actionLabel && onAction ? (
        <View className="mt-6">
          <Button label={actionLabel} onPress={onAction} />
        </View>
      ) : null}
    </View>
  );
}

export default EmptyState;
