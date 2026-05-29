// Input — design spec §3.5. Text field + 6-cell OTP field.
import { useRef, useState } from 'react';
import {
  Text,
  TextInput,
  View,
  type NativeSyntheticEvent,
  type TextInputKeyPressEventData,
  type TextInputProps,
} from 'react-native';

import { colors } from '@/theme';

interface InputProps extends Omit<TextInputProps, 'style'> {
  label?: string;
  error?: string;
}

export function Input({ label, error, onFocus, onBlur, ...rest }: InputProps) {
  const [focused, setFocused] = useState(false);

  const borderClass = error
    ? 'border-2 border-danger'
    : focused
      ? 'border-2 border-saffron-600'
      : 'border border-ink-400';

  return (
    <View>
      {label ? <Text className="mb-2 text-label-md text-ink-700">{label}</Text> : null}
      <TextInput
        {...rest}
        placeholderTextColor={colors.ink[600]}
        onFocus={(e) => {
          setFocused(true);
          onFocus?.(e);
        }}
        onBlur={(e) => {
          setFocused(false);
          onBlur?.(e);
        }}
        className={`min-h-[52px] rounded-md bg-ink-200 px-4 py-[14px] text-body-lg text-ink-900 ${borderClass}`}
      />
      {error ? <Text className="mt-2 text-body-sm text-danger">{error}</Text> : null}
    </View>
  );
}

interface OtpInputProps {
  value: string;
  onChangeText: (next: string) => void;
  length?: number;
  autoFocus?: boolean;
}

export function OtpInput({ value, onChangeText, length = 6, autoFocus = false }: OtpInputProps) {
  const inputs = useRef<Array<TextInput | null>>([]);
  const [focusedIndex, setFocusedIndex] = useState<number | null>(null);
  const chars = value.split('').slice(0, length);

  const handleChange = (index: number, text: string) => {
    const digits = text.replace(/[^0-9]/g, '');
    const arr = value.split('');
    if (digits.length === 0) {
      arr[index] = '';
      onChangeText(arr.join('').slice(0, length));
      return;
    }
    let cursor = index;
    for (const digit of digits) {
      if (cursor >= length) break;
      arr[cursor] = digit;
      cursor += 1;
    }
    onChangeText(arr.join('').slice(0, length));
    inputs.current[Math.min(cursor, length - 1)]?.focus();
  };

  const handleKeyPress =
    (index: number) => (event: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
      if (event.nativeEvent.key === 'Backspace' && !chars[index]) {
        inputs.current[index - 1]?.focus();
      }
    };

  return (
    <View className="flex-row gap-2">
      {Array.from({ length }).map((_, index) => (
        <TextInput
          // eslint-disable-next-line react/no-array-index-key
          key={index}
          ref={(node) => {
            inputs.current[index] = node;
          }}
          value={chars[index] ?? ''}
          onChangeText={(text) => handleChange(index, text)}
          onKeyPress={handleKeyPress(index)}
          onFocus={() => setFocusedIndex(index)}
          onBlur={() => setFocusedIndex((prev) => (prev === index ? null : prev))}
          keyboardType="number-pad"
          maxLength={1}
          autoFocus={autoFocus && index === 0}
          textContentType="oneTimeCode"
          className={`h-[56px] w-[48px] rounded-md bg-ink-200 text-center text-heading-lg text-ink-900 ${
            focusedIndex === index ? 'border-2 border-saffron-600' : 'border border-ink-400'
          }`}
        />
      ))}
    </View>
  );
}

export default Input;
