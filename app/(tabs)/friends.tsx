// Friends tab — built in Phase 7 (§6.13). Phase 1 saffron empty-state per blueprint.
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconUsers } from '@tabler/icons-react-native';

import { EmptyState } from '@/components/ui';
import { colors } from '@/theme';

export default function FriendsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="flex-1">
        <EmptyState
          icon={<IconUsers size={48} color={colors.ink[500]} strokeWidth={1.75} />}
          title="No friends yet"
          body="Add friends to see their walks and steal their hexes. Coming in a later phase."
        />
      </View>
    </SafeAreaView>
  );
}
