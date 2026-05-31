// Start — the active-walk screen. Full-bleed map + a persistent stats sheet. Pressing Start
// Walk begins the live capture loop (useHexTracker): your GPS is watched, the hex you're in is
// detected, a level-scaled dwell runs, and the hex auto-captures + flips saffron on the map.
// Duration + Hexes are live; richer route/distance stats come with full Walk Sessions (Phase 10).
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import { Button } from '@/components/ui';
import { HexMap } from '@/components/map/HexMap';
import { HexIcon } from '@/components/shared/HexIcon';
import { IconStack, IconTarget } from '@/components/ui/Icon';
import { useHexTracker } from '@/hooks/useHexTracker';
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

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export default function StartScreen() {
  const insets = useSafeAreaInsets();
  const [walking, setWalking] = useState(false);
  const [durationSec, setDurationSec] = useState(0);
  const sheetRef = useRef<BottomSheet>(null);
  const [sheetH, setSheetH] = useState(320);
  const snapPoints = useMemo(() => [sheetH], [sheetH]);

  const tracker = useHexTracker(walking);

  // Live duration while walking.
  useEffect(() => {
    if (!walking) return;
    const id = setInterval(() => setDurationSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [walking]);

  const start = () => {
    setDurationSec(0);
    setWalking(true);
  };
  const finish = () => setWalking(false);

  const dwelling = tracker.status === 'dwelling' || tracker.status === 'capturing';
  const dwellRemain = Math.max(0, Math.ceil(tracker.dwellSec * (1 - tracker.dwellProgress)));

  return (
    <View className="flex-1 bg-ink-50">
      {/* ── Live map; captured hexes flip saffron here ── */}
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
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: colors.ink[100] }}
        handleIndicatorStyle={{ backgroundColor: colors.ink[500], width: 40 }}
      >
        <BottomSheetView>
          <View
            onLayout={(e) => setSheetH(Math.ceil(e.nativeEvent.layout.height) + 28)}
            style={{ paddingHorizontal: 20, paddingTop: 4, paddingBottom: insets.bottom + 16 }}
          >
            {/* Primary metrics */}
            <View className="flex-row items-end justify-around">
              <Stat value={mmss(durationSec)} label="Duration" big />
              <View className="flex-row items-center gap-1.5">
                <HexIcon size={18} color={colors.saffron[600]} />
                <Stat value={String(tracker.capturedCount)} label="Hexes" big />
              </View>
            </View>

            {/* Capture status / dwell progress */}
            <View className="mt-6 min-h-[44px] justify-center">
              {walking && dwelling ? (
                <>
                  <View className="mb-1.5 flex-row justify-between">
                    <Text className="text-label-md text-ink-800">
                      {tracker.status === 'capturing' ? 'Capturing…' : 'Hold this hex'}
                    </Text>
                    <Text style={{ fontVariant: ['tabular-nums'] }} className="text-label-md text-saffron-600">
                      {dwellRemain}s
                    </Text>
                  </View>
                  <View className="h-2 overflow-hidden rounded-full bg-ink-300">
                    <View
                      className="h-full rounded-full bg-saffron-600"
                      style={{ width: `${Math.round(tracker.dwellProgress * 100)}%` }}
                    />
                  </View>
                </>
              ) : (
                <Text className="text-center text-body-md text-ink-700">
                  {walking ? tracker.message || 'Walk into a hex to capture it.' : 'Press Start Walk, then walk into a hex to capture it.'}
                </Text>
              )}
            </View>

            {/* Controls */}
            <View className="mt-6">
              {!walking ? (
                <Button label="Start Walk" size="lg" onPress={start} />
              ) : (
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button label="Pause" variant="secondary" size="lg" onPress={() => undefined} />
                  </View>
                  <View className="flex-1">
                    <Button label="Finish" size="lg" onPress={finish} />
                  </View>
                </View>
              )}
            </View>
          </View>
        </BottomSheetView>
      </BottomSheet>
    </View>
  );
}
