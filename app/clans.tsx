// Clans — your clan (roster + leave) or create/browse/join. Pushed route reached from Play's
// clan toggle + Me. Mutations go through the create/join/leave RPCs; after each, refresh the
// user store so users.clan_id is current across the app.
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { IconChevronLeft } from '@/components/ui/Icon';

import { Avatar, Badge, Button } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchOwnUser } from '@/lib/supabase/auth';
import {
  createClan,
  fetchClanMembers,
  fetchMyClan,
  joinClan,
  leaveClan,
  listClans,
  type Clan,
  type ClanMember,
} from '@/lib/supabase/clans';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

const CLAN_CAP = 100;

const clanError = (e: unknown): string => {
  const m = (e as { message?: string })?.message ?? '';
  if (m.includes('clan_full')) return 'That clan is full (100 members).';
  if (m.includes('already_in_clan')) return "You're already in a clan.";
  if (m.includes('bad_name')) return 'Pick a clan name (1–40 characters).';
  return 'Something went wrong. Try again.';
};

export default function ClansScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const setUser = useUserStore((s) => s.setUser);

  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [clans, setClans] = useState<Clan[]>([]);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);

  const myColour = user?.hex_colour || colors.player.saffron;

  const load = useCallback(async () => {
    const clan = await fetchMyClan(user?.clan_id).catch(() => null);
    setMyClan(clan);
    if (clan) {
      setMembers(await fetchClanMembers(clan).catch(() => []));
    } else {
      setClans(await listClans().catch(() => []));
    }
  }, [user?.clan_id]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const refreshUser = async () => {
    if (user?.id) {
      try {
        setUser(await fetchOwnUser(user.id));
      } catch {
        /* best effort */
      }
    }
  };

  const doCreate = async () => {
    if (busy) return;
    setBusy(true);
    try {
      await createClan(name.trim(), myColour);
      setName('');
      await refreshUser();
      await load();
    } catch (e) {
      Alert.alert('Create clan', clanError(e));
    } finally {
      setBusy(false);
    }
  };

  const doJoin = async (id: string) => {
    if (busy) return;
    setBusy(true);
    try {
      await joinClan(id);
      await refreshUser();
      await load();
    } catch (e) {
      Alert.alert('Join clan', clanError(e));
    } finally {
      setBusy(false);
    }
  };

  const doLeave = () =>
    Alert.alert('Leave clan?', 'You can join another clan afterwards.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Leave',
        style: 'destructive',
        onPress: async () => {
          try {
            await leaveClan();
            await refreshUser();
            await load();
          } catch (e) {
            Alert.alert('Leave clan', clanError(e));
          }
        },
      },
    ]);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="flex-row items-center px-3 py-2">
        <IconChevronLeft size={26} color={colors.ink[900]} onPress={() => router.back()} />
        <Text className="ml-1 text-display-sm text-ink-900">Clans</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        {myClan ? (
          <>
            {/* Your clan */}
            <View className="flex-row items-center rounded-md border border-ink-400 bg-ink-100 p-4">
              <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: myClan.colour || colors.player.saffron }}>
                <Text className="text-heading-md font-extrabold text-white">{myClan.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-heading-md text-ink-900">{myClan.name}</Text>
                <Text className="text-body-sm text-ink-700">
                  {myClan.memberCount} / {CLAN_CAP} members
                </Text>
              </View>
              <Button label="Leave" size="sm" variant="secondary" onPress={doLeave} />
            </View>

            <Text className="mb-2 mt-6 text-label-sm uppercase text-ink-600">Members by points</Text>
            {members.map((m, i) => (
              <View
                key={m.id}
                className={`mb-2 flex-row items-center rounded-md px-3 py-3 ${m.you ? 'border border-saffron-600 bg-ink-200' : 'bg-ink-200'}`}
              >
                <Text style={{ fontVariant: ['tabular-nums'] }} className="w-6 text-heading-sm text-ink-700">
                  {i + 1}
                </Text>
                <Avatar size={32} name={m.name} />
                <Text className="ml-3 flex-1 text-heading-sm text-ink-900">{m.name}</Text>
                {m.isOwner ? <Badge tone="saffron" label="Owner" /> : null}
                <Text style={{ fontVariant: ['tabular-nums'] }} className="ml-2 text-body-md text-ink-800">
                  {m.points.toLocaleString('en-IN')}
                </Text>
              </View>
            ))}
          </>
        ) : (
          <>
            {/* Create */}
            <Text className="mb-2 text-heading-md text-ink-900">Create a clan</Text>
            <View className="mb-2 flex-row items-center rounded-md border border-ink-400 bg-ink-200 px-3">
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="Clan name"
                placeholderTextColor={colors.ink[600]}
                maxLength={40}
                className="h-[48px] flex-1 text-body-lg text-ink-900"
              />
            </View>
            <Button label="Create clan" onPress={doCreate} disabled={busy || name.trim().length === 0} />

            {/* Discovery */}
            <Text className="mb-2 mt-8 text-heading-md text-ink-900">Join a clan</Text>
            {clans.length === 0 ? (
              <Text className="text-body-sm text-ink-700">No clans yet — be the first to create one.</Text>
            ) : (
              clans.map((c) => {
                const full = c.memberCount >= CLAN_CAP;
                return (
                  <View key={c.id} className="mb-2 flex-row items-center rounded-md bg-ink-100 p-3">
                    <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: c.colour || colors.player.saffron }}>
                      <Text className="font-extrabold text-white">{c.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View className="ml-3 flex-1">
                      <Text className="text-heading-sm text-ink-900">{c.name}</Text>
                      <Text className="text-body-sm text-ink-700">
                        {c.memberCount} / {CLAN_CAP} members
                      </Text>
                    </View>
                    {full ? (
                      <Text className="text-body-sm text-ink-600">Full</Text>
                    ) : (
                      <Button label="Join" size="sm" onPress={() => doJoin(c.id)} disabled={busy} />
                    )}
                  </View>
                );
              })
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
