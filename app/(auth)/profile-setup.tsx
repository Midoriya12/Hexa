// Profile Setup — faithful to INTVL 28 "Profile — Edit" (dark, header + Done,
// centered avatar + pencil, labelled fields, "Terra colour" swatch row), saffron.
// Single screen (replaces the 3-step wizard) per the INTVL blueprint. Keeps username
// uniqueness check + home-location entry + writes the users row.
//
// The location field is region-driven (config/region.json via lib/config/region):
//   • mode 'zip'  — free-text code entry (US ZIP), validated by the region's pattern.
//   • mode 'list' — pick-from-list modal (e.g. Bangalore pincodes).
// The DB column is still `users.pincode` (a generic area code); no schema change.
import { useState } from 'react';
import { FlatList, Modal, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { IconPencil } from '@/components/ui/Icon';
import { useRouter } from 'expo-router';

import { Avatar, Button, SubToggle } from '@/components/ui';
import { supabase } from '@/lib/supabase/client';
import { useUserStore } from '@/stores/userStore';
import {
  region,
  isValidLocationCode,
  locationLabel,
  neighbourhoodFor,
  LOCATION_OPTIONS,
} from '@/lib/config/region';
import { colors } from '@/theme';

const USERNAME_RE = /^[a-zA-Z0-9_]+$/;
type UsernameStatus = 'idle' | 'checking' | 'available' | 'taken' | 'invalid';

const PLAY_DEPTHS = ['Just walking', 'Competing', 'Conquering'] as const;
const PLAY_KEYS: Record<string, string> = {
  'Just walking': 'walking',
  Competing: 'competing',
  Conquering: 'conquering',
};

// The 8 player/hex colours (design spec §2.1).
const HEX_COLOURS = Object.entries(colors.player) as [string, string][];

// Labelled field in the INTVL profile-edit style: small grey label over the value input.
function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View className="mb-4">
      <Text className="mb-1 text-label-sm uppercase text-ink-600" style={{ letterSpacing: 0.5 }}>
        {label}
      </Text>
      {children}
    </View>
  );
}

