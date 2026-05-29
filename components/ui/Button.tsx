// Button — design spec §3.1.
// Variants: primary | secondary | ghost | danger | glass. Sizes: sm | md | lg.
// Pressable with scale 0.97 on press, Light haptic on press, loading spinner.
import { type ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
  type PressableProps,
} from 'react-native';
import * as Haptics from 'expo-haptics';

import { colors } from '@/theme';

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'glass';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends Omit<PressableProps, 'children' | 'style'> {
  label: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
}

const containerByVariant: Record<ButtonVariant, string> = {
  primary: 'bg-saffron-600',
  secondary: 'bg-ink-200',
  ghost: 'bg-transparent',
  danger: 'bg-danger',
  glass: 'bg-glass-dark border border-white/10',
};

const labelByVariant: Record<ButtonVariant, string> = {
  primary: 'text-ink-50',
  secondary: 'text-ink-900',
  ghost: 'text-saffron-600',
  danger: 'text-white',
  glass: 'text-white',
};

const spinnerColorByVariant: Record<ButtonVariant, string> = {
  primary: colors.ink[50],
  secondary: colors.ink[900],
  ghost: colors.saffron[600],
  danger: '#FFFFFF',
  glass: '#FFFFFF',
};

// Heights/paddings from §3.1: sm 36/12, md 44/16, lg 56/24.
const sizeContainer: Record<ButtonSize, string> = {
  sm: 'h-[36px] px-3',
  md: 'h-[44px] px-4',
  lg: 'h-[56px] px-6',
};

const sizeLabel: Record<ButtonSize, string> = {
  sm: 'text-body-sm',
  md: 'text-label-md',
  lg: 'text-heading-sm',
};

export function Button({
  label,
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  leftIcon,
  onPress,
  ...rest
}: ButtonProps) {
  const isDisabled = Boolean(disabled) || loading;

  const handlePress = (event: GestureResponderEvent) => {
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onPress?.(event);
  };

  return (
    <Pressable
      {...rest}
      accessibilityRole="button"
      accessibilityState={{ disabled: isDisabled, busy: loading }}
      disabled={isDisabled}
      hitSlop={size === 'sm' ? 8 : 4}
      onPress={handlePress}
    >
      {({ pressed }) => {
        const active = pressed && !isDisabled;
        const shadow =
          variant === 'primary'
            ? active
              ? 'shadow-glow-saffron'
              : 'shadow-xs'
            : variant === 'glass'
              ? 'shadow-md'
              : '';
        return (
          <View
            style={active ? { transform: [{ scale: 0.97 }] } : undefined}
            className={[
              'flex-row items-center justify-center rounded-md',
              sizeContainer[size],
              containerByVariant[variant],
              shadow,
              isDisabled ? 'opacity-40' : '',
            ].join(' ')}
          >
            {loading ? (
              <>
                <Text className={`${sizeLabel[size]} ${labelByVariant[variant]} font-semibold opacity-0`}>
                  {label}
                </Text>
                <View className="absolute bottom-0 left-0 right-0 top-0 items-center justify-center">
                  <ActivityIndicator color={spinnerColorByVariant[variant]} />
                </View>
              </>
            ) : (
              <View className="flex-row items-center">
                {leftIcon ? <View className="mr-2">{leftIcon}</View> : null}
                <Text className={`${sizeLabel[size]} ${labelByVariant[variant]} font-semibold`}>{label}</Text>
              </View>
            )}
          </View>
        );
      }}
    </Pressable>
  );
}

export default Button;
