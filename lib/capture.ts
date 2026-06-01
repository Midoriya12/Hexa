// Capture a hex: call the server-validated capture_hex RPC. The caller supplies the H3 cell id
// (resolved client-side from the loaded grid — see useHexTracker) plus the raw GPS fix; the
// server re-checks the point is inside that cell + serialises/records the capture. The client
// only proposes. Errors come back as the RAISEd codes from 003_capture.sql.
//
// NOTE: h3-js is intentionally NOT used on-device — its emscripten build constructs
// `new TextDecoder('utf-16le')`, which Hermes/Expo's TextDecoder rejects (RangeError). We
// resolve the cell from the in-memory grid instead. h3-js stays in the Node seeding script only.
import { supabase } from '@/lib/supabase/client';

export interface CaptureResult {
  ok: boolean;
  h3: string;
  ip: number;
  stolen_from: string | null;
}

export type CaptureError =
  | 'not_authenticated'
  | 'hex_not_found'
  | 'bad_coords'
  | 'outside_hex'
  | 'already_owned'
  | 'cooldown'
  | 'unknown';

const KNOWN_ERRORS: CaptureError[] = [
  'not_authenticated',
  'hex_not_found',
  'bad_coords',
  'outside_hex',
  'already_owned',
  'cooldown',
];

export async function captureHex(
  h3: string,
  lat: number,
  lng: number,
): Promise<{ ok: true; result: CaptureResult } | { ok: false; error: CaptureError }> {
  const { data, error } = await supabase.rpc('capture_hex', { p_h3: h3, p_lat: lat, p_lng: lng });
  if (error) {
    const msg = error.message ?? '';
    return { ok: false, error: KNOWN_ERRORS.find((k) => msg.includes(k)) ?? 'unknown' };
  }
  return { ok: true, result: data as unknown as CaptureResult };
}
