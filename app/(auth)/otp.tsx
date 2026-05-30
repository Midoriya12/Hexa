// OTP Verification — design spec §6.3. Auto-submits on the 6th digit.
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, { useAnimatedStyle, useSharedValue, withSequence, withTiming } from 'react-native-reanimated';
import { IconChevronLeft } from '@/components/ui/Icon';
import { useLocalSearchParams, useRouter } from 'expo-router';

import { OtpInput, Spinner } from '@/components/ui';
import { fetchOwnUser, isProfileComplete, requestOtp, verifyOtp } from '@/lib/supabase/auth';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

const RESEND_SECONDS = 30;
const MAX_RESENDS = 3;

// "+919876543210" -> "+91 98765 43210"
function formatPhone(e164: string): string {
  const national = e164.replace('+91', '');
  return `+91 ${national.slice(0, 5)} ${national.slice(5)}`;
}

export default function OtpScreen() {
  const router = useRouter();
  const { phone } = useLocalSearchParams<{ phone: string }>();
  const setUser = useUserStore((s) => s.setUser);

  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RESEND_SECONDS);
  const [resends, setResends] = useState(0);

  const shake = useSharedValue(0);
  const submitted = useRef(false);

  // Resend countdown.
  useEffect(() => {
    if (secondsLeft <= 0) return;
    const t = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(t);
  }, [secondsLeft]);

  // Auto-submit when the 6th digit lands.
  useEffect(() => {
    if (code.length === 6 && !submitted.current && phone) {
      submitted.current = true;
      void verify(code);
    }
  }, [code, phone]);

  const verify = async (token: string) => {
    setVerifying(true);
    setError(null);
    try {
      const session = await verifyOtp(phone, token);
      const row = await fetchOwnUser(session.user.id);
      setUser(row);
      // New user -> onboarding; returning + complete -> straight to the app.
      router.replace(isProfileComplete(row) ? '/(tabs)' : '/(auth)/onboarding');
    } catch {
      // Wrong code: shake, clear, refocus, message.
      shake.value = withSequence(
        withTiming(-8, { duration: 50 }),
        withTiming(8, { duration: 50 }),
        withTiming(-8, { duration: 50 }),
        withTiming(0, { duration: 50 }),
      );
      setCode('');
      setError('Wrong code. Try again.');
      submitted.current = false;
      setVerifying(false);
    }
  };

  const onResend = async () => {
    if (secondsLeft > 0 || resends >= MAX_RESENDS || !phone) return;
    try {
      await requestOtp(phone);
      setResends((r) => r + 1);
      setSecondsLeft(RESEND_SECONDS);
      setError(null);
    } catch {
      setError("Couldn't resend the code. Try again?");
    }
  };

  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));
  const resendsExhausted = resends >= MAX_RESENDS;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="flex-1 px-4">
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go back"
          onPress={() => router.back()}
          hitSlop={8}
          className="h-14 w-10 justify-center"
        >
          <IconChevronLeft size={24} color={colors.ink[900]} />
        </Pressable>

        <Text className="mt-6 text-display-sm text-ink-900">Enter the code</Text>
        <Text className="mt-3 text-body-md text-ink-700">
          Sent to {phone ? formatPhone(phone) : ''}{' '}
          <Text className="text-saffron-600" onPress={() => router.back()}>
            Change
          </Text>
        </Text>

        <Animated.View style={shakeStyle} className="mt-10">
          {verifying ? (
            <View className="h-[56px] flex-row items-center">
              <Spinner size="large" />
            </View>
          ) : (
            <OtpInput value={code} onChangeText={setCode} autoFocus />
          )}
        </Animated.View>

        {error ? <Text className="mt-3 text-body-sm text-danger">{error}</Text> : null}

        <View className="mt-6">
          {resendsExhausted ? (
            <Text className="text-body-sm text-ink-600">Try again in 10 minutes</Text>
          ) : secondsLeft > 0 ? (
            <Text className="text-body-sm text-ink-600">Resend code in {secondsLeft}s</Text>
          ) : (
            <Text className="text-body-sm text-saffron-600" onPress={onResend}>
              Resend code
            </Text>
          )}
        </View>
      </View>
    </SafeAreaView>
  );
}
