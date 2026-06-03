// ActionSheet — themed bottom-sheet replacement for the OS Alert / action sheet (which renders as
// a jarring plain-white system dialog that clashes with the dark saffron UI). Title + optional
// message + a stack of actions; destructive actions read red, the cancel action is separated.
// Full-width bottom sheet with a safe-area bottom inset, so it adapts cleanly to every screen.
import { Modal, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export interface SheetAction {
  label: string;
  onPress?: () => void;
  destructive?: boolean;
  cancel?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  message?: string;
  actions: SheetAction[];
  onClose: () => void;
}

export function ActionSheet({ visible, title, message, actions, onClose }: ActionSheetProps) {
  const insets = useSafeAreaInsets();
  const choices = actions.filter((a) => !a.cancel);
  const cancels = actions.filter((a) => a.cancel);
  const run = (a: SheetAction) => {
    onClose();
    a.onPress?.();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" statusBarTranslucent onRequestClose={onClose}>
      <Pressable onPress={onClose} className="flex-1 justify-end bg-black/60">
        <Pressable
          onPress={() => undefined}
          style={{ paddingBottom: insets.bottom + 12 }}
          className="rounded-t-3xl bg-ink-100 px-4 pt-3"
        >
          <View className="mb-2 h-1 w-10 self-center rounded-full bg-ink-400" />
          {title ? <Text className="mt-1 text-center text-heading-md text-ink-900">{title}</Text> : null}
          {message ? <Text className="mt-1 text-center text-body-sm text-ink-600">{message}</Text> : null}

          <View className="mt-3">
            {choices.map((a, i) => (
              <Pressable key={i} onPress={() => run(a)} className="mb-2 items-center rounded-xl bg-ink-200 py-3.5">
                <Text className={`text-body-lg font-semibold ${a.destructive ? 'text-danger' : 'text-ink-900'}`}>
                  {a.label}
                </Text>
              </Pressable>
            ))}
            {cancels.map((a, i) => (
              <Pressable key={`c${i}`} onPress={() => run(a)} className="mt-1 items-center rounded-xl py-3.5">
                <Text className="text-body-lg font-semibold text-ink-600">{a.label}</Text>
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export default ActionSheet;
