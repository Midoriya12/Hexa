// Notifications — the inbox behind the Play-header bell. Surfaces the two things that need your
// attention: incoming FRIEND requests (anyone) and pending CLAN JOIN requests (clan officers
// only). Both are accept/decline inline; responding refreshes the badge count. Derived from
// pending rows — no separate notifications table.
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter, type Href } from 'expo-router';

import { Avatar, Button } from '@/components/ui';
import { IconChevronLeft } from '@/components/ui/Icon';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { listIncomingRequests, respondToRequest, type FriendRequest } from '@/lib/supabase/friends';
import { listJoinRequests, respondJoinRequest, type JoinRequest } from '@/lib/supabase/clans';
import { listNotifications, markNotificationsRead, type AppNotification } from '@/lib/supabase/notifications';
import { useNotificationStore } from '@/stores/notificationStore';
import { colors } from '@/theme';

function ago(iso: string): string {
  const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { user } = useCurrentUser();
  const canManageJoins = user?.clan_role === 'president' || user?.clan_role === 'vp';
  const refreshBadge = useNotificationStore((s) => s.refresh);

  const [friendReqs, setFriendReqs] = useState<FriendRequest[]>([]);
  const [joinReqs, setJoinReqs] = useState<JoinRequest[]>([]);
  const [events, setEvents] = useState<AppNotification[]>([]);

  const load = useCallback(() => {
    listIncomingRequests().then(setFriendReqs).catch(() => undefined);
    listNotifications().then(setEvents).catch(() => undefined);
    if (canManageJoins) listJoinRequests().then(setJoinReqs).catch(() => undefined);
    else setJoinReqs([]);
  }, [canManageJoins]);

  useFocusEffect(
    useCallback(() => {
      load();
      // Opening the inbox marks the events read → clears the bell badge for them.
      void markNotificationsRead().then(() => refreshBadge(canManageJoins));
    }, [load, refreshBadge, canManageJoins]),
  );

  const onFriend = async (friendshipId: number, accept: boolean) => {
    try {
      await respondToRequest(friendshipId, accept);
    } finally {
      load();
      void refreshBadge(canManageJoins);
    }
  };
  const onJoin = async (requestId: number, accept: boolean) => {
    try {
      await respondJoinRequest(requestId, accept);
    } finally {
      load();
      void refreshBadge(canManageJoins);
    }
  };

  const empty = friendReqs.length === 0 && joinReqs.length === 0 && events.length === 0;

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <View className="flex-row items-center px-3 py-2">
        <IconChevronLeft size={26} color={colors.ink[900]} onPress={() => router.back()} />
        <Text className="ml-1 text-display-sm text-ink-900">Notifications</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {empty ? (
          <Text className="py-16 text-center text-body-md text-ink-700">You&apos;re all caught up. 🎉</Text>
        ) : null}

        {/* Friend requests */}
        {friendReqs.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-label-sm uppercase tracking-wide text-ink-600">Friend requests</Text>
            {friendReqs.map((r) => (
              <View key={`f${r.friendshipId}`} className="mb-2 flex-row items-center rounded-md bg-ink-100 p-3">
                <Pressable onPress={() => router.push(`/u/${r.from.id}` as Href)} className="flex-row items-center flex-1">
                  <Avatar size={48} name={r.from.name} />
                  <View className="ml-3 flex-1">
                    <Text className="text-heading-sm text-ink-900">{r.from.name}</Text>
                    <Text className="text-body-sm text-ink-700">wants to be friends</Text>
                  </View>
                </Pressable>
                <View className="flex-row gap-2">
                  <Button label="Accept" size="sm" onPress={() => onFriend(r.friendshipId, true)} />
                  <Button label="Decline" size="sm" variant="secondary" onPress={() => onFriend(r.friendshipId, false)} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Clan join requests (officers only) */}
        {joinReqs.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-label-sm uppercase tracking-wide text-ink-600">Clan join requests</Text>
            {joinReqs.map((r) => (
              <View key={`j${r.id}`} className="mb-2 flex-row items-center rounded-md bg-ink-100 p-3">
                <Pressable onPress={() => router.push(`/u/${r.user.id}` as Href)} className="flex-row items-center flex-1">
                  <Avatar size={48} name={r.user.name} />
                  <View className="ml-3 flex-1">
                    <Text className="text-heading-sm text-ink-900">{r.user.name}</Text>
                    <Text className="text-body-sm text-ink-700">
                      wants to join · {r.user.points.toLocaleString('en-US')} pts
                    </Text>
                    {r.message ? (
                      <Text className="mt-0.5 text-body-sm italic text-ink-700" numberOfLines={2}>
                        “{r.message}”
                      </Text>
                    ) : null}
                  </View>
                </Pressable>
                <View className="flex-row gap-2">
                  <Button label="Accept" size="sm" onPress={() => onJoin(r.id, true)} />
                  <Button label="Decline" size="sm" variant="secondary" onPress={() => onJoin(r.id, false)} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Activity — steals, level-ups (the notifications table) */}
        {events.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-label-sm uppercase tracking-wide text-ink-600">Activity</Text>
            {events.map((n) => {
              const toThief = n.type === 'steal' && typeof n.data.by === 'string' ? (n.data.by as string) : null;
              const inner = (
                <View className="flex-row items-center">
                  <View className="h-10 w-10 items-center justify-center rounded-full bg-saffron-600/15">
                    <Text className="text-body-lg">
                      {n.type === 'steal'
                        ? '🔥'
                        : n.type === 'level_up'
                          ? '⭐'
                          : n.type === 'rent'
                            ? '💰'
                            : n.type === 'warning'
                              ? '⚠️'
                              : n.type === 'ban'
                                ? '🚫'
                                : '🔔'}
                    </Text>
                  </View>
                  <View className="ml-3 flex-1">
                    <Text className="text-heading-sm text-ink-900">{n.title}</Text>
                    {n.body ? <Text className="text-body-sm text-ink-700">{n.body}</Text> : null}
                  </View>
                  <Text className="text-label-sm text-ink-600">{ago(n.createdAt)}</Text>
                </View>
              );
              return (
                <View key={`n${n.id}`} className={`mb-2 rounded-md p-3 ${n.readAt ? 'bg-ink-100' : 'bg-ink-200'}`}>
                  {toThief ? <Pressable onPress={() => router.push(`/u/${toThief}` as Href)}>{inner}</Pressable> : inner}
                </View>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}
