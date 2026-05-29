// Supabase client — single instance for the app.
// Session is persisted in MMKV (fast, synchronous, native) so it survives restarts
// (acceptance: "Auth state persists across app restarts"). The same MMKV instance
// backs userStore, under a separate key namespace.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { createMMKV } from 'react-native-mmkv';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than producing a misconfigured client.
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY in the environment (.env.local).',
  );
}

// Shared MMKV instance for all persisted app state.
// react-native-mmkv v4 (Nitro) creates instances via the createMMKV() factory.
export const storage = createMMKV({ id: 'hexa' });

// supabase-js expects an async Storage-like adapter; MMKV is synchronous so we wrap
// each call in a resolved promise. Keys are prefixed to keep the auth session distinct
// from userStore's persisted slice in the same MMKV file.
const SESSION_PREFIX = 'sb:';

const mmkvAuthStorage = {
  getItem: (key: string): Promise<string | null> =>
    Promise.resolve(storage.getString(SESSION_PREFIX + key) ?? null),
  setItem: (key: string, value: string): Promise<void> => {
    storage.set(SESSION_PREFIX + key, value);
    return Promise.resolve();
  },
  removeItem: (key: string): Promise<void> => {
    storage.remove(SESSION_PREFIX + key); // v4: delete() -> remove()
    return Promise.resolve();
  },
};

export const supabase: SupabaseClient = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: mmkvAuthStorage,
    autoRefreshToken: true,
    persistSession: true,
    // No URL-based session detection on native (that's a web-only OAuth concern).
    detectSessionInUrl: false,
  },
});
