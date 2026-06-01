// Start — the active-walk screen. Map + stats sheet + the live capture loop (useHexTracker).
// Start Walk → tracking begins, you walk into a hex, a TOP progress bar shows the dwell, the
// hex auto-captures (success card with confetti + points), and Finish shows a walk summary.
// Pause/Resume freezes the session; a new Start resets it. Duration + Distance + Hexes are live.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetView } from '@gorhom/bottom-sheet';

import { Button } from '@/components/ui';
import { HexMap } from '@/components/map/HexMap';
import { HexIcon } from '@/components/shared/HexIcon';
import { IconStack, IconTarget } from '@/components/ui/Icon';
import { CaptureSuccess } from '@/components/capture/CaptureSuccess';
import { WalkSummary } from '@/components/capture/WalkSummary';
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
  const [paused, setPaused] = useState(false);
  const [sessionKey, setSessionKey] = useState(0);
  const [durationSec, setDurationSec] = useState(0);
  const [summary, setSummary] = useState<{
    durationSec: number;
    distanceM: number;
    hexes: number;
    points: number;
  } | null>(null);
  const [card, setCard] = useState<{ ip: number; pph: number } | null>(null);
  const seenNonce = useRef(0);

  const sheetRef = useRef<BottomSheet>(null);
  const [sheetH, setSheetH] = useState(300);
  const snapPoints = useMemo(() => [sheetH], [sheetH]);

  const tracker = useHexTracker(walking && !paused, sessionKey);

  // Live duration while actively walking (frozen while paused).
  useEffect(() => {
    if (!walking || paused) return;
    const id = setInterval(() => setDurationSec((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [walking, paused]);

  // Pop the success card once per capture (nonce changes each capture).
  useEffect(() => {
    if (tracker.lastCapture && tracker.lastCapture.nonce !== seenNonce.current) {
      seenNonce.current = tracker.lastCapture.nonce;
      setCard({ ip: tracker.lastCapture.ip, pph: tracker.lastCapture.pph });
    }
  }, [tracker.lastCapture]);

  const start = () => {
    setSessionKey((k) => k + 1);
    setDurationSec(0);
    setPaused(false);
    setSummary(null);
    setWalking(true);
  };
  const finish = () => {
    setSummary({
      durationSec,
      distanceM: tracker.distanceM,
      hexes: tracker.capturedCount,
      points: tracker.capturedCount * 100, // flat IP=100 for now
    });
    setWalking(false);
    setPaused(false);
    setDurationSec(0);
    setSessionKey((k) => k + 1); // reset tracker distance/hexes so the next walk starts at 0
  };

  const dwelling = tracker.status === 'dwelling' || tracker.status === 'capturing';
  const dwellRemain = Math.max(0, Math.ceil(tracker.dwellSec * (1 - tracker.dwellProgress)));

  return (
    <View className="flex-1 bg-ink-50">
      <HexMap followUser dot={tracker.position} />

      {/* ── TOP dwell progress bar (prominent — so capture never feels random) ── */}
      {walking && dwelling ? (
        <View style={{ position: 'absolute', top: insets.top + 6, left: 0, right: 0 }} className="px-4">
          <View className="h-2.5 overflow-hidden rounded-full bg-ink-300">
            <View
              className="h-full rounded-full bg-saffron-600"
              style={{ width: `${Math.round(tracker.dwellProgress * 100)}%` }}
            />
          </View>
          <Text className="mt-1 text-center text-label-sm font-semibold text-ink-900">
            {tracker.status === 'capturing' ? 'Capturing…' : `Hold this hex · ${dwellRemain}s`}
          </Text>
        </View>
      ) : null}

      {/* ── Floating controls (right) ── */}
      <View style={{ position: 'absolute', right: 16, top: insets.top + 56 }}>
        <ControlButton>
          <IconTarget size={20} color={colors.ink[900]} />
        </ControlButton>
        <ControlButton>
          <IconStack size={20} color={colors.ink[900]} />
        </ControlButton>
      </View>

      {/* ── Stats sheet ── */}
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
            <View className="items-center">
              <Stat value={mmss(durationSec)} label="Duration" big />
            </View>
            <View className="mt-5 flex-row items-start justify-around">
              <Stat value={(tracker.distanceM / 1000).toFixed(2)} label="Distance · km" />
              <View className="flex-row items-center gap-1.5">
                <HexIcon size={18} color={colors.saffron[600]} />
                <Stat value={String(tracker.capturedCount)} label="Hexes" />
              </View>
            </View>

            <View className="mt-5 min-h-[20px] justify-center">
              <Text className="text-center text-body-md text-ink-700">
                {walking ? tracker.message || 'Walk into a hex to capture it.' : 'Press Start Walk, then walk into a hex.'}
              </Text>
            </View>

            <View className="mt-5">
              {!walking ? (
                <Button label="Start Walk" size="lg" onPress={start} />
              ) : (
                <View className="flex-row gap-3">
                  <View className="flex-1">
                    <Button
                      label={paused ? 'Resume' : 'Pause'}
                      variant="secondary"
                      size="lg"
                      onPress={() => setPaused((p) => !p)}
                    />
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

      <CaptureSuccess
        visible={!!card}
        ip={card?.ip ?? 0}
        pph={card?.pph ?? 0}
        onClose={() => setCard(null)}
      />
      <WalkSummary
        visible={!!summary}
        durationSec={summary?.durationSec ?? 0}
        distanceM={summary?.distanceM ?? 0}
        hexes={summary?.hexes ?? 0}
        points={summary?.points ?? 0}
        onClose={() => setSummary(null)}
      />
    </View>
  );
}
