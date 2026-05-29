// ProgressIndicator — design spec §3.8. Linear bar, circular ring, and spinner.
//
// NOTES / deferred:
//  - Linear fill should be a saffron.500->saffron.700 gradient (§3.8). Solid
//    saffron.600 for now; gradient needs expo-linear-gradient (not yet approved).
//  - CircularProgress draws the arc with the SVG-free rotating-half-ring technique.
//    It renders without extra deps but the arc geometry is approximate — VERIFY ON
//    DEVICE, and for the 240px capture dwell ring (§6.9, Phase 4) prefer
//    react-native-svg for precision (propose adding it then).
import { useEffect, type ReactNode } from 'react';
import { ActivityIndicator, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';

import { colors } from '@/theme';

const clamp01 = (n: number) => Math.max(0, Math.min(1, n));

interface LinearProgressProps {
  progress: number; // 0..1
  height?: number;
}

export function LinearProgress({ progress, height = 8 }: LinearProgressProps) {
  const value = useSharedValue(clamp01(progress));

  useEffect(() => {
    value.value = withTiming(clamp01(progress), { duration: 300 });
  }, [progress, value]);

  const fillStyle = useAnimatedStyle(() => ({ width: `${value.value * 100}%` }));

  return (
    <View style={{ height }} className="w-full overflow-hidden rounded-full bg-ink-400">
      <Animated.View style={fillStyle} className="h-full rounded-full bg-saffron-600" />
    </View>
  );
}

interface CircularProgressProps {
  progress: number; // 0..1
  size?: number;
  strokeWidth?: number;
  trackColor?: string;
  fillColor?: string;
  children?: ReactNode;
}

export function CircularProgress({
  progress,
  size = 64,
  strokeWidth = 6,
  trackColor = colors.ink[400],
  fillColor = colors.saffron[600],
  children,
}: CircularProgressProps) {
  const value = useSharedValue(clamp01(progress));

  useEffect(() => {
    value.value = withTiming(clamp01(progress), { duration: 300 });
  }, [progress, value]);

  const rightStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(Math.min(value.value, 0.5) / 0.5) * 180}deg` }],
  }));
  const leftStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${((Math.max(value.value, 0.5) - 0.5) / 0.5) * 180}deg` }],
  }));

  const half = size / 2;
  const ring: ViewStyle = {
    width: size,
    height: size,
    borderRadius: half,
    borderWidth: strokeWidth,
    borderTopColor: fillColor,
    borderRightColor: fillColor,
    borderBottomColor: 'transparent',
    borderLeftColor: 'transparent',
  };

  return (
    <View style={{ width: size, height: size }} className="items-center justify-center">
      <View
        style={{
          position: 'absolute',
          width: size,
          height: size,
          borderRadius: half,
          borderWidth: strokeWidth,
          borderColor: trackColor,
        }}
      />
      <View style={{ position: 'absolute', width: half, height: size, right: 0, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', right: 0, width: size, height: size }, rightStyle]}>
          <View style={[ring, { transform: [{ rotate: '135deg' }] }]} />
        </Animated.View>
      </View>
      <View style={{ position: 'absolute', width: half, height: size, left: 0, overflow: 'hidden' }}>
        <Animated.View style={[{ position: 'absolute', left: 0, width: size, height: size }, leftStyle]}>
          <View style={[ring, { transform: [{ rotate: '-45deg' }] }]} />
        </Animated.View>
      </View>
      {children ? <View style={{ position: 'absolute' }} className="items-center justify-center">{children}</View> : null}
    </View>
  );
}

interface SpinnerProps {
  size?: number | 'small' | 'large';
}

export function Spinner({ size = 'small' }: SpinnerProps) {
  return <ActivityIndicator size={size} color={colors.saffron[600]} />;
}
