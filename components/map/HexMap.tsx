// HexMap — the real Mapbox map (globe projection + zoom), used behind the Play and
// Start sheets. NOTE: requires the native Mapbox build; only import this into screens
// AFTER the dev client is rebuilt with @rnmapbox/maps, or the app will crash.
// Hex/zone overlays come in Phase 2/3 once hexes are generated.
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useIsFocused } from 'expo-router';
import Mapbox, { Camera, MapView } from '@rnmapbox/maps';

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
    </MapView>
  );
}

export default HexMap;
