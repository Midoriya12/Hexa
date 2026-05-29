// Onboarding Carousel — design spec §6.4. 3 swipeable pages.
// Visuals are static placeholders for Phase 1 (Lottie deferred — patch #26).
import { useRef, useState } from 'react';
import { Dimensions, FlatList, Text, View, type ViewToken } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';

const { width } = Dimensions.get('window');

interface Page {
  key: string;
  heading: string;
  body: string;
}

const PAGES: Page[] = [
  {
    key: 'game',
    heading: 'Walk the city. Capture it.',
    body: 'Every neighbourhood in Bangalore is split into hex tiles. Stand on one for 20 seconds — it’s yours.',
  },
  {
    key: 'rivalry',
    heading: 'Your friends will steal them.',
    body: 'Defend your turf or lose it. Build streaks, climb your pincode leaderboard, earn medals for moments worth remembering.',
  },
  {
    key: 'reward',
    heading: 'Walk for real things.',
    body: 'Brand-sponsored vouchers from cafés you actually walk past. Coming soon to HSR, Indiranagar, Koramangala.',
  },
];

export default function OnboardingScreen() {
  const router = useRouter();
  const listRef = useRef<FlatList<Page>>(null);
  const [index, setIndex] = useState(0);

  const onViewableItemsChanged = useRef((info: { viewableItems: ViewToken[] }) => {
    const first = info.viewableItems[0];
    if (first?.index != null) setIndex(first.index);
  }).current;

  const isLast = index === PAGES.length - 1;

  const goNext = () => {
    if (isLast) {
      router.replace('/(auth)/profile-setup');
    } else {
      listRef.current?.scrollToIndex({ index: index + 1 });
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="h-14 flex-row items-center justify-end px-4">
        {!isLast ? (
          <Text className="text-body-sm text-ink-700" onPress={() => router.replace('/(auth)/profile-setup')}>
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
          <View style={{ width }} className="flex-1 items-center justify-center px-6">
            {/* Static placeholder visual (Lottie deferred — patch #26). */}
            <View className="mb-10 h-48 w-48 items-center justify-center rounded-2xl bg-ink-200">
              <View className="h-24 w-24 rounded-lg bg-saffron-600/30" />
            </View>
            <Text className="text-center text-display-md text-ink-900">{item.heading}</Text>
            <Text className="mt-4 text-center text-body-lg text-ink-700">{item.body}</Text>
          </View>
        )}
      />

      <View className="px-4 pb-2">
        <View className="mb-6 flex-row justify-center gap-2">
          {PAGES.map((p, i) => (
            <View
              key={p.key}
              className={`h-2 rounded-full ${i === index ? 'w-6 bg-saffron-600' : 'w-2 bg-ink-400'}`}
            />
          ))}
        </View>
        <Button label={isLast ? "Let's go" : 'Next'} onPress={goNext} />
      </View>
    </SafeAreaView>
  );
}
