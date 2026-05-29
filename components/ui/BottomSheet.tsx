// BottomSheet — design spec §3.6. Thin wrapper over @gorhom/bottom-sheet with our
// styling. Render inside a GestureHandlerRootView; drive it via a ref
// (ref.current?.expand() / .close()).
import { forwardRef, useCallback, useMemo, type ReactNode } from 'react';
import GorhomBottomSheet, {
  BottomSheetBackdrop,
  BottomSheetView,
  type BottomSheetBackdropProps,
} from '@gorhom/bottom-sheet';

import { colors } from '@/theme';

interface BottomSheetProps {
  children: ReactNode;
  snapPoints?: Array<string | number>;
  onClose?: () => void;
}

export const BottomSheet = forwardRef<GorhomBottomSheet, BottomSheetProps>(function BottomSheet(
  { children, snapPoints, onClose },
  ref,
) {
  const points = useMemo(() => snapPoints ?? ['40%', '80%'], [snapPoints]);

  const renderBackdrop = useCallback(
    (props: BottomSheetBackdropProps) => (
      <BottomSheetBackdrop
        {...props}
        appearsOnIndex={0}
        disappearsOnIndex={-1}
        opacity={0.5}
        pressBehavior="close"
      />
    ),
    [],
  );

  return (
    <GorhomBottomSheet
      ref={ref}
      index={-1}
      snapPoints={points}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={renderBackdrop}
      backgroundStyle={{
        backgroundColor: colors.ink[100],
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
      }}
      handleIndicatorStyle={{ backgroundColor: colors.ink[500], width: 36, height: 4 }}
    >
      <BottomSheetView style={{ paddingHorizontal: 24, paddingTop: 16, paddingBottom: 32 }}>
        {children}
      </BottomSheetView>
    </GorhomBottomSheet>
  );
});

export default BottomSheet;
