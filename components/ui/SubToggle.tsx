// SubToggle — design spec §3.11. Animated segmented control (max 4 options).
import { useEffect, useState } from 'react';
import { LayoutChangeEvent, Pressable, Text, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

interface SubToggleProps {
  options: string[]; // 2..4
  value: string;
  onChange: (next: string) => void;
}

const PADDING = 4;

export function SubToggle({ options, value, onChange }: SubToggleProps) {
  const [trackWidth, setTrackWidth] = useState(0);
  const segmentWidth = trackWidth > 0 ? (trackWidth - PADDING * 2) / options.length : 0;
  const index = Math.max(0, options.indexOf(value));
  const offset = useSharedValue(0);

  useEffect(() => {
    offset.value = withTiming(index * segmentWidth, { duration: 200 });
  }, [index, segmentWidth, offset]);

  const pillStyle = useAnimatedStyle(() => ({
    width: segmentWidth,
    transform: [{ translateX: offset.value }],
  }));

  const onLayout = (event: LayoutChangeEvent) => setTrackWidth(event.nativeEvent.layout.width);

  return (
    <View onLayout={onLayout} className="h-[36px] flex-row rounded-full bg-ink-200 p-1">
      {segmentWidth > 0 ? (
        <Animated.View
          style={[pillStyle, { position: 'absolute', top: PADDING, bottom: PADDING, left: PADDING }]}
          className="rounded-full bg-saffron-600"
        />
      ) : null}
      {options.map((option) => {
        const selected = option === value;
        return (
          <Pressable
            key={option}
            accessibilityRole="button"
            accessibilityState={{ selected }}
            className="flex-1 items-center justify-center"
            onPress={() => {
              void Haptics.selectionAsync();
              onChange(option);
            }}
          >
            <Text className={`text-label-md ${selected ? 'font-semibold text-white' : 'text-ink-700'}`}>
              {option}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default SubToggle;
