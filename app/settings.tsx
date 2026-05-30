// Settings — matches INTVL's light "Me menu" screenshot: light bg, profile header,
// saffron "Refer a friend" gradient card, white grouped rows, sign out + delete.
// Dropped "Plans & purchases" (no in-app purchases — PROGA). Sign out is functional.
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  IconChevronLeft,
  IconChevronRight,
  IconGift,
  IconHelpCircle,
  IconMessageCircle,
  IconNews,
  IconPencil,
  IconSettings,
  IconShieldLock,
  IconUserPlus,
  IconWatch,
} from '@/components/ui/Icon';

import { Button } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

function Row({ icon, label, highlight, onPress }: { icon: React.ReactNode; label: string; highlight?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-3 flex-row items-center rounded-md bg-light-card px-4 py-4 ${
        highlight ? 'border border-saffron-600' : 'border border-light-border'
      }`}
    >
      <View className="w-7">{icon}</View>
      <Text className="ml-2 flex-1 text-body-lg text-light-ink">{label}</Text>
      <IconChevronRight size={20} color={colors.light.faint} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const signOut = useUserStore((s) => s.signOut);
  const ic = (Icon: typeof IconPencil) => <Icon size={22} color={colors.light.sub} />;

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You can sign back in with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);
  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently removes your account and captures. Cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => undefined },
    ]);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-light-bg">
      {/* Header: back + name + View profile */}
      <View className="flex-row items-center px-3 py-2">
        <IconChevronLeft size={26} color={colors.light.ink} onPress={() => router.back()} />
        <Text className="ml-1 flex-1 text-heading-md text-light-ink">{user?.display_name ?? 'Me'}</Text>
        <Text className="text-body-md font-semibold text-saffron-700">View profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}>
        {/* Refer a friend — saffron gradient card */}
        <LinearGradient
          colors={[colors.saffron[400], colors.saffron[600]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{ borderRadius: 12, marginBottom: 16 }}
        >
          <View className="flex-row items-center p-4">
            <IconUserPlus size={28} color="#FFFFFF" />
            <View className="ml-3 flex-1">
              <Text className="text-heading-sm font-bold text-white">Refer a friend</Text>
              <Text className="text-body-sm text-white/90">Earn XP for every friend who joins Hexa.</Text>
            </View>
            <IconChevronRight size={22} color="#FFFFFF" />
          </View>
        </LinearGradient>

        <Row icon={ic(IconGift)} label="Enter referral code" highlight onPress={() => undefined} />
        <Row icon={ic(IconPencil)} label="Edit profile" onPress={() => undefined} />
        <Row icon={ic(IconSettings)} label="App settings" onPress={() => undefined} />
        <Row icon={ic(IconShieldLock)} label="Privacy" onPress={() => undefined} />
        <Row icon={ic(IconWatch)} label="Integrations" onPress={() => undefined} />
        <Row icon={ic(IconHelpCircle)} label="FAQs" onPress={() => undefined} />
        <Row icon={ic(IconMessageCircle)} label="Support" onPress={() => undefined} />
        <Row icon={ic(IconNews)} label="App change log" onPress={() => undefined} />

        <View className="mt-2 gap-3">
          <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
          <Text className="self-center py-2 text-body-md font-semibold text-danger" onPress={confirmDelete}>
            Delete account
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
