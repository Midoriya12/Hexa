// Play — matches INTVL's Play screen: top mode/clan selector, full-screen map, floating
// map controls, and a PERSISTENT swipe-up bottom sheet ("My Clan") with Leaderboard /
// Territories / History tabs overlaying the map. Map itself is a placeholder until
// Mapbox (the native build). DESIGN PREVIEW: mock clan + standings.
import { useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import BottomSheet, { BottomSheetScrollView } from '@gorhom/bottom-sheet';
import {
  IconBell,
  IconChevronDown,
  IconCrown,
  IconEye,
  IconStack,
  IconTarget,
} from '@/components/ui/Icon';

import { Avatar, Badge, SubToggle } from '@/components/ui';
import { HexIcon } from '@/components/shared/HexIcon';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/theme';

const CLAN = { name: 'HSR Walkers', hexes: 3392, members: 124 };

const MEMBERS = [
  { rank: 1, name: 'Priya', hexes: 842 },
  { rank: 2, name: 'Rohit', hexes: 718 },
  { rank: 3, name: 'Aisha', hexes: 665 },
  { rank: 4, name: 'Karthik', hexes: 521 },
  { rank: 5, name: 'Charan12', hexes: 421, you: true },
  { rank: 6, name: 'Meera', hexes: 398 },
  { rank: 7, name: 'Sandeep', hexes: 274 },
];

function CtrlButton({ children }: { children: React.ReactNode }) {
  return (
    <View className="mb-3 h-11 w-11 items-center justify-center rounded-full bg-glass-dark">
      {children}
    </View>
  );
}

export default function PlayScreen() {
  const { user } = useCurrentUser();
  const [mode, setMode] = useState('Clan');
  const [sheetTab, setSheetTab] = useState('Leaderboard');
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['16%', '55%', '92%'], []);

  return (
    <View className="flex-1 bg-ink-100">
      {/* ── Map placeholder (Mapbox lands here) ── */}
      <View className="absolute inset-0 items-center justify-center">
        <HexIcon size={64} color={colors.ink[400]} />
        <Text className="mt-3 text-body-sm text-ink-600">Live map + globe — Mapbox build</Text>
      </View>

      {/* ── Top overlay: bell + mode selector ── */}
      <SafeAreaView edges={['top']}>
        <View className="px-4 pt-2">
          <View className="flex-row items-center">
            <View className="mr-3 h-10 w-10 items-center justify-center rounded-full bg-glass-dark">
              <IconBell size={20} color={colors.ink[900]} />
            </View>
            <View className="flex-1 flex-row rounded-full bg-glass-dark p-1">
              {['Solo', 'Clan'].map((m) => {
                const active = m === mode;
                return (
                  <Pressable
                    key={m}
                    onPress={() => setMode(m)}
                    className={`flex-1 flex-row items-center justify-center rounded-full py-2 ${active ? 'bg-ink-300' : ''}`}
                  >
                    <Text className={`text-label-md ${active ? 'font-semibold text-ink-900' : 'text-ink-700'}`}>
                      {m === 'Clan' ? CLAN.name : 'Solo'}
                    </Text>
                    {m === 'Clan' ? <IconChevronDown size={16} color={colors.ink[700]} /> : null}
                  </Pressable>
                );
              })}
            </View>
          </View>
          <View className="mt-2 flex-row items-center justify-center">
            <IconCrown size={16} color={colors.saffron[600]} />
            <Text className="ml-1 text-label-sm uppercase tracking-wide text-ink-800">Clan of the area</Text>
          </View>
        </View>
      </SafeAreaView>

      {/* ── Floating map controls (right) ── */}
      <View className="absolute right-4 top-1/3">
        <CtrlButton>
          <IconEye size={20} color={colors.saffron[600]} />
        </CtrlButton>
        <CtrlButton>
          <IconTarget size={20} color={colors.ink[900]} />
        </CtrlButton>
        <CtrlButton>
          <IconStack size={20} color={colors.ink[900]} />
        </CtrlButton>
      </View>

      {/* ── Persistent swipe-up sheet: My Clan ── */}
      <BottomSheet
        ref={sheetRef}
        index={0}
        snapPoints={snapPoints}
        enablePanDownToClose={false}
        backgroundStyle={{ backgroundColor: colors.ink[100] }}
        handleIndicatorStyle={{ backgroundColor: colors.ink[500], width: 36 }}
      >
        <BottomSheetScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
          {/* Clan summary */}
          <View className="flex-row items-center">
            <Avatar size={48} name={CLAN.name} />
            <View className="ml-3 flex-1">
              <Text className="text-heading-md text-ink-900">{mode === 'Clan' ? CLAN.name : 'Bangalore'}</Text>
              <Text className="text-body-sm text-ink-700">
                {mode === 'Clan' ? `${CLAN.members} members` : 'City standings'}
              </Text>
            </View>
            <View className="items-end">
              <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-md text-saffron-600">
                {CLAN.hexes.toLocaleString('en-IN')}
              </Text>
              <Text className="text-label-sm uppercase text-ink-600">Hexes</Text>
            </View>
          </View>

          {/* Tabs */}
          <View className="my-4">
            <SubToggle options={['Leaderboard', 'Territories', 'History']} value={sheetTab} onChange={setSheetTab} />
          </View>

          {sheetTab === 'Leaderboard' ? (
            MEMBERS.map((m) => {
              const top3 = m.rank <= 3;
              return (
                <View
                  key={m.rank}
                  className={`mb-2 flex-row items-center rounded-md p-3 ${m.you ? 'border border-saffron-600 bg-ink-200' : 'bg-ink-200'}`}
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
                    {m.hexes} hexes
                  </Text>
                </View>
              );
            })
          ) : sheetTab === 'Territories' ? (
            <View className="items-center py-10">
              <HexIcon size={40} color={colors.ink[500]} />
              <Text className="mt-3 text-body-md text-ink-700">Clan-held hexes appear here once the map is live.</Text>
            </View>
          ) : (
            <View className="items-center py-10">
              <Badge tone="neutral" label="Clan territory over time" />
              <Text className="mt-3 text-body-md text-ink-700">History chart — live in Phase 11.</Text>
            </View>
          )}
        </BottomSheetScrollView>
      </BottomSheet>
    </View>
  );
}
