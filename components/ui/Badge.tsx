// Badge / Chip — design spec §3.4. Pill, 6 tones, bg tone@15% + text tone@100%.
import { type ReactNode } from 'react';
import { Text, View } from 'react-native';

import { type BadgeTone } from '@/theme';

const bgByTone: Record<BadgeTone, string> = {
  neutral: 'bg-ink-700/15',
  success: 'bg-success/15',
  danger: 'bg-danger/15',
  warning: 'bg-warning/15',
  saffron: 'bg-saffron-600/15',
  info: 'bg-info/15',
};

const textByTone: Record<BadgeTone, string> = {
  neutral: 'text-ink-700',
  success: 'text-success',
  danger: 'text-danger',
  warning: 'text-warning',
  saffron: 'text-saffron-600',
  info: 'text-info',
};

interface BadgeProps {
  label: string;
  tone?: BadgeTone;
  leftIcon?: ReactNode;
}

export function Badge({ label, tone = 'neutral', leftIcon }: BadgeProps) {
  return (
    <View className={`flex-row items-center self-start rounded-full px-[10px] py-1 ${bgByTone[tone]}`}>
      {leftIcon ? <View className="mr-1">{leftIcon}</View> : null}
      <Text className={`text-label-sm ${textByTone[tone]}`}>{label}</Text>
    </View>
  );
}

export default Badge;
