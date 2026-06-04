// useHexTracker — the live capture loop for an active walk. While `active`, it watches the
// foreground GPS, SMOOTHS the position (EMA, with hard damping on big spikes) to calm GPS
// wiggle, resolves which hex you're standing in from the in-memory grid (nearest cell centre),
// runs a level-scaled dwell timer (you just stay IN the hex — patch #39) with boundary
// hysteresis, and auto-calls capture_hex when the dwell completes. The smoothed point drives the
// dot, distance, hex detection and capture, so everything is stable + consistent.
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
  /** Smoothed position [lat,lng] for the on-map dot + camera (null until the first good fix). */
  position: { lat: number; lng: number } | null;
  /** Set on each successful capture (drives the success card); cleared on a new session. */
  lastCapture: { ip: number; pph: number; h3: string; nonce: number; type: 'neutral' | 'steal' } | null;
  message: string;
}

const EARTH_M_PER_DEG = 111_320;
const HEX_REACH_M = 80; // res-10 circumradius ~75m + a little slack
const FLAT_PPH = 5; // rent/hr per hex (Phase 5 hourly engine; the Me dashboard reads my_rent_rate() authoritatively)
const SMOOTH_ALPHA = 0.25; // EMA weight for a normal fix
const SPIKE_M = 40; // a jump bigger than this is treated as a GPS spike and damped hard

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

/** Nearest playable cell to a point (its containing hex), or null if none within reach. */
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
  if (Math.sqrt(bestD) * EARTH_M_PER_DEG > HEX_REACH_M) return null;
  return { h3: best.h3, owner: best.owner };
}

/** Look up a hex's props by id (for dwell hysteresis). */
function getHexProps(h3: string): HexFeatureProps | null {
  const fc = useHexStore.getState().fc;
  return fc?.features.find((f) => f.properties.h3 === h3)?.properties ?? null;
}

