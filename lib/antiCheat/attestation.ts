// Device-attestation token acquisition — SCAFFOLD (Phase 8 part 2).
//
// Returns null until Firebase App Check + the native dep (@react-native-firebase/app-check) are
// wired and ATTEST_ENABLED is flipped on (see lib/antiCheat/config.ts and the Phase 8 setup
// checklist in CLAUDE.md). While disabled, the capture path is untouched.
//
// When enabled, this will fetch a Play Integrity (Android) / App Attest (iOS) *limited-use* token —
// bound single-use against a server-issued nonce so a harvested token can't be replayed by a
// modified client (the design review flagged plain App Check tokens as replayable).
import { ATTEST_ENABLED } from './config';

export async function getAttestationToken(_nonce?: string): Promise<string | null> {
  if (!ATTEST_ENABLED) return null;
  // TODO(attestation): once @react-native-firebase/app-check is installed + the dev-client is rebuilt:
  //   const { token } = await getLimitedUseToken(appCheck);
  //   return token;
  return null;
}
