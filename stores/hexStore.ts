// Hex grid + ownership state, shared across the Play and Start maps + the capture tracker. At
// full-Bangalore scale (~85K cells) we never hold the whole grid: we WINDOW it.
//   - byId       — hexes currently loaded for the visible viewport / the walker's surroundings,
//                  fetched via the hexes_in_bbox RPC (migration 009) and evicted by distance once
//                  past CAP so memory + render cost stay bounded.
//   - ownedAlways — the hexes YOU hold, fetched bounds-independently (fetchOwnHexes) so your
//                  territory renders at EVERY zoom regardless of camera; never evicted.
//   - fc         — the derived FeatureCollection the map renders (ownedAlways overrides byId).
//                  Kept null until the first load so callers can tell "still loading" from "no hex".
// INVARIANT: exactly one HexMap is mounted at a time (useIsFocused gates it), so the single shared
// loadedBounds / eviction model is safe (Play and Start never drive loadBounds concurrently).
import { create } from 'zustand';

import {
  fetchHexesInBounds,
  fetchOwnHexes,
  type Bounds,
  type HexCollection,
  type HexFeature,
  type HexFeatureProps,
} from '@/lib/supabase/hexes';

type Owner = HexFeatureProps['owner'];

// Tuning — all sized so ONE fetch stays well under PostgREST max_rows (1000). res-10 cell ≈130m.
const MIN_FETCH_ZOOM = 12; // hexes start showing ~1 zoom level sooner (sparse grid makes it cheap)
const MAX_SPAN_DEG = 0.06; // clamp the fetched box to ~6.7 km/side; with the SPARSE grid (~3.5 hex/km²)
//                            that's only a few hundred hexes per fetch — well under max_rows — and a
//                            bigger loaded area means panning stays inside it (feels instant, fewer refetches)
const PAD = 0.15; // pad each side for pan headroom (total stays under the row cap)
const CAP = 2500; // max windowed features kept in memory (ownedAlways is separate + never evicted)
const PROX_RADIUS_DEG = 0.006; // ~660 m capture-readiness window for the walking tracker (> HEX_REACH_M=80)
const PROX_MOVE_M = 120; // re-evaluate proximity only after the user moves this far
const EARTH_M_PER_DEG = 111_320;

