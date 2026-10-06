// Player profile — public stats for any user, reached by tapping a friend / feed name /
// leaderboard row / clan member. Shows their clan + your friendship status, with inline
// add-friend / accept actions. Pushed route /u/<id>.
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { IconChevronLeft } from '@/components/ui/Icon';

import { Avatar, Badge, Button } from '@/components/ui';
import { MedalChip } from '@/components/shared/MedalChip';
import { fetchUserProfile, type UserProfile } from '@/lib/supabase/profile';
import { respondToRequest, sendRequest } from '@/lib/supabase/friends';
import { colors } from '@/theme';

const ROLE_LABEL: Record<string, string> = { president: 'President', vp: 'VP', senior: 'Senior', member: 'Member' };

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <View className="flex-1 items-center rounded-md border border-ink-400 bg-ink-100 py-4">
      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-lg font-extrabold text-saffron-600">
        {value}
      </Text>
      <Text className="mt-0.5 text-label-sm uppercase tracking-wide text-ink-600">{label}</Text>
    </View>
  );
}

export default function ProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const reload = useCallback(() => {
    if (!id) return;
    fetchUserProfile(id)
      .then(setProfile)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      setLoading(true);
      reload();
    }, [reload]),
  );

  const addFriend = async () => {
    if (!profile || busy) return;
    setBusy(true);
    setProfile({ ...profile, friendship: 'outgoing' }); // optimistic
    try {
      await sendRequest(profile.id);
    } catch {
      Alert.alert('Friends', "Couldn't send the request — you may already be connected.");
      reload();
    } finally {
      setBusy(false);
    }
  };

  const respond = async (accept: boolean) => {
    if (!profile?.friendshipId || busy) return;
    setBusy(true);
    try {
      await respondToRequest(profile.friendshipId, accept);
    } finally {
      setBusy(false);
      reload();
    }
  };

  const Friendship = () => {
    if (!profile || profile.isYou) return null;
    switch (profile.friendship) {
      case 'friends':
        return (
          <View className="mt-4 items-center">
            <Badge tone="saffron" label="✓ Friends" />
          </View>
        );
      case 'outgoing':
        return (
          <View className="mt-4">
            <Button label="Request sent" variant="secondary" disabled onPress={() => undefined} />
          </View>
        );
      case 'incoming':
        return (
          <View className="mt-4 flex-row gap-3">
            <View className="flex-1">
              <Button label="Accept" onPress={() => respond(true)} loading={busy} />
            </View>
            <View className="flex-1">
              <Button label="Decline" variant="secondary" onPress={() => respond(false)} />
            </View>
          </View>
        );
      default:
        return (
          <View className="mt-4">
            <Button label="Add friend" onPress={addFriend} loading={busy} />
          </View>
        );
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="flex-row items-center px-3 py-2">
        <IconChevronLeft size={26} color={colors.ink[900]} onPress={() => router.back()} />
        <Text className="ml-1 text-display-sm text-ink-900">Profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading ? (
          <Text className="py-10 text-center text-body-md text-ink-700">Loading…</Text>
        ) : !profile ? (
          <Text className="py-10 text-center text-body-md text-ink-700">Player not found.</Text>
        ) : (
          <>
            <View className="items-center pt-4">
              <View className="rounded-full p-1" style={{ borderWidth: 3, borderColor: profile.colour || colors.player.saffron }}>
                <Avatar size={96} name={profile.name} />
              </View>
              <View className="mt-3 flex-row items-center gap-2">
                <Text className="text-display-sm text-ink-900">{profile.name}</Text>
                <MedalChip medalId={profile.equippedMedal} size={20} />
              </View>
              <Text className="text-body-md text-ink-700">@{profile.username ?? '—'}</Text>
              <View className="mt-2 flex-row items-center gap-2">
                <Badge tone="saffron" label={`Level ${profile.level}`} />
                {profile.clanName && profile.clanId ? (
                  <Pressable onPress={() => router.push(`/c/${profile.clanId}` as Href)}>
                    <Badge tone="neutral" label={`${profile.clanName} · ${ROLE_LABEL[profile.clanRole ?? 'member'] ?? 'Member'}`} />
                  </Pressable>
                ) : null}
              </View>

              <Friendship />
            </View>

            <View className="mt-6 flex-row gap-3">
              <Stat value={profile.points.toLocaleString('en-US')} label="Points" />
              <Stat value={profile.captures.toLocaleString('en-US')} label="Hexes captured" />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
