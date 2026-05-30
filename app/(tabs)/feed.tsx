// Feed — matches the real INTVL "Feed / Explore" screenshot (single-column rich
// posts), recoloured saffron, Hexa content (captures/walks, not runs). Bottom-nav tab.
// Phase 13 feature; DESIGN PREVIEW with mock posts.
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconBell, IconChevronRight, IconHeart, IconMessageCircle, IconTrophy } from '@/components/ui/Icon';

import { Avatar } from '@/components/ui';
import { colors } from '@/theme';

interface Post {
  name: string;
  level: number;
  time: string;
  hood: string;
  caption: string;
  distance: string;
  duration: string;
  hexes: number;
  likes: number;
  comments: number;
  photos: string[]; // mock photo tints
}

const POSTS: Post[] = [
  {
    name: 'Priya',
    level: 30,
    time: '19 hours ago',
    hood: 'HSR Layout',
    caption: '10 hexes?! Lowkey thought I captured way more, still a solid evening walk haha',
    distance: '9.70 km',
    duration: '55:09',
    hexes: 10,
    likes: 193,
    comments: 10,
    photos: [colors.player.forest, colors.player.gold],
  },
  {
    name: 'Rohit',
    level: 9,
    time: '19 hours ago',
    hood: 'Koramangala',
    caption: 'Nice loop around the lake, testing the app',
    distance: '4.91 km',
    duration: '31:25',
    hexes: 4,
    likes: 42,
    comments: 3,
    photos: [colors.player.teal, colors.player.crimson],
  },
];

const TABS = ['Explore', 'Following'] as const;

function PostView({ post }: { post: Post }) {
  return (
    <View className="mb-6">
      {/* author row */}
      <View className="flex-row items-center">
        <View>
          <Avatar size={48} name={post.name} />
          <View className="absolute -bottom-1 left-1 rounded-full bg-ink-50 px-1.5 py-0.5">
            <Text className="text-[10px] font-bold text-ink-900">L{post.level}</Text>
          </View>
        </View>
        <View className="ml-3 flex-1">
          <Text className="text-heading-sm text-ink-900">{post.name}</Text>
          <Text className="text-body-sm text-ink-700">{post.time}</Text>
          <Text className="text-body-sm text-ink-700">{post.hood} 🇮🇳</Text>
        </View>
      </View>

      <Text className="mt-3 text-body-md text-ink-800">{post.caption}</Text>

      {/* photo carousel (mock) */}
      <View className="mt-3 flex-row gap-1">
        {post.photos.map((tint, i) => (
          <View
            key={i}
            className="h-44 flex-1 rounded-md"
            style={{ backgroundColor: `${tint}55` }}
          />
        ))}
      </View>

      {/* stats bar */}
      <View className="mt-3 flex-row items-center rounded-md bg-ink-100 p-3">
        <View className="flex-1">
          <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-sm text-ink-900">
            {post.distance}
          </Text>
          <Text className="text-label-sm uppercase text-ink-600">Distance</Text>
        </View>
        <View className="flex-1">
          <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-sm text-ink-900">
            {post.duration}
          </Text>
          <Text className="text-label-sm uppercase text-ink-600">Duration</Text>
        </View>
        <View className="flex-1">
          <Text style={{ fontVariant: ['tabular-nums'] }} className="text-heading-sm text-saffron-600">
            {post.hexes}
          </Text>
          <Text className="text-label-sm uppercase text-ink-600">Hexes</Text>
        </View>
        <View className="flex-row items-center gap-3 border-l border-ink-400 pl-4">
          <View className="flex-row items-center gap-1">
            <IconHeart size={18} color={colors.ink[600]} />
            <Text className="text-body-sm text-ink-700">{post.likes}</Text>
          </View>
          <View className="flex-row items-center gap-1">
            <IconMessageCircle size={18} color={colors.ink[600]} />
            <Text className="text-body-sm text-ink-700">{post.comments}</Text>
          </View>
        </View>
      </View>
    </View>
  );
}

export default function FeedScreen() {
  const [tab, setTab] = useState<string>('Explore');

  return (
    <SafeAreaView edges={['top']} className="flex-1 bg-ink-50">
      {/* header: bell · Feed · avatar */}
      <View className="h-12 flex-row items-center justify-between px-4">
        <IconBell size={24} color={colors.ink[900]} />
        <Text className="text-heading-md text-ink-900">Feed</Text>
        <Avatar size={32} name="Charan12" />
      </View>

      {/* underline tabs (match INTVL) */}
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
        {/* territory leaderboards card */}
        <Pressable className="mb-6 flex-row items-center rounded-md bg-ink-200 p-4">
          <IconTrophy size={24} color={colors.saffron[600]} />
          <Text className="ml-3 flex-1 text-body-lg text-ink-900">Bangalore territory leaderboards</Text>
          <IconChevronRight size={20} color={colors.ink[600]} />
        </Pressable>

        {POSTS.map((p) => (
          <PostView key={p.name} post={p} />
        ))}

        <Text className="text-center text-body-sm text-ink-600">Mock feed — live in Phase 13</Text>
      </ScrollView>
    </SafeAreaView>
  );
}
