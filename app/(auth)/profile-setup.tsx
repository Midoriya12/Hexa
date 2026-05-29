// Profile Setup — design spec §6.5. 3 steps, no back across steps.
// Step 1 Identity (username + display name), Step 2 Location (pincode), Step 3 Play depth.
// GPS auto-detect deferred to Phase 3 (patch #29) — manual pincode selection only.
import { useState } from 'react';
import { FlatList, Modal, Pressable, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { Button, Card, Spinner } from '@/components/ui';
import { supabase } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/userStore';
import { BANGALORE_PINCODES, NEIGHBOURHOODS, pincodeLabel } from '@/lib/utils/bangalore';
import { colors } from '@/theme';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';
type PlayDepth = 'walking' | 'competing' | 'conquering';

const PLAY_DEPTHS: { key: PlayDepth; title: string; body: string }[] = [
  { key: 'walking', title: 'Just walking', body: 'I want to explore and capture casually. Show me a clean map.' },
  { key: 'competing', title: 'Competing', body: 'I want leaderboards, streaks, and friend rivalries.' },
  { key: 'conquering', title: 'Conquering', body: 'Give me everything — clans, medals, paths, the deep end.' },
];

export default function ProfileSetupScreen() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [pincode, setPincode] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [playDepth, setPlayDepth] = useState<PlayDepth | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const checkUsername = async () => {
    const u = username.trim();
    if (u.length < 3 || u.length > 20 || !USERNAME_RE.test(u)) {
      setUsernameStatus('invalid');
      return;
    }
    setUsernameStatus('checking');
    try {
      const { data } = await supabase.from('public_users').select('id').eq('username', u).maybeSingle();
      setUsernameStatus(data ? 'taken' : 'available');
    } catch {
      setUsernameStatus('idle');
    }
  };

  const step1Valid = usernameStatus === 'available' && displayName.trim().length > 0;

  const submit = async () => {
    if (!playDepth) return;
    setSubmitting(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      const id = auth.user?.id;
      if (!id || !auth.user?.phone) throw new Error('No authenticated user');
      const { data, error } = await supabase
        .from('users')
        .insert({
          id,
          phone: `+${auth.user.phone}`,
          username: username.trim(),
          display_name: displayName.trim(),
          pincode,
          home_neighbourhood: NEIGHBOURHOODS[pincode] ?? null,
          language_pref: 'en',
          flags: { play_depth: playDepth },
        })
        .select()
        .single();
      if (error) throw error;
      setUser(data);
      router.replace('/(auth)/permissions');
    } catch {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
      <View className="flex-1 px-4 pt-6">
        <Text className="mb-8 text-label-sm uppercase text-ink-600">Step {step} of 3</Text>

        {step === 1 ? (
          <View className="flex-1">
            <Text className="text-display-sm text-ink-900">Pick a username</Text>
            <Text className="mt-3 text-body-md text-ink-700">
              This is what others will see when you capture or steal hexes.
            </Text>

            <View className="mt-8 flex-row items-center rounded-md border border-ink-400 bg-ink-200 px-4">
              <Text className="text-body-lg text-ink-600">@</Text>
              <TextInput
                value={username}
                onChangeText={(t) => {
                  setUsername(t);
                  setUsernameStatus('idle');
                }}
                onBlur={checkUsername}
                placeholder="rohit_walks_bangalore"
                placeholderTextColor={colors.ink[600]}
                autoCapitalize="none"
                autoCorrect={false}
                className="ml-1 h-[52px] flex-1 text-body-lg text-ink-900"
              />
              {usernameStatus === 'checking' ? <Spinner /> : null}
              {usernameStatus === 'available' ? <Text className="text-body-md text-success">✓</Text> : null}
            </View>
            {usernameStatus === 'taken' ? (
              <Text className="mt-2 text-body-sm text-danger">That username is already taken</Text>
            ) : usernameStatus === 'invalid' ? (
              <Text className="mt-2 text-body-sm text-danger">3–20 letters, numbers or underscores</Text>
            ) : (
              <Text className="mt-2 text-body-sm text-ink-600">You can change this later in Settings.</Text>
            )}

            <Text className="mt-6 mb-2 text-label-md text-ink-700">Display name</Text>
            <TextInput
              value={displayName}
              onChangeText={setDisplayName}
              placeholder="Rohit"
              placeholderTextColor={colors.ink[600]}
              className="h-[52px] rounded-md border border-ink-400 bg-ink-200 px-4 text-body-lg text-ink-900"
            />

            <View className="flex-1" />
            <Button label="Continue" onPress={() => setStep(2)} disabled={!step1Valid} />
          </View>
        ) : step === 2 ? (
          <View className="flex-1">
            <Text className="text-display-sm text-ink-900">Where do you live?</Text>
            <Text className="mt-3 text-body-md text-ink-700">
              We&apos;ll show you the leaderboard for your neighbourhood first.
            </Text>

            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerOpen(true)}
              className="mt-8 h-[52px] justify-center rounded-md border border-ink-400 bg-ink-200 px-4"
            >
              <Text className={`text-body-lg ${pincode ? 'text-ink-900' : 'text-ink-600'}`}>
                {pincode ? pincodeLabel(pincode) : 'Select your pincode'}
              </Text>
            </Pressable>

            <View className="flex-1" />
            <Button label="Continue" onPress={() => setStep(3)} disabled={!pincode} />

            <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
              <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
                <View className="h-14 flex-row items-center justify-between px-4">
                  <Text className="text-heading-md text-ink-900">Select pincode</Text>
                  <Text className="text-body-md text-saffron-600" onPress={() => setPickerOpen(false)}>
                    Close
                  </Text>
                </View>
                <FlatList
                  data={BANGALORE_PINCODES}
                  keyExtractor={(p) => p}
                  initialNumToRender={20}
                  renderItem={({ item }) => (
                    <Pressable
                      accessibilityRole="button"
                      onPress={() => {
                        setPincode(item);
                        setPickerOpen(false);
                      }}
                      className="border-b border-ink-300 px-4 py-4"
                    >
                      <Text className="text-body-lg text-ink-900">{pincodeLabel(item)}</Text>
                    </Pressable>
                  )}
                />
              </SafeAreaView>
            </Modal>
          </View>
        ) : (
          <View className="flex-1">
            <Text className="text-display-sm text-ink-900">How do you want to play?</Text>
            <Text className="mt-3 text-body-md text-ink-700">
              We&apos;ll tune the app to your style. Change anytime.
            </Text>

            <View className="mt-8 gap-3">
              {PLAY_DEPTHS.map((opt) => {
                const selected = playDepth === opt.key;
                return (
                  <Card
                    key={opt.key}
                    onPress={() => setPlayDepth(opt.key)}
                    className={selected ? 'border-2 border-saffron-600' : ''}
                  >
                    <Text className={`text-heading-sm ${selected ? 'text-saffron-600' : 'text-ink-900'}`}>
                      {opt.title}
                    </Text>
                    <Text className="mt-1 text-body-sm text-ink-700">{opt.body}</Text>
                  </Card>
                );
              })}
            </View>

            <View className="flex-1" />
            <Button label="Start playing" onPress={submit} disabled={!playDepth} loading={submitting} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}
