# Hexa — Build Project Guide

> **Read order:** this file → the relevant phase section of the spec PDF → the code.

## Source of Truth

- **Canonical spec:** `c:\Users\chara\Downloads\IDK\Hexa — Complete Build Document for Claude Code.pdf`
- **Where this file conflicts with the PDF, this file wins.** The "Spec Patches" section below is the authoritative override list.
- **Expo:** Always read https://docs.expo.dev/versions/v56.0.0/ before writing native-touching code. Expo APIs change across SDKs; do not rely on training-data recall.

## Project Summary (one paragraph)

Hexa turns Bangalore into a hex-tiled board game. The city is split into ~85K H3 res-10 hexes (~150m across). Walk into a hex, dwell 20 seconds under GPS + speed + accelerometer checks, and capture it. Hold hexes for passive points (PPH); others can steal them. Compete on neighbourhood leaderboards, earn medals, climb levels with Safe-Point retention rules, eventually join clans and redeem points for closed-loop brand vouchers. Hyperlocal first (HSR / Koramangala / Indiranagar), Bangalore-only for the first 6 months.

## Decisions Already Made (Do Not Relitigate)

- **Mobile stack:** Expo (CNG / managed workflow) + React Native + TypeScript strict. NOT Flutter. NOT React Native CLI bare.
- **Backend:** Supabase Pro ($25/mo from day 1) with Postgres + PostGIS + h3-pg + Realtime + Edge Functions. NOT Firebase.
- **Map:** MapLibre + MapTiler tiles. NOT Google Maps. NOT Mapbox.
- **Hex grid:** Uber H3 resolution 10. Stored as `bigint` in Postgres, not string. h3-js on client, h3-pg on server.
- **Auth:** Phone OTP only. NO Google/Apple/email sign-in. MSG91 wired in via Supabase's Custom SMS Provider config (see patch #6).
- **Capture rules:** 20s dwell, GPS accuracy ≤25m, sustained speed ≤10 km/h, accelerometer ≥2 step events, point-in-polygon check. Server is source of truth, client gives instant feedback — conflicts: server wins.
- **Launch geography:** Bangalore only for first 6 months. Within Bangalore: HSR + Koramangala + Indiranagar.
- **Locale:** IST (Asia/Kolkata) everywhere. INR currency. Never USD in user-facing strings.
- **No crypto, no tokens, no NFTs, no user buy-in, no P2P trading, no point-to-fiat conversion.** Brand-funded closed-loop vouchers only (PROGA 2025 compliance — see patch #13).
- **Battery is sacred.** Background GPS is the #1 reason walking apps get uninstalled. Design every phase with battery in mind.
- **Loss-aversion notifications** ("you lost X") over gain-motivation ("earn Y").
- **Phase gating is non-negotiable.** Do NOT skip ahead. Do NOT add features outside the current phase. Each phase has an acceptance checklist; do not proceed until every item passes.

## Current Phase

**Phase 0 — Pre-Build Setup.** Scaffold complete on this machine. Still pending:

- [ ] Accounts: Supabase, MapTiler, MSG91, Apple Developer, Google Play, Sentry, PostHog, OpenWeather
- [ ] Apple Developer enrollment (start NOW — 1-21 days depending on entity type)
- [ ] Figma wireframes (8 screens, rough is fine)
- [ ] `.env.local` populated with real keys
- [x] Repo scaffolded and pushed
- [x] CLAUDE.md written

Phase 1 starts only after every Phase 0 box above is checked.

## Stack (as installed, SDK 56)

| Layer | Tool | Version |
|---|---|---|
| Mobile framework | Expo | ~56.0 |
| Language | TypeScript | ~6.0 (strict mode on) |
| Runtime | React Native | 0.85.3 |
| UI library | React | 19.2.3 |
| Routing | expo-router | ~56.2 |
| Animation | react-native-reanimated | 4.3 |
| Native worklets | react-native-worklets | 0.8 |
| Backend | Supabase Pro | Postgres 15 + PostGIS + h3-pg |
| Map renderer | MapLibre (to be added Phase 2) | — |
| Hex math | h3-js (to be added Phase 2) | — |
| State | Zustand (to be added Phase 1) | — |
| Storage | react-native-mmkv (to be added Phase 1) | — |
| Server fetch | @tanstack/react-query (to be added Phase 2) | — |

## Spec Patches (override the PDF where they conflict)

Each patch overrides the corresponding section of the PDF. The PDF stays as the canonical narrative spec; this list is the diff.

1. **[PATCHED] Hex count.** Bangalore bbox at H3 res 10 yields ~86,500 hexes — NOT 520K. The PDF math (Section 10 and Appendix B) is off by ~6x. Update generation script timing from "~30 min" to "~5-8 min." DB sizing, viewport-query LIMITs, and seed-script progress logs should all assume ~85-100K, not 520K.

2. **[PATCHED] Streak day boundary.** Streak day = midnight-to-midnight IST (NOT 5AM-to-5AM, contrary to Section 2.8). The SQL in Section 6.3 uses `::DATE` in `Asia/Kolkata`, which is midnight-aligned. Spec wording yields to code. The 9 PM IST nudge stays.

3. **[PATCHED] Safe Point demotion logic.** Cron must check **daily RP earned** ≥ level threshold (50 / 100 / 150 for L3 / L4 / L5) for each of the last 3 days, not just "any capture exists." A user who logs 1 RP/day technically passes Section 5.2's cron but fails the spec in Section 2.6. Rewrite the demotion query to group captures by IST day, sum `ip_awarded`, and check that the daily sum >= threshold for every day in the window.

4. **[PATCHED] `isMock` auto-reject.** Section 2.10 lists `isMock=true` as a hard invalidator. Bump the risk-scorer contribution in Section 8.4 from `+60` to `+100` so a mock GPS reading alone triggers rejection (threshold is 80). Equivalent alternative: short-circuit before scoring — `if (isMock) return REJECT;`.

5. **[PATCHED] `users` table RLS.** Drop both SELECT policies from Section 4 (they OR together so `USING (TRUE)` makes everything readable, leaking phone numbers, ban status, device fingerprints). Keep `users_update_own UPDATE` policy. Create a `public_users` view exposing only the columns safe for cross-user reads (id, username, display_name, avatar_url, level, hex_colour, current_round_points, ghost_mode). Front-end joins go through the view, not the table.

6. **[PATCHED] MSG91 + Supabase Auth integration.** Use Supabase Auth's **Custom SMS Provider** config (Auth settings → SMS Provider) to point at MSG91 directly. Keep `supabase.auth.signInWithOtp()` on the client. **Skip the custom `send-otp` Edge Function described in Section 1.2 entirely** — that flow leaves no path for MSG91 OTP verification to produce a Supabase session token. Custom SMS Provider hands MSG91 the message and lets Supabase keep its own OTP verify + session lifecycle.

7. **[PATCHED] Daily cap wording.** Section 2.4's "Daily cap: 800 points/day max for unlevelled users" contradicts Section 2.6's table (L1 cap is 200, L5 cap is 1000). Treat Section 2.6 as authoritative: daily cap varies by level (200 / 400 / 600 / 800 / 1000). Strike the 800 line from 2.4.

8. **[PATCHED] PPH soft cap implementation.** Drop the `pph_paused BOOLEAN` column from `zone_ownership` entirely. The column zombifies once a user holds 51+ hexes and then releases some — paused flags never get un-set, PPH silently dies. Instead, compute the cap at PPH-calculation time:
   ```sql
   WITH ranked_hexes AS (
     SELECT zo.user_id, h.pph_value,
       ROW_NUMBER() OVER (PARTITION BY zo.user_id ORDER BY zo.captured_at DESC) AS rn
     FROM zone_ownership zo
     JOIN hexes h ON h.h3_index = zo.h3_index
     WHERE zo.user_id IS NOT NULL
   )
   SELECT user_id, SUM(pph_value) AS total_pph
   FROM ranked_hexes
   WHERE rn <= 50
   GROUP BY user_id;
   ```
   Use this in the hourly PPH cron in Section 4.6.

9. **[PATCHED] Streak LP double-count.** Section 2.4's points table lists +100 / +500 / +2000 LP for 7-day / 30-day / 100-day streaks. Section 2.9 awards the same amounts via Week One / Month One / (future) medals. Remove the streak rows from the Section 2.4 table — medal LP is the canonical reward.

10. **[PATCHED] Background geolocation library.** Sections 3.2, 5.1, and 9.2 give three different stances on when to switch from `expo-location` to transistorsoft's `react-native-background-geolocation`. Single rule: **stay on `expo-location` + `expo-task-manager` through Phase 9**. Only consider switching in Phase 9.2 IF battery profiling shows > 8% / hour during active walks. Most apps never need to switch.

11. **[PATCHED] Level 3 unlocks.** Section 2.6 table says L3 unlocks "Clans, custom username colour." But clans don't ship until Phase 11 (Month 4). Anyone hitting L3 in Phase 7–10 sees a phantom feature. MVP unlocks for L3: **"Friends + custom hex colour."** Clan unlock activates at L3+ retroactively when Phase 11 ships.

12. **[PATCHED] Path auto-paint schema.** Section 10 (Phase 10) says owning a path auto-paints all underlying hexes in your colour. The current `zone_ownership` schema has no way to express "visual override without hex-ownership transfer." Locked design: **path takes visual priority on the map, but the underlying hex owner keeps PPH.** Implementation deferred to Phase 10 — likely needs either a `hex_path_overlay` table or a client-side compute via `path_ownership ⋈ paths.checkpoints ⋈ hexes` at viewport load. Decide at Phase 10 design time; do NOT mutate `zone_ownership.user_id` for path captures.

13. **[PATCHED] Phase 12 Compliance Pre-Flight (PROGA 2025).** Add to the top of Phase 12, before any monetization code:

    > **Promotion and Regulation of Online Gaming Act 2025 (PROGA).** Presidential assent 22 August 2025, in force 1 May 2026, rules notified 22 April 2026. Criminalises real-money gaming (including skill-based) with penalties up to 5 years imprisonment + fines. Karnataka / Delhi / MP High Court challenges transferred to Supreme Court 8 September 2025; SC began hearing November 2025. Final interpretation could still shift — monitor MeitY notifications monthly.
    >
    > **Banned for us:**
    > - Cash entry fees from users
    > - Cash prize pools funded by user buy-in
    > - Any token / coin / point convertible to fiat
    > - User-to-user point trading with monetary value
    > - NFTs or assets with secondary markets
    >
    > **Explicitly permitted** (per Bar and Bench's PROGA analysis): *"Rewards like brand vouchers are permissible if non-convertible, closed-loop (specific vendors), and non-cash."* Our model — brand pays cash to fund vouchers → user redeems points for closed-loop brand voucher → user spends voucher at that specific brand only — is legal. Brand-funded UPI payouts (where user never paid in) are permitted as direct sponsorships.
    >
    > **Pre-revenue checklist — every box green before Phase 12 launches:**
    > 1. Engage Ikigai Law or Nishith Desai for a one-time PROGA compliance memo (~₹40–75K). Do not take a single rupee of revenue before the memo is in hand.
    > 2. ToS + Privacy Policy explicitly state: "Points have no monetary value. Vouchers are closed-loop, non-transferable, non-refundable."
    > 3. Voucher schema has `is_closed_loop BOOLEAN DEFAULT TRUE` constraint that cannot be set to FALSE.
    > 4. UPI payout flow only fires when funded by a pre-deposited brand sponsor pool (track via `brand_funding_pool` table) — never from user-side rupees.
    > 5. App Store description does NOT use the words "win cash," "real money," "earn money," or "withdraw." Use: "Walk to earn brand-sponsored vouchers."
    >
    > **Anti-rules — never violate:**
    > - Never let user buy-in fund another user's payout (STEPN's Ponzi mistake).
    > - Never allow point-to-fiat conversion at user request.
    > - Never enable peer-to-peer point or voucher trading.
    > - Size brand prize pool to current sponsor revenue only — never to projected user growth.
    > - External revenue funds 100% of the prize pool.

14. **[PATCHED] Capture endpoint naming.** Section 3.3 refers to `POST /capture`. Actual Edge Function path is `/functions/v1/validate-capture` (matches the folder structure in Section 4.3). Update all client calls and documentation.

15. **[PATCHED] Apple Developer enrollment timing.** Section 7 says "2-7 days." Reality: 1-2 days for individual enrollment, but **2-3 weeks** if D-U-N-S verification kicks in for organisation enrollment. Update to "1-21 days depending on entity type" and start this BEFORE any code work.

16. **[PATCHED] Streak SQL — complete rewrite.** The function in Section 6.3 has three problems: (a) it never sets `current_streak = 1` on the very first capture (the `v_last_streak_day = today` branch returns early because `execute_capture` sets `last_capture_at = now()` BEFORE calling this function); (b) the freeze branch only decrements `streak_freezes_available` and never updates `current_streak`, so the streak gets "preserved" at its old value rather than incrementing for today's capture; (c) it doesn't handle multi-day absences — a single freeze should cover exactly one missed day, not bridge a 2+ day gap.

    Corrected function:
    ```sql
    CREATE OR REPLACE FUNCTION update_streak_if_needed(p_user_id UUID) RETURNS VOID LANGUAGE plpgsql AS $$
    DECLARE
      v_last_capture TIMESTAMPTZ;
      v_streak INT;
      v_freezes INT;
      v_last_streak_day DATE;
      v_today DATE;
      v_days_missed INT;
    BEGIN
      SELECT last_capture_at, current_streak, streak_freezes_available
        INTO v_last_capture, v_streak, v_freezes
      FROM users WHERE id = p_user_id;

      v_today := (now() AT TIME ZONE 'Asia/Kolkata')::DATE;

      -- First capture ever (or streak was zeroed)
      IF v_last_capture IS NULL OR v_streak = 0 THEN
        UPDATE users SET
          current_streak = 1,
          longest_streak = GREATEST(longest_streak, 1)
        WHERE id = p_user_id;
        RETURN;
      END IF;

      v_last_streak_day := (v_last_capture AT TIME ZONE 'Asia/Kolkata')::DATE;
      v_days_missed := v_today - v_last_streak_day;

      -- Already captured today
      IF v_days_missed = 0 THEN RETURN; END IF;

      -- Captured yesterday — streak continues
      IF v_days_missed = 1 THEN
        UPDATE users SET
          current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1)
        WHERE id = p_user_id;
        RETURN;
      END IF;

      -- Missed exactly one day, freeze available — bridge it
      IF v_days_missed = 2 AND v_freezes >= 1 THEN
        UPDATE users SET
          streak_freezes_available = streak_freezes_available - 1,
          current_streak = current_streak + 1,
          longest_streak = GREATEST(longest_streak, current_streak + 1)
        WHERE id = p_user_id;
        RETURN;
      END IF;

      -- Multi-day absence (or no freeze) — reset
      UPDATE users SET current_streak = 1 WHERE id = p_user_id;
    END;
    $$;
    ```

    Semantics: freeze covers exactly one skipped day. 2+ skipped days = reset, regardless of freezes held. Note `execute_capture` should still set `last_capture_at = now()` AFTER calling this function, not before — otherwise the "days missed" calculation reads its own write.

17. **[NEW PATCH] Expo SDK version.** PDF specifies SDK 51; scaffold installed SDK 56 (latest stable as of 2026-05-25). All version pins in Section 5.1's `package.json` are stale — read the current `package.json` instead. When adding new Expo libraries, query https://docs.expo.dev/versions/v56.0.0/ for the correct version specifier.

18. **[NEW PATCH] CNG (Continuous Native Generation), not Bare workflow.** PDF Section 3.2 mandates Expo Bare. Modern Expo (SDK 50+) uses CNG: `/ios` and `/android` folders are git-ignored and regenerated on demand via `npx expo prebuild`. This is the default scaffold pattern and is better for our needs (config plugins handle most native customisation). Run `prebuild` only when (a) building a dev client, (b) building for store submission, or (c) adding a native module not covered by an Expo config plugin. Do NOT commit `/ios` and `/android` to git.

## Dependency Adjustments vs PDF Section 5.1

Drop entirely (already absent from scaffold):
- `viem` — Ethereum library; contradicts the no-crypto principle in Section 1.4. Copy-paste error in the PDF.
- `react-native-keyboard-controller` — overkill for OTP + a handful of inputs. Default RN keyboard behaviour is fine for MVP.
- `@xstate/react` — for the capture FSM, prefer a plain TypeScript discriminated union + switch. One fewer dep to maintain.

Add only when their phase arrives — do not pre-install:
- Phase 1: `zustand`, `react-native-mmkv`, `@supabase/supabase-js`, `react-native-toast-message`
- Phase 2: `@maplibre/maplibre-react-native`, `h3-js`, `@tanstack/react-query`
- Phase 3: `expo-location`, `expo-task-manager`, `expo-sensors`
- Phase 4: `expo-haptics`, `expo-notifications`, `expo-secure-store`
- Phase 6: `date-fns`, `react-native-view-shot`, `expo-sharing`, `expo-image-manipulator`

Versions: always pin to whatever https://docs.expo.dev/versions/v56.0.0/ recommends for the installed SDK.

## Conventions

- **TypeScript strict mode.** `tsc --noEmit` must pass before any commit. Already on in `tsconfig.json`.
- **Conventional Commits.** `feat(scope): summary`, `fix(scope): summary`, `chore: summary`, `docs: summary`, `refactor(scope): summary`, `test(scope): summary`. Scope examples: `capture`, `map`, `auth`, `db`, `ci`.
- **Times are IST.** Use `Asia/Kolkata` in all SQL, `date-fns-tz` on the client. Never store IST as a naive timestamp.
- **Currency is INR.** Never USD in user-facing strings. Use `Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`.
- **Comment WHY, not WHAT.** Code shows what; comments explain the game-design or constraint reason.
- **Ask before:** adding any dependency, changing the DB schema, changing capture-FSM states, or any requirement that's ambiguous in the PDF.
- **End of each phase:** run the acceptance checklist explicitly in the chat. If any box fails, stop and fix before proceeding.
- **Commit cadence:** at least one commit per logical sub-task within a phase. Push to `main` after every commit that passes `tsc --noEmit`.

## Project Layout (scaffold + planned)

```
hexa/
├── app/                     # Expo Router (file-based routing)
├── components/              # Reusable UI (to be filled phase-by-phase)
├── constants/               # Theme, colors, magic numbers
├── assets/                  # Images, fonts, sounds, medal SVGs
├── lib/                     # [planned, Phase 1+] Pure logic, no UI
├── stores/                  # [planned, Phase 1+] Zustand stores
├── hooks/                   # [planned, Phase 1+] Custom hooks
├── types/                   # [planned, Phase 1+] Shared types
├── scripts/                 # [planned, Phase 3+] One-off scripts (hex generation, seed)
├── supabase/                # [planned, Phase 1+] Migrations + Edge Functions
├── CLAUDE.md                # This file
├── AGENTS.md                # Auto-generated reminder to read versioned Expo docs
├── package.json
├── app.json                 # Expo config
├── tsconfig.json
└── .env.local               # gitignored — local secrets only
```

## Notes for Future Claude Sessions

- The scaffold's auto-generated `AGENTS.md` reminds you to read `https://docs.expo.dev/versions/v56.0.0/` before writing native-touching code. Honour it.
- The source-of-truth PDF lives at `c:\Users\chara\Downloads\IDK\Hexa — Complete Build Document for Claude Code.pdf` — read the relevant phase section in full before starting work on it.
- Memory entries at `C:\Users\chara\.claude\projects\c--Users-chara-Downloads-IDK\memory\` track which phase we're in. Keep them current.
- The user (Sai) is the sole founder + sole developer. They are sharp, opinionated, and have already corrected the spec 18 times before any code was written. Trust their decisions; ask before re-litigating.
