// Bottom tab bar — design spec §3.9 / §4.1. 4 tabs: Map / Leaderboard / Friends /
// Profile. Map uses the custom hex icon; the rest use Tabler. Saffron active tint,
// ink-700 inactive, dark translucent bar. (True frosted blur needs expo-blur — a
// later polish; a solid dark bar approximates glass.blur for now.)
import { Tabs } from 'expo-router';
import { IconTrophy, IconUser, IconUsers } from '@tabler/icons-react-native';

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
          borderTopColor: colors.ink[400],
          borderTopWidth: 1,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' },
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
          title: 'Leaderboard',
          tabBarIcon: ({ color }) => <IconTrophy size={24} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="friends"
        options={{
          title: 'Friends',
          tabBarIcon: ({ color }) => <IconUsers size={24} color={color} strokeWidth={1.75} />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          tabBarIcon: ({ color }) => <IconUser size={24} color={color} strokeWidth={1.75} />,
        }}
      />
    </Tabs>
  );
}
