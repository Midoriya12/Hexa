// HoldToConfirm — design spec §3.12. Press-and-hold 1500ms to fire; danger fill
// sweeps left->right; haptic ticks at 500/1000ms; success + scale punch at 1500ms;
// release early animates the fill back to 0. Label changes across the hold phases.
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface HoldToConfirmProps {
  onConfirm: () => void;
  label?: string;
  holdingLabel?: string;
  completeLabel?: string;
  leftIcon?: ReactNode;
  duration?: number;
}

type Phase = 'idle' | 'holding' | 'done';

export function HoldToConfirm({
  onConfirm,
  label = 'Hold to confirm',
  holdingLabel = 'Holding…',
  completeLabel = 'Done',
  leftIcon,
  duration = 1500,
}: HoldToConfirmProps) {
  const progress = useSharedValue(0);
  const scale = useSharedValue(1);
  const [phase, setPhase] = useState<Phase>('idle');
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const completed = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => () => clearTimers(), []);

  const start = () => {
    completed.current = false;
    setPhase('holding');
    progress.value = withTiming(1, { duration });
    timers.current.push(setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 500));
    timers.current.push(setTimeout(() => void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium), 1000));
    timers.current.push(
      setTimeout(() => {
        completed.current = true;
        setPhase('done');
        scale.value = withSequence(withTiming(1.03, { duration: 80 }), withTiming(1, { duration: 120 }));
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onConfirm();
      }, duration),
    );
  };

  const end = () => {
    if (completed.current) return;
    clearTimers();
    setPhase('idle');
    progress.value = withTiming(0, { duration: 300 });
  };

  const fillStyle = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));
  const containerStyle = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const currentLabel = phase === 'idle' ? label : phase === 'holding' ? holdingLabel : completeLabel;

  return (
    <Pressable accessibilityRole="button" onPressIn={start} onPressOut={end}>
      <Animated.View style={containerStyle} className="h-[56px] justify-center overflow-hidden rounded-md bg-ink-300">
        <Animated.View style={fillStyle} className="absolute bottom-0 left-0 top-0 bg-danger" />
        <View className="flex-row items-center justify-center">
          {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
          <Text className="text-label-md font-semibold text-white">{currentLabel}</Text>
        </View>
      </Animated.View>
    </Pressable>
  );
}

export default HoldToConfirm;
