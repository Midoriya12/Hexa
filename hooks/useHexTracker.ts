// useHexTracker — the live capture loop for an active walk. While `active`, it watches the
// foreground GPS, resolves which hex you're standing in from the in-memory grid (nearest cell
// centre — H3 cells are ~Voronoi cells of their centres, so this is the containing cell), runs
// a level-scaled dwell timer (you just stay IN the hex — patch #39), and auto-calls capture_hex
// when the dwell completes. On success it flips the hex to 'you' on the shared map store and
// refreshes your stats. Foreground only (Phase 9 adds background); anti-cheat is Phase 8.
//
// h3-js is intentionally NOT imported here (it crashes Hermes via TextDecoder utf-16le); the
// server still validates point-in-polygon against the true cell boundary.
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';

import { captureHex } from '@/lib/capture';
import { fetchOwnUser } from '@/lib/supabase/auth';
import { useHexStore } from '@/stores/hexStore';
import { useUserStore } from '@/stores/userStore';
import type { HexFeatureProps } from '@/lib/supabase/hexes';

export type TrackStatus =
  | 'idle'
  | 'locating'
  | 'low_accuracy'
  | 'denied'
  | 'no_hex'
  | 'dwelling'
  | 'capturing'
  | 'captured'
  | 'owned'
  | 'error';

export interface TrackState {
  status: TrackStatus;
  currentHex: string | null;
  accuracy: number | null;
  dwellProgress: number; // 0..1
  dwellSec: number;
  capturedCount: number;
  distanceM: number;
  /** Set on each successful capture (drives the success card); cleared on a new session. */
  lastCapture: { ip: number; pph: number; h3: string; nonce: number } | null;
  message: string;
}

const EARTH_M_PER_DEG = 111_320;
const HEX_REACH_M = 80; // res-10 circumradius ~75m + a little slack
const FLAT_PPH = 3; // common-hex rent/hr (rarity tiers + the hourly engine come in Phase 5)

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Nearest playable cell to a GPS point (its containing hex), or null if none within reach. */
function nearestHex(lat: number, lng: number): { h3: string; owner: HexFeatureProps['owner'] } | null {
  const fc = useHexStore.getState().fc;
  if (!fc) return null;
  const cosLat = Math.cos((lat * Math.PI) / 180);
  let best: HexFeatureProps | null = null;
  let bestD = Infinity;
  for (const f of fc.features) {
    const dLat = f.properties.clat - lat;
    const dLng = (f.properties.clng - lng) * cosLat;
    const d = dLat * dLat + dLng * dLng;
    if (d < bestD) {
      bestD = d;
      best = f.properties;
    }
  }
  if (!best) return null;
  const distM = Math.sqrt(bestD) * EARTH_M_PER_DEG;
  if (distM > HEX_REACH_M) return null;
  return { h3: best.h3, owner: best.owner };
}

