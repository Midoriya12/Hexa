// Mock-location (fake-GPS) detection.
//
// expo-location exposes `mocked` on the TOP-LEVEL LocationObject (Android only — see
// node_modules/expo-location/build/Location.types.d.ts: `mocked?: boolean` on LocationObject, NOT
// on LocationObjectCoords). iOS has no equivalent flag; iOS spoofing is covered by attestation
// (Phase 8 part 2), not here.
//
// This is honest-user HYGIENE, not anti-cheat: a modified client can simply lie. It must ship in the
// same release as the SERVER motion check (017) and is never the sole defence.
import { Platform } from 'react-native';
import type * as Location from 'expo-location';

export function isMockFix(loc: Location.LocationObject): boolean {
  return Platform.OS === 'android' && loc.mocked === true;
}
