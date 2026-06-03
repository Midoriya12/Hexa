// Play — INTVL Play layout. Full-bleed live map with a persistent swipe-up sheet whose
// COLLAPSED peek shows ONLY the summary (no half-cut tabs): the peek height is measured from
// the summary so it fits exactly on every device. Clan summary mirrors INTVL's "My Club"
// header (identity + two metric columns: hexes held · members); Solo shows you + your hexes.
// Leaderboard/Territories/History live below, reached by swiping up. Solo vs Clan switches the
// summary (and, once captures exist, which hexes the map highlights — patch #34).
import { useCallback, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { IconBell, IconChevronDown, IconEye, IconStack, IconTarget } from '@/components/ui/Icon';

import { Avatar } from '@/components/ui';
import { HexMap, type HexMapHandle } from '@/components/map/HexMap';
import { HexInfo } from '@/components/map/HexInfo';
import { HexIcon } from '@/components/shared/HexIcon';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchTopPlayers, type LeaderPlayer } from '@/lib/supabase/leaderboard';
import { fetchClanMembers, fetchMyClan, type Clan, type ClanMember } from '@/lib/supabase/clans';
import { useNotificationStore } from '@/stores/notificationStore';
import { colors } from '@/theme';

const CLAN_MEMBER_CAP = 100; // clans are capped at 100 members (patch #32)
const SHEET_TABS = ['Leaderboard', 'Territories', 'History'];
const MODES = ['Solo', 'Clan'];

function ControlButton({ children, onPress }: { children: React.ReactNode; onPress?: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      className="mb-3 h-11 w-11 items-center justify-center rounded-full border border-ink-400 bg-ink-100"
    >
      {children}
    </Pressable>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View className="items-end">
      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-md text-saffron-600">
        {value}
      </Text>
      <Text numberOfLines={1} className="text-label-sm uppercase text-ink-600">
        {label}
      </Text>
    </View>
  );
}

/** Compact summary shown in the collapsed peek: a small centred title, then a single row of
 *  identity (avatar + name + sub) and 1–2 metric columns. Used for both Clan and Solo. */
