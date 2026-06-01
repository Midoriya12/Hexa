// Friends — real: search players by username, send requests, accept/decline incoming, list
// accepted friends. friendships is plain RLS'd; names resolved via public_users. Reached from Me.
import { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { IconChevronLeft, IconSearch, IconUserPlus } from '@/components/ui/Icon';

import { Avatar, Badge, Button } from '@/components/ui';
import {
  listFriends,
  listIncomingRequests,
  respondToRequest,
  searchUsers,
  sendRequest,
  type FriendRequest,
  type FriendUser,
} from '@/lib/supabase/friends';
import { colors } from '@/theme';

export default function FriendsScreen() {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequest[]>([]);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requested, setRequested] = useState<Set<string>>(new Set());

  const refresh = useCallback(() => {
    listIncomingRequests().then(setRequests).catch(() => undefined);
    listFriends().then(setFriends).catch(() => undefined);
  }, []);

  useFocusEffect(useCallback(() => {
    refresh();
  }, [refresh]));

  // Debounced search.
  useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    const id = setTimeout(() => {
      searchUsers(q).then(setResults).catch(() => setResults([]));
    }, 300);
    return () => clearTimeout(id);
  }, [query]);

  const add = async (id: string) => {
    setRequested((s) => new Set(s).add(id)); // optimistic
    try {
      await sendRequest(id);
    } catch {
      /* 23505 already friends/requested — keep it marked */
    }
  };

  const respond = async (friendshipId: number, accept: boolean) => {
    try {
      await respondToRequest(friendshipId, accept);
    } finally {
      refresh();
    }
  };

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }} keyboardShouldPersistTaps="handled">
        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <View className="flex-row items-center">
            <IconChevronLeft size={26} color={colors.ink[900]} onPress={() => router.back()} />
            <Text className="ml-1 text-display-sm text-ink-900">Friends</Text>
          </View>
          <IconUserPlus size={26} color={colors.saffron[600]} />
        </View>

        {/* Search */}
        <View className="mb-6 flex-row items-center rounded-md border border-ink-400 bg-ink-200 px-3">
          <IconSearch size={20} color={colors.ink[600]} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search by username"
            placeholderTextColor={colors.ink[600]}
            autoCapitalize="none"
            className="ml-2 h-[48px] flex-1 text-body-lg text-ink-900"
          />
        </View>

        {/* Search results */}
        {query.trim().length >= 2 ? (
          <View className="mb-6">
            <Text className="mb-2 text-label-sm uppercase text-ink-600">Results</Text>
            {results.length === 0 ? (
              <Text className="text-body-sm text-ink-700">No players found.</Text>
            ) : (
              results.map((u) => (
                <View key={u.id} className="mb-2 flex-row items-center rounded-md bg-ink-100 p-3">
                  <Avatar size={48} name={u.name} />
                  <View className="ml-3 flex-1">
                    <Text className="text-heading-sm text-ink-900">{u.name}</Text>
                    <Text className="text-body-sm text-ink-700">@{u.username ?? '—'}</Text>
                  </View>
                  {requested.has(u.id) ? (
                    <Text className="text-body-sm text-ink-600">Requested</Text>
                  ) : (
                    <Button label="Add" size="sm" onPress={() => add(u.id)} />
                  )}
                </View>
              ))
            )}
          </View>
        ) : null}

        {/* Pending requests */}
        {requests.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-label-sm uppercase text-ink-600">Requests</Text>
            {requests.map((r) => (
              <View key={r.friendshipId} className="mb-2 flex-row items-center rounded-md bg-ink-100 p-3">
                <Avatar size={48} name={r.from.name} />
                <View className="ml-3 flex-1">
                  <Text className="text-heading-sm text-ink-900">{r.from.name}</Text>
                  <Text className="text-body-sm text-ink-700">@{r.from.username ?? '—'}</Text>
                </View>
                <View className="flex-row gap-2">
                  <Button label="Accept" size="sm" onPress={() => respond(r.friendshipId, true)} />
                  <Button label="Decline" size="sm" variant="secondary" onPress={() => respond(r.friendshipId, false)} />
                </View>
              </View>
            ))}
          </View>
        ) : null}

        {/* Friends list */}
        <Text className="mb-2 text-label-sm uppercase text-ink-600">Your friends · {friends.length}</Text>
        {friends.length === 0 ? (
          <Text className="text-body-sm text-ink-700">No friends yet — search a username above to add one.</Text>
        ) : (
          friends.map((f) => (
            <View key={f.id} className="mb-2 flex-row items-center rounded-md bg-ink-100 p-3">
              <Avatar size={48} name={f.name} />
              <View className="ml-3 flex-1">
                <Text className="text-heading-sm text-ink-900">{f.name}</Text>
                <View className="mt-0.5 flex-row items-center gap-2">
                  <Text className="text-body-sm text-ink-700">@{f.username ?? '—'}</Text>
                  <Badge tone="saffron" label={`L${f.level}`} />
                </View>
              </View>
              <Text style={{ fontVariant: ['tabular-nums'] }} className="text-body-md font-semibold text-ink-900">
                {f.points.toLocaleString('en-IN')}
              </Text>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
