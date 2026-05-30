// Bottom tab bar — 5 tabs: Map / Leaderboard / Friends / Feed / Profile.
// (Sai's call to include Feed as a tab — overrides design-spec §4.1's 4-tab plan,
// patch #31.) Map uses the custom hex icon; rest use MaterialCommunityIcons. Saffron
// active tint, ink-700 inactive. Labels shortened to fit 5 tabs on narrow phones.
import { Tabs } from 'expo-router';
import { IconLayoutGrid, IconTrophy, IconUser, IconUsers } from '@/components/ui/Icon';

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
          borderTopColor: 'rgba(61,61,61,0.5)', // ink.400 @ 50% (design spec §3.9)
          borderTopWidth: 1,
        },
        // 11px + allow-font-scaling off so 5 labels fit on small Android widths.
        tabBarLabelStyle: { fontSize: 11, fontWeight: '500' },
        tabBarAllowFontScaling: false,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Map',
          tabBarIcon: ({ color, focused }) => <HexIcon size={24} color={color} filled={focused} />,
        }}
      />
      <Tabs.Screen
        name="leaderboard"
        options={{
          title: 'Ranks',
          tabBarIcon: ({ color }) => <IconTrophy size={24} color={color} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color }) => <IconUsers size={24} color={color} />,
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
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconUser size={24} color={color} />,
        }}
      />
    </Tabs>
  );
}
