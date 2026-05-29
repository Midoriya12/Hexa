import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import '../global.css';

import { supabase } from '@/lib/supabase/client';
import { fetchOwnUser, getSession, isProfileComplete } from '@/lib/supabase/auth';
import { useUserStore } from '@/stores/userStore';

export {
  // Catch errors thrown in the navigation tree (routed to Sentry in the observability task).
  ErrorBoundary,
} from 'expo-router';

// Keep the splash up until session bootstrap + fonts are ready.
SplashScreen.preventAutoHideAsync();

/**
 * Restore the Supabase session on cold start, hydrate the profile row, and keep
 * both in sync on sign-in / sign-out. Returns the session + a `ready` flag.
 */
function useSessionBootstrap() {
  const setUser = useUserStore((s) => s.setUser);
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        const current = await getSession();
        if (!mounted) return;
        setSession(current);
        if (current) {
          const row = await fetchOwnUser(current.user.id);
          if (mounted) setUser(row);
        }
      } catch {
        // Boot must not hang on a transient auth/network error; Sentry capture is
        // added in the observability task. Fall through to ready with no session.
      } finally {
        if (mounted) setReady(true);
      }
    })();

    const { data } = supabase.auth.onAuthStateChange(async (_event, next) => {
      if (!mounted) return;
      setSession(next);
      if (next) {
        try {
          setUser(await fetchOwnUser(next.user.id));
        } catch {
          /* profile fetch retried on next navigation */
        }
      } else {
        setUser(null);
      }
    });

    return () => {
      mounted = false;
      data.subscription.unsubscribe();
    };
  }, [setUser]);

  return { session, ready };
}

/**
 * Auth guard. Protects (tabs) from unauthenticated/incomplete users and bounces
 * fully-onboarded users off the entry screens. Forward navigation within the auth
 * flow (otp -> onboarding -> profile-setup -> permissions -> tabs) is driven by the
 * screens themselves; the guard only corrects mismatches on cold start / sign-out.
 */
function useAuthGuard(session: Session | null, ready: boolean) {
  const segments = useSegments();
  const router = useRouter();
  const user = useUserStore((s) => s.user);

  useEffect(() => {
    if (!ready) return;
    const inAuthGroup = segments[0] === '(auth)';
    const onEntryScreen = segments[1] === 'phone' || segments[1] === 'otp';
    const complete = isProfileComplete(user);

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/phone');
    } else if (session && !complete && !inAuthGroup) {
      router.replace('/(auth)/profile-setup');
    } else if (session && complete && inAuthGroup && onEntryScreen) {
      router.replace('/(tabs)');
    }
  }, [ready, session, user, segments, router]);
}

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
  });
  const { session, ready } = useSessionBootstrap();

  useEffect(() => {
    if (fontsLoaded && ready) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded, ready]);

  useAuthGuard(session, ready);

  if (!fontsLoaded || !ready) {
    return null;
  }

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(tabs)" />
    </Stack>
  );
}
