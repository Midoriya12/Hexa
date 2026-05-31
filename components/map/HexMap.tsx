// HexMap — the real Mapbox map (globe projection + zoom), used behind the Play and
// Start sheets. NOTE: requires the native Mapbox build; only import this into screens
// AFTER the dev client is rebuilt with @rnmapbox/maps, or the app will crash.
// Hex/zone overlays come in Phase 2/3 once hexes are generated.
import { useEffect, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import Mapbox, { Camera, FillLayer, LineLayer, MapView, ShapeSource } from '@rnmapbox/maps';

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

export function HexMap({ style, zoomLevel = 12 }: HexMapProps) {
  // Mapbox GL contends for a single drawing surface across MapView instances; with the
  // tab navigator keeping screens mounted, two live maps (Play + Start) leaves one blank.
  // Mount the map only while its screen is focused so exactly one surface is ever live.
  const isFocused = useIsFocused();
  const [hexes, setHexes] = useState<HexCollection | null>(null);

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
      styleURL={Mapbox.StyleURL.Dark}
      projection="globe"
      scaleBarEnabled={false}
      logoEnabled={false}
      attributionEnabled={false}
      compassEnabled={false}
    >
      <Camera
        defaultSettings={{ centerCoordinate: HSR_CENTER, zoomLevel }}
        minZoomLevel={0.5}
        maxZoomLevel={19}
      />

      {/* Playable hex grid. One source + fill + outline, coloured per-feature by ownership.
          Unowned = no fill + faint outline (reads as a grid); yours = saffron; others = grey
          (their clan colour comes in Step C). Layers gated to street zoom for performance. */}
      {hexes ? (
        <ShapeSource id="hexSource" shape={hexes} tolerance={0.5}>
          <FillLayer
            id="hexFill"
            minZoomLevel={9}
            style={{
              fillColor: [
                'match',
                ['get', 'owner'],
                'you', '#FF6F00',
                'other', '#888888',
                'rgba(0,0,0,0)',
              ],
              fillOpacity: ['match', ['get', 'owner'], 'you', 0.55, 'other', 0.4, 0],
              fillAntialias: true,
            }}
          />
          <LineLayer
            id="hexOutline"
            minZoomLevel={9}
            style={{
              lineColor: [
                'match',
                ['get', 'owner'],
                'you', '#FF6F00',
                'other', '#CFCFCF',
                'rgba(255,140,0,0.85)', // unowned: brighter saffron so the grid reads clearly
              ],
              // Thicker, and scale up as you zoom in so hexes stay crisp.
              lineWidth: [
                'interpolate',
                ['linear'],
                ['zoom'],
                11, ['match', ['get', 'owner'], 'none', 1.4, 2.0],
                16, ['match', ['get', 'owner'], 'none', 2.4, 3.2],
              ],
              lineJoin: 'round',
            }}
          />
        </ShapeSource>
      ) : null}
    </MapView>
  );
}

export default HexMap;