export default function ProfileSetupScreen() {
  const router = useRouter();
  const setUser = useUserStore((s) => s.setUser);

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [usernameStatus, setUsernameStatus] = useState<UsernameStatus>('idle');
  const [locationCode, setLocationCode] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [hexColour, setHexColour] = useState<string>(colors.player.saffron);
  const [playDepth, setPlayDepth] = useState<string>('Competing');
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

  const locationValid = isValidLocationCode(locationCode);
  const valid = usernameStatus === 'available' && displayName.trim().length > 0 && locationValid;

  const submit = async () => {
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
          pincode: locationCode.trim(),
          home_neighbourhood: neighbourhoodFor(locationCode.trim()),
          hex_colour: hexColour,
          language_pref: 'en',
          flags: { play_depth: PLAY_KEYS[playDepth] },
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
      {/* Header: title + Done */}
      <View className="h-14 flex-row items-center justify-center">
        <Text className="text-heading-md text-ink-900">Set up your profile</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 24 }}>
        {/* Avatar + edit pencil */}
        <View className="mb-6 items-center">
          <View>
            <Avatar size={96} name={displayName || username || undefined} />
            <View className="absolute bottom-0 right-0 h-8 w-8 items-center justify-center rounded-full border-2 border-ink-50 bg-saffron-600">
              <IconPencil size={16} color={colors.ink[50]} strokeWidth={2} />
            </View>
          </View>
        </View>

        <Field label="Username">
          <View
            className={`flex-row items-center rounded-md border bg-ink-200 px-4 ${
              usernameStatus === 'taken' || usernameStatus === 'invalid' ? 'border-danger' : 'border-ink-400'
            }`}
          >
            <Text className="text-body-lg text-ink-600">@</Text>
            <TextInput
              value={username}
              onChangeText={(t) => {
                setUsername(t);
                setUsernameStatus('idle');
              }}
              onBlur={checkUsername}
              placeholder="the_king_charan"
              placeholderTextColor={colors.ink[600]}
              autoCapitalize="none"
              autoCorrect={false}
              className="ml-1 h-[52px] flex-1 text-body-lg text-ink-900"
            />
            {usernameStatus === 'available' ? <Text className="text-body-md text-success">✓</Text> : null}
            {usernameStatus === 'checking' ? <Text className="text-body-sm text-ink-600">…</Text> : null}
          </View>
          {usernameStatus === 'taken' ? (
            <Text className="mt-1 text-body-sm text-danger">That username is taken</Text>
          ) : usernameStatus === 'invalid' ? (
            <Text className="mt-1 text-body-sm text-danger">3–20 letters, numbers or underscores</Text>
          ) : null}
        </Field>

        <Field label="Display name">
          <TextInput
            value={displayName}
            onChangeText={setDisplayName}
            placeholder="Charan"
            placeholderTextColor={colors.ink[600]}
            className="h-[52px] rounded-md border border-ink-400 bg-ink-200 px-4 text-body-lg text-ink-900"
          />
        </Field>

        <Field label={region.location.label}>
          {region.location.mode === 'list' ? (
            <Pressable
              accessibilityRole="button"
              onPress={() => setPickerOpen(true)}
              className="h-[52px] justify-center rounded-md border border-ink-400 bg-ink-200 px-4"
            >
              <Text className={`text-body-lg ${locationCode ? 'text-ink-900' : 'text-ink-600'}`}>
                {locationCode ? locationLabel(locationCode) : `Select your ${region.location.term}`}
              </Text>
            </Pressable>
          ) : (
            <>
              <View
                className={`flex-row items-center rounded-md border bg-ink-200 px-4 ${
                  locationCode.length > 0 && !locationValid ? 'border-danger' : 'border-ink-400'
                }`}
              >
                <TextInput
                  value={locationCode}
                  onChangeText={(t) => setLocationCode(t.replace(/[^0-9]/g, '').slice(0, 5))}
                  placeholder={region.location.placeholder}
                  placeholderTextColor={colors.ink[600]}
                  keyboardType="number-pad"
                  className="h-[52px] flex-1 text-body-lg text-ink-900"
                />
                {locationValid ? <Text className="text-body-md text-success">✓</Text> : null}
              </View>
              {locationCode.length > 0 && !locationValid ? (
                <Text className="mt-1 text-body-sm text-danger">{region.location.invalidHint}</Text>
              ) : locationValid && neighbourhoodFor(locationCode) ? (
                <Text className="mt-1 text-body-sm text-ink-600">{locationLabel(locationCode)}</Text>
              ) : null}
            </>
          )}
        </Field>

        {/* Hex colour swatches (INTVL "Terra colour") */}
        <Field label="Hex colour">
          <View className="flex-row flex-wrap gap-3">
            {HEX_COLOURS.map(([name, hex]) => {
              const selected = hexColour === hex;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="button"
                  accessibilityLabel={`Hex colour ${name}`}
                  onPress={() => setHexColour(hex)}
                  className={`h-11 w-11 items-center justify-center rounded-full ${
                    selected ? 'border-2 border-saffron-600' : ''
                  }`}
                >
                  <View style={{ backgroundColor: hex }} className="h-8 w-8 rounded-full" />
                </Pressable>
              );
            })}
          </View>
        </Field>

        {/* Play depth */}
        <Field label="How you'll play">
          <SubToggle options={[...PLAY_DEPTHS]} value={playDepth} onChange={setPlayDepth} />
        </Field>

        <View className="mt-4">
          <Button label="Start playing" size="lg" onPress={submit} disabled={!valid} loading={submitting} />
        </View>
      </ScrollView>

      {region.location.mode === 'list' ? (
        <Modal visible={pickerOpen} animationType="slide" onRequestClose={() => setPickerOpen(false)}>
          <SafeAreaView edges={['top', 'bottom']} className="flex-1 bg-ink-50">
            <View className="h-14 flex-row items-center justify-between px-4">
              <Text className="text-heading-md text-ink-900">Select {region.location.term}</Text>
              <Text className="text-body-md text-saffron-600" onPress={() => setPickerOpen(false)}>
                Close
              </Text>
            </View>
            <FlatList
              data={LOCATION_OPTIONS}
              keyExtractor={(p) => p}
              initialNumToRender={20}
              renderItem={({ item }) => (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => {
                    setLocationCode(item);
                    setPickerOpen(false);
                  }}
                  className="border-b border-ink-300 px-4 py-4"
                >
                  <Text className="text-body-lg text-ink-900">{locationLabel(item)}</Text>
                </Pressable>
              )}
            />
          </SafeAreaView>
        </Modal>
      ) : null}
    </SafeAreaView>
  );
}
