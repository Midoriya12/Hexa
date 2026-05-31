// HexMap — the real Mapbox map (globe projection + zoom), used behind the Play and
// Start sheets. NOTE: requires the native Mapbox build; only import this into screens
// AFTER the dev client is rebuilt with @rnmapbox/maps, or the app will crash.
// Hex/zone overlays come in Phase 2/3 once hexes are generated.
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import Mapbox, { Camera, FillLayer, LineLayer, MapView, ShapeSource, StyleImport } from '@rnmapbox/maps';

import { fetchHexes, type HexCollection } from '@/lib/supabase/hexes';

// Public token (pk.*) — fine to bundle. Telemetry off (patch #19 / DPDPA 2023).
Mapbox.setAccessToken(process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? null);
void Mapbox.setTelemetryEnabled(false);

// HSR Layout centroid [lng, lat] — the launch area.
const HSR_CENTER: [number, number] = [77.6446, 12.9116];

interface HexMapProps {
  style?: StyleProp<ViewStyle>;
  /** Lower (~2) shows the globe; higher (~14) drops into the neighbourhood. */
  zoomLevel?: number;
}

// Mapbox Standard — the modern colourful 3D globe (blue oceans, green land, atmosphere).
// Its `lightPreset` gives day/night: bright & scenic in daylight, dark at night.
const STANDARD_STYLE = 'mapbox://styles/mapbox/standard';

// Fixed local-hour window (refine to real sunrise/sunset later).
function isDaytime(): boolean {
  const h = new Date().getHours();
  return h >= 6 && h < 18;
}

export function HexMap({ style, zoomLevel = 14 }: HexMapProps) {
  // Mapbox GL contends for a single drawing surface across MapView instances; with the
  // tab navigator keeping screens mounted, two live maps (Play + Start) leaves one blank.
  // Mount the map only while its screen is focused so exactly one surface is ever live.
  const isFocused = useIsFocused();
  const [hexes, setHexes] = useState<HexCollection | null>(null);
  const lightPreset = useMemo(() => (isDaytime() ? 'day' : 'night'), []);

  useEffect(() => {
    let alive = true;
    fetchHexes()
      .then((fc) => alive && setHexes(fc))
      .catch(() => alive && setHexes(null)); // map still renders without the grid
    return () => {
      alive = false;
    };
  }, []);

  if (!isFocused) return null;

  return (
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

      {/* Hex rendering, INTVL-style: OWNED hexes are territory and show at every zoom; the
          UNOWNED grid only appears once you zoom into your area (minZoom 13), so the city
          view stays clean instead of a honeycomb mesh. One source, layers split by `owner`. */}
      {hexes ? (
        <ShapeSource id="hexSource" shape={hexes} tolerance={0.5}>
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
          {/* Unowned grid — outline only. Appears from zoom 12 (your locality) so you don't
              have to zoom in hard, but the city/globe view (zoom <12) stays clean. */}
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
  );
}

export default HexMap;
