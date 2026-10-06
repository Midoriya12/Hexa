// Active launch region — the SINGLE source of truth for the app's geography and locale.
// Both this module (the app) and the Node seeder scripts (scripts/*.mjs) read the
// same config/region.json, so the map centre, signup location field, phone-number
// rules, day-boundary timezone, hex-grid bounding box and neighbourhood labels all
// move together when you re-target a city. To launch a different city, edit
// config/region.json, add a matching migration for `app_tz()` (see 018), and re-run
// the hex seeder — no code changes here. `location.mode` picks the signup UX:
// 'zip' = free-text entry (US ZIP), 'list' = pick-from-list (e.g. Indian pincodes).
import raw from '@/config/region.json';

export interface RegionArea {
  name: string;
  code: string;
  lat: number;
  lng: number;
}

export interface RegionPhone {
  /** E.164 country prefix, e.g. "+1". */
  dialCode: string;
  /** Flag emoji shown beside the dial code. */
  flag: string;
  /** Digits in a national number (US: 10). */
  nationalLength: number;
  /** Regex a complete national number must match. */
  nationalPattern: string;
  invalidHint: string;
  /** Display grouping for the national number. */
  format: 'us' | 'in';
}

export interface RegionConfig {
  id: string;
  name: string;
  shortName: string;
  country: string;
  /** IANA zone used for streak days, daily caps and "tonight" copy. Must match SQL `app_tz()`. */
  timezone: string;
  phone: RegionPhone;
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

// ── Phone numbers ────────────────────────────────────────────────────────────────────────────────

const phoneRe = new RegExp(region.phone.nationalPattern);

/** True if `digits` is a complete, well-formed national number for the active region. */
export function isValidNationalPhone(digits: string): boolean {
  return phoneRe.test(digits);
}

/** National digits → E.164 ("5551234567" → "+15551234567"). Supabase Auth needs E.164. */
export function toE164(digits: string): string {
  return `${region.phone.dialCode}${digits}`;
}

/** Progressive display formatting while the user types (US: "(555) 123-4567", IN: "98765 43210"). */
export function formatNationalPhone(digits: string): string {
  if (region.phone.format === 'us') {
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  }
  if (digits.length <= 5) return digits;
  return `${digits.slice(0, 5)} ${digits.slice(5)}`;
}

/** Max characters of the formatted national number (so the TextInput cap matches the format). */
export const PHONE_INPUT_MAX_LENGTH = formatNationalPhone('9'.repeat(region.phone.nationalLength)).length;

/** E.164 → human display with the dial code ("+15551234567" → "+1 (555) 123-4567"). */
export function formatE164Display(e164: string): string {
  const national = e164.startsWith(region.phone.dialCode) ? e164.slice(region.phone.dialCode.length) : e164;
  return `${region.phone.dialCode} ${formatNationalPhone(national)}`;
}

// ── Local days ───────────────────────────────────────────────────────────────────────────────────

const dayFmt = new Intl.DateTimeFormat('en-CA', {
  timeZone: region.timezone,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Calendar day of `ms` in the region's timezone as a comparable integer (days since epoch).
 * Mirrors the SQL `(ts AT TIME ZONE app_tz())::date` so client streak/at-risk maths agrees with
 * the server. Handles DST, unlike a fixed UTC offset.
 */
export function regionDayIndex(ms: number): number {
  const ymd = dayFmt.format(new Date(ms)); // "YYYY-MM-DD"
  return Math.floor(Date.UTC(+ymd.slice(0, 4), +ymd.slice(5, 7) - 1, +ymd.slice(8, 10)) / 86_400_000);
}
