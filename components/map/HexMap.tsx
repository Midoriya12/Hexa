// HexMap — the live Mapbox map behind the Play and Start sheets.
// Style: Mapbox STANDARD (colourful 3D globe — blue oceans, green land, atmosphere) with a
// day/night `lightPreset` (bright & scenic by day, lit-up dark at night). Standard is newer
// ("V11 only" + the StyleImport component on the new architecture), so the MapView is wrapped
// in an error boundary: if it ever fails to render, we fall back to a plain dark backdrop and
// the rest of the screen (sheet, controls) keeps working — no white-screen.
//
// Hex rendering (INTVL territory model): OWNED hexes show as coloured territory at all zooms;
// the UNOWNED grid shows outline-only from zoom 12 (aligned with the viewport-fetch gate) so the
// city/globe view stays clean and a single fetch stays under the PostgREST row cap.
import {
  Component,
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useRef,
  type ComponentRef,
  type ReactNode,
} from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import * as Location from 'expo-location';
import Mapbox, {
  Camera,
  CircleLayer,
  FillLayer,
  LineLayer,
  LocationPuck,
  MapView,
  ShapeSource,
  StyleImport,
  type MapState,
} from '@rnmapbox/maps';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useHexStore } from '@/stores/hexStore';

// Public token (pk.*) — fine to bundle. Telemetry off (patch #19 / DPDPA 2023).
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? null);
void Mapbox.setTelemetryEnabled(false);

// Mapbox Standard — the modern colourful 3D globe. `lightPreset` drives day/night lighting.
const STANDARD_STYLE = 'mapbox://styles/mapbox/standard';

// HSR Layout centroid [lng, lat] — the launch area.
const HSR_CENTER: [number, number] = [77.6446, 12.9116];

// Zoomed-right-out "whole globe" level — the Start map opens here, then flies down to you.
const GLOBE_ZOOM = 2.2;

// Fixed local-hour window (refine to real sunrise/sunset later).
function isDaytime(): boolean {
  const h = new Date().getHours();
  return h >= 6 && h < 18;
}

/** Contains any render failure from the (newer) Standard style / StyleImport so a map problem
 *  degrades to a dark backdrop instead of taking down the whole screen. */
class MapErrorBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (this.state.failed) {
      return <View style={[StyleSheet.absoluteFill, { backgroundColor: '#0A0A0A' }]} />;
    }
    return this.props.children;
  }
}

interface HexMapProps {
  style?: StyleProp<ViewStyle>;
  /** Lower (~2) shows the globe; higher (~14) drops into the neighbourhood. */
  zoomLevel?: number;
  /** Follow + centre on the user's live location (used on the Start/active-walk screen). */
  followUser?: boolean;
  /** Smoothed [lat,lng] for the on-map dot + camera follow (from useHexTracker). */
  dot?: { lat: number; lng: number } | null;
  /** Walking route to the nearest hex (Start's crosshair), drawn as a dashed line. */
  route?: GeoJSON.LineString | null;
  /** Tapping the map reports the nearest hex (Play uses this to open the hex-info card). */
  onHexPress?: (h3: string) => void;
}

export interface HexMapHandle {
  /** Fly the camera to the nearest unowned hex (Play's "find nearest hex" control). */
  flyToNearestHex: () => void;
}

