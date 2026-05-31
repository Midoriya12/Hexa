// HexMap — the live Mapbox map behind the Play and Start sheets.
// Style: Mapbox STANDARD (colourful 3D globe — blue oceans, green land, atmosphere) with a
// day/night `lightPreset` (bright & scenic by day, lit-up dark at night). Standard is newer
// ("V11 only" + the StyleImport component on the new architecture), so the MapView is wrapped
// in an error boundary: if it ever fails to render, we fall back to a plain dark backdrop and
// the rest of the screen (sheet, controls) keeps working — no white-screen.
//
// Hex rendering (INTVL territory model): OWNED hexes show as coloured territory at all zooms;
// the UNOWNED grid shows outline-only from zoom 12 so the city/globe view stays clean.
import { Component, useEffect, useMemo, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import Mapbox, { Camera, FillLayer, LineLayer, MapView, ShapeSource, StyleImport } from '@rnmapbox/maps';

import { useCurrentUser } from '@/hooks/useCurrentUser';
import { useHexStore } from '@/stores/hexStore';

// Public token (pk.*) — fine to bundle. Telemetry off (patch #19 / DPDPA 2023).
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? null);
void Mapbox.setTelemetryEnabled(false);

// Mapbox Standard — the modern colourful 3D globe. `lightPreset` drives day/night lighting.
const STANDARD_STYLE = 'mapbox://styles/mapbox/standard';

// HSR Layout centroid [lng, lat] — the launch area.
const HSR_CENTER: [number, number] = [77.6446, 12.9116];

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
}

export function HexMap({ style, zoomLevel = 14 }: HexMapProps) {
  // Mapbox GL contends for a single drawing surface across MapView instances; with the tab
  // navigator keeping screens mounted, two live maps (Play + Start) leaves one blank. Mount
  // the map only while its screen is focused so exactly one surface is ever live.
  const isFocused = useIsFocused();
  const fc = useHexStore((s) => s.fc);
  const loadHexes = useHexStore((s) => s.load);
  const { user } = useCurrentUser();
  const lightPreset = useMemo(() => (isDaytime() ? 'day' : 'night'), []);

  // Load the grid + ownership once into the shared store (no-op if already loaded). Captures
  // update the store, so both the Play and Start maps recolour instantly.
  useEffect(() => {
    void loadHexes(user?.id ?? null);
  }, [loadHexes, user?.id]);

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
      >
        {/* Day/night lighting on the Standard basemap (bright & colourful by day, dark at night). */}
        <StyleImport id="basemap" existing config={{ lightPreset }} />

        <Camera
          defaultSettings={{ centerCoordinate: HSR_CENTER, zoomLevel }}
          minZoomLevel={0.5}
          maxZoomLevel={19}
        />

        {fc ? (
          <ShapeSource id="hexSource" shape={fc} tolerance={0.5}>
            {/* Owned territory — fill + outline, all zooms */}
            <FillLayer
              id="hexFillOwned"
              filter={['!=', ['get', 'owner'], 'none']}
              style={{
                fillColor: ['match', ['get', 'owner'], 'you', '#FF6F00', 'other', '#888888', '#888888'],
                fillOpacity: ['match', ['get', 'owner'], 'you', 0.55, 0.4],
                fillAntialias: true,
              }}
            />
            <LineLayer
              id="hexLineOwned"
              filter={['!=', ['get', 'owner'], 'none']}
              style={{
                lineColor: ['match', ['get', 'owner'], 'you', '#FF6F00', 'other', '#CFCFCF', '#CFCFCF'],
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
}

export default HexMap;
