// Profile tab — full screen (§6.11) lands in Phase 5. Phase 1 shows identity + a
// working Sign out (with confirm), satisfying the acceptance criterion. Sign out
// relocates into Settings (§6.15) when that ships.
import { Alert, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserStore } from '@/stores/userStore';

export default function ProfileScreen() {
  const { user } = useCurrentUser();
  const signOut = useUserStore((s) => s.signOut);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', 'You can sign back in with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50 px-4">
      <View className="flex-1 items-center justify-center">
        <Avatar size={96} name={user?.display_name ?? user?.username ?? undefined} uri={user?.avatar_url ?? undefined} />
        <Text className="mt-4 text-heading-lg text-ink-900">{user?.display_name ?? '—'}</Text>
        <Text className="mt-1 text-body-md text-ink-700">@{user?.username ?? '—'}</Text>
      </View>
      <View className="pb-6">
        <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
      </View>
    </SafeAreaView>
  );
}
