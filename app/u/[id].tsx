// Player profile — public stats for any user, reached by tapping a friend / feed name /
// leaderboard row. Pushed route /u/<id>.
import { useCallback, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { IconChevronLeft } from '@/components/ui/Icon';

import { Avatar, Badge } from '@/components/ui';
import { fetchUserProfile, type UserProfile } from '@/lib/supabase/profile';
import { colors } from '@/theme';

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

  useFocusEffect(
    useCallback(() => {
      let alive = true;
      if (!id) return;
      setLoading(true);
      fetchUserProfile(id)
        .then((p) => alive && setProfile(p))
        .catch(() => undefined)
        .finally(() => alive && setLoading(false));
      return () => {
        alive = false;
      };
    }, [id]),
  );

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
              <Text className="mt-3 text-display-sm text-ink-900">{profile.name}</Text>
              <Text className="text-body-md text-ink-700">@{profile.username ?? '—'}</Text>
              <View className="mt-2">
                <Badge tone="saffron" label={`Level ${profile.level}`} />
              </View>
            </View>

            <View className="mt-6 flex-row gap-3">
              <Stat value={profile.points.toLocaleString('en-IN')} label="Points" />
              <Stat value={profile.captures.toLocaleString('en-IN')} label="Hexes captured" />
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
