// Hex grid + ownership state, shared across the Play and Start maps (and the capture tracker),
// so a capture updates every map instantly without a full refetch. Backed by zustand (same as
// userStore). The grid is fetched once per session; setOwner flips a single hex optimistically.
import { create } from 'zustand';

import { fetchHexes, type HexCollection, type HexFeatureProps } from '@/lib/supabase/hexes';

type Owner = HexFeatureProps['owner'];

interface HexState {
  fc: HexCollection | null;
  loading: boolean;
  /** Whose ownership the current `fc` was computed for (null = signed out / unloaded). */
  loadedFor: string | null;
  /** Load the grid + ownership. No-op only when already loaded FOR THE SAME user (unless force);
   *  a different user (e.g. after switching accounts) forces a refetch so 'you'/'other' is correct. */
  load: (myId: string | null, force?: boolean) => Promise<void>;
  /** Optimistically set one hex's owner (e.g. to 'you' right after a capture). */
  setOwner: (h3: string, owner: Owner) => void;
  /** Owner of a hex, or undefined if it isn't a playable hex. */
  ownerOf: (h3: string) => Owner | undefined;
  /** Clear all hex state (call on sign-out so the next account never sees stale ownership). */
  reset: () => void;
}

export const useHexStore = create<HexState>((set, get) => ({
  fc: null,
  loading: false,
  loadedFor: null,
  load: async (myId, force = false) => {
    const st = get();
    if (st.loading) return;
    // Reload when the grid is for a DIFFERENT user — otherwise account A's hexes would stay
    // flagged 'you' and render in account B's colour. Same user + already loaded = no-op.
    if (st.fc && st.loadedFor === myId && !force) return;
    set({ loading: true });
    try {
      const fc = await fetchHexes(myId);
      set({ fc, loading: false, loadedFor: myId });
    } catch {
      set({ loading: false }); // map renders without the grid; tracker simply finds no hexes
    }
  },
  setOwner: (h3, owner) => {
    const fc = get().fc;
    if (!fc) return;
    const features = fc.features.map((f) =>
      f.properties.h3 === h3 ? { ...f, properties: { ...f.properties, owner } } : f,
    );
    set({ fc: { type: 'FeatureCollection', features } });
  },
  ownerOf: (h3) => get().fc?.features.find((f) => f.properties.h3 === h3)?.properties.owner,
  reset: () => set({ fc: null, loading: false, loadedFor: null }),
}));
