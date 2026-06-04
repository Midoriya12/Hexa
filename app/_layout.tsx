import { useFonts } from 'expo-font';
import { Stack, useRouter, useSegments, type Href } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState } from 'react';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import type { Session } from '@supabase/supabase-js';
import 'react-native-reanimated';

import '../global.css';

import { supabase } from '@/lib/supabase/client';
import { fetchOwnUser, getSession, isProfileComplete } from '@/lib/supabase/auth';
import { useUserStore } from '@/stores/userStore';
import { useHexStore } from '@/stores/hexStore';
import { useNotificationStore } from '@/stores/notificationStore';
import { initSentry, Sentry } from '@/lib/sentry';

export {
  // expo-router renders this on a navigation-tree error; Sentry's global handler
  // captures the underlying exception.
  ErrorBoundary,
} from 'expo-router';

// Install the global error/crash handler as early as possible.
initSentry();

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
      } catch (err) {
        // Boot must not hang on a transient auth/network error; report and fall
        // through to ready with no session.
        Sentry.captureException(err);
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
        } catch (err) {
          Sentry.captureException(err); // profile fetch retried on next navigation
        }
      } else {
        setUser(null);
        useHexStore.getState().reset(); // drop the previous account's hex ownership
        useNotificationStore.getState().reset(); // and its unread badge
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
    const onBanned = (segments[0] as string) === 'banned';
    const complete = isProfileComplete(user);
    // Phase 8: a banned account is locked out everywhere. Checked FIRST. An expired temp-ban
    // (banned_until in the past) auto-clears here on the next fetchOwnUser, leaving the ban screen.
    const banned =
      !!user &&
      (user.banned_permanently === true ||
        (user.banned_until != null && new Date(user.banned_until).getTime() > Date.now()));

    if (session && banned) {
      if (!onBanned) router.replace('/banned' as Href);
      return;
    }
    if (onBanned) {
      // Not (or no longer) banned but sitting on the ban screen → send them where they belong.
      router.replace(session && complete ? '/(tabs)' : '/(auth)/phone');
      return;
    }

    if (!session && !inAuthGroup) {
      router.replace('/(auth)/phone');
    } else if (session && !complete && !inAuthGroup) {
      router.replace('/(auth)/profile-setup');
    } else if (session && complete && inAuthGroup && onEntryScreen) {
      router.replace('/(tabs)');
    }
  }, [ready, session, user, segments, router]);
}

function RootLayout() {
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
    <GestureHandlerRootView style={{ flex: 1 }}>
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0A0A0A' } }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="banned" options={{ gestureEnabled: false }} />
      </Stack>
    </GestureHandlerRootView>
  );
}

// Sentry.wrap adds routing + error-boundary instrumentation around the root.
export default Sentry.wrap(RootLayout);
