// Phase 8 — the lockout screen for a suspended/banned account. The root auth guard
// (app/_layout.tsx) redirects here whenever the signed-in user has banned_permanently = true or a
// banned_until in the future, and bounces back out the moment a temp-ban expires. There is no way
// forward from here except an appeal (email) — or signing out to switch accounts.
import { Linking, Pressable, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useUserStore } from '@/stores/userStore';
import { colors } from '@/theme';

const APPEAL_EMAIL = 'bille.sai12@gmail.com';

function formatUntil(iso: string | null): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleString('en-US', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function BannedScreen() {
  const user = useUserStore((s) => s.user);
  const signOut = useUserStore((s) => s.signOut);

  const permanent = user?.banned_permanently === true;
  const until = formatUntil(user?.banned_until ?? null);

  const headline = permanent ? 'Account banned' : 'Account suspended';
  const body = permanent
    ? 'Your account has been permanently banned for repeated cheating (impossible movement / fake GPS). If you believe this is a mistake, you can appeal.'
    : until
      ? `Your account is suspended until ${until} for movement that looked impossible for walking. It will unlock automatically — keep it fair and you're all set.`
      : 'Your account is temporarily suspended for movement that looked impossible for walking. It will unlock automatically.';

  const appeal = () => {
    const subject = encodeURIComponent('Hexa ban appeal');
    const bodyTxt = encodeURIComponent(`My account ID: ${user?.id ?? '(unknown)'}\n\nWhy I think this is a mistake:\n`);
    void Linking.openURL(`mailto:${APPEAL_EMAIL}?subject=${subject}&body=${bodyTxt}`).catch(() => undefined);
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="flex-1 items-center justify-center px-8">
        <View
          className="h-20 w-20 items-center justify-center rounded-full"
          style={{ backgroundColor: 'rgba(220,38,38,0.12)' }}
        >
          <Text style={{ fontSize: 38 }}>🚫</Text>
        </View>

        <Text className="mt-6 text-center text-display-sm text-ink-900">{headline}</Text>
        <Text className="mt-3 text-center text-body-md leading-6 text-ink-700">{body}</Text>

        <Pressable
          onPress={appeal}
          className="mt-8 w-full items-center rounded-xl bg-saffron-600 py-4"
          style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}
        >
          <Text className="text-body-md font-extrabold text-ink-50">Appeal this decision</Text>
        </Pressable>
        <Text className="mt-2 text-center text-label-sm text-ink-600">{APPEAL_EMAIL}</Text>

        <Pressable onPress={() => void signOut()} className="mt-6 py-2">
          <Text className="text-body-sm font-semibold" style={{ color: colors.ink[600] }}>
            Sign out
          </Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