export function useHexTracker(active: boolean, sessionKey: number): TrackState {
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const setOwner = useHexStore((s) => s.setOwner);

  // Level-scaled dwell: 60s at L1 → 20s floor (patch #39).
  const level = user?.level ?? 1;
  const dwellSec = Math.max(20, 60 - (level - 1) * 5);
  const dwellMs = dwellSec * 1000;
  const myId = user?.id ?? null;

  const [state, setState] = useState<TrackState>({
    status: 'idle',
    currentHex: null,
    accuracy: null,
    dwellProgress: 0,
    dwellSec,
    capturedCount: 0,
    distanceM: 0,
    lastCapture: null,
    message: '',
  });

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastFixRef = useRef<{ lat: number; lng: number } | null>(null);
  const hexRef = useRef<string | null>(null);
  const dwellStartRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const countRef = useRef(0);
  const distanceRef = useRef(0);
  const captureNonceRef = useRef(0);

  // New session (a fresh Start, not a pause/resume) → zero the counters.
  useEffect(() => {
    countRef.current = 0;
    distanceRef.current = 0;
    lastFixRef.current = null;
    setState((s) => ({ ...s, capturedCount: 0, distanceM: 0, lastCapture: null }));
  }, [sessionKey]);

  useEffect(() => {
    if (!active) {
      hexRef.current = null;
      dwellStartRef.current = null;
      coordsRef.current = null;
      lastFixRef.current = null; // so resume doesn't count a phantom step from the pause point
      setState((s) => ({ ...s, status: 'idle', currentHex: null, dwellProgress: 0, message: '' }));
      return;
    }

    let cancelled = false;
    let sub: Location.LocationSubscription | undefined;
    let interval: ReturnType<typeof setInterval> | undefined;

    (async () => {
      const perm = await Location.requestForegroundPermissionsAsync();
      if (cancelled) return;
      if (!perm.granted) {
        setState((s) => ({ ...s, status: 'denied', message: 'Location access is needed to capture hexes.' }));
        return;
      }
      setState((s) => ({ ...s, status: 'locating', message: 'Getting your location…' }));

      sub = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.Highest,
          distanceInterval: 4,
          timeInterval: 2000,
          mayShowUserSettingsDialog: true,
        },
        (loc) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy } = loc.coords;
          if (accuracy == null || accuracy > 25) {
            setState((s) => ({ ...s, status: 'low_accuracy', accuracy, message: 'Improving GPS signal…' }));
            return;
          }
          coordsRef.current = { lat: latitude, lng: longitude };

          // Accumulate walk distance (ignore sub-metre noise + >50m GPS jumps).
          if (lastFixRef.current) {
            const step = haversineM(lastFixRef.current.lat, lastFixRef.current.lng, latitude, longitude);
            if (step > 1 && step < 50) {
              distanceRef.current += step;
              setState((s) => ({ ...s, distanceM: distanceRef.current }));
            }
          }
          lastFixRef.current = { lat: latitude, lng: longitude };

          const hit = nearestHex(latitude, longitude);
          if (!hit) {
            hexRef.current = null;
            dwellStartRef.current = null;
            setState((s) => ({ ...s, status: 'no_hex', accuracy, currentHex: null, dwellProgress: 0, message: 'Walk into a hex to capture it.' }));
            return;
          }
          if (hit.owner === 'you') {
            hexRef.current = null;
            dwellStartRef.current = null;
            setState((s) => ({ ...s, status: 'owned', accuracy, currentHex: hit.h3, dwellProgress: 0, message: 'You already hold this hex.' }));
            return;
          }
          // Capturable ('none' or 'other'): start/continue the dwell.
          if (hexRef.current !== hit.h3) {
            hexRef.current = hit.h3;
            dwellStartRef.current = Date.now();
            setState((s) => ({ ...s, status: 'dwelling', accuracy, currentHex: hit.h3, dwellProgress: 0, message: 'Hold this hex…' }));
          } else {
            setState((s) => ({ ...s, accuracy, currentHex: hit.h3 }));
          }
        },
        (reason) => {
          if (!cancelled) setState((s) => ({ ...s, status: 'error', message: String(reason) }));
        },
      );

      interval = setInterval(async () => {
        if (cancelled || capturingRef.current) return;
        const start = dwellStartRef.current;
        const h3 = hexRef.current;
        const coords = coordsRef.current;
        if (!start || !h3 || !coords) return;

        const progress = Math.min(1, (Date.now() - start) / dwellMs);
        if (progress < 1) {
          setState((s) => ({ ...s, status: 'dwelling', dwellProgress: progress }));
          return;
        }

        // Dwell complete → capture.
        capturingRef.current = true;
        setState((s) => ({ ...s, status: 'capturing', dwellProgress: 1, message: 'Capturing…' }));
        const res = await captureHex(h3, coords.lat, coords.lng);
        if (cancelled) {
          capturingRef.current = false;
          return;
        }
        if (res.ok) {
          setOwner(h3, 'you');
          countRef.current += 1;
          captureNonceRef.current += 1;
          hexRef.current = null;
          dwellStartRef.current = null;
          setState((s) => ({
            ...s,
            status: 'captured',
            currentHex: h3,
            dwellProgress: 0,
            capturedCount: countRef.current,
            lastCapture: { ip: res.result.ip, pph: FLAT_PPH, h3, nonce: captureNonceRef.current },
            message: `Hex captured! +${res.result.ip} pts`,
          }));
          if (myId) {
            try {
              const row = await fetchOwnUser(myId);
              if (!cancelled) setUser(row);
            } catch {
              /* stats refresh is best-effort */
            }
          }
        } else {
          dwellStartRef.current = res.error === 'cooldown' ? null : Date.now();
          const message =
            res.error === 'outside_hex'
              ? 'Move into the hex to capture.'
              : res.error === 'cooldown'
                ? 'Just captured — head to another hex.'
                : 'Capture failed — trying again.';
          setState((s) => ({ ...s, status: 'error', dwellProgress: 0, message }));
        }
        capturingRef.current = false;
      }, 250);
    })();

    return () => {
      cancelled = true;
      sub?.remove();
      if (interval) clearInterval(interval);
    };
  }, [active, dwellMs, myId, setOwner, setUser]);

  return { ...state, dwellSec };
}
