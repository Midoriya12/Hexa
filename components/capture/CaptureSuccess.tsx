// Capture success card — celebratory modal shown right after a hex is captured: confetti,
// Instant Points earned, and the hex's rent/hr (PPH). Has a Share action (text for now; a
// rendered image card is a later polish) and Continue. Driven by useHexTracker.lastCapture.
import { Dimensions, Modal, Share, Text, View } from 'react-native';
import ConfettiCannon from 'react-native-confetti-cannon';

import { Button } from '@/components/ui';
import { HexIcon } from '@/components/shared/HexIcon';
import { colors } from '@/theme';

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-center">
      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-display-sm font-extrabold text-saffron-600">
        {value}
      </Text>
      <Text className="mt-1 text-label-sm uppercase tracking-wide text-ink-600">{label}</Text>
    </View>
  );
}

export function CaptureSuccess({
  visible,
  ip,
  pph,
  stolen = false,
  onClose,
}: {
  visible: boolean;
  ip: number;
  pph: number;
  stolen?: boolean;
  onClose: () => void;
}) {
  const { width } = Dimensions.get('window');
  const share = () =>
    void Share.share({
      message: stolen
        ? `I just STOLE a hex on Hexa! +${ip} points, now earning ${pph}/hr. 🟧 Come take it back. #Hexa`
        : `I just captured a hex on Hexa! +${ip} points, now earning ${pph}/hr. 🟧 Come take it back. #Hexa`,
    });

  return (
    <Modal transparent animationType="fade" visible={visible} onRequestClose={onClose}>
      <View className="flex-1 items-center justify-center bg-black/70 px-8">
        <View className="w-full items-center rounded-2xl bg-ink-100 p-6">
          <View className="h-16 w-16 items-center justify-center rounded-2xl bg-saffron-600/20">
            <HexIcon size={40} color={colors.saffron[600]} />
          </View>
          <Text className="mt-3 text-heading-lg font-extrabold text-ink-900">{stolen ? 'Hex stolen! 🔥' : 'Hex captured!'}</Text>
          <View className="mt-5 w-full flex-row justify-around">
            <Stat value={`+${ip}`} label="Instant points" />
            <Stat value={`${pph}/hr`} label="Rent" />
          </View>
          <View className="mt-6 w-full gap-3">
            <Button label="Share" variant="secondary" onPress={share} />
            <Button label="Continue" onPress={onClose} />
          </View>
        </View>
      </View>
      {visible ? (
        <ConfettiCannon
          count={70}
          origin={{ x: width / 2, y: -20 }}
          autoStart
          autoStartDelay={250} // let the modal finish fading in before the pieces animate (smoother)
          fadeOut
          explosionSpeed={400}
          fallSpeed={2600}
          colors={[colors.saffron[300], colors.saffron[400], colors.saffron[600], '#FFFFFF']}
        />
      ) : null}
    </Modal>
  );
}
