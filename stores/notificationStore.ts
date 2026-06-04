// Notification badge count, shared so the Play-header bell shows an unread number that updates
// from anywhere. Combines: incoming FRIEND requests + (officers') pending CLAN JOIN requests
// (both DERIVED from pending rows) + unread EVENTS from the notifications table (steals, level-ups).
import { create } from 'zustand';

import { listIncomingRequests } from '@/lib/supabase/friends';
import { listJoinRequests } from '@/lib/supabase/clans';
import { unreadNotificationCount } from '@/lib/supabase/notifications';

interface NotifState {
  friendCount: number;
  joinCount: number;
  eventCount: number;
  total: number;
  /** Recompute counts. `canManageJoins` gates the (officer-only) clan join requests. */
  refresh: (canManageJoins: boolean) => Promise<void>;
  /** Clear on sign-out so the next account starts at zero. */
  reset: () => void;
}

export const useNotificationStore = create<NotifState>((set) => ({
  friendCount: 0,
  joinCount: 0,
  eventCount: 0,
  total: 0,
  refresh: async (canManageJoins) => {
    const [fr, jr, ev] = await Promise.all([
      listIncomingRequests().catch(() => []),
      canManageJoins ? listJoinRequests().catch(() => []) : Promise.resolve([]),
      unreadNotificationCount().catch(() => 0),
    ]);
    set({ friendCount: fr.length, joinCount: jr.length, eventCount: ev, total: fr.length + jr.length + ev });
  },
  reset: () => set({ friendCount: 0, joinCount: 0, eventCount: 0, total: 0 }),
}));
