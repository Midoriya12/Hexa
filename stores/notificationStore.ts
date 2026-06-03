// Notification badge count, shared so the Play-header bell shows an unread number that updates
// from anywhere (responding to a request on the Notifications screen refreshes it). Notifications
// are DERIVED from existing pending rows (no separate table): incoming friend requests + (for
// clan officers) pending clan join requests.
import { create } from 'zustand';

import { listIncomingRequests } from '@/lib/supabase/friends';
import { listJoinRequests } from '@/lib/supabase/clans';

interface NotifState {
  friendCount: number;
  joinCount: number;
  total: number;
  /** Recompute counts. `canManageJoins` gates the (officer-only) clan join requests. */
  refresh: (canManageJoins: boolean) => Promise<void>;
  /** Clear on sign-out so the next account starts at zero. */
  reset: () => void;
}

export const useNotificationStore = create<NotifState>((set) => ({
  friendCount: 0,
  joinCount: 0,
  total: 0,
  refresh: async (canManageJoins) => {
    const [fr, jr] = await Promise.all([
      listIncomingRequests().catch(() => []),
      canManageJoins ? listJoinRequests().catch(() => []) : Promise.resolve([]),
    ]);
    set({ friendCount: fr.length, joinCount: jr.length, total: fr.length + jr.length });
  },
  reset: () => set({ friendCount: 0, joinCount: 0, total: 0 }),
}));
