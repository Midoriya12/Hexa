// Play — INTVL Play layout. Full-bleed live map with a persistent swipe-up sheet whose
// COLLAPSED peek shows only the summary (clan: name · members · hexes held / solo: you ·
// area · hexes held). Leaderboard/Territories/History live BELOW and are reached by swiping
// up, so the peek stays small and the map stays visible. Solo vs Clan switches the summary
// (and, once captures exist, which hexes the map highlights). Percentage snaps adapt to all
// device sizes.
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import { IconBell, IconChevronDown, IconEye, IconStack, IconTarget } from '@/components/ui/Icon';

import { Avatar } from '@/components/ui';
import { HexMap } from '@/components/map/HexMap';
import { HexIcon } from '@/components/shared/HexIcon';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/theme';

const CLAN_MEMBER_CAP = 100; // clans are capped at 100 members (patch #32)
const CLAN = { name: 'HSR Walkers', hexes: 3392, members: 92 };
const MEMBERS = [
  { rank: 1, name: 'Priya', hexes: 842 },
  { rank: 2, name: 'Rohit', hexes: 718 },
  { rank: 3, name: 'Aisha', hexes: 665 },
  { rank: 4, name: 'Karthik', hexes: 521 },
  { rank: 5, name: 'Charan12', hexes: 421, you: true },
  { rank: 6, name: 'Meera', hexes: 398 },
  { rank: 7, name: 'Sandeep', hexes: 274 },
];
const SHEET_TABS = ['Leaderboard', 'Territories', 'History'];
const MODES = ['Solo', 'Clan'];

function ControlButton({ children }: { children: React.ReactNode }) {
  return (
    <View className="mb-3 h-11 w-11 items-center justify-center rounded-full border border-ink-400 bg-ink-100">
      {children}
    </View>
  );
}

/** Compact one-row summary shown in the collapsed peek. */
function SummaryRow({
  name,
  sub,
  hexes,
}: {
  name: string;
  sub: string;
  hexes: number;
}) {
  return (
    <View className="flex-row items-center">
      <Avatar size={40} name={name} />
      <View className="ml-3 flex-1">
        <Text numberOfLines={1} className="text-heading-sm text-ink-900">
          {name}
        </Text>
        <Text numberOfLines={1} className="text-body-sm text-ink-700">
          {sub}
        </Text>
      </View>
      <View className="items-end">
        <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-lg text-saffron-600">
          {hexes.toLocaleString('en-IN')}
        </Text>
        <Text className="text-label-sm uppercase text-ink-600">Hexes held</Text>
      </View>
    </View>
  );
}

export default function PlayScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useCurrentUser();
  const [mode, setMode] = useState('Clan');
  const [tab, setTab] = useState('Leaderboard');
  const sheetRef = useRef<BottomSheet>(null);
  // Peek = summary only (small). Mid/full reveal the tabs + content. % snaps scale per device.
  const snapPoints = useMemo(() => ['18%', '55%', '92%'], []);

  const isClan = mode === 'Clan';
  const myName = user?.display_name || user?.username || 'You';
  const myArea = user?.home_neighbourhood || 'Bengaluru';
  const myHexes = user?.current_held_hexes ?? 0;

  return (
    <View className="flex-1 bg-ink-50">
      {/* ── Live map (globe + zoom), full-bleed behind everything ── */}
      <HexMap />

      {/* ── Top mode bar (full width, neutral) ── */}
      <View style={{ paddingTop: insets.top + 8 }} className="px-4">
        <View className="flex-row rounded-full bg-ink-100 p-1">
          {MODES.map((m) => {
            const active = m === mode;
            return (
              <Pressable
                key={m}
                onPress={() => setMode(m)}
                className={`flex-1 flex-row items-center justify-center rounded-full py-2.5 ${active ? 'bg-ink-300' : ''}`}
              >
                <Text className={`text-label-md ${active ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                  {m === 'Clan' ? CLAN.name : 'Solo'}
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

      {/* ── Floating bell (left, below top bar) ── */}
      <View style={{ position: 'absolute', left: 16, top: insets.top + 64 }}>
        <View className="h-11 w-11 items-center justify-center rounded-full border border-ink-400 bg-ink-100">
          <IconBell size={20} color={colors.ink[900]} />
        </View>
      </View>

      {/* ── Floating controls (right) ── */}
      <View style={{ position: 'absolute', right: 16, top: insets.top + 64 }}>
        <ControlButton>
          <IconEye size={20} color={colors.saffron[600]} />
        </ControlButton>
        <ControlButton>
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
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: colors.ink[100] }}
        handleIndicatorStyle={{ backgroundColor: colors.ink[500], width: 40 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 2, paddingBottom: 40 }}>
          {/* Summary (always visible in the peek) */}
          {isClan ? (
            <SummaryRow name={CLAN.name} sub={`${CLAN.members} / ${CLAN_MEMBER_CAP} members`} hexes={CLAN.hexes} />
          ) : (
            <SummaryRow name={myName} sub={myArea} hexes={myHexes} />
          )}

          {/* Hint that there's more below (only meaningful in the peek) */}
          <View className="mt-3 mb-1 items-center">
            <Text className="text-label-sm uppercase tracking-wide text-ink-500">Swipe up for standings</Text>
          </View>

          {/* Underline tabs (revealed on swipe up) */}
          <View className="mt-2 flex-row border-b border-ink-400">
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
                  {isClan ? 'Clan members by hexes' : 'Players near you'}
                </Text>
                {MEMBERS.map((m) => {
                  const top3 = m.rank <= 3;
                  return (
                    <View
                      key={m.rank}
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
                      <Text style={{ fontVariant: ['tabular-nums'] }} className="text-body-md text-ink-800">
                        {m.hexes}
                      </Text>
                    </View>
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
    </View>
  );
}
