// Onboarding — bold intro in the INTVL visual language (dark + saffron). INTVL has
// no onboarding carousel, so this applies the style, not a specific screen.
import { useRef, useState } from 'react';
import { FlatList, Text, useWindowDimensions, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconFlag, IconGift, IconHexagons } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';
import { colors } from '@/theme';

interface Page {
  key: string;
  heading: string;
  body: string;
  Icon: typeof IconHexagons;
}

const PAGES: Page[] = [
  {
    key: 'game',
    heading: 'Walk the city.\nCapture it.',
    body: 'Bangalore is split into hex tiles. Stand on one for 20 seconds — it’s yours.',
    Icon: IconHexagons,
  },
  {
    key: 'rivalry',
    heading: 'Defend\nyour turf.',
    body: 'Friends and strangers steal your hexes. Build streaks, climb your pincode leaderboard, earn medals.',
    Icon: IconFlag,
  },
  {
    key: 'reward',
    heading: 'Walk for\nreal things.',
    body: 'Brand-sponsored vouchers from cafés you actually walk past. Coming to HSR, Indiranagar, Koramangala.',
    Icon: IconGift,
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const { width } = useWindowDimensions(); // live width — adapts to rotation / screen size
  const listRef = useRef<FlatList<Page>>(null);
  const [index, setIndex] = useState(0);

  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const isLast = index === PAGES.length - 1;
  const goNext = () => {
    if (isLast) router.replace('/(auth)/profile-setup');
    else listRef.current?.scrollToIndex({ index: index + 1 });
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="h-12 flex-row items-center justify-end px-4">
        {!isLast ? (
          <Text className="text-label-md text-ink-700" onPress={() => router.replace('/(auth)/profile-setup')}>
            Skip
          </Text>
        ) : null}
      </View>

      <FlatList
        ref={listRef}
        data={PAGES}
        keyExtractor={(p) => p.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={{ itemVisiblePercentThreshold: 60 }}
        renderItem={({ item }) => (
          <View style={{ width }} className="flex-1 px-6">
            {/* Bold saffron hero block */}
            <View className="mt-4 h-72 items-center justify-center rounded-2xl bg-saffron-600/15">
              <item.Icon size={96} color={colors.saffron[600]} strokeWidth={1.5} />
            </View>
            <Text className="mt-10 text-display-lg font-extrabold text-ink-900">{item.heading}</Text>
            <Text className="mt-4 text-body-lg text-ink-700">{item.body}</Text>
          </View>
        )}
      />

      <View className="px-6 pb-2">
        <View className="mb-6 flex-row gap-2">
          {PAGES.map((p, i) => (
            <View
              key={p.key}
              className={`h-1.5 rounded-full ${i === index ? 'w-8 bg-saffron-600' : 'w-1.5 bg-ink-400'}`}
            />
          ))}
        </View>
        <Button label={isLast ? "Let's go" : 'Next'} size="lg" onPress={goNext} />
      </View>
    </SafeAreaView>
  );
}
