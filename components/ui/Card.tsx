// Card — design spec §3.2. Default + pressable variants.
// bg ink.200, radius md, shadow-sm, padding 16 (20 for content-heavy),
// optional 1px ink.400 emphasis border. Pressable scales to 0.98 + Light haptic.
import { type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import * as Haptics from 'expo-haptics';

interface CardProps {
  children: ReactNode;
  onPress?: () => void;
  bordered?: boolean;
  contentHeavy?: boolean;
  className?: string;
  testID?: string;
}

export function Card({
  children,
  onPress,
  bordered = false,
  contentHeavy = false,
  className = '',
  testID,
}: CardProps) {
  const cardClass = [
    'rounded-md bg-ink-200 shadow-sm',
    contentHeavy ? 'p-5' : 'p-4',
    bordered ? 'border border-ink-400' : '',
    className,
  ].join(' ');

  if (onPress) {
    return (
      <Pressable
        accessibilityRole="button"
        testID={testID}
        onPress={() => {
          void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onPress();
        }}
      >
        {({ pressed }) => (
          <View style={pressed ? { transform: [{ scale: 0.98 }] } : undefined} className={cardClass}>
            {children}
          </View>
        )}
      </Pressable>
    );
  }

  return (
    <View testID={testID} className={cardClass}>
      {children}
    </View>
  );
}

export default Card;
