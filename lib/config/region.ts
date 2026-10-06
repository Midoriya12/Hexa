// Active launch region — the SINGLE source of truth for the app's geography.
// Both this module (the app) and the Node seeder scripts (scripts/*.mjs) read the
// same config/region.json, so the map centre, signup location field, hex-grid
// bounding box and neighbourhood labels all move together when you re-target a city.
// To launch a different city, edit config/region.json and re-run the hex seeder — no
// code changes here. `location.mode` picks the signup UX: 'zip' = free-text entry
// (US ZIP), 'list' = pick-from-list (e.g. Bangalore pincodes).
import raw from '@/config/region.json';

export interface RegionArea {
  name: string;
  code: string;
  lat: number;
  lng: number;
}

export interface RegionConfig {
  id: string;
  name: string;
  shortName: string;
  country: string;
  center: { lat: number; lng: number };
  seed: {
    bbox: { west: number; south: number; east: number; north: number };
    swath: { west: number; south: number; east: number; north: number };
    floor: number;
    swathFloor: number;
  };
  location: {
    mode: 'zip' | 'list';
    term: string;
    label: string;
    placeholder: string;
    pattern: string;
    invalidHint: string;
    /** Selectable codes when mode === 'list'. */
    options?: string[];
  };
  testHex: { query: string; lat: number; lng: number; code: string; neighbourhood: string };
  areas: RegionArea[];
}

export const region = raw as RegionConfig;

/** Map centre as a Mapbox [lng, lat] tuple. */
export const REGION_CENTER: [number, number] = [region.center.lng, region.center.lat];

/** Codes offered in the signup picker when the region uses list-mode (empty for free-text regions). */
export const LOCATION_OPTIONS: string[] = region.location.mode === 'list' ? region.location.options ?? [] : [];

const codeRe = new RegExp(region.location.pattern);

/** True if `code` is a well-formed location code for the active region. */
export function isValidLocationCode(code: string): boolean {
  return codeRe.test(code.trim());
}

/** "10012 — SoHo" when the code maps to a known area, else the bare code. */
export function locationLabel(code: string): string {
  const area = region.areas.find((a) => a.code === code);
  return area ? `${code} — ${area.name}` : code;
}

/** The neighbourhood name for a code, or null when unknown. Stored on users.home_neighbourhood. */
export function neighbourhoodFor(code: string): string | null {
  return region.areas.find((a) => a.code === code)?.name ?? null;
}
