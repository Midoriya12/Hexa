// Avatar — design spec §3.3. Circular; photo or initial fallback.
// NOTE: spec calls for a saffron->coral gradient fallback. That needs
// expo-linear-gradient (not in the approved Phase 0 dep set), so the fallback is a
// solid saffron fill for now — swap to a gradient once that dep is approved.
import { Image, Text, View } from 'react-native';

import { colors } from '@/theme';

type AvatarSize = 24 | 32 | 40 | 48 | 64 | 96 | 128;

interface AvatarProps {
  size?: AvatarSize;
  uri?: string;
  name?: string;
  bordered?: boolean;
}

export function Avatar({ size = 48, uri, name, bordered = false }: AvatarProps) {
  const initial = name?.trim().charAt(0).toUpperCase() || '?';
  const dimension = { width: size, height: size };
  const borderClass = bordered ? 'border-2 border-white' : '';

  if (uri) {
    return (
      <Image
        accessibilityRole="image"
        source={{ uri }}
        style={dimension}
        className={`rounded-full ${borderClass}`}
      />
    );
  }

  return (
    <View
      style={[dimension, { backgroundColor: colors.player.saffron }]}
      className={`items-center justify-center rounded-full ${borderClass}`}
    >
      <Text
        style={{ fontSize: Math.round(size * 0.42), lineHeight: Math.round(size * 0.48) }}
        className="font-bold text-white"
      >
        {initial}
      </Text>
    </View>
  );
}

export default Avatar;
