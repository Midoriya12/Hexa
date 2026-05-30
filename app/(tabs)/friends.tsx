// Friends tab — INTVL 21 "Following" layout (search + requests + friend rows), saffron.
// DESIGN PREVIEW: mock friends/requests; live data is Phase 7.
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconSearch, IconUserPlus } from '@tabler/icons-react-native';

import { Avatar, Badge, Button, Card } from '@/components/ui';
import { colors } from '@/theme';

const REQUESTS = [{ name: 'Vikram', username: 'vik_blr', level: 2 }];

const FRIENDS = [
  { name: 'Priya', username: 'priya_walks', level: 5, points: 8420 },
  { name: 'Rohit', username: 'rohit_hsr', level: 4, points: 7180 },
  { name: 'Meera', username: 'meera_m', level: 3, points: 3980 },
  { name: 'Sandeep', username: 'sandy', level: 2, points: 2740 },
];

export default function FriendsScreen() {
  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <View className="mb-4 mt-2 flex-row items-center justify-between">
          <Text className="text-display-sm text-ink-900">Friends</Text>
          <IconUserPlus size={26} color={colors.saffron[600]} strokeWidth={1.75} />
        </View>

        {/* Search */}
        <View className="mb-6 flex-row items-center rounded-md border border-ink-400 bg-ink-200 px-3">
          <IconSearch size={20} color={colors.ink[600]} strokeWidth={1.75} />
          <TextInput
            placeholder="Search by username"
            placeholderTextColor={colors.ink[600]}
            autoCapitalize="none"
            className="ml-2 h-[48px] flex-1 text-body-lg text-ink-900"
          />
        </View>

        {/* Pending requests */}
        {REQUESTS.length > 0 ? (
          <View className="mb-6">
            <Text className="mb-2 text-label-sm uppercase text-ink-600" style={{ letterSpacing: 0.5 }}>
              Requests
            </Text>
            {REQUESTS.map((r) => (
              <Card key={r.username} className="mb-2">
                <View className="flex-row items-center">
                  <Avatar size={48} name={r.name} />
                  <View className="ml-3 flex-1">
                    <Text className="text-heading-sm text-ink-900">{r.name}</Text>
                    <Text className="text-body-sm text-ink-700">@{r.username}</Text>
                  </View>
                  <View className="flex-row gap-2">
                    <Button label="Accept" size="sm" onPress={() => undefined} />
                    <Button label="Decline" size="sm" variant="secondary" onPress={() => undefined} />
                  </View>
                </View>
              </Card>
            ))}
          </View>
        ) : null}

        {/* Friends list */}
        <Text className="mb-2 text-label-sm uppercase text-ink-600" style={{ letterSpacing: 0.5 }}>
          Your friends · {FRIENDS.length}
        </Text>
        {FRIENDS.map((f) => (
          <View key={f.username} className="mb-2 flex-row items-center rounded-md bg-ink-100 p-3">
            <Avatar size={48} name={f.name} />
            <View className="ml-3 flex-1">
              <Text className="text-heading-sm text-ink-900">{f.name}</Text>
              <View className="mt-0.5 flex-row items-center gap-2">
                <Text className="text-body-sm text-ink-700">@{f.username}</Text>
                <Badge tone="saffron" label={`L${f.level}`} />
              </View>
            </View>
            <Text className="text-body-sm text-saffron-600">Steal them</Text>
          </View>
        ))}

        <Text className="mt-4 text-center text-body-sm text-ink-600">
          Mock friends — live in Phase 7
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