function SheetSummary({
  title,
  name,
  sub,
  metrics,
}: {
  title: string;
  name: string;
  sub: string;
  metrics: { value: string; label: string }[];
}) {
  return (
    <View>
      <Text className="text-center text-label-md uppercase tracking-wide text-ink-600">{title}</Text>
      <View className="mt-2 flex-row items-center">
        <Avatar size={40} name={name} />
        <View className="ml-3 flex-shrink">
          <Text numberOfLines={1} className="text-heading-sm text-ink-900">
            {name}
          </Text>
          <Text numberOfLines={1} className="text-body-sm text-ink-700">
            {sub}
          </Text>
        </View>
        <View className="ml-auto flex-row items-center gap-5 pl-3">
          {metrics.map((m) => (
            <Metric key={m.label} value={m.value} label={m.label} />
          ))}
        </View>
      </View>
    </View>
  );
}

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useCurrentUser();
  const [mode, setMode] = useState('Solo');
  const [tab, setTab] = useState('Leaderboard');
  const sheetRef = useRef<BottomSheet>(null);
  const mapRef = useRef<HexMapHandle>(null);
  const [selectedHex, setSelectedHex] = useState<string | null>(null);
  const [topPlayers, setTopPlayers] = useState<LeaderPlayer[]>([]);
  const [myClan, setMyClan] = useState<Clan | null>(null);
  const [clanMembers, setClanMembers] = useState<ClanMember[]>([]);
  const notifCount = useNotificationStore((s) => s.total);
  const refreshNotif = useNotificationStore((s) => s.refresh);

  const clanId = user?.clan_id ?? null;
  const canManageJoins = user?.clan_role === 'president' || user?.clan_role === 'vp';
  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchTopPlayers()
        .then((p) => alive && setTopPlayers(p))
        .catch(() => undefined);
      fetchMyClan(clanId)
        .then(async (c) => {
          if (!alive) return;
          setMyClan(c);
          setClanMembers(c ? await fetchClanMembers(c).catch(() => []) : []);
        })
        .catch(() => undefined);
      void refreshNotif(canManageJoins);
      return () => {
        alive = false;
      };
    }, [clanId, canManageJoins, refreshNotif]),
  );

  // Peek snap is measured from the summary so ONLY the summary shows (no half-cut tabs); the
  // two higher snaps reveal the tabs + content. % snaps adapt to all device sizes.
  const [peekH, setPeekH] = useState(150);
  const snapPoints = useMemo(() => [peekH, '55%', '92%'], [peekH]);

  const isClan = mode === 'Clan';
  const myName = user?.display_name || user?.username || 'You';
  const myArea = user?.home_neighbourhood || 'Bengaluru';
  const myHexes = user?.current_held_hexes ?? 0;
  const clanPoints = clanMembers.reduce((s, m) => s + m.points, 0);

  // Both leaderboards are REAL now: Solo = top players by points; Clan = your clan's members.
  const leaderRows = isClan
    ? clanMembers.map((m, i) => ({
        key: m.id,
        id: m.id,
        rank: i + 1,
        name: m.name,
        points: m.points,
        sub: m.isOwner ? 'Owner' : `Level ${m.level}`,
        you: m.you,
      }))
    : topPlayers.map((p, i) => ({ key: p.id || String(i), id: p.id, rank: i + 1, name: p.name, points: p.points, sub: `Level ${p.level}`, you: p.id === user?.id }));

  return (
    <View className="flex-1 bg-ink-50">
      {/* ── Live map (globe + zoom), full-bleed behind everything ── */}
      <HexMap ref={mapRef} onHexPress={setSelectedHex} />

      {/* ── Top mode bar (full width, neutral) ── */}
      <View style={{ paddingTop: insets.top + 8 }} className="px-4">
        <View className="flex-row rounded-full bg-ink-100 p-1">
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <Pressable
                key={m}
                onPress={() => {
                  if (m === 'Clan' && isClan) router.push('/clans' as Href);
                  else setMode(m);
                }}
                className={`flex-1 flex-row items-center justify-center rounded-full py-2.5 ${active ? 'bg-ink-300' : ''}`}
              >
                <Text numberOfLines={1} className={`text-label-md ${active ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                  {m === 'Clan' ? myClan?.name ?? 'Clan' : 'Solo'}
                </Text>
                {m === 'Clan' ? (
                  <View className="ml-1">
                    <IconChevronDown size={16} color={active ? colors.ink[900] : colors.ink[700]} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* ── Floating bell (left, below top bar) → notifications inbox, with unread badge ── */}
      <View style={{ position: 'absolute', left: 16, top: insets.top + 64 }}>
        <Pressable
          onPress={() => router.push('/notifications' as Href)}
          className="h-11 w-11 items-center justify-center rounded-full border border-ink-400 bg-ink-100"
        >
          <IconBell size={20} color={colors.ink[900]} />
          {notifCount > 0 ? (
            <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-saffron-600 px-1">
              <Text style={{ fontVariant: ['tabular-nums'] }} className="text-label-sm font-bold text-white">
                {notifCount > 99 ? '99+' : notifCount}
              </Text>
            </View>
          ) : null}
        </Pressable>
      </View>

      {/* ── Floating controls (right) ── */}
      <View style={{ position: 'absolute', right: 16, top: insets.top + 64 }}>
        <ControlButton>
          <IconEye size={20} color={colors.saffron[600]} />
        </ControlButton>
        <ControlButton onPress={() => mapRef.current?.flyToNearestHex()}>
          <IconTarget size={20} color={colors.ink[900]} />
        </ControlButton>
        <ControlButton>
          <IconStack size={20} color={colors.ink[900]} />
        </ControlButton>
      </View>

      {/* ── Persistent sheet: peek = summary only; swipe up for tabs + content ── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enableDynamicSizing={false}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: colors.ink[100] }}
        handleIndicatorStyle={{ backgroundColor: colors.ink[500], width: 40 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 40 }}>
          {/* Summary — its measured height sets the peek snap so nothing below peeks through. */}
          <View onLayout={(e) => setPeekH(Math.round(e.nativeEvent.layout.height) + 46)}>
            {isClan ? (
              myClan ? (
                <Pressable onPress={() => router.push('/clans' as Href)}>
                  <SheetSummary
                    title="My Clan"
                    name={myClan.name}
                    sub={`${myClan.memberCount} / ${CLAN_MEMBER_CAP} members · tap to manage`}
                    metrics={[
                      { value: clanPoints.toLocaleString('en-IN'), label: 'Points' },
                      { value: `${myClan.memberCount}/${CLAN_MEMBER_CAP}`, label: 'Members' },
                    ]}
                  />
                </Pressable>
              ) : (
                <Pressable onPress={() => router.push('/clans' as Href)} className="items-center py-3">
                  <Text className="text-heading-md text-ink-900">You&apos;re not in a clan</Text>
                  <Text className="mt-1 text-body-sm text-ink-700">Tap to create or join one →</Text>
                </Pressable>
              )
            ) : (
              <SheetSummary
                title="Solo"
                name={myName}
                sub={myArea}
                metrics={[{ value: myHexes.toLocaleString('en-IN'), label: 'Hexes held' }]}
              />
            )}
          </View>

          {/* Underline tabs (revealed on swipe up) */}
          <View className="mt-5 flex-row border-b border-ink-400">
            {SHEET_TABS.map((t) => {
              const active = t === tab;
              return (
                <Pressable key={t} onPress={() => setTab(t)} className="mr-6 pb-2">
                  <Text className={`text-heading-sm ${active ? 'text-ink-900' : 'text-ink-600'}`}>{t}</Text>
                  {active ? (
                    <View className="absolute -bottom-px left-0 right-0 h-0.5 rounded-full bg-saffron-600" />
                  ) : null}
                </Pressable>
              );
            })}
          </View>

          {/* Tab content */}
          <View className="mt-4">
            {tab === 'Leaderboard' ? (
              <>
                <Text className="mb-3 text-label-sm uppercase tracking-wide text-ink-600">
                  {isClan ? 'Clan members by points' : 'Top players by points'}
                </Text>
                {leaderRows.length === 0 ? (
                  <Text className="text-body-sm text-ink-700">
                    {isClan ? 'Join a clan to see clan standings.' : 'No players yet.'}
                  </Text>
                ) : null}
                {leaderRows.map((m) => {
                  const top3 = m.rank <= 3;
                  return (
                    <Pressable
                      key={m.key}
                      onPress={() => m.id && router.push(`/u/${m.id}` as Href)}
                      className={`mb-2 flex-row items-center rounded-md px-3 py-3 ${m.you ? 'border border-saffron-600 bg-ink-200' : 'bg-ink-200'}`}
                    >
                      <Text
                        style={{ fontVariant: ['tabular-nums'] }}
                        className={`w-6 text-heading-sm ${top3 ? 'text-saffron-600' : 'text-ink-700'}`}
                      >
                        {m.rank}
                      </Text>
                      <Avatar size={32} name={m.name} />
                      <Text className="ml-3 flex-1 text-heading-sm text-ink-900">{m.name}</Text>
                      <View className="items-end">
                        <Text style={{ fontVariant: ['tabular-nums'] }} className="text-body-md font-semibold text-ink-900">
                          {m.points.toLocaleString('en-IN')}
                        </Text>
                        <Text style={{ fontVariant: ['tabular-nums'] }} className="text-label-sm text-ink-600">
                          {m.sub}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </>
            ) : tab === 'Territories' ? (
              <View className="items-center py-12">
                <HexIcon size={40} color={colors.ink[500]} />
                <Text className="mt-3 text-center text-body-md text-ink-700">
                  {isClan ? 'Clan-held hexes' : 'Your captured hexes'} appear here once you start capturing.
                </Text>
              </View>
            ) : (
              <View className="items-center py-12">
                <Text className="text-center text-body-md text-ink-700">
                  {isClan ? 'Clan capture history' : 'Your capture history'} — lands with Walk Sessions.
                </Text>
              </View>
            )}
          </View>
        </BottomSheetScrollView>
      </BottomSheet>

      <HexInfo h3={selectedHex} onClose={() => setSelectedHex(null)} />
    </View>
  );
}
