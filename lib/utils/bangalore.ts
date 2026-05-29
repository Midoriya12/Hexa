// Bangalore pincode helpers. Launch geography: HSR / Koramangala / Indiranagar.
// The full pincode -> neighbourhood map is derived during Phase 3 hex generation
// (reverse geocode); for Phase 1 profile-setup we label the known launch areas and
// fall back to the bare pincode otherwise.

export const PINCODE_MIN = 560001;
export const PINCODE_MAX = 560103;

/** All valid Bangalore pincodes in range, as strings ("560001" … "560103"). */
export const BANGALORE_PINCODES: string[] = Array.from(
  { length: PINCODE_MAX - PINCODE_MIN + 1 },
  (_, i) => String(PINCODE_MIN + i),
);

/** Known neighbourhood labels (expanded in Phase 3). 560102 per design spec §6.5. */
export const NEIGHBOURHOODS: Record<string, string> = {
  '560102': 'HSR Layout',
  '560034': 'Koramangala',
  '560038': 'Indiranagar',
};

export function isValidBangalorePincode(pincode: string): boolean {
  const n = Number(pincode);
  return Number.isInteger(n) && n >= PINCODE_MIN && n <= PINCODE_MAX;
}

/** "560102 — HSR Layout" when known, else "560102". */
export function pincodeLabel(pincode: string): string {
  const hood = NEIGHBOURHOODS[pincode];
  return hood ? `${pincode} — ${hood}` : pincode;
}
