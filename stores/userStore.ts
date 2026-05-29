// userStore — current user profile + auth status (Zustand + MMKV persist).
// The profile is cached in MMKV so the app can render immediately on cold start
// while the session is restored (acceptance: state persists across restarts).
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

import { storage } from '@/lib/supabase/client';
import { signOut as authSignOut } from '@/lib/supabase/auth';
import type { UserRow } from '@/types/database';

interface UserState {
  user: UserRow | null;
  isLoading: boolean;
  setUser: (user: UserRow | null) => void;
  setLoading: (isLoading: boolean) => void;
  signOut: () => Promise<void>;
}

// Zustand persist storage backed by the shared MMKV instance (own 'us:' namespace,
// distinct from the Supabase session's 'sb:' keys in the same MMKV file).
const mmkvJSONStorage = {
  getItem: (name: string): string | null => storage.getString('us:' + name) ?? null,
  setItem: (name: string, value: string): void => storage.set('us:' + name, value),
  removeItem: (name: string): void => {
    storage.remove('us:' + name); // v4: delete() -> remove() (returns boolean; discard)
  },
};

export const useUserStore = create<UserState>()(
  persist(
    (set) => ({
      user: null,
      isLoading: false,
      setUser: (user) => set({ user }),
      setLoading: (isLoading) => set({ isLoading }),
      signOut: async () => {
        await authSignOut();
        set({ user: null });
      },
    }),
    {
      name: 'user-store',
      storage: createJSONStorage(() => mmkvJSONStorage),
      // Persist only the profile; isLoading is ephemeral.
      partialize: (state) => ({ user: state.user }),
    },
  ),
);