export const HexMap = forwardRef<HexMapHandle, HexMapProps>(function HexMap(
  { style, zoomLevel = 14, followUser = false, dot = null, route = null, onHexPress },
  ref,
) {
  // Mapbox GL contends for a single drawing surface across MapView instances; with the tab
  // navigator keeping screens mounted, two live maps (Play + Start) leaves one blank. Mount
  // the map only while its screen is focused so exactly one surface is ever live.
  const isFocused = useIsFocused();
  const fc = useHexStore((s) => s.fc);
  const { user } = useCurrentUser();
  const myId = user?.id ?? null;
  const myColor = user?.hex_colour || '#FF6F00'; // your captured hexes render in your chosen colour
  const lightPreset = useMemo(() => (isDaytime() ? 'day' : 'night'), []);
  const cameraRef = useRef<ComponentRef<typeof Camera>>(null);

  // Your OWN hexes load bounds-independently (territory shows at every zoom); reloads on account
  // switch. The visible grid is loaded per-viewport in onMapIdle below.
  useEffect(() => {
    void useHexStore.getState().loadOwn(myId);
  }, [myId]);

  // Viewport loader: when the camera settles, fetch the hexes inside the (clamped + padded) bounds.
  // bounds.ne/sw are [lng,lat]; skip mid-gesture settles. The store merges, evicts + dedupes.
  const onMapIdle = useCallback(
    (state: MapState) => {
      if (state.gestures?.isGestureActive) return;
      const { bounds, zoom } = state.properties;
      void useHexStore
        .getState()
        .loadBounds(
          { minLng: bounds.sw[0], minLat: bounds.sw[1], maxLng: bounds.ne[0], maxLat: bounds.ne[1] },
          zoom,
          myId,
        );
    },
    [myId],
  );

  // "Find nearest hex": fly to the closest UNOWNED hex to the user (or launch-area centre if
  // location is unavailable). No turn-by-turn — just a camera move (spec line 1480).
  const flyToNearestHex = useCallback(async () => {
    let from: [number, number] = HSR_CENTER;
    try {
      let granted = (await Location.getForegroundPermissionsAsync()).granted;
      if (!granted) granted = (await Location.requestForegroundPermissionsAsync()).granted;
      if (granted) {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        from = [loc.coords.longitude, loc.coords.latitude];
      }
    } catch {
      /* fall back to the launch-area centre */
    }
    // Prime the loaded window around the user so the scan sees nearby hexes (viewport-windowed).
    await useHexStore.getState().ensureLoadedAround(from[1], from[0], myId);
    const current = useHexStore.getState().fc;
    if (!current) return;
    let best: [number, number] | null = null;
    let bestD = Infinity;
    for (const f of current.features) {
      if (f.properties.owner !== 'none') continue;
      const dx = f.properties.clng - from[0];
      const dy = f.properties.clat - from[1];
      const d = dx * dx + dy * dy;
      if (d < bestD) {
        bestD = d;
        best = [f.properties.clng, f.properties.clat];
      }
    }
    if (best) cameraRef.current?.setCamera({ centerCoordinate: best, zoomLevel: 16, animationDuration: 800 });
  }, [myId]);

  useImperativeHandle(ref, () => ({ flyToNearestHex }), [flyToNearestHex]);

  // Tap the map → report the nearest hex (within ~100m) so the screen can show its info.
  const handleMapPress = useCallback(
    (feature: GeoJSON.Feature) => {
      if (!onHexPress || feature.geometry?.type !== 'Point') return;
      const [lng, lat] = (feature.geometry as GeoJSON.Point).coordinates;
      const fc = useHexStore.getState().fc;
      if (!fc) return;
      const cosLat = Math.cos((lat * Math.PI) / 180);
      let best: string | null = null;
      let bestD = Infinity;
      for (const f of fc.features) {
        const dLat = f.properties.clat - lat;
        const dLng = (f.properties.clng - lng) * cosLat;
        const d = dLat * dLat + dLng * dLng;
        if (d < bestD) {
          bestD = d;
          best = f.properties.h3;
        }
      }
      if (best && Math.sqrt(bestD) * 111320 <= 100) onHexPress(best);
    },
    [onHexPress],
  );

  // Cinematic intro (Start only): open on the globe, then fly down to the user's REAL location
  // (falls back to the launch area if location is unavailable). Replays whenever the Start tab is
  // focused — the MapView remounts on focus, so it reopens on the globe and dives in again.
  useEffect(() => {
    if (!followUser || !isFocused) return;
    let alive = true;
    (async () => {
      let target: [number, number] = HSR_CENTER;
      try {
        const granted =
          (await Location.getForegroundPermissionsAsync()).granted ||
          (await Location.requestForegroundPermissionsAsync()).granted;
        if (granted) {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          target = [loc.coords.longitude, loc.coords.latitude];
        }
      } catch {
        /* fall back to the launch-area centre */
      }
      if (!alive) return;
      cameraRef.current?.setCamera({
        centerCoordinate: target,
        zoomLevel: 16,
        animationMode: 'flyTo',
        animationDuration: 2800,
      });
    })();
    return () => {
      alive = false;
    };
  }, [followUser, isFocused]);

  // Smoothly follow the SMOOTHED dot (not raw GPS) so the camera glides instead of jittering;
  // setCamera without zoomLevel preserves the user's current zoom.
  useEffect(() => {
    if (followUser && dot) {
      cameraRef.current?.setCamera({ centerCoordinate: [dot.lng, dot.lat], animationDuration: 1200 });
    }
  }, [followUser, dot?.lat, dot?.lng]);

  if (!isFocused) return null;

  return (
    <MapErrorBoundary>
      <MapView
        style={style ?? StyleSheet.absoluteFill}
        styleURL={STANDARD_STYLE}
        projection="globe"
        scaleBarEnabled={false}
        logoEnabled={false}
        attributionEnabled={false}
        compassEnabled={false}
        onPress={onHexPress ? handleMapPress : undefined}
        onMapIdle={onMapIdle}
      >
        {/* Day/night lighting on the Standard basemap (bright & colourful by day, dark at night). */}
        <StyleImport id="basemap" existing config={{ lightPreset }} />

        <Camera
          ref={cameraRef}
          // Start (followUser) opens on the globe and flies down to you (see intro effect below);
          // Play opens at its given zoom.
          defaultSettings={{ centerCoordinate: HSR_CENTER, zoomLevel: followUser ? GLOBE_ZOOM : zoomLevel }}
          minZoomLevel={0.5}
          maxZoomLevel={19}
        />

        {/* Walking route to the nearest hex (drawn under the dot). */}
        {route ? (
          <ShapeSource id="routeSource" shape={{ type: 'Feature', geometry: route, properties: {} }}>
            <LineLayer
              id="routeLine"
              style={{ lineColor: '#2E86FF', lineWidth: 4, lineCap: 'round', lineJoin: 'round', lineDasharray: [1.6, 1.4] }}
            />
          </ShapeSource>
        ) : null}

        {/* Smoothed "you are here" dot when a position is supplied (Start); else the default puck. */}
        {dot ? (
          <ShapeSource
            id="meSource"
            shape={{ type: 'Feature', geometry: { type: 'Point', coordinates: [dot.lng, dot.lat] }, properties: {} }}
          >
            <CircleLayer id="meHalo" style={{ circleRadius: 16, circleColor: '#2E86FF', circleOpacity: 0.18 }} />
            <CircleLayer
              id="meDot"
              style={{ circleRadius: 7, circleColor: '#2E86FF', circleStrokeWidth: 2, circleStrokeColor: '#FFFFFF' }}
            />
          </ShapeSource>
        ) : (
          <LocationPuck />
        )}

        {fc ? (
          <ShapeSource id="hexSource" shape={fc} tolerance={0.5}>
            {/* Owned territory — fill + outline, all zooms */}
            <FillLayer
              id="hexFillOwned"
              filter={['!=', ['get', 'owner'], 'none']}
              style={{
                fillColor: ['match', ['get', 'owner'], 'you', myColor, 'other', '#888888', '#888888'],
                fillOpacity: ['match', ['get', 'owner'], 'you', 0.55, 0.4],
                fillAntialias: true,
              }}
            />
            <LineLayer
              id="hexLineOwned"
              filter={['!=', ['get', 'owner'], 'none']}
              style={{
                lineColor: ['match', ['get', 'owner'], 'you', myColor, 'other', '#CFCFCF', '#CFCFCF'],
                lineWidth: ['interpolate', ['linear'], ['zoom'], 11, 2.0, 16, 3.2],
                lineJoin: 'round',
              }}
            />
            {/* Unowned grid — outline only, from zoom 12 (locality) so the city view stays clean. */}
            <LineLayer
              id="hexLineUnowned"
              filter={['==', ['get', 'owner'], 'none']}
              minZoomLevel={12}
              style={{
                lineColor: 'rgba(255,140,0,0.9)',
                lineWidth: ['interpolate', ['linear'], ['zoom'], 12, 1.2, 17, 2.8],
                lineJoin: 'round',
              }}
            />
          </ShapeSource>
        ) : null}
      </MapView>
    </MapErrorBoundary>
  );
});

export default HexMap;
