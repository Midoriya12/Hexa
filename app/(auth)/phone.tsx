// Phone Entry — design spec §6.2. Collect the phone number, send the OTP.
import { useState } from 'react';
import { Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, BottomToast } from '@/components/ui';
import { requestOtp } from '@/lib/supabase/auth';
import { colors } from '@/theme';

// Indian mobile: 10 digits starting 6-9.
const VALID_PHONE = /^[6-9]\d{9}$/;

// "9876543210" -> "98765 43210"
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
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="flex-1 px-4 pt-6">
        <Text className="text-display-sm text-ink-900">What&apos;s your number?</Text>
        <Text className="mt-3 text-body-md text-ink-700">We&apos;ll send you a 6-digit code.</Text>

        <View className="mt-10 flex-row">
          {/* Locked +91 (no other country in v1). */}
          <View className="h-[52px] w-20 flex-row items-center justify-center rounded-md border border-ink-400 bg-ink-200">
            <Text className="text-body-lg text-ink-900">🇮🇳 +91</Text>
          </View>
          <TextInput
            value={formatNational(digits)}
            onChangeText={onChange}
            placeholder="Enter mobile number"
            placeholderTextColor={colors.ink[600]}
            keyboardType="number-pad"
            maxLength={11} // 10 digits + 1 space
            autoFocus
            className={`ml-3 h-[52px] flex-1 rounded-md bg-ink-200 px-4 text-body-lg text-ink-900 ${
              error ? 'border-2 border-danger' : 'border border-ink-400'
            }`}
          />
        </View>

        {error ? (
          <Text className="mt-2 text-body-sm text-danger">{error}</Text>
        ) : (
          <Text className="mt-2 text-body-sm text-ink-600">Standard SMS rates may apply</Text>
        )}

        <View className="flex-1" />

        <Button label="Send code" onPress={onSend} disabled={!valid} loading={sending} />

        <Text className="mb-2 mt-4 text-center text-body-sm text-ink-600">
          By continuing, you agree to our <Text className="text-saffron-600">Terms</Text> and{' '}
          <Text className="text-saffron-600">Privacy Policy</Text>
        </Text>
      </View>

      <BottomToast
        visible={toast}
        message="Couldn't send code. Try again?"
        onDismiss={() => setToast(false)}
      />
    </SafeAreaView>
  );
}
