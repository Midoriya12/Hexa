// Bottom tab bar — INTVL's 4 tabs: Play · Me · Feed · Start (Sai's call, patch #31
// updated). Play = the map, Me = profile, Feed = social feed, Start = begin a walk.
// Leaderboard + Friends are pushed screens reached from Play/Me (as INTVL organises them).
// Play uses the custom hex icon; rest use MaterialCommunityIcons. Saffron active tint.
import { Tabs } from 'expo-router';
import { IconLayoutGrid, IconUser, IconWalk } from '@/components/ui/Icon';

import { HexIcon } from '@/components/shared/HexIcon';
import { colors } from '@/theme';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.saffron[600],
        tabBarInactiveTintColor: colors.ink[700],
        tabBarStyle: {
          backgroundColor: colors.ink[100],
          borderTopColor: 'rgba(61,61,61,0.5)',
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Play',
          tabBarIcon: ({ color, focused }) => <HexIcon size={24} color={color} filled={focused} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Me',
          tabBarIcon: ({ color }) => <IconUser size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="feed"
        options={{
          title: 'Feed',
          tabBarIcon: ({ color }) => <IconLayoutGrid size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="start"
        options={{
          title: 'Start',
          tabBarIcon: ({ color }) => <IconWalk size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
