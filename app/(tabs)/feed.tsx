// Feed — INTVL 19 "Explore" layout (2-col post grid + filter toggle), saffron.
// Bottom-nav tab (Sai's call, overrides design-spec §4.1 4-tab plan — patch #31).
// Phase 13 feature; DESIGN PREVIEW with mock capture posts.
import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconHeart, IconHexagonFilled, IconMessageCircle } from '@/components/ui/Icon';

import { Avatar, SubToggle } from '@/components/ui';
import { colors } from '@/theme';

interface Post {
  name: string;
  hood: string;
  caption: string;
  ip: number;
  likes: number;
  comments: number;
  tint: string;
}

const POSTS: Post[] = [
  { name: 'Priya', hood: 'HSR', caption: 'captured a Power hex', ip: 170, likes: 24, comments: 3, tint: colors.player.teal },
  { name: 'Rohit', hood: 'Koramangala', caption: 'hit a 12-day streak', ip: 0, likes: 41, comments: 8, tint: colors.player.crimson },
  { name: 'Aisha', hood: 'Indiranagar', caption: 'captured a Crown hex', ip: 250, likes: 88, comments: 12, tint: colors.player.gold },
  { name: 'Karthik', hood: 'HSR', caption: 'stole 3 hexes', ip: 130, likes: 9, comments: 1, tint: colors.player.sky },
  { name: 'Meera', hood: 'BTM', caption: 'earned Night Owl', ip: 0, likes: 17, comments: 2, tint: colors.player.purple },
  { name: 'Sandeep', hood: 'HSR', caption: 'captured 5 hexes', ip: 500, likes: 6, comments: 0, tint: colors.player.forest },
];

function PostCard({ post }: { post: Post }) {
  return (
    <View className="mb-3 overflow-hidden rounded-md bg-ink-200" style={{ width: '48.5%' }}>
      {/* "photo" placeholder */}
      <View className="h-28 items-center justify-center" style={{ backgroundColor: `${post.tint}33` }}>
        <IconHexagonFilled size={40} color={post.tint} />
      </View>
      <View className="p-3">
        <View className="flex-row items-center">
          <Avatar size={24} name={post.name} />
          <Text className="ml-2 flex-1 text-label-md text-ink-900" numberOfLines={1}>
            {post.name}
          </Text>
        </View>
        <Text className="mt-2 text-body-sm text-ink-800" numberOfLines={2}>
          {post.caption} in {post.hood}
        </Text>
        {post.ip > 0 ? <Text className="mt-1 text-label-sm text-saffron-600">+{post.ip} IP</Text> : null}
        <View className="mt-2 flex-row items-center gap-4">
          <View className="flex-row items-center gap-1">
            <IconHeart size={16} color={colors.ink[600]} strokeWidth={1.75} />
            <Text className="text-label-sm text-ink-600">{post.likes}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <IconMessageCircle size={16} color={colors.ink[600]} strokeWidth={1.75} />
            <Text className="text-label-sm text-ink-600">{post.comments}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const [tab, setTab] = useState('Explore');

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        <Text className="mb-4 mt-2 text-display-sm text-ink-900">Feed</Text>
        <SubToggle options={['Explore', 'Following']} value={tab} onChange={setTab} />
        <Text className="mb-4 mt-3 text-body-sm text-ink-700">Captures near you · {tab}</Text>

        <View className="flex-row flex-wrap justify-between">
          {POSTS.map((p) => (
            <PostCard key={p.name + p.caption} post={p} />
          ))}
        </View>

        <Text className="mt-2 text-center text-body-sm text-ink-600">Mock feed — live in Phase 13</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
