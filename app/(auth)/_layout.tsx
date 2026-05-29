// Auth flow stack. Header hidden; horizontal slide forward/back (design spec §4.2).
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: '#0A0A0A' }, // ink.50
      }}
    />
  );
}
