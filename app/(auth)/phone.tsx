// Phone Entry — INTVL "Welcome / Sign In" blueprint (patch #30), recoloured to
// Hexa saffron. Warm saffron gradient hero + bold wordmark + single phone field +
// dark primary CTA. Phone-OTP only (no email/password/social — locked decision).
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { BottomToast, Button } from '@/components/ui';
import { requestOtp } from '@/lib/supabase/auth';
import { colors } from '@/theme';

const VALID_PHONE = /^[6-9]\d{9}$/;

function formatNational(digits: string): string {
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

export default function PhoneEntryScreen() {
  const router = useRouter();
  const [digits, setDigits] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState(false);

  const valid = VALID_PHONE.test(digits);

  const onChange = (text: string) => {
    setDigits(text.replace(/[^0-9]/g, '').slice(0, 10));
    if (error) setError(null);
  };

  const onSend = async () => {
    if (!valid) {
      setError('Please enter a valid Indian mobile number');
      return;
    }
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSending(true);
    try {
      await requestOtp(`+91${digits}`);
      router.push({ pathname: '/(auth)/otp', params: { phone: `+91${digits}` } });
    } catch {
      setToast(true);
    } finally {
      setSending(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.saffron[500], colors.saffron[600], colors.saffron[800]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 0, y: 1 }}
      style={{ flex: 1 }}
    >
      <SafeAreaView edges={['top', 'bottom']} className="flex-1">
        <View className="flex-1 px-6">
          {/* Hero wordmark + tagline (INTVL welcome treatment). */}
          <View className="mt-16 items-center">
            <Text className="text-display-lg font-extrabold tracking-tight text-white">HEXA</Text>
            <Text className="mt-2 text-body-lg text-white/90">Walk the city. Capture it.</Text>
          </View>

          <View className="mt-12">
            <Text className="mb-2 text-label-md text-white/90">Your mobile number</Text>
            <View className="flex-row">
              <View className="h-[56px] w-20 flex-row items-center justify-center rounded-md bg-white/15">
                <Text className="text-body-lg font-semibold text-white">🇮🇳 +91</Text>
              </View>
              <TextInput
                value={formatNational(digits)}
                onChangeText={onChange}
                placeholder="Enter mobile number"
                placeholderTextColor="rgba(255,255,255,0.6)"
                keyboardType="number-pad"
                maxLength={11}
                autoFocus
                className={`ml-3 h-[56px] flex-1 rounded-md bg-white/15 px-4 text-body-lg font-semibold text-white ${
                  error ? 'border-2 border-ink-50' : ''
                }`}
              />
            </View>
            {error ? (
              <Text className="mt-2 text-body-sm font-semibold text-ink-50">{error}</Text>
            ) : (
              <Text className="mt-2 text-body-sm text-white/80">We&apos;ll send you a 6-digit code.</Text>
            )}
          </View>

          <View className="flex-1" />

          {/* Dark primary CTA on the warm gradient (INTVL's dark Sign-in button). */}
          <Button label="Send code" variant="secondary" size="lg" onPress={onSend} disabled={!valid} loading={sending} />

          <Text className="mb-2 mt-4 text-center text-body-sm text-white/80">
            By continuing, you agree to our <Text className="font-semibold text-white">Terms</Text> and{' '}
            <Text className="font-semibold text-white">Privacy Policy</Text>
          </Text>
        </View>

        <BottomToast
          visible={toast}
          message="Couldn't send code. Try again?"
          onDismiss={() => setToast(false)}
        />
      </SafeAreaView>
    </LinearGradient>
  );
}
