// Settings — INTVL's "Me menu" screen, DARK to match Feed/Me: profile header, saffron
// "Refer a friend" gradient card, grouped rows, sign out + delete. Dropped "Plans &
// purchases" (no in-app purchases — PROGA). Sign out is functional.
import { useState } from 'react';
import { Pressable, ScrollView, Switch, Text, View } from 'react-native';
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

import { ActionSheet, Button, type SheetAction } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { updateOwnUser } from '@/lib/supabase/auth';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

function Row({ icon, label, highlight, onPress }: { icon: React.ReactNode; label: string; highlight?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className={`mb-3 flex-row items-center rounded-md bg-ink-100 px-4 py-4 ${
        highlight ? 'border border-saffron-600' : 'border border-ink-400'
      }`}
    >
      <View className="w-7">{icon}</View>
      <Text className="ml-2 flex-1 text-body-lg text-ink-900">{label}</Text>
      <IconChevronRight size={20} color={colors.ink[500]} />
    </Pressable>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const signOut = useUserStore((s) => s.signOut);
  const setUser = useUserStore((s) => s.setUser);
  const ic = (Icon: typeof IconPencil) => <Icon size={22} color={colors.ink[600]} />;

  // Themed confirm sheet (replaces the plain-white OS Alert).
  const [sheet, setSheet] = useState<{ title?: string; message?: string; actions: SheetAction[] } | null>(null);
  const confirm = (title: string, message: string, label: string, onConfirm: () => void) =>
    setSheet({
      title,
      message,
      actions: [
        { label, destructive: true, onPress: onConfirm },
        { label: 'Cancel', cancel: true },
      ],
    });

  const ghost = !!user?.ghost_mode;
  const toggleGhost = async (v: boolean) => {
    if (!user?.id) return;
    setUser({ ...user, ghost_mode: v }); // optimistic
    try {
      setUser(await updateOwnUser(user.id, { ghost_mode: v }));
    } catch {
      /* keep optimistic */
    }
  };

  const confirmSignOut = () =>
    confirm('Sign out?', 'You can sign back in with your phone number.', 'Sign out', () => void signOut());
  const confirmDelete = () =>
    confirm('Delete account?', 'This permanently removes your account and captures. Cannot be undone.', 'Delete', () => undefined);

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      {/* Header: back + name + View profile */}
      <View className="flex-row items-center px-3 py-2">
        <IconChevronLeft size={26} color={colors.ink[900]} onPress={() => router.back()} />
        <Text className="ml-1 flex-1 text-heading-md text-ink-900">{user?.display_name ?? 'Me'}</Text>
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

        {/* Ghost mode — privacy toggle */}
        <View className="mb-3 flex-row items-center rounded-md border border-ink-400 bg-ink-100 px-4 py-4">
          <View className="w-7">{ic(IconShieldLock)}</View>
          <View className="ml-2 flex-1">
            <Text className="text-body-lg text-ink-900">Ghost mode</Text>
            <Text className="text-body-sm text-ink-700">Hide me from feeds & leaderboards</Text>
          </View>
          <Switch
            value={ghost}
            onValueChange={toggleGhost}
            trackColor={{ false: colors.ink[400], true: colors.saffron[600] }}
            thumbColor="#FFFFFF"
          />
        </View>

        <View className="mt-2 gap-3">
          <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
          <Text className="self-center py-2 text-body-md font-semibold text-danger" onPress={confirmDelete}>
            Delete account
          </Text>
        </View>
      </ScrollView>

      <ActionSheet
        visible={!!sheet}
        title={sheet?.title}
        message={sheet?.message}
        actions={sheet?.actions ?? []}
        onClose={() => setSheet(null)}
      />
    </SafeAreaView>
  );
}
