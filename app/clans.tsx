// Clans — full governance UI. In a clan: tabbed Roster / Requests / Chat / Settings with
// role-gated moderation (kick/promote), stats, leave/disband. Not in a clan: create (costs
// 1500 pts) + browse/request-to-join. Plus a clan-vs-clan leaderboard. Server enforces every
// permission; the UI only shows the buttons you're allowed to press.
import { useCallback, useState } from 'react';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import { IconChevronLeft } from '@/components/ui/Icon';

import { Avatar, Badge, Button } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchOwnUser } from '@/lib/supabase/auth';
import {
  CLAN_COST,
  cancelJoinRequest,
  clanError,
  createClan,
  disbandClan,
  fetchClanMembers,
  fetchClanStats,
  fetchClansLeaderboard,
  fetchMessages,
  fetchMyClan,
  kickMember,
  leaveClan,
  listClans,
  listJoinRequests,
  postMessage,
  requestToJoin,
  respondJoinRequest,
  setMemberRole,
  updateClan,
  type Clan,
  type ClanLbRow,
  type ClanMember,
  type ClanMessage,
  type ClanRole,
  type ClanStats,
  type JoinRequest,
} from '@/lib/supabase/clans';
import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

const CAP = 100;
const ROLE_LABEL: Record<ClanRole, string> = { president: 'President', vp: 'VP', senior: 'Senior', member: 'Member' };
const rank = (r: ClanRole) => ({ president: 3, vp: 2, senior: 1, member: 0 })[r];

function Avatarish({ name, colour, size = 32 }: { name: string; colour: string | null; size?: 24 | 32 | 40 | 48 }) {
  return (
    <View style={{ borderWidth: 2, borderColor: colour || 'transparent', borderRadius: 999 }}>
      <Avatar size={size} name={name} />
    </View>
  );
}

