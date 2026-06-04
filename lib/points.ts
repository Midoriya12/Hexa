// Shared level + XP helpers. MUST mirror migration 010 (level_for_lp / level_name): levels are
// driven by lifetime_points (LP). Single source so the Me-screen XP bar isn't faked.
export const LEVEL_THRESHOLDS = [0, 500, 2500, 10000, 30000] as const; // index = level - 1
export const LEVEL_NAMES = ['Walker', 'Strider', 'Patroller', 'Conqueror', 'Mayor'] as const;

export function levelName(level: number): string {
  return LEVEL_NAMES[Math.min(Math.max(level, 1), 5) - 1];
}

/** Progress within the current level toward the next (or atMax at L5). */
export function xpProgress(lifetimePoints: number, level: number) {
  const i = Math.min(Math.max(level, 1), 5) - 1;
  const floor = LEVEL_THRESHOLDS[i];
  const next = LEVEL_THRESHOLDS[i + 1];
  if (next === undefined) return { atMax: true, into: 0, span: 0, toNext: 0, pct: 1 };
  const into = Math.max(0, lifetimePoints - floor);
  const span = next - floor;
  return { atMax: false, into, span, toNext: Math.max(0, next - lifetimePoints), pct: Math.min(1, into / span) };
}
