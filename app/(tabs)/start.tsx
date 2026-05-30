// Start — INTVL 25 "active walk" layout, adapted to Hexa. Full-bleed map (placeholder
// until Mapbox; HexMap swaps in after the native build) with floating controls and a
// persistent swipe-up stats sheet (Duration / Distance / Hexes / Avg pace) carrying the
// Start / Pause / Finish controls. Dark (Sai's theme: only Me/Settings are light).
// Live tracking is the Walk Session feature (Phase 10); stats are zeroed for now.
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import { Button } from '@/components/ui';
import { HexIcon } from '@/components/shared/HexIcon';
import { IconStack, IconTarget, IconWalk } from '@/components/ui/Icon';
import { colors } from '@/theme';

function ControlButton({ children }: { children: React.ReactNode }) {
  return (
    <View className="mb-3 h-11 w-11 items-center justify-center rounded-full border border-ink-400 bg-ink-100">
      {children}
    </View>
  );
}

function Stat({ value, label, big }: { value: string; label: string; big?: boolean }) {
  return (
    <View className="items-center">
      <Text
        style={{ fontVariant: ['tabular-nums'] }}
        className={`font-extrabold text-ink-900 ${big ? 'text-display-xl' : 'text-heading-lg'}`}
      >
        {value}
      </Text>
      <Text className="mt-1 text-label-sm uppercase tracking-wide text-ink-600">{label}</Text>
    </View>
  );
}

export default function StartScreen() {
  const insets = useSafeAreaInsets();
  const [walking, setWalking] = useState(false);
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['32%', '60%'], []);

  return (
    <View className="flex-1 bg-ink-50">
      {/* ── Map placeholder (HexMap swaps in after the native Mapbox build) ── */}
      <LinearGradient
        colors={[colors.ink[100], colors.ink[50]]}
        style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 }}
      />
      <View className="absolute left-0 right-0 items-center" style={{ top: insets.top + 120 }}>
        <View className="h-16 w-16 items-center justify-center rounded-2xl bg-ink-200">
          <IconWalk size={36} color={colors.ink[500]} />
        </View>
        <Text className="mt-3 text-body-sm text-ink-600">Your route draws here once you start walking</Text>
      </View>

      {/* ── Floating controls (right) ── */}
      <View style={{ position: 'absolute', right: 16, top: insets.top + 12 }}>
        <ControlButton>
          <IconTarget size={20} color={colors.ink[900]} />
        </ControlButton>
        <ControlButton>
          <IconStack size={20} color={colors.ink[900]} />
        </ControlButton>
      </View>

      {/* ── Persistent walk-stats sheet ── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: colors.ink[100] }}
        handleIndicatorStyle={{ backgroundColor: colors.ink[500], width: 40 }}
      >
        <BottomSheetView style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 16 }}>
          {/* Primary metric */}
          <View className="items-center">
            <Stat value="00:00" label="Duration" big />
          </View>

          {/* Secondary metrics */}
          <View className="mt-5 flex-row items-start justify-around">
            <Stat value="0.00" label="Distance · km" />
            <View className="flex-row items-center gap-1.5">
              <HexIcon size={18} color={colors.saffron[600]} />
              <Stat value="0" label="Hexes" />
            </View>
            <Stat value="0:00" label="Avg pace" />
          </View>

          {/* Controls */}
          <View className="mt-7">
            {!walking ? (
              <Button label="Start Walk" size="lg" onPress={() => setWalking(true)} />
            ) : (
              <View className="flex-row gap-3">
                <View className="flex-1">
                  <Button label="Pause" variant="secondary" size="lg" onPress={() => undefined} />
                </View>
                <View className="flex-1">
                  <Button label="Finish" size="lg" onPress={() => setWalking(false)} />
                </View>
              </View>
            )}
            <Text className="mt-3 text-center text-body-sm text-ink-600">
              {walking
                ? 'Walk into a hex and hold 20s to capture it'
                : 'Live tracking arrives with Walk Sessions (Phase 10)'}
            </Text>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