export default function ClansScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const setUser = useUserStore((s) => s.setUser);

  const [tab, setTab] = useState('Roster');
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [stats, setStats] = useState<ClanStats | null>(null);
  const [members, setMembers] = useState<ClanMember[]>([]);
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [messages, setMessages] = useState<ClanMessage[]>([]);
  const [clans, setClans] = useState<Clan[]>([]);
  const [lb, setLb] = useState<ClanLbRow[]>([]);
  const [chat, setChat] = useState('');
  const [showLb, setShowLb] = useState(false);

  // create form
  const [name, setName] = useState('');
  const [desc, setDesc] = useState('');
  const [minP, setMinP] = useState('');
  const [minH, setMinH] = useState('');

  const myRole = (user?.clan_role ?? null) as ClanRole | null;
  const canModerate = myRole === 'president' || myRole === 'vp';
  const myPoints = user?.current_round_points ?? 0;

  const refreshUser = async () => {
    if (user?.id) {
      try {
        setUser(await fetchOwnUser(user.id));
      } catch {
        /* best effort */
      }
    }
  };

  const load = useCallback(async () => {
    const clan = await fetchMyClan(user?.clan_id).catch(() => null);
    setMyClan(clan);
    if (clan) {
      setMembers(await fetchClanMembers(clan).catch(() => []));
      setStats(await fetchClanStats(clan.id).catch(() => null));
      if (myRole === 'president' || myRole === 'vp') setRequests(await listJoinRequests().catch(() => []));
      setMessages(await fetchMessages(clan.id).catch(() => []));
    } else {
      setClans(await listClans().catch(() => []));
    }
    setLb(await fetchClansLeaderboard().catch(() => []));
  }, [user?.clan_id, myRole]);

  useFocusEffect(useCallback(() => {
    void load();
  }, [load]));

  const act = async (fn: () => Promise<unknown>, title: string) => {
    try {
      await fn();
      await refreshUser();
      await load();
    } catch (e) {
      Alert.alert(title, clanError(e));
    }
  };

  // ── Moderation action sheet on a member ──
  const onMemberPress = (m: ClanMember) => {
    if (m.you || !myRole) {
      router.push(`/u/${m.id}` as Href);
      return;
    }
    const buttons: { text: string; style?: 'destructive' | 'cancel'; onPress?: () => void }[] = [
      { text: 'View profile', onPress: () => router.push(`/u/${m.id}` as Href) },
    ];
    if (myRole === 'president') {
      const roles: ClanRole[] = ['vp', 'senior', 'member'];
      roles.filter((r) => r !== m.role).forEach((r) =>
        buttons.push({ text: `Make ${ROLE_LABEL[r]}`, onPress: () => act(() => setMemberRole(m.id, r), 'Change role') }),
      );
      buttons.push({ text: 'Transfer presidency', onPress: () => act(() => setMemberRole(m.id, 'president'), 'Transfer') });
    }
    // kick matrix (client mirror; server enforces)
    const canKick =
      (myRole === 'president') ||
      (myRole === 'vp' && rank(m.role) < rank('vp')) ||
      (myRole === 'senior' && m.role === 'member');
    if (canKick) buttons.push({ text: 'Kick', style: 'destructive', onPress: () => act(() => kickMember(m.id), 'Kick') });
    buttons.push({ text: 'Cancel', style: 'cancel' });
    Alert.alert(m.name, ROLE_LABEL[m.role], buttons);
  };

  const tabs = canModerate ? ['Roster', 'Requests', 'Chat', 'Settings'] : ['Roster', 'Chat'];

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="flex-row items-center px-3 py-2">
        <IconChevronLeft size={26} color={colors.ink[900]} onPress={() => router.back()} />
        <Text className="ml-1 flex-1 text-display-sm text-ink-900">{myClan ? myClan.name : 'Clans'}</Text>
        <Pressable onPress={() => setShowLb((v) => !v)}>
          <Text className="text-body-md font-semibold text-saffron-600">{showLb ? 'Back' : 'Rankings'}</Text>
        </Pressable>
      </View>

      {showLb ? (
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          <Text className="mb-3 text-heading-md text-ink-900">Clan rankings</Text>
          {lb.length === 0 ? (
            <Text className="text-body-sm text-ink-700">No clans yet.</Text>
          ) : (
            lb.map((c) => (
              <View key={c.id} className={`mb-2 flex-row items-center rounded-md px-3 py-3 ${c.id === myClan?.id ? 'border border-saffron-600 bg-ink-200' : 'bg-ink-200'}`}>
                <Text style={{ fontVariant: ['tabular-nums'] }} className={`w-7 text-heading-sm ${c.rank <= 3 ? 'text-saffron-600' : 'text-ink-700'}`}>{c.rank}</Text>
                <View className="h-8 w-8 items-center justify-center rounded-lg" style={{ backgroundColor: c.colour || colors.player.saffron }}>
                  <Text className="font-extrabold text-white">{c.name.charAt(0).toUpperCase()}</Text>
                </View>
                <View className="ml-3 flex-1">
                  <Text className="text-heading-sm text-ink-900">{c.name}</Text>
                  <Text className="text-label-sm text-ink-600">{c.memberCount} members · {c.totalHexes.toLocaleString('en-IN')} hexes</Text>
                </View>
                <Text style={{ fontVariant: ['tabular-nums'] }} className="text-body-md font-semibold text-ink-900">{c.totalPoints.toLocaleString('en-IN')}</Text>
              </View>
            ))
          )}
        </ScrollView>
      ) : myClan ? (
        // ════════════ IN A CLAN ════════════
        <View className="flex-1">
          {/* Header + stats */}
          <View className="px-4">
            <View className="flex-row items-center">
              <View className="h-12 w-12 items-center justify-center rounded-xl" style={{ backgroundColor: myClan.colour || colors.player.saffron }}>
                <Text className="text-heading-md font-extrabold text-white">{myClan.name.charAt(0).toUpperCase()}</Text>
              </View>
              <View className="ml-3 flex-1">
                {myRole ? <Badge tone="saffron" label={ROLE_LABEL[myRole]} /> : null}
                {myClan.description ? <Text className="mt-1 text-body-sm text-ink-700">{myClan.description}</Text> : null}
              </View>
              <Button label="Leave" size="sm" variant="secondary" onPress={() => Alert.alert('Leave clan?', 'You can join another later.', [{ text: 'Cancel', style: 'cancel' }, { text: 'Leave', style: 'destructive', onPress: () => act(leaveClan, 'Leave') }])} />
            </View>
            <View className="mt-3 flex-row gap-3">
              {[
                { v: `${myClan.memberCount}/${CAP}`, l: 'Members' },
                { v: (stats?.totalPoints ?? 0).toLocaleString('en-IN'), l: 'Total points' },
                { v: (stats?.totalHexes ?? 0).toLocaleString('en-IN'), l: 'Total hexes' },
              ].map((s) => (
                <View key={s.l} className="flex-1 items-center rounded-md border border-ink-400 bg-ink-100 py-2">
                  <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-sm font-extrabold text-saffron-600">{s.v}</Text>
                  <Text className="text-label-sm uppercase text-ink-600">{s.l}</Text>
                </View>
              ))}
            </View>

            {/* Tabs */}
            <View className="mt-4 flex-row border-b border-ink-400">
              {tabs.map((t) => {
                const active = t === tab;
                return (
                  <Pressable key={t} onPress={() => setTab(t)} className="mr-5 pb-2">
                    <Text className={`text-heading-sm ${active ? 'text-ink-900' : 'text-ink-600'}`}>
                      {t}
                      {t === 'Requests' && requests.length ? ` (${requests.length})` : ''}
                    </Text>
                    {active ? <View className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-saffron-600" /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>

          <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 }}>
            {tab === 'Roster' ? (
              members.map((m) => (
                <Pressable key={m.id} onPress={() => onMemberPress(m)} className={`mb-2 flex-row items-center rounded-md px-3 py-3 ${m.you ? 'border border-saffron-600 bg-ink-200' : 'bg-ink-200'}`}>
                  <Avatarish name={m.name} colour={m.colour} />
                  <View className="ml-3 flex-1">
                    <Text className="text-heading-sm text-ink-900">{m.name}</Text>
                    <Text className="text-label-sm text-ink-600">{ROLE_LABEL[m.role]} · L{m.level}</Text>
                  </View>
                  <Text style={{ fontVariant: ['tabular-nums'] }} className="text-body-md text-ink-800">{m.points.toLocaleString('en-IN')}</Text>
                </Pressable>
              ))
            ) : tab === 'Requests' ? (
              requests.length === 0 ? (
                <Text className="text-body-sm text-ink-700">No pending requests.</Text>
              ) : (
                requests.map((r) => (
                  <View key={r.id} className="mb-2 flex-row items-center rounded-md bg-ink-200 p-3">
                    <Avatarish name={r.user.name} colour={r.user.colour} />
                    <View className="ml-3 flex-1">
                      <Text className="text-heading-sm text-ink-900">{r.user.name}</Text>
                      <Text className="text-label-sm text-ink-600">L{r.user.level} · {r.user.points.toLocaleString('en-IN')} pts</Text>
                    </View>
                    <View className="flex-row gap-2">
                      <Button label="Accept" size="sm" onPress={() => act(() => respondJoinRequest(r.id, true), 'Accept')} />
                      <Button label="Reject" size="sm" variant="secondary" onPress={() => act(() => respondJoinRequest(r.id, false), 'Reject')} />
                    </View>
                  </View>
                ))
              )
            ) : tab === 'Chat' ? (
              <>
                {messages.length === 0 ? (
                  <Text className="text-body-sm text-ink-700">No messages yet — say hi to your clan.</Text>
                ) : (
                  messages.map((msg) => (
                    <View key={msg.id} className="mb-3 flex-row">
                      <Avatarish name={msg.name} colour={msg.colour} size={32} />
                      <View className="ml-2 flex-1">
                        <Text className="text-label-md font-semibold text-ink-900">{msg.name}</Text>
                        <Text className="text-body-md text-ink-800">{msg.body}</Text>
                      </View>
                    </View>
                  ))
                )}
                <View className="mt-2 flex-row items-center gap-2">
                  <View className="flex-1 rounded-md border border-ink-400 bg-ink-200 px-3">
                    <TextInput
                      value={chat}
                      onChangeText={setChat}
                      placeholder="Message your clan"
                      placeholderTextColor={colors.ink[600]}
                      className="h-[44px] text-body-md text-ink-900"
                    />
                  </View>
                  <Button
                    label="Send"
                    size="sm"
                    onPress={async () => {
                      const t = chat.trim();
                      if (!t || !myClan) return;
                      setChat('');
                      try {
                        await postMessage(myClan.id, t);
                        setMessages(await fetchMessages(myClan.id));
                      } catch (e) {
                        Alert.alert('Chat', clanError(e));
                      }
                    }}
                  />
                </View>
              </>
            ) : (
              // Settings (president/vp)
              <ClanSettings clan={myClan} isPresident={myRole === 'president'} onSaved={load} refreshUser={refreshUser} />
            )}
          </ScrollView>
        </View>
      ) : (
        // ════════════ NOT IN A CLAN ════════════
        <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
          <Text className="mb-1 text-heading-md text-ink-900">Found a clan</Text>
          <Text className="mb-3 text-body-sm text-ink-700">Costs {CLAN_COST.toLocaleString('en-IN')} points — you have {myPoints.toLocaleString('en-IN')}.</Text>
          <Field value={name} onChange={setName} placeholder="Clan name" />
          <Field value={desc} onChange={setDesc} placeholder="Description (optional)" />
          <View className="flex-row gap-3">
            <View className="flex-1"><Field value={minP} onChange={setMinP} placeholder="Min points to join" numeric /></View>
            <View className="flex-1"><Field value={minH} onChange={setMinH} placeholder="Min hexes" numeric /></View>
          </View>
          <Button
            label={`Create clan (${CLAN_COST.toLocaleString('en-IN')} pts)`}
            disabled={name.trim().length === 0 || myPoints < CLAN_COST}
            onPress={() =>
              act(() => createClan(name.trim(), user?.hex_colour || colors.player.saffron, desc.trim(), Number(minP) || 0, Number(minH) || 0), 'Create clan')
            }
          />

          <Text className="mb-2 mt-8 text-heading-md text-ink-900">Join a clan</Text>
          {clans.length === 0 ? (
            <Text className="text-body-sm text-ink-700">No clans yet — be the first.</Text>
          ) : (
            clans.map((c) => {
              const full = c.memberCount >= CAP;
              return (
                <View key={c.id} className="mb-2 flex-row items-center rounded-md bg-ink-100 p-3">
                  <View className="h-10 w-10 items-center justify-center rounded-lg" style={{ backgroundColor: c.colour || colors.player.saffron }}>
                    <Text className="font-extrabold text-white">{c.name.charAt(0).toUpperCase()}</Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-heading-sm text-ink-900">{c.name}</Text>
                    <Text className="text-label-sm text-ink-600">
                      {c.memberCount}/{CAP}
                      {c.minPoints > 0 ? ` · ${c.minPoints.toLocaleString('en-IN')}+ pts` : ''}
                      {c.minHexes > 0 ? ` · ${c.minHexes}+ hexes` : ''}
                    </Text>
                  </View>
                  {full ? (
                    <Text className="text-body-sm text-ink-600">Full</Text>
                  ) : (
                    <Button label="Request" size="sm" onPress={() => act(() => requestToJoin(c.id), 'Request')} />
                  )}
                </View>
              );
            })
          )}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function Field({ value, onChange, placeholder, numeric }: { value: string; onChange: (v: string) => void; placeholder: string; numeric?: boolean }) {
  return (
    <View className="mb-2 rounded-md border border-ink-400 bg-ink-200 px-3">
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.ink[600]}
        keyboardType={numeric ? 'number-pad' : 'default'}
        className="h-[48px] text-body-lg text-ink-900"
      />
    </View>
  );
}

function ClanSettings({ clan, isPresident, onSaved, refreshUser }: { clan: Clan; isPresident: boolean; onSaved: () => void; refreshUser: () => Promise<void> }) {
  const [name, setName] = useState(clan.name);
  const [desc, setDesc] = useState(clan.description);
  const [minP, setMinP] = useState(String(clan.minPoints));
  const [minH, setMinH] = useState(String(clan.minHexes));

  const save = async () => {
    try {
      await updateClan({ name: name.trim(), description: desc.trim(), minPoints: Number(minP) || 0, minHexes: Number(minH) || 0 });
      onSaved();
    } catch (e) {
      Alert.alert('Save', clanError(e));
    }
  };

  return (
    <View>
      <Field value={name} onChange={setName} placeholder="Clan name" />
      <Field value={desc} onChange={setDesc} placeholder="Description" />
      <View className="flex-row gap-3">
        <View className="flex-1"><Field value={minP} onChange={setMinP} placeholder="Min points" numeric /></View>
        <View className="flex-1"><Field value={minH} onChange={setMinH} placeholder="Min hexes" numeric /></View>
      </View>
      <Button label="Save settings" onPress={save} />
      {isPresident ? (
        <View className="mt-6">
          <Text
            className="self-center py-2 text-body-md font-semibold text-danger"
            onPress={() =>
              Alert.alert('Disband clan?', 'This permanently deletes the clan for everyone.', [
                { text: 'Cancel', style: 'cancel' },
                {
                  text: 'Disband',
                  style: 'destructive',
                  onPress: async () => {
                    try {
                      await disbandClan();
                      await refreshUser();
                      onSaved();
                    } catch (e) {
                      Alert.alert('Disband', clanError(e));
                    }
                  },
                },
              ])
            }
          >
            Disband clan
          </Text>
        </View>
      ) : null}
    </View>
  );
}
