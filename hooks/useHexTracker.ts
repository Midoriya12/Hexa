// useHexTracker — the live capture loop for an active walk. While `active`, it watches the
// foreground GPS, figures out which hex you're standing in, runs a level-scaled dwell timer
// (you just have to stay IN the hex, not stand still — patch #39), and auto-calls capture_hex
// when the dwell completes. On success it flips the hex to 'you' on the shared map store and
// refreshes your stats. Foreground only (Phase 9 adds background); deeper anti-cheat is Phase 8.
import { useEffect, useRef, useState } from 'react';
import * as Location from 'expo-location';
import { latLngToCell } from 'h3-js';

import { captureHex } from '@/lib/capture';
import { fetchOwnUser } from '@/lib/supabase/auth';
import { useHexStore } from '@/stores/hexStore';
import { useUserStore } from '@/stores/userStore';

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
  message: string;
}

export function useHexTracker(active: boolean): TrackState {
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const ownerOf = useHexStore((s) => s.ownerOf);
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
    message: '',
  });

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const hexRef = useRef<string | null>(null);
  const dwellStartRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const countRef = useRef(0);

  useEffect(() => {
    if (!active) {
      hexRef.current = null;
      dwellStartRef.current = null;
      coordsRef.current = null;
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

          let h3: string;
          try {
            h3 = latLngToCell(latitude, longitude, 10);
          } catch {
            return;
          }
          const owner = ownerOf(h3);

          if (owner === undefined) {
            hexRef.current = null;
            dwellStartRef.current = null;
            setState((s) => ({ ...s, status: 'no_hex', accuracy, currentHex: null, dwellProgress: 0, message: 'Walk into a hex to capture it.' }));
            return;
          }
          if (owner === 'you') {
            hexRef.current = null;
            dwellStartRef.current = null;
            setState((s) => ({ ...s, status: 'owned', accuracy, currentHex: h3, dwellProgress: 0, message: 'You already hold this hex.' }));
            return;
          }
          // Capturable ('none' or 'other'): start/continue the dwell.
          if (hexRef.current !== h3) {
            hexRef.current = h3;
            dwellStartRef.current = Date.now();
            setState((s) => ({ ...s, status: 'dwelling', accuracy, currentHex: h3, dwellProgress: 0, message: 'Hold this hex…' }));
          } else {
            setState((s) => ({ ...s, accuracy, currentHex: h3 }));
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
        const res = await captureHex(coords.lat, coords.lng);
        if (cancelled) {
          capturingRef.current = false;
          return;
        }
        if (res.ok) {
          setOwner(h3, 'you');
          countRef.current += 1;
          hexRef.current = null;
          dwellStartRef.current = null;
          setState((s) => ({
            ...s,
            status: 'captured',
            currentHex: h3,
            dwellProgress: 0,
            capturedCount: countRef.current,
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
          // Reset the dwell so it can retry; cooldown waits for the next hex.
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
  }, [active, dwellMs, myId, ownerOf, setOwner, setUser]);

  return { ...state, dwellSec };
}
