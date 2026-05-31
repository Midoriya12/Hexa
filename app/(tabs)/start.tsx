// Start — INTVL 25 "active walk" layout, adapted to Hexa. Full-bleed map (placeholder
// until Mapbox; HexMap swaps in after the native build) with floating controls and a
// persistent swipe-up stats sheet (Duration / Distance / Hexes / Avg pace) carrying the
// Start / Pause / Finish controls. Dark (Sai's theme: only Me/Settings are light).
// Live tracking is the Walk Session feature (Phase 10); stats are zeroed for now.
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import { Button } from '@/components/ui';
import { HexMap } from '@/components/map/HexMap';
import { HexIcon } from '@/components/shared/HexIcon';
import { IconStack, IconTarget } from '@/components/ui/Icon';
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
  // Sheet height is MEASURED from the content so the stats + the full Start button always
  // show (no half-cut button); the primary action never needs a swipe to reach.
  const [sheetH, setSheetH] = useState(300);
  const snapPoints = useMemo(() => [sheetH], [sheetH]);

  return (
    <View className="flex-1 bg-ink-50">
      {/* ── Live map (globe + zoom); route overlay arrives with Walk Sessions ── */}
      <HexMap />

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
        <BottomSheetView>
          <View
            onLayout={(e) => setSheetH(Math.ceil(e.nativeEvent.layout.height) + 28)}
            style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 16 }}
          >
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
                  ? 'Walk into a hex and hold steady to capture it'
                  : 'Live tracking arrives with Walk Sessions (Phase 10)'}
              </Text>
            </View>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
