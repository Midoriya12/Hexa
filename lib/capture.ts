// Capture a hex: compute the H3 cell for a GPS fix and call the server-validated capture_hex
// RPC. The server re-checks the point is inside the cell + serialises/records the capture; the
// client only proposes. Errors come back as the RAISEd codes from 003_capture.sql.
import { latLngToCell } from 'h3-js';

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
  lat: number,
  lng: number,
): Promise<{ ok: true; result: CaptureResult } | { ok: false; error: CaptureError }> {
  let p_h3: string;
  try {
    p_h3 = latLngToCell(lat, lng, 10); // h3-js: (lat, lng) order
  } catch {
    return { ok: false, error: 'bad_coords' };
  }

  const { data, error } = await supabase.rpc('capture_hex', { p_h3, p_lat: lat, p_lng: lng });
  if (error) {
    const msg = error.message ?? '';
    return { ok: false, error: KNOWN_ERRORS.find((k) => msg.includes(k)) ?? 'unknown' };
  }
  return { ok: true, result: data as unknown as CaptureResult };
}
