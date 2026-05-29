# Hexa — Build Project Guide

> **Read order:** this file (patches + decisions) → the **v3 Design Spec** (visual + interaction) → the **Build Spec** (data + logic) → the code.
> **Always read** https://docs.expo.dev/versions/v56.0.0/ before writing native-touching code. Expo APIs change across SDKs; do not rely on training-data recall.

## Source of Truth

- **v3 Design Spec** — [docs/hexa-design-spec-v3.pdf](docs/hexa-design-spec-v3.pdf) (v3, delivered 2026-05-29). Visual + interaction spec: design system, components, motion, 28 screen specs across 13 phases. Canonical for all UI decisions. Exact values (colours, spacing, font sizes, durations) are used verbatim — never "improved" or substituted.
- **Build Spec** — [docs/hexa-build-spec.pdf](docs/hexa-build-spec.pdf) + `HEXA_BUILD_SPEC.md` (shared before Phase 1). Data, logic, schema, edge functions, anti-cheat.
- **INTVL Reference** — [docs/reference/intvl-screen-reference.pdf](docs/reference/intvl-screen-reference.pdf). Category context ONLY (how a peer walking-territory app shapes clans/feeds/runs). Never copy its visuals, copy, layouts, or coral colour scheme. If an INTVL pattern conflicts with our design spec, the design spec wins — always.
- **Spec Patches** (below) are the authoritative override list and win over every document.

## Project Summary

Hexa turns Bangalore into a hex-tiled board game. The city is split into ~85K H3 res-10 hexes (~130m across); walk into a hex, dwell 20 seconds under GPS + speed + accelerometer checks, and capture it. Hold hexes for passive points per hour (PPH); friends and strangers steal them. Compete on per-pincode leaderboards across monthly seasons, build streaks, earn medals, climb levels with Safe-Point retention, eventually join clans and redeem points for closed-loop brand vouchers. Hyperlocal first (HSR / Koramangala / Indiranagar), Bangalore-only for the first 6 months.

## Stack (locked)

