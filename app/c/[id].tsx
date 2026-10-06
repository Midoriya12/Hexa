// Clan profile — view ANY clan by id (from a player's profile clan badge, a leaderboard row, etc).
// Shows crest, description, aggregate stats, requirements, and the full roster. If you're not a
// member you can request to join (optional message); if you are, you can jump to manage it.
import { useCallback, useState } from 'react';
import { Alert, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from 'expo-router';
import { IconChevronLeft } from '@/components/ui/Icon';

import { Avatar, Button } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import {
  clanError,
  fetchClanMembers,
  fetchClanStats,
  fetchMyClan,
  requestToJoin,
  type Clan,
  type ClanMember,
  type ClanRole,
  type ClanStats,
} from '@/lib/supabase/clans';
import { colors } from '@/theme';

const CAP = 100;
const ROLE_LABEL: Record<ClanRole, string> = { president: 'President', vp: 'VP', senior: 'Senior', member: 'Member' };

function Ringed({ name, colour }: { name: string; colour: string | null }) {
  const ring = colour ? 2 : 0;
  const box = 40 + ring * 2;
  return (
    <View
      style={{
        width: box,
        height: box,
        borderRadius: box / 2,
        borderWidth: ring,
        borderColor: colour || 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'flex-start',
        overflow: 'hidden',
      }}
    >
      <Avatar size={40} name={name} />
    </View>
  );
}

export default function ClanProfileScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useCurrentUser();

  const [clan, setClan] = useState<Clan | null>(null);
  const [stats, setStats] = useState<ClanStats | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [loading, setLoading] = useState(true);

  const [modal, setModal] = useState(false);
  const [joinMsg, setJoinMsg] = useState('');
  const [sending, setSending] = useState(false);
  const [requested, setRequested] = useState(false);

  const isMember = !!user?.clan_id && user.clan_id === id;

  const load = useCallback(() => {
    if (!id) return;
    setLoading(true);
    fetchMyClan(id)
      .then(async (c) => {
        setClan(c);
        if (c) {
          setStats(await fetchClanStats(c.id).catch(() => null));
          setMembers(await fetchClanMembers(c).catch(() => []));
        }
      })
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const submit = async () => {
    if (!clan || sending) return;
    setSending(true);
    try {
      await requestToJoin(clan.id, joinMsg);
      setRequested(true);
      setModal(false);
      setJoinMsg('');
    } catch (e) {
      Alert.alert('Request', clanError(e));
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="flex-row items-center px-3 py-2">
        <IconChevronLeft size={26} color={colors.ink[900]} onPress={() => router.back()} />
        <Text className="ml-1 text-display-sm text-ink-900">Clan</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {loading ? (
          <Text className="py-10 text-center text-body-md text-ink-700">Loading…</Text>
        ) : !clan ? (
          <Text className="py-10 text-center text-body-md text-ink-700">Clan not found.</Text>
        ) : (
          <>
            <View className="flex-row items-center">
              <View className="h-14 w-14 items-center justify-center rounded-xl" style={{ backgroundColor: clan.colour || colors.player.saffron }}>
                <Text className="text-heading-lg font-extrabold text-white">{clan.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View className="ml-3 flex-1">
                <Text className="text-heading-lg text-ink-900">{clan.name}</Text>
                <Text className="text-label-sm text-ink-600">{clan.memberCount}/{CAP} members</Text>
              </View>
            </View>

            {clan.description ? <Text className="mt-3 text-body-md text-ink-700">{clan.description}</Text> : null}

            <View className="mt-3 flex-row gap-3">
              {[
                { v: `${clan.memberCount}/${CAP}`, l: 'Members' },
                { v: (stats?.totalPoints ?? 0).toLocaleString('en-US'), l: 'Total points' },
                { v: (stats?.totalHexes ?? 0).toLocaleString('en-US'), l: 'Hexes held' },
              ].map((s) => (
                <View key={s.l} className="flex-1 items-center rounded-md border border-ink-400 bg-ink-100 py-2">
                  <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-sm font-extrabold text-saffron-600">{s.v}</Text>
                  <Text className="text-label-sm uppercase text-ink-600">{s.l}</Text>
                </View>
              ))}
            </View>

            {clan.minPoints > 0 || clan.minHexes > 0 ? (
              <Text className="mt-3 text-body-sm text-ink-700">
                Requirements: {clan.minPoints > 0 ? `${clan.minPoints.toLocaleString('en-US')}+ pts` : ''}
                {clan.minPoints > 0 && clan.minHexes > 0 ? ' · ' : ''}
                {clan.minHexes > 0 ? `${clan.minHexes}+ hexes` : ''}
              </Text>
            ) : null}

            <View className="mt-4">
              {isMember ? (
                <Button label="Open my clan" variant="secondary" onPress={() => router.push('/clans' as Href)} />
              ) : clan.memberCount >= CAP ? (
                <Text className="text-center text-body-md text-ink-600">This clan is full.</Text>
              ) : requested ? (
                <Text className="text-center text-body-md text-ink-600">Request sent ✓</Text>
              ) : (
                <Button label="Request to join" onPress={() => setModal(true)} />
              )}
            </View>

            <Text className="mb-2 mt-6 text-label-sm uppercase tracking-wide text-ink-600">Members</Text>
            {members.length === 0 ? (
              <Text className="text-body-sm text-ink-700">Loading members…</Text>
            ) : (
              members.map((m) => (
                <Pressable key={m.id} onPress={() => router.push(`/u/${m.id}` as Href)} className="mb-2 flex-row items-center rounded-md bg-ink-200 px-3 py-3">
                  <Ringed name={m.name} colour={m.colour} />
                  <View className="ml-3 flex-1">
                    <Text className="text-heading-sm text-ink-900">{m.name}</Text>
                    <Text className="text-label-sm text-ink-600">{ROLE_LABEL[m.role]} · L{m.level}</Text>
                  </View>
                  <Text style={{ fontVariant: ['tabular-nums'] }} className="text-body-md text-ink-800">{m.points.toLocaleString('en-US')}</Text>
                </Pressable>
              ))
            )}
          </>
        )}
      </ScrollView>

      {/* Request-to-join modal (optional message) */}
      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <Pressable onPress={() => setModal(false)} className="flex-1 items-center justify-center bg-black/60 px-6">
          <Pressable onPress={() => undefined} className="w-full rounded-xl bg-ink-100 p-5">
            <Text className="text-heading-md text-ink-900">Request to join {clan?.name}</Text>
            <Text className="mt-1 text-body-sm text-ink-700">Add an optional message for the clan officers.</Text>
            <View className="mt-3 rounded-md border border-ink-400 bg-ink-200 px-3">
              <TextInput
                value={joinMsg}
                onChangeText={setJoinMsg}
                placeholder="e.g. I walk every morning — would love to join!"
                placeholderTextColor={colors.ink[600]}
                multiline
                maxLength={280}
                className="min-h-[72px] py-2 text-body-md text-ink-900"
              />
            </View>
            <View className="mt-4 flex-row gap-3">
              <View className="flex-1">
                <Button label="Cancel" variant="secondary" onPress={() => { setModal(false); setJoinMsg(''); }} />
              </View>
              <View className="flex-1">
                <Button label="Send request" loading={sending} onPress={submit} />
              </View>
            </View>
          </Pressable>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}
