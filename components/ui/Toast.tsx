// Toast — design spec §3.7. Top banner (hex-stolen style) + bottom toast.
// NOTE: spec calls for backdrop blur on the top banner (glass.dark + blur). True
// blur needs expo-blur (BlurView); the translucent glass.dark fill approximates it
// until that dep is approved. Swipe-to-dismiss is deferred — tap/action dismiss for now.
import { useEffect, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';

import { Avatar } from './Avatar';

interface TopBannerProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  avatarName?: string;
  avatarUri?: string;
  actionLabel?: string;
  onAction?: () => void;
  topInset?: number;
}

export function TopBanner({
  visible,
  message,
  onDismiss,
  avatarName,
  avatarUri,
  actionLabel,
  onAction,
  topInset = 16,
}: TopBannerProps) {
  const translateY = useSharedValue(-140);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withSpring(0, { damping: 18, stiffness: 200 });
      opacity.value = withTiming(1, { duration: 300 });
      if (!actionLabel) {
        const timer = setTimeout(onDismiss, 5000);
        return () => clearTimeout(timer);
      }
    }
    return undefined;
  }, [visible, actionLabel, onDismiss, translateY, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[style, { position: 'absolute', left: 16, right: 16, top: topInset }]}
      className="flex-row items-center rounded-lg border border-danger/30 bg-glass-dark p-3 shadow-md"
    >
      <Pressable
        accessibilityRole="button"
        className="flex-1 flex-row items-center"
        onPress={onAction ?? onDismiss}
      >
        <Avatar size={40} name={avatarName} uri={avatarUri} />
        <Text className="ml-3 flex-1 text-body-sm text-white">{message}</Text>
      </Pressable>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" onPress={onAction} className="ml-2 rounded-md bg-saffron-600 px-3 py-2">
          <Text className="text-label-sm font-semibold text-ink-50">{actionLabel}</Text>
        </Pressable>
      ) : null}
    </Animated.View>
  );
}

interface BottomToastProps {
  visible: boolean;
  message: string;
  onDismiss: () => void;
  leftIcon?: ReactNode;
  bottomInset?: number;
  durationMs?: number;
}

export function BottomToast({
  visible,
  message,
  onDismiss,
  leftIcon,
  bottomInset = 24,
  durationMs = 3000,
}: BottomToastProps) {
  const translateY = useSharedValue(80);
  const opacity = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      translateY.value = withTiming(0, { duration: 300 });
      opacity.value = withTiming(1, { duration: 300 });
      const timer = setTimeout(onDismiss, durationMs);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [visible, durationMs, onDismiss, translateY, opacity]);

  const style = useAnimatedStyle(() => ({
    transform: [{ translateY: translateY.value }],
    opacity: opacity.value,
  }));

  if (!visible) return null;

  return (
    <Animated.View
      style={[style, { position: 'absolute', left: 16, right: 16, bottom: bottomInset }]}
      className="flex-row items-center rounded-md bg-ink-100 px-3 py-[10px] shadow-sm"
    >
      {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
      <Text className="flex-1 text-body-sm text-ink-900">{message}</Text>
    </Animated.View>
  );
}