export function useHexTracker(active: boolean, sessionKey: number): TrackState {
  const user = useUserStore((s) => s.user);
  const setUser = useUserStore((s) => s.setUser);
  const setOwner = useHexStore((s) => s.setOwner);

  // Level-scaled dwell: 60s at L1 → 20s floor by L5 (patch #39; -10s/level reaches the floor).
  const level = user?.level ?? 1;
  const dwellSec = Math.max(20, 60 - (level - 1) * 10);
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
    position: null,
    lastCapture: null,
    message: '',
  });

  const coordsRef = useRef<{ lat: number; lng: number } | null>(null);
  const smoothRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastFixRef = useRef<{ lat: number; lng: number } | null>(null);
  const hexRef = useRef<string | null>(null);
  const dwellStartRef = useRef<number | null>(null);
  const capturingRef = useRef(false);
  const countRef = useRef(0);
  const distanceRef = useRef(0);
  const captureNonceRef = useRef(0);
  // dwellMs changes when the user levels up. Read it through a ref so a level-up mid-walk (the
  // capture path calls setUser, which can change level → dwellMs) does NOT re-run the GPS-watcher
  // effect and tear down the live location subscription. The ref is kept fresh by the effect below.
  const dwellMsRef = useRef(dwellMs);

  // New session (a fresh Start, not a pause/resume) → zero the counters + smoothing.
  useEffect(() => {
    countRef.current = 0;
    distanceRef.current = 0;
    lastFixRef.current = null;
    smoothRef.current = null;
    setState((s) => ({ ...s, capturedCount: 0, distanceM: 0, lastCapture: null, position: null }));
  }, [sessionKey]);

  // Keep the dwell duration fresh without restarting the GPS watcher when the level changes.
  useEffect(() => {
    dwellMsRef.current = dwellMs;
  }, [dwellMs]);

  useEffect(() => {
    if (!active) {
      hexRef.current = null;
      dwellStartRef.current = null;
      coordsRef.current = null;
      lastFixRef.current = null;
      useHexStore.getState().setActiveHex(null);
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
          distanceInterval: 3,
          timeInterval: 1500,
          mayShowUserSettingsDialog: true,
        },
        (loc) => {
          if (cancelled) return;
          const { latitude, longitude, accuracy } = loc.coords;
          if (accuracy == null || accuracy > 25) {
            setState((s) => ({ ...s, status: 'low_accuracy', accuracy, message: 'Improving GPS signal…' }));
            return;
          }

          // Smooth (EMA); damp big spikes hard so a noisy fix barely nudges the dot.
          const prev = smoothRef.current;
          let lat = latitude;
          let lng = longitude;
          if (prev) {
            const jump = haversineM(prev.lat, prev.lng, latitude, longitude);
            const a = jump > SPIKE_M ? 0.1 : SMOOTH_ALPHA;
            lat = prev.lat + a * (latitude - prev.lat);
            lng = prev.lng + a * (longitude - prev.lng);
          }
          smoothRef.current = { lat, lng };
          coordsRef.current = { lat, lng };
          setState((s) => ({ ...s, accuracy, position: { lat, lng } }));

          // Keep the hexes around the walker loaded so capture works even if the camera roamed
          // (throttled internally by distance moved). Decouples capture-readiness from the viewport.
          void useHexStore.getState().ensureLoadedAround(lat, lng, myId);

          // Accumulate distance from the smoothed track (ignore sub-metre noise + >50m jumps).
          if (lastFixRef.current) {
            const step = haversineM(lastFixRef.current.lat, lastFixRef.current.lng, lat, lng);
            if (step > 1 && step < 50) {
              distanceRef.current += step;
              setState((s) => ({ ...s, distanceM: distanceRef.current }));
            }
          }
          lastFixRef.current = { lat, lng };

          // Hysteresis: keep the current dwell hex while still within reach (boundary jitter
          // must not reset the timer).
          const cur = hexRef.current;
          if (cur) {
            const p = getHexProps(cur);
            if (p && p.owner !== 'you' && haversineM(lat, lng, p.clat, p.clng) <= HEX_REACH_M) {
              setState((s) => ({ ...s, currentHex: cur }));
              return;
            }
          }

          const hit = nearestHex(lat, lng);
          if (!hit) {
            hexRef.current = null;
            dwellStartRef.current = null;
            useHexStore.getState().setActiveHex(null);
            setState((s) => ({ ...s, status: 'no_hex', currentHex: null, dwellProgress: 0, message: 'Walk into a hex to capture it.' }));
            return;
          }
          if (hit.owner === 'you') {
            hexRef.current = null;
            dwellStartRef.current = null;
            useHexStore.getState().setActiveHex(null);
            setState((s) => ({ ...s, status: 'owned', currentHex: hit.h3, dwellProgress: 0, message: 'You already hold this hex.' }));
            return;
          }
          if (hexRef.current !== hit.h3) {
            hexRef.current = hit.h3;
            dwellStartRef.current = Date.now();
            useHexStore.getState().setActiveHex(hit.h3); // protect the dwell cell from eviction
            setState((s) => ({ ...s, status: 'dwelling', currentHex: hit.h3, dwellProgress: 0, message: 'Hold this hex…' }));
          } else {
            setState((s) => ({ ...s, currentHex: hit.h3 }));
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

        const progress = Math.min(1, (Date.now() - start) / dwellMsRef.current);
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
          useHexStore.getState().setActiveHex(null);
          setState((s) => ({
            ...s,
            status: 'captured',
            currentHex: h3,
            dwellProgress: 0,
            capturedCount: countRef.current,
            lastCapture: { ip: res.result.ip, pph: FLAT_PPH, h3, nonce: captureNonceRef.current, type: res.result.type },
            message: `${res.result.type === 'steal' ? 'Hex stolen!' : 'Hex captured!'} +${res.result.ip} pts`,
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
          // Locked/protected hexes: don't re-arm the dwell — hysteresis parks you here without
          // hammering the RPC every cycle until you walk away. Transient errors retry next dwell.
          const noRetry =
            res.error === 'cooldown' ||
            res.error === 'block_cooldown' ||
            res.error === 'fresh_paint' ||
            res.error === 'protected';
          dwellStartRef.current = noRetry ? null : Date.now();
          const message =
            res.error === 'outside_hex'
              ? 'Move into the hex to capture.'
              : res.error === 'block_cooldown'
                ? 'Just taken — locked for a few minutes.'
                : res.error === 'fresh_paint'
                  ? "Freshly painted — can't steal it yet."
                  : res.error === 'protected'
                    ? 'Protected — part of their home turf.'
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
  }, [active, myId, setOwner, setUser]); // NOT dwellMs — read via dwellMsRef so a level-up doesn't restart the watcher

  return { ...state, dwellSec };
}