function pad(b: Bounds, frac: number): Bounds {
  const dLat = (b.maxLat - b.minLat) * frac;
  const dLng = (b.maxLng - b.minLng) * frac;
  return { minLat: b.minLat - dLat, maxLat: b.maxLat + dLat, minLng: b.minLng - dLng, maxLng: b.maxLng + dLng };
}
function clampSpan(b: Bounds, maxSpan: number): Bounds {
  const cLat = (b.minLat + b.maxLat) / 2;
  const cLng = (b.minLng + b.maxLng) / 2;
  const halfLat = Math.min((b.maxLat - b.minLat) / 2, maxSpan / 2);
  const halfLng = Math.min((b.maxLng - b.minLng) / 2, maxSpan / 2);
  return { minLat: cLat - halfLat, maxLat: cLat + halfLat, minLng: cLng - halfLng, maxLng: cLng + halfLng };
}
function contains(outer: Bounds, inner: Bounds): boolean {
  return (
    outer.minLat <= inner.minLat &&
    outer.maxLat >= inner.maxLat &&
    outer.minLng <= inner.minLng &&
    outer.maxLng >= inner.maxLng
  );
}
function inBox(b: Bounds, lat: number, lng: number): boolean {
  return lat >= b.minLat && lat <= b.maxLat && lng >= b.minLng && lng <= b.maxLng;
}
function boxAround(lat: number, lng: number, r: number): Bounds {
  return { minLat: lat - r, maxLat: lat + r, minLng: lng - r, maxLng: lng + r };
}
function moveM(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const dLat = (aLat - bLat) * EARTH_M_PER_DEG;
  const dLng = (aLng - bLng) * EARTH_M_PER_DEG * Math.cos((aLat * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
}

interface HexState {
  byId: Map<string, HexFeature>;
  ownedAlways: Map<string, HexFeature>;
  fc: HexCollection | null;
  loading: boolean;
  loadedFor: string | null;
  loadedBounds: Bounds | null;
  activeHex: string | null; // the tracker's current dwell cell — never evicted
  reqSeq: number; // monotonic id for stale-response drop
  lastProx: { lat: number; lng: number } | null;

  /** Load the caller's OWN hexes (bounds-independent) so territory shows at all zooms. */
  loadOwn: (myId: string | null) => Promise<void>;
  /** Load the hexes inside the map viewport (gated by zoom; merged + evicted). */
  loadBounds: (b: Bounds, zoom: number, myId: string | null) => Promise<void>;
  /** Keep the hexes around a walking position loaded (capture-readiness independent of camera). */
  ensureLoadedAround: (lat: number, lng: number, myId: string | null) => Promise<void>;
  /** Protect the dwell cell from eviction. */
  setActiveHex: (h3: string | null) => void;
  /** Optimistically flip one hex's owner (e.g. to 'you' right after a capture). */
  setOwner: (h3: string, owner: Owner) => void;
  ownerOf: (h3: string) => Owner | undefined;
  reset: () => void;
  /** Internal: fetch a box, drop stale responses, merge, evict, rebuild fc. */
  _loadBox: (box: Bounds, myId: string | null) => Promise<void>;
}

export const useHexStore = create<HexState>((set, get) => {
  // Derive fc from byId ∪ ownedAlways (ownedAlways wins, so your colour persists past eviction).
  const rebuild = () => {
    const { byId, ownedAlways } = get();
    const merged = new Map(byId);
    for (const [k, v] of ownedAlways) merged.set(k, v);
    set({ fc: { type: 'FeatureCollection', features: [...merged.values()] } });
  };

  // Detect an account switch ONCE — idempotent across loadOwn + loadBounds, which both call it and
  // can race. Claims loadedFor SYNCHRONOUSLY so the second caller sees no change and doesn't re-clear
  // (which previously wiped the new user's freshly-loaded hexes). On a real switch we blank fc so
  // stale territory never lingers; on a cold start (loadedFor was null) fc stays null so callers can
  // still tell "still loading" from "no hex here".
  const ensureUser = (myId: string | null) => {
    if (get().loadedFor === myId) return;
    const switching = get().loadedFor !== null;
    get().byId.clear();
    get().ownedAlways.clear();
    set({
      loadedFor: myId,
      loadedBounds: null,
      lastProx: null,
      ...(switching ? { fc: { type: 'FeatureCollection' as const, features: [] } } : {}),
    });
  };

  return {
    byId: new Map(),
    ownedAlways: new Map(),
    fc: null,
    loading: false,
    loadedFor: null,
    loadedBounds: null,
    activeHex: null,
    reqSeq: 0,
    lastProx: null,

    loadOwn: async (myId) => {
      if (!myId) return;
      ensureUser(myId);
      let feats: HexFeature[];
      try {
        feats = await fetchOwnHexes(myId);
      } catch {
        return; // territory will still fill in from viewport fetches
      }
      if (get().loadedFor !== myId) return; // account switched during the await — drop
      const owned = new Map<string, HexFeature>();
      for (const f of feats) owned.set(f.properties.h3, f);
      set({ ownedAlways: owned });
      if (get().fc !== null) rebuild(); // don't flip null->non-null here; the first viewport load does
    },

    _loadBox: async (box, myId) => {
      ensureUser(myId); // claims loadedFor synchronously + drops the prior account's data
      const seq = get().reqSeq + 1;
      set({ reqSeq: seq, loading: true });
      let feats: HexFeature[];
      try {
        feats = await fetchHexesInBounds(box);
      } catch {
        if (get().reqSeq === seq) set({ loading: false });
        return;
      }
      if (get().reqSeq !== seq) return; // a newer request started — drop this stale result
      if (get().loadedFor !== myId) return; // account switched during the await — drop

      const { byId, ownedAlways, activeHex } = get();
      let changed = false;
      for (const f of feats) {
        const prev = byId.get(f.properties.h3);
        if (!prev || prev.properties.owner !== f.properties.owner) changed = true;
        byId.set(f.properties.h3, f);
      }

      if (byId.size > CAP) {
        const cLat = (box.minLat + box.maxLat) / 2;
        const cLng = (box.minLng + box.maxLng) / 2;
        const victims: { h3: string; d: number }[] = [];
        for (const [h3, f] of byId) {
          if (ownedAlways.has(h3) || h3 === activeHex) continue;
          if (inBox(box, f.properties.clat, f.properties.clng)) continue; // keep what we just loaded
          const dLat = f.properties.clat - cLat;
          const dLng = f.properties.clng - cLng;
          victims.push({ h3, d: dLat * dLat + dLng * dLng });
        }
        victims.sort((a, b) => b.d - a.d); // farthest first
        let toDrop = byId.size - CAP;
        for (const v of victims) {
          if (toDrop <= 0) break;
          byId.delete(v.h3);
          toDrop--;
          changed = true;
        }
      }

      // loadedBounds tracks ONLY the last fetched box (NOT a growing union — a union rectangle would
      // falsely "contain" the never-fetched corners between two diagonal viewports and skip needed
      // fetches there, stranding the walker's cells).
      set({ loadedBounds: box, loading: false });
      if (changed || get().fc === null) rebuild(); // first load sets fc non-null even if empty
    },

    loadBounds: async (b, zoom, myId) => {
      if (zoom < MIN_FETCH_ZOOM) return;
      const box = pad(clampSpan(b, MAX_SPAN_DEG), PAD);
      const st = get();
      if (myId === st.loadedFor && st.loadedBounds && contains(st.loadedBounds, box)) return;
      await get()._loadBox(box, myId);
    },

    ensureLoadedAround: async (lat, lng, myId) => {
      if (!myId) return;
      const st = get();
      if (st.lastProx && moveM(lat, lng, st.lastProx.lat, st.lastProx.lng) < PROX_MOVE_M) return;
      const box = boxAround(lat, lng, PROX_RADIUS_DEG);
      if (myId === st.loadedFor && st.loadedBounds && contains(st.loadedBounds, box)) {
        set({ lastProx: { lat, lng } });
        return;
      }
      set({ lastProx: { lat, lng } });
      await get()._loadBox(box, myId);
    },

    setActiveHex: (h3) => set({ activeHex: h3 }),

    setOwner: (h3, owner) => {
      const { byId, ownedAlways } = get();
      const base = byId.get(h3) ?? ownedAlways.get(h3);
      if (base) {
        const next: HexFeature = { ...base, properties: { ...base.properties, owner } };
        if (byId.has(h3)) byId.set(h3, next);
        if (owner === 'you') ownedAlways.set(h3, next);
        else ownedAlways.delete(h3);
      } else if (owner !== 'you') {
        ownedAlways.delete(h3);
      }
      rebuild();
    },

    ownerOf: (h3) => get().ownedAlways.get(h3)?.properties.owner ?? get().byId.get(h3)?.properties.owner,

    reset: () =>
      set({
        byId: new Map(),
        ownedAlways: new Map(),
        fc: null,
        loading: false,
        loadedFor: null,
        loadedBounds: null,
        activeHex: null,
        lastProx: null,
      }),
  };
});
