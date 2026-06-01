// Walk summary — shown on Finish: a celebratory gradient header (hexes captured) + a stats row
// (duration, distance, pace, points). Persisting walks to the Me "Your walks" list is next.
import { Modal, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { Button } from '@/components/ui';
import { HexIcon } from '@/components/shared/HexIcon';
import { colors } from '@/theme';

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-md font-extrabold text-ink-900">
        {value}
      </Text>
      <Text className="mt-1 text-label-sm uppercase tracking-wide text-ink-600">{label}</Text>
    </View>
  );
}

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

function paceMinKm(durationSec: number, distanceM: number): string {
  if (distanceM < 50) return '—';
  const secPerKm = durationSec / (distanceM / 1000);
  const m = Math.floor(secPerKm / 60);
  const s = Math.round(secPerKm % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function WalkSummary({
  visible,
  durationSec,
  distanceM,
  hexes,
  points,
  onClose,
}: {
  visible: boolean;
  durationSec: number;
  distanceM: number;
  hexes: number;
  points: number;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="overflow-hidden rounded-t-3xl bg-ink-100">
          {/* Gradient header with the hero stat */}
          <LinearGradient
            colors={[colors.saffron[400], colors.saffron[600]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{ paddingVertical: 24, alignItems: 'center' }}
          >
            <Text className="text-label-md uppercase tracking-widest text-white/90">Walk complete</Text>
            <View className="mt-2 flex-row items-center gap-2">
              <HexIcon size={30} color="#FFFFFF" />
              <Text style={{ fontVariant: ['tabular-nums'] }} className="text-display-xl font-extrabold text-white">
                {hexes}
              </Text>
            </View>
            <Text className="text-body-sm text-white/90">hexes captured</Text>
          </LinearGradient>

          {/* Stats */}
          <View className="px-5 pb-10 pt-6">
            <View className="flex-row justify-around">
              <Metric value={mmss(durationSec)} label="Duration" />
              <Metric value={(distanceM / 1000).toFixed(2)} label="km" />
              <Metric value={paceMinKm(durationSec, distanceM)} label="min/km" />
              <Metric value={`+${points}`} label="Points" />
            </View>
            <View className="mt-7">
              <Button label="Done" size="lg" onPress={onClose} />
            </View>
          </View>
        </View>
      </View>
    </Modal>
  );
}
