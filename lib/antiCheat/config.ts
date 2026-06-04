// Phase 8 anti-cheat feature flags.
//
// Device attestation (Play Integrity on Android / App Attest on iOS, via Firebase App Check) is
// SCAFFOLDED but OFF until: (1) a Firebase/Google Cloud project + App Check are set up, (2) the
// native dep ships in a dev-client rebuild, and (3) — for iOS — the Apple Developer account is
// approved. While ATTEST_ENABLED is false the capture path behaves exactly as it does today.
//
// Flip on per-build via the EAS env var EXPO_PUBLIC_ATTEST_ENFORCED=true once setup is complete and
// App Check monitor metrics show legit-unattested traffic is negligible.
export const ATTEST_ENABLED = (process.env.EXPO_PUBLIC_ATTEST_ENFORCED ?? 'false') === 'true';

// Client mock-location guard: how many consecutive mocked fixes (over MOCK_MIN_MS wall-clock) before
// we lock capture. Debounces a transient OEM `mocked=true`; a single clean fix auto-recovers.
export const MOCK_STREAK = 3;
export const MOCK_MIN_MS = 4000;
