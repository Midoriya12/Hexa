// Settings — INTVL 29 "Settings Menu" layout (grouped rows), saffron.
// Presented from Profile. Sign out is functional; other rows are UI for now.
import { Alert, ScrollView, Switch, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import {
  IconBell,
  IconChevronLeft,
  IconChevronRight,
  IconColorSwatch,
  IconGhost2,
  IconHelpCircle,
  IconLanguage,
  IconMapPin,
  IconShieldLock,
  IconUserCircle,
} from '@/components/ui/Icon';
import { useRouter } from 'expo-router';

import { Button } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

type RowProps = { icon: React.ReactNode; label: string; value?: string; onPress?: () => void; right?: React.ReactNode };

function Row({ icon, label, value, onPress, right }: RowProps) {
  return (
    <View className="flex-row items-center px-4 py-3">
      <View className="w-7">{icon}</View>
      <Text className="ml-2 flex-1 text-body-lg text-ink-900">{label}</Text>
      {value ? <Text className="mr-2 text-body-md text-ink-700">{value}</Text> : null}
      {right ?? (onPress ? <IconChevronRight size={20} color={colors.ink[600]} strokeWidth={1.75} /> : null)}
    </View>
  );
}

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View className="mb-6">
      <Text className="mb-2 px-4 text-label-sm uppercase text-ink-600" style={{ letterSpacing: 0.5 }}>
        {title}
      </Text>
      <View className="overflow-hidden rounded-md bg-ink-200 divide-y divide-ink-400">{children}</View>
    </View>
  );
}

export default function SettingsScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const signOut = useUserStore((s) => s.signOut);
  const [ghost, setGhost] = useState(user?.ghost_mode ?? false);
  const [stealAlerts, setStealAlerts] = useState(true);

  const trackColor = { false: colors.ink[400], true: colors.saffron[600] };

  const confirmSignOut = () =>
    Alert.alert('Sign out?', 'You can sign back in with your phone number.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
    ]);

  const confirmDelete = () =>
    Alert.alert('Delete account?', 'This permanently removes your account and captures. This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => undefined },
    ]);

  const ic = (Icon: typeof IconUserCircle) => <Icon size={22} color={colors.ink[700]} strokeWidth={1.75} />;

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="h-14 flex-row items-center px-2">
        <IconChevronLeft size={26} color={colors.ink[900]} strokeWidth={1.75} onPress={() => router.back()} />
        <Text className="ml-1 text-heading-md text-ink-900">Settings</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 }}>
        <Group title="Account">
          <Row icon={ic(IconUserCircle)} label="Edit profile" onPress={() => undefined} />
          <Row icon={ic(IconMapPin)} label="Home pincode" value={user?.pincode ?? '—'} onPress={() => undefined} />
        </Group>

        <Group title="Notifications">
          <Row
            icon={ic(IconBell)}
            label="Hex stolen alerts"
            right={<Switch value={stealAlerts} onValueChange={setStealAlerts} trackColor={trackColor} thumbColor="#fff" />}
          />
        </Group>

        <Group title="Privacy">
          <Row
            icon={ic(IconGhost2)}
            label="Ghost mode"
            right={<Switch value={ghost} onValueChange={setGhost} trackColor={trackColor} thumbColor="#fff" />}
          />
          <Row icon={ic(IconShieldLock)} label="Blocked users" onPress={() => undefined} />
        </Group>

        <Group title="Appearance & Play">
          <Row icon={ic(IconColorSwatch)} label="Hex colour" onPress={() => undefined} />
          <Row icon={ic(IconLanguage)} label="Language" value="English" onPress={() => undefined} />
        </Group>

        <Group title="About & Support">
          <Row icon={ic(IconHelpCircle)} label="Help & FAQ" onPress={() => undefined} />
          <Row icon={ic(IconShieldLock)} label="Privacy policy" onPress={() => undefined} />
          <Row icon={ic(IconUserCircle)} label="Version" value="1.0.0 (dev)" />
        </Group>

        <View className="gap-3">
          <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
          <Text className="self-center py-2 text-body-md text-danger" onPress={confirmDelete}>
            Delete account
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