- **Mobile:** Expo + React Native + TypeScript strict, **CNG / managed workflow** (NOT Bare — see patch #18; NOT Flutter; NOT RN CLI).
- **Styling:** NativeWind (Tailwind for React Native). Tokens in `theme/tokens.ts` are the single source of truth.
- **Backend:** Supabase Pro (Postgres + PostGIS + h3-pg + Realtime + Edge Functions). NOT Firebase.
- **Map:** Mapbox via `@rnmapbox/maps` + Mapbox tiles (NOT Google Maps; NOT MapLibre + MapTiler — patch #19).
- **Hex grid:** Uber H3 resolution 10, stored as `bigint` in Postgres (not string). h3-js on client, h3-pg on server.
- **Auth:** Phone OTP only (no Google/Apple/email). MSG91 via Supabase Custom SMS Provider (patch #6); MSG91 setup deferred to pre-production, dev uses test OTP (patch #20).
- **State / data / storage:** Zustand + TanStack Query + MMKV.
- **Animation / gesture:** react-native-reanimated + react-native-gesture-handler.
- **Location:** expo-location + expo-task-manager (foreground + background GPS through Phase 9; reassess transistorsoft only if battery profiling fails — patch #10).
- **Platforms:** iOS 16+ and Android 9+ from day 1. Dev is **Android-first** (patch #21).

**As installed (SDK 56):**

| Layer | Tool | Version |
|---|---|---|
| Mobile framework | Expo | ~56.0 |
| Language | TypeScript | ~6.0 (strict) |
| Runtime | React Native | 0.85.3 |
| UI | React | 19.2.3 |
| Routing | expo-router | ~56.2 |
| Animation | react-native-reanimated | 4.3 |
| Native worklets | react-native-worklets | 0.8 |
| Safe area | react-native-safe-area-context | ~5.7 |

Everything else (NativeWind, gesture-handler, @gorhom/bottom-sheet, expo-haptics, Zustand, MMKV, Supabase, Mapbox, h3-js, …) is **not yet installed** — added phase-by-phase, with explicit approval (see Dependency Adjustments).

## Design Principles (v3 Design Spec §1)

1. **The map is the product.** The home screen is a map first, a UI second. Every element must justify covering even 1px of map; when in doubt, hide it behind a tap.
2. **Loss aversion drives the loop.** Every screen makes it easy to see what you might lose (streak, rank, hexes) and fix it in one tap. Notifications read "Rohit stole 3 of your hexes," never "+30 points available."
3. **Dark by default. Saffron for moments that matter.** Near-black base, high-contrast text. Saffron `#FF6F00` is reserved for owned hexes, primary CTAs, your name on leaderboards, capture celebrations, and the active streak. Saffron everywhere kills the impact of saffron anywhere.

## Decisions Already Made (Do Not Relitigate)

- **App name:** Hexa.
- **Colour scheme:** saffron `#FF6F00` primary, dark mode default (light mode is post-MVP). Do NOT propose alternatives.
- **Platforms:** iOS 16+ and Android 9+ from day 1.
- **Launch geography:** Bangalore only for the first 6 months. Within Bangalore: HSR + Koramangala + Indiranagar first.
- **Hex grid:** Uber H3 resolution 10, ~85K hexes for the launch area, stored as `bigint`.
- **Capture mechanics:** 20s dwell · GPS accuracy ≤25m · sustained speed ≤10 km/h · ≥2 accelerometer step events · point-in-polygon check · 30-min Fresh Paint immunity · 23h revisit window · 15-min block cooldown. Server is source of truth; client gives instant feedback; conflicts → server wins.
- **No crypto, no tokens, no NFTs, no user buy-in, no P2P trading, no point-to-fiat conversion, no sweepstakes** (we explicitly skip the Entry Vault mechanic INTVL has). Brand-funded closed-loop vouchers only — PROGA 2025 compliance (patch #13). If asked to write code that violates this, STOP and flag it; do not write it.
- **Locale:** IST (Asia/Kolkata) everywhere. INR currency. Never USD in user-facing strings.
- **Battery is sacred.** Background GPS is the #1 reason walking apps get uninstalled — design every phase around it.
- **Loss-aversion notifications** over gain-motivation.
- **Phase gating is non-negotiable.** Do NOT skip ahead. Do NOT add features outside the current phase. Each phase has an acceptance checklist; do not proceed until every box passes.

## Authority Order

**Spec Patches > v3 Design Spec > Build Spec > INTVL Reference > training data.**

If the design spec doesn't cover something needed, ASK — do not guess and do not extrapolate from INTVL. If a contradiction is found between specs (or between a spec and what's technically sound), flag it before writing code; patch the spec rather than building around it.

## Conventions

- **TypeScript strict mode.** `tsc --noEmit` must pass before any commit. No `any` types.
- **No `console.log` in committed code.** Proper Sentry/PostHog wrappers land in Phase 1.
- **No emojis in code or commit messages.** Emojis are for user-facing UI only (notifications, badges).
- **Styling:** NativeWind classes for layout/colour. `StyleSheet` only where Tailwind doesn't fit (animations, dynamic values). No inline style objects for static layout/colour.
- **Conventional Commits.** `feat(scope):`, `fix(scope):`, `chore:`, `docs:`, `refactor(scope):`, `test(scope):`. Scopes: `ui`, `capture`, `map`, `auth`, `db`, `ci`, … Commit small — at least one commit per logical sub-task (one UI component per commit in Phase 0).
- **Ask before:** adding any dependency, changing the DB schema, changing capture-FSM states, any structural change, or anything ambiguous in the specs.
- **Times are IST** (`Asia/Kolkata` in SQL, `date-fns-tz` on the client — never store IST as a naive timestamp). **Currency is INR** (`Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' })`).
- **Comment WHY, not WHAT.** Code shows what; comments explain the game-design or constraint reason.
- **End of each phase:** run the acceptance checklist explicitly in chat. If any box fails, stop and fix before proceeding.

## Current Phase

**Phase 0 — Pre-Build Setup + Foundational UI.** Setup essentially closed; building the design-system component library (tokens → tailwind → scaffold → 13 UI components → demo screen). Status as of 2026-05-29:

- [x] Repo scaffolded and pushed (Expo SDK 56, TypeScript strict)
- [x] CLAUDE.md restructured; all 21 spec patches preserved
- [x] `.env.local` populated — 8/10 keys (MSG91 pair deferred, patch #20)
- [x] Supabase confirmed LIVE — `/auth/v1/health` → 200 (GoTrue v2.189.0), anon key valid
- [x] Dev platform: **Android-first** (Windows, no Mac — patch #21)
- [x] **v3 Design Spec delivered** (2026-05-29) — serves as the canonical visual spec; satisfies the old "Figma wireframes" Phase-0 item (Figma optional/later)
- [~] **Apple Developer Program — APPLIED 2026-05-29, enrollment in progress** (lifts the patch #21 deferral; once active, dev builds can side-load to Sai's iPhone via EAS). Android-first still holds until it activates.
- [ ] Google Play Console — defer until first Android internal/beta release (Phase 9)
- [ ] Phase 0 component library — IN PROGRESS

## Spec Patches

**This list is append-only.** Each patch overrides the design spec / build spec where they conflict. **Authority order: Patches > v3 Design Spec > Build Spec > INTVL Reference > training data.** Never renumber — patch #N keeps its number forever so cross-references stay valid. Status tags: **[PATCHED]** (active override), **[OPEN]** (unresolved), **[ABSORBED INTO v3 SPEC §X.Y]** (fix is now canonical in the spec; kept as historical record, not an active override).

**Absorption audit (2026-05-29, vs v3 _design_ spec):** All 21 patches target the build spec, game logic, data schema, anti-cheat, or build/process decisions — domains the v3 _design_ spec (visual + interaction only) does not cover. **None are absorbed by the v3 design spec.** Two patches in fact override stale content still in v3: **#19** (design spec §5.2 / §6.7 still say "MapLibre/Mapbox" + "MapTiler" — we use Mapbox) and **#11** (design spec §3.13 still shows "Clans" as the Level-3 unlock — MVP L3 unlock is Friends + custom hex colour until clans ship in Phase 11). Re-run this audit against the v3 **build** spec when it's shared (before Phase 1) — that's the document most patches target, and it likely absorbs several.

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

11. **[PATCHED] Level 3 unlocks.** Section 2.6 table says L3 unlocks "Clans, custom username colour." But clans don't ship until Phase 11 (Month 4). Anyone hitting L3 in Phase 7–10 sees a phantom feature. MVP unlocks for L3: **"Friends + custom hex colour."** Clan unlock activates at L3+ retroactively when Phase 11 ships. (Note: v3 design spec §3.13 still uses "Reach Level 3 to unlock Clans" as its FeatureGate example — this patch overrides that copy for MVP.)

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

17. **[PATCHED] Expo SDK version.** PDF specifies SDK 51; scaffold installed SDK 56 (latest stable as of 2026-05-25). All version pins in Section 5.1's `package.json` are stale — read the current `package.json` instead. When adding new Expo libraries, query https://docs.expo.dev/versions/v56.0.0/ for the correct version specifier.

18. **[PATCHED] CNG (Continuous Native Generation), not Bare workflow.** PDF Section 3.2 mandates Expo Bare. Modern Expo (SDK 50+) uses CNG: `/ios` and `/android` folders are git-ignored and regenerated on demand via `npx expo prebuild`. This is the default scaffold pattern and is better for our needs (config plugins handle most native customisation). Run `prebuild` only when (a) building a dev client, (b) building for store submission, or (c) adding a native module not covered by an Expo config plugin. Do NOT commit `/ios` and `/android` to git. (Reaffirmed canonical 2026-05-29 — the Phase 0 prompt said "Bare" in error; CNG wins.)

19. **[PATCHED] Mapbox SDK instead of MapLibre + MapTiler.** Spec specified `@maplibre/maplibre-react-native` rendering MapTiler tiles. Reversed: use `@rnmapbox/maps` rendering Mapbox tiles. Reasoning:
    - **Free tier covers us through PMF.** Mapbox: 25K mobile MAUs/month free. We're targeting 1K users by Month 5. Versus MapTiler's $29/month flat from day 1 (~₹15-20K saved over 6-month MVP).
    - **The RN binding is dramatically better-maintained.** `@rnmapbox/maps` has full-time engineering behind it; MapLibre's RN bindings have had unmaintained stretches with open issues sitting for months. For a solo dev, debugging binding internals is not the use of time.
    - **Built for custom-UI rendering.** Mapbox was designed for app-skinned maps, not navigation. For Hexa where the map IS the game UI, the customisation surface matters more than the cost difference at our scale.
    - **Offline mode is mature.** Bangalore has GPS dead zones (basements, metro, dense apartment compounds). Mapbox's offline tile bundling is built for this.
    - **Still cheaper than Google at scale.** At 70K monthly loads: Mapbox ~$100 vs Google $294+.

    **Implementation notes for Phase 2 (do not write code yet — wait for Phase 2):**
    - Install: `@rnmapbox/maps` (latest stable). Drop `@maplibre/maplibre-react-native` from any future dep list.
    - Two tokens: `EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN` (`pk.*`, bundled into client, fine in `.env.local`) and `MAPBOX_SECRET_TOKEN` (`sk.*` with `DOWNLOADS:READ` scope, used at build time by the Expo plugin to fetch the native SDK from Mapbox's private npm registry — move to EAS secrets before any real build).
    - The HexLayer code in Section 4 (`ShapeSource` / `FillLayer` / `LineLayer`) ports nearly 1:1 to `@rnmapbox/maps` — same component names, near-identical props.
    - **Disable telemetry on app init**: `Mapbox.setTelemetryEnabled(false)`. Mapbox SDK collects anonymized location telemetry by default. With DPDPA 2023 in force and Hexa being a location-tracking app, telemetry off is the safe default. Document in Privacy Policy.
    - **Billing alert from day one**: set a Mapbox usage alert at 20K MAU and a hard cap at 40K so a viral spike doesn't generate a surprise bill. Mapbox dashboard → Account → Usage → Notifications.
    - Tokens need to be wired through the Expo config plugin before any iOS build, or compile fails. Read https://docs.mapbox.com/help/tutorials/use-mapbox-gl-js-with-react-native/ and the `@rnmapbox/maps` Expo install guide before starting Phase 2.

20. **[PATCHED] MSG91 deferred to pre-production; dev auth uses Supabase test OTP.** Setting up the MSG91 account, OTP template, and Supabase Custom SMS Provider config is deferred until the pre-production / launch run-up — it is NOT required to build or test Phases 1–11. `MSG91_AUTH_KEY` and `MSG91_TEMPLATE_ID` stay blank in `.env.local` until then. During development, build the full phone-OTP flow against **Supabase Auth test phone numbers** (Auth → Sign In / Providers → Phone → add test numbers with fixed 6-digit OTP codes). This exercises the real `supabase.auth.signInWithOtp()` / `verifyOtp()` client path and Supabase's session lifecycle without sending a single SMS or spending a paisa. At launch, wire MSG91 via the Custom SMS Provider per patch #6 — **no client code changes, only Supabase Auth config**. Reason (Sai, 2026-05-28): don't pay for or configure SMS before there's anything to ship.

21. **[PATCHED] Android-first development; Apple enrollment + iOS deferred to pre-launch.** Sai develops on Windows 11 (no Mac). Consequence: no iOS simulator, and a custom iOS dev client can't be installed on a physical iPhone without either a Mac (Xcode) or a **paid Apple Developer account** (EAS internal distribution needs device provisioning). Decision (Sai, 2026-05-29): build and test everything on **Android** (emulator + physical Android via an `expo-dev-client` build — local Android Studio or EAS, no paid account needed) through the dev phases. **Plain Expo Go is insufficient from Phase 1 onward** (native modules: `react-native-mmkv` in Phase 1, `@rnmapbox/maps` in Phase 2) — use a custom dev client, not Expo Go. Apple enrollment is deferred to the pre-launch run-up; start it ~3 weeks before target ship (can take up to 21 days — patch #15 — and it gates TestFlight + Phase 8 App Attest). **A dedicated iOS pass before launch is mandatory** to validate the iOS-divergent surfaces: background GPS (Phases 3/9), push notifications (Phase 4), App Attest (Phase 8). Do not assume Android-tested behaviour transfers to iOS there. _(Update 2026-05-29: Apple Developer Program now applied — enrollment in progress; iOS testing on Sai's iPhone unlocks once it activates. Android-first holds until then.)_

---

**[NEW IN v3 SPEC]** — patches #22+ below correct the v3 design spec (delivered 2026-05-29) or the v3 build spec. _None yet._

## Dependency Adjustments

Drop entirely (already absent from scaffold):
- `viem` — Ethereum library; contradicts the no-crypto principle. Copy-paste error in the PDF.
- `react-native-keyboard-controller` — overkill for OTP + a handful of inputs. Default RN keyboard behaviour is fine for MVP.
- `@xstate/react` — for the capture FSM, prefer a plain TypeScript discriminated union + switch. One fewer dep to maintain.

Add only when their phase arrives — do not pre-install, and **ask before installing**:
- **Phase 0 (component library):** `nativewind` + `tailwindcss`, `react-native-gesture-handler`, `@gorhom/bottom-sheet`, `expo-haptics`. _(Note: the v3 design spec's component library is built in Phase 0, which pulls `expo-haptics` — Button §3.1 — and `@gorhom/bottom-sheet` — §3.6 — forward from their old Phase 4 slot. `react-native-reanimated` is already installed.)_
- Phase 1: `zustand`, `react-native-mmkv`, `@supabase/supabase-js`, `react-native-toast-message`
- Phase 2: `@rnmapbox/maps`, `h3-js`, `@tanstack/react-query`
- Phase 3: `expo-location`, `expo-task-manager`, `expo-sensors`
- Phase 4: `expo-notifications`, `expo-secure-store`
- Phase 6: `date-fns`, `react-native-view-shot`, `expo-sharing`, `expo-image-manipulator`
- Phase 1 (icons): Tabler Icons (per design spec §2.6)

Versions: always pin to whatever https://docs.expo.dev/versions/v56.0.0/ recommends for the installed SDK.

## Project Layout (target — scaffolded in Phase 0)

```
hexa/
├── app/
│   ├── (auth)/              # phone, otp, onboarding, profile-setup, permissions
│   ├── (tabs)/              # index (map), leaderboard, friends, profile
│   └── _devtools/           # components.tsx — visual QA demo screen
├── components/
│   ├── ui/                  # Button, Card, Badge, Avatar, Input, BottomSheet, Toast,
│   │                        #   SubToggle, HoldToConfirm, FeatureGate, MetricRow,
│   │                        #   ProgressIndicator, EmptyState
│   ├── capture/             # [Phase 2+]
│   ├── map/                 # [Phase 2+]
│   └── shared/              # [Phase 2+]
├── lib/                     # utils, supabase, h3, capture, location, antiCheat, points, medals
├── stores/                  # userStore, mapStore, captureStore, notificationStore
├── hooks/                   # useLocation, useCurrentUser, useCapture, useStreak
├── types/                   # database, game, api
├── theme/                   # tokens.ts (single source of truth), index.ts
├── docs/                    # hexa-build-spec.pdf, design spec (to be moved here)
├── tailwind.config.js
├── CLAUDE.md                # this file
├── AGENTS.md                # auto-generated: read versioned Expo docs
├── package.json / app.json / tsconfig.json
└── .env.local               # gitignored — local secrets only
```

## Notes for Future Claude Sessions

- `AGENTS.md` reminds you to read `https://docs.expo.dev/versions/v56.0.0/` before writing native-touching code. Honour it.
- Read the relevant phase section of the v3 design spec (UI) and build spec (logic) in full before starting that phase.
- Memory entries at `C:\Users\chara\.claude\projects\c--Users-chara-Downloads-IDK\memory\` track the current phase. Keep them current.
- The user (Sai) is the sole founder + sole developer — sharp, opinionated, and has corrected the spec 21 times before real code was written. Trust the decisions; ask before re-litigating. They will push back hard on drift, unrequested features, INTVL copying, or phase-skipping — the spec exists to prevent drift over a 10-week MVP.
