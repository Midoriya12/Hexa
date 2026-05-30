// Leaderboard tab — INTVL "Club/Member Leaderboard" layout (screens 06/07), saffron.
// Header + scope sub-toggles + your-rank card + ranked rows.
// DESIGN PREVIEW: realistic mock standings so the layout reads true; live data is Phase 7.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Badge, Card, SubToggle } from '@/components/ui';
import { useCurrentUser } from '@/hooks/useCurrentUser';
import { colors } from '@/theme';

interface Row {
  rank: number;
  name: string;
  username: string;
  level: number;
  points: number;
  you?: boolean;
}

const MOCK: Row[] = [
  { rank: 1, name: 'Priya', username: 'priya_walks', level: 5, points: 8420 },
  { rank: 2, name: 'Rohit', username: 'rohit_hsr', level: 4, points: 7180 },
  { rank: 3, name: 'Aisha', username: 'aisha_runs', level: 4, points: 6650 },
  { rank: 4, name: 'Karthik', username: 'kt_blr', level: 3, points: 5210 },
  { rank: 5, name: 'Charan12', username: 'the_king_charan', level: 1, points: 4210, you: true },
  { rank: 6, name: 'Meera', username: 'meera_m', level: 3, points: 3980 },
  { rank: 7, name: 'Sandeep', username: 'sandy', level: 2, points: 2740 },
  { rank: 8, name: 'Nisha', username: 'nisha_k', level: 2, points: 1990 },
];

function RankRow({ row }: { row: Row }) {
  const top3 = row.rank <= 3;
  return (
    <View
      className={`mb-2 flex-row items-center rounded-md p-3 ${
        row.you ? 'border border-saffron-600 bg-ink-200' : 'bg-ink-100'
      }`}
    >
      <Text
        style={{ fontVariant: ['tabular-nums'] }}
        className={`w-7 text-heading-md ${top3 ? 'text-saffron-600' : 'text-ink-700'}`}
      >
        {row.rank}
      </Text>
      <Avatar size={40} name={row.name} />
      <View className="ml-3 flex-1">
        <Text className="text-heading-sm text-ink-900">{row.name}</Text>
        <Text className="text-body-sm text-ink-700">@{row.username}</Text>
      </View>
      <View className="items-end">
        <Text
          style={{ fontVariant: ['tabular-nums'] }}
          className={`text-heading-sm ${top3 ? 'text-saffron-600' : 'text-ink-900'}`}
        >
          {row.points.toLocaleString('en-IN')}
        </Text>
        <Text className="text-label-sm uppercase text-ink-600">points</Text>
      </View>
    </View>
  );
}

export default function LeaderboardScreen() {
  const { user } = useCurrentUser();
  const [scope, setScope] = useState('Pincode');
  const [timeframe, setTimeframe] = useState('Month');
  const me = MOCK.find((r) => r.you);

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text className="mb-4 mt-2 text-display-sm text-ink-900">Leaderboard</Text>

        <SubToggle options={['Pincode', 'City', 'Friends']} value={scope} onChange={setScope} />
        <View className="mt-3">
          <SubToggle options={['Week', 'Month', 'All-time']} value={timeframe} onChange={setTimeframe} />
        </View>

        <Text className="mb-3 mt-4 text-body-sm text-ink-700">
          {user?.pincode ?? '560068'} · {scope} · This {timeframe.toLowerCase()}
        </Text>

        {/* Your rank card */}
        {me ? (
          <Card className="mb-4 border border-saffron-600">
            <View className="flex-row items-center">
              <Text style={{ fontVariant: ['tabular-nums'] }} className="w-7 text-heading-md text-saffron-600">
                {me.rank}
              </Text>
              <Avatar size={40} name={me.name} />
              <View className="ml-3 flex-1">
                <Text className="text-heading-sm text-ink-900">You · {me.name}</Text>
                <Badge tone="saffron" label={`Level ${me.level}`} />
              </View>
              <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-md text-saffron-600">
                {me.points.toLocaleString('en-IN')}
              </Text>
            </View>
          </Card>
        ) : null}

        {MOCK.map((row) => (
          <RankRow key={row.rank} row={row} />
        ))}

        <Text className="mt-4 text-center text-body-sm text-ink-600">
          Mock standings — live leaderboards arrive in Phase 7
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
