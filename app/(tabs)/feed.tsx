// Feed — real capture activity (spec: capture/clan activity, not free-form posts). Explore =
// everyone's recent captures; Following = friends' (Step C-next). Refreshes on focus.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { IconBell, IconChevronRight, IconTrophy } from '@/components/ui/Icon';

import { Avatar } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { fetchFeed, type FeedItem } from '@/lib/supabase/feed';
import { colors } from '@/theme';

const TABS = ['Explore', 'Following'] as const;

function ago(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  return `${Math.floor(hr / 24)}d ago`;
}

function FeedRow({ item }: { item: FeedItem }) {
  return (
    <View className="mb-4 flex-row items-center">
      <View>
        <Avatar size={48} name={item.name} />
        <View className="absolute -bottom-1 left-0.5 rounded-full bg-ink-50 px-1.5 py-0.5">
          <Text className="text-[10px] font-bold text-ink-900">L{item.level}</Text>
        </View>
      </View>
      <View className="ml-3 flex-1">
        <Text className="text-body-md text-ink-900">
          <Text className="font-semibold">{item.name}</Text>
          {item.stolen ? ' stole a hex in ' : ' captured a hex in '}
          <Text className="font-semibold">{item.neighbourhood}</Text>
        </Text>
        <Text className="text-label-sm text-ink-600">{ago(item.capturedAt)}</Text>
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="h-3 w-3 rounded-sm" style={{ backgroundColor: item.colour || colors.player.saffron }} />
        <Text style={{ fontVariant: ['tabular-nums'] }} className="text-body-md font-semibold text-saffron-600">
          +{item.ip}
        </Text>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const [tab, setTab] = useState<string>('Explore');
  const [items, setItems] = useState<FeedItem[]>([]);
  const { user } = useCurrentUser();

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      fetchFeed()
        .then((f) => alive && setItems(f))
        .catch(() => undefined);
      return () => {
        alive = false;
      };
    }, []),
  );

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="h-12 flex-row items-center justify-between px-4">
        <IconBell size={24} color={colors.ink[900]} />
        <Text className="text-heading-md text-ink-900">Feed</Text>
        <Avatar size={32} name={user?.display_name ?? user?.username ?? undefined} />
      </View>

      <View className="flex-row border-b border-ink-400">
        {TABS.map((t) => {
          const active = t === tab;
          return (
            <Pressable key={t} className="flex-1 items-center py-3" onPress={() => setTab(t)}>
              <Text className={`text-heading-sm ${active ? 'text-ink-900' : 'text-ink-600'}`}>{t}</Text>
              {active ? <View className="absolute bottom-0 h-0.5 w-16 rounded-full bg-saffron-600" /> : null}
            </Pressable>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 32 }}>
        <Pressable className="mb-6 flex-row items-center rounded-md bg-ink-200 p-4">
          <IconTrophy size={24} color={colors.saffron[600]} />
          <Text className="ml-3 flex-1 text-body-lg text-ink-900">Bangalore territory leaderboards</Text>
          <IconChevronRight size={20} color={colors.ink[600]} />
        </Pressable>

        {tab === 'Following' ? (
          <View className="items-center py-16">
            <Text className="text-center text-body-md text-ink-700">
              Add friends to see their captures here.
            </Text>
            <Text className="mt-1 text-center text-body-sm text-ink-600">Friends arrive in the next update.</Text>
          </View>
        ) : items.length === 0 ? (
          <View className="items-center py-16">
            <Text className="text-center text-body-md text-ink-700">No captures yet.</Text>
            <Text className="mt-1 text-center text-body-sm text-ink-600">Go to Start and take your first hex!</Text>
          </View>
        ) : (
          items.map((it) => <FeedRow key={it.id} item={it} />)
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
