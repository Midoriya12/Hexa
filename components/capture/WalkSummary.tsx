// Walk summary — shown when the player taps Finish: the session's duration, distance and hexes
// captured. (Persisting walks to a history list is a separate step — see CLAUDE.md.)
import { Modal, Text, View } from 'react-native';

import { Button } from '@/components/ui';

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-lg font-extrabold text-ink-900">
        {value}
      </Text>
      <Text className="mt-1 text-label-sm uppercase tracking-wide text-ink-600">{label}</Text>
    </View>
  );
}

const mmss = (sec: number) =>
  `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;

export function WalkSummary({
  visible,
  durationSec,
  distanceM,
  hexes,
  onClose,
}: {
  visible: boolean;
  durationSec: number;
  distanceM: number;
  hexes: number;
  onClose: () => void;
}) {
  return (
    <Modal transparent animationType="slide" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 justify-end bg-black/60">
        <View className="rounded-t-3xl bg-ink-100 px-6 pb-10 pt-6">
          <Text className="text-center text-heading-lg font-extrabold text-ink-900">Walk complete</Text>
          <Text className="mt-1 text-center text-body-sm text-ink-600">Nice one. Here&apos;s your walk.</Text>
          <View className="mt-6 flex-row justify-around">
            <Metric value={mmss(durationSec)} label="Duration" />
            <Metric value={(distanceM / 1000).toFixed(2)} label="Distance · km" />
            <Metric value={String(hexes)} label="Hexes" />
          </View>
          <View className="mt-7">
            <Button label="Done" size="lg" onPress={onClose} />
          </View>
        </View>
      </View>
    </Modal>
  );
}
