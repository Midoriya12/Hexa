# Hexa Screen Design Blueprint

> Derived by merging all 30 INTVL wireframe analyses (intvl_p03–p17), recoloured into Hexa's saffron + dark-ink identity, with INTVL-specific mechanics carved out per locked Hexa decisions.
>
> **Source of truth:** `C:\Users\chara\Code\hexa\docs\hexa-design-spec-v3.pdf` (tokens §2) + `C:\Users\chara\Code\hexa\CLAUDE.md` (patches override the PDF where they conflict). This blueprint *applies* those — it does not override them.
>
> **Phase-0 component library (already built, all live):** `C:\Users\chara\Code\hexa\components\ui\*` + tokens at `C:\Users\chara\Code\hexa\theme\tokens.ts`. Reuse these; do not re-implement. Demo gallery: route `/_devtools/components`.

---

## 1. INTVL-derived visual system

Every INTVL screen is one full-bleed dark canvas built from ~10 recurring patterns. Across all 30 wireframes the same scaffold repeats; INTVL's coral `#FF5A5F` is the only brand colour that changes — it becomes Hexa saffron `#FF6F00` (`colors.saffron[600]`). Below, each shared pattern is mapped to the exact Phase-0 component + token that realises it. **No new primitives are required for any screen** — everything composes from the 13 existing components.

### 1.1 Screen scaffold (every screen)
- **Canvas:** `bg-ink-50` (`#0A0A0A`). Horizontal content padding `layout.screenPadding = 16`. Respect top status-bar inset and bottom home-indicator/safe-area.
- **Surface stack (depth):** background `ink-50` → cards `ink-200` (`#1F1F1F`) → elevated/sheets `ink-100` (`#141414`) → pressed `ink-300`. Borders/dividers always `ink-400` (`#3D3D3D`).
- **Text hierarchy:** primary `ink-900` `#F5F5F5`, body `ink-800` `#D6D6D6`, secondary `ink-700` `#B0B0B0`, caption `ink-600`. Type from `typography` scale (Inter, loaded Phase 1).
- **Default radius:** `borderRadius.md = 12px` on cards/buttons/inputs; `full` on avatars/pills/segmented tracks; `xl = 24px` top-corners on bottom sheets.

### 1.2 Pattern → component map

| INTVL pattern (seen across) | Hexa realisation | Phase-0 component | Saffron/token notes |
|---|---|---|---|
| **Hero / primary CTA button** ("Sign In", "Start Run", "Log run", "Join", "Confirm") | Full-width primary action | `Button` `variant="primary" size="lg"` | `bg-saffron-600`, label `text-ink-50` (dark text on saffron, per built component), `h-56`, `shadow-xs` resting → `shadow-glow-saffron` on press, scale 0.97 + Light haptic |
| **Secondary / ghost / cancel button** | Cancel, "View other options", outlined pair | `Button` `variant="secondary"` (filled `ink-200`) or `variant="ghost"` (saffron text, transparent) | Modal "Cancel" = `secondary`; inline text links = `ghost` |
| **Destructive button** ("Delete Account", "Discard run") | Danger action | `Button` `variant="danger"` | `bg-danger` `#FF3D00`. (Hexa removes "Discard" on walk finish — see §3) |
| **Card row** ([badge/avatar] · [name + meta] · [metric/action]) — clan list, leaderboard, feed, settings | Horizontal row inside a card | `Card` + flex-row composition (`Avatar` left, text column center, metric/`Button`/chevron right) | `Card` = `bg-ink-200 rounded-md shadow-sm p-4`; use `bordered` for emphasis. Divider `border-ink-400` |
| **Header / summary card** (clan badge + name + metric row) | Detail-screen header block | `Card contentHeavy` wrapping `Avatar` + title + `MetricRow size="sm"` | Title `ink-900`, metrics `MetricRow` |
| **Segmented control / sub-tabs** ("My Club \| Leaderboard \| Territories \| History", Date/User/Area, Everyone/Followers, Explore/Runs/Groups) | Animated 2–4 option segmented control | `SubToggle` | Active pill `bg-saffron-600`, `rounded-full bg-ink-200` track, selection haptic, 200ms slide. **Max 4 options** — split overflow into a second control or screen |
| **Ranked list row** (rank# · avatar · name/loc · metric · badge) | Leaderboard / king-of-area row | `Card` (or plain row) + rank pill + `Avatar size={40\|48}` + `Badge` | Rank 1–3 = `Badge tone="saffron"` pill or saffron metric; metric value `text-saffron-600` for top ranks; alternate rows `ink-200`/`ink-100` |
| **Big metric display** (`0.00`, `00:00`, prize value, XP) | Hero numbers, 1–3 cells | `MetricRow` (3–4 cells) for grids; raw `typography['display-*']` + `fontVariant: tabular-nums` for single hero | `MetricRow` numbers `display-md`/`display-sm`, labels uppercase `label-sm ink-600`, optional `dividers` |
| **Avatar / badge thumbnail** (40–96px circular) | Identity + clan/medal badge | `Avatar` (sizes 24/32/40/48/64/96/128) | Photo or initial fallback (solid saffron until gradient dep approved). `bordered` for selection (saffron border via wrapper) |
| **Input field / OTP cells** (email, code, search, profile fields) | Text field + 6-cell OTP | `Input` (label + error) and `OtpInput` | Focus border `border-saffron-600`, error `border-danger`. **OTP is the auth field, not email/password** (see §3) |
| **Status badge / level gate / lock chip** ("Level 5", locked/unlocked, "Capture in Progress") | Pill chip / gate | `Badge` (6 tones) + `FeatureGate` for locked states | `tone="saffron"` unlocked, `tone="neutral"` locked. Gating = `FeatureGate` (gate by "first walk", not XP — §3) |
| **Modal / confirmation dialog** (Join confirm, finish confirm, permission) | Centered card over scrim, dual CTA | `BottomSheet` (or scrim + `Card`) | Scrim `glass.dark` `rgba(10,10,10,0.75)`; sheet `ink-100`, top radius `xl`; footer = `Button` primary + secondary pair |
| **Hold-to-confirm** (Hexa-specific capture/destructive intent) | Press-and-hold ring | `HoldToConfirm` | Saffron progress ring; use for capture dwell affordance + irreversible actions |
| **Toast / inline feedback** (success/error strips) | Transient banner | `Toast` | `success` `#00C853`, `danger` `#FF3D00`, `warning` `#FFAB00` |
| **Progress bar / ring** (XP bar, dwell timer, level progress) | Linear/radial progress | `ProgressIndicator` | Saffron fill on `ink-400` track |
| **Empty / zero state** ("You haven't discovered a run nearby", locked feed) | Centered icon + copy + CTA | `EmptyState` | Icon `iconSize.xl`, copy `ink-700`, optional `Button` |
| **Status strip / glass overlay on map** (GPS, area m², capture progress) | Translucent bar over map | `Card` w/ `glass.blur` bg or `Button variant="glass"` | `bg-glass-dark border-white/10`, `shadow-md`; GPS/active icons saffron |
| **Gradient fill** (elevation/pace chart area fill, celebration glow) | Chart area fill + celebration | charting view + `shadows['glow-saffron']` | Fill saffron `#FF6F00` → transparent `rgba(255,111,0,0.3)`; axes `ink-700`/`ink-400`. (Hexa reframes chart as **Capture Timeline**, not elevation/pace — §3) |
| **Bottom navigation** (INTVL: 4–5 generic/labelled icons) | Fixed tab bar | Expo Router tabs shell (Phase 0 stub) | **Hexa nav is fixed: `Map · Leaderboard · Friends · Profile` (4 tabs).** Active icon/label `saffron-600`, inactive `ink-700`, bar `ink-100`. Do NOT copy INTVL's 5-tab "Feed/Runs/Stats/Leaderboard/Profile" |

### 1.3 Motion & celebration (from `motion` tokens)
- Toggles/focus = `fast` 200ms; modals/transitions = `base` 300ms `standard` easing; **capture success / level-up = `slow` 500ms `bounce` spring + `glow-saffron`**. Map sheet entry = `decelerate`.
- Haptics are baked into `Button`/`Card`/`SubToggle` (Light impact / selection). Use Success haptic on capture, Warning on hex-stolen.

---

## 2. Per-screen blueprint (grouped by Hexa phase)

> INTVL screen numbers (01–30) are cited as the visual source for each Hexa screen. **Phase 1 screens are marked 🟢 BUILD FIRST.** Out-of-phase screens are documented for continuity but must NOT be built ahead of their phase (strict phase gating — overview memory).

### Phase 1 — Foundation & Auth 🟢 (build these first)

> Phase 1 scope = phone-OTP auth + `users` table + bottom-tabs shell. The tab shell ships with **Home/Map and Profile as placeholders**; the other tabs are stubs. Permissions are requested **upfront in this flow**, not inline later.

#### 🟢 P1 — Phone Entry *(from INTVL 01 Welcome/Sign-In; carve-out)*
- **Layout (top→bottom):** status inset → hero block: saffron-tinted headline "Welcome to Hexa" using `typography['display-lg']` → subcopy `body-lg ink-800` → single `Input` for **phone number** (country prefix `+91`, `keyboardType="phone-pad"`) → `Button variant="primary" size="lg"` label **"Continue with Phone"** → small print ToS/Privacy `body-sm ink-700`.
- **Carve-out:** REMOVE email field, password field, "Sign In", the OR divider, and Google/Apple buttons (INTVL 01). REMOVE the Google account chooser entirely (INTVL 02 maps to nothing). Auth is phone-OTP only.
- **Tokens:** bg `ink-50`, input `ink-200`/border `ink-400`→`saffron-600` on focus.

#### 🟢 P1 — OTP Verification *(from INTVL 02 chooser slot, repurposed)*
- **Layout:** back affordance → title "Enter the code" `heading-lg` → "Sent to +91 …" `body-md ink-700` → `OtpInput` (6 cells, `autoFocus`, `oneTimeCode` autofill) → resend countdown link (`ghost` button, disabled during timer) → auto-submit on 6th digit; `Button primary` "Verify" fallback.
- **Backend note (from memory):** verifies against Supabase Auth **test phone numbers** (fixed OTP) in dev; MSG91 wired via Supabase Custom SMS Provider only at launch — no client change. On error use `Input`/`OtpInput` error border + `Toast danger`.

#### 🟢 P1 — Onboarding / Walking Plan *(from INTVL 18 "Create My Running Plan"; recoloured)*
- **Layout:** full-width **saffron accent bar** (`bg-saffron-600`, text `ink-50`) heading "Set up your walks" → short questionnaire as `Card`-wrapped choice rows (`SubToggle` or selectable cards): e.g. "How far do you usually walk?", "Solo or join a clan later?", "Capture reminders on?" → `Button primary size="lg"` "Start walking".
- **Carve-out:** "running plan" → **walking plan / capture preferences**. No XP/level modules here (those are Phase 5). Keep aligned to phone-OTP flow (no email/Google).

#### 🟢 P1 — Profile Setup *(from INTVL 28 Profile Edit; recoloured)*
- **Layout:** header "Profile" centered, back + **Done** (`ghost`) → `Avatar size={96}` with saffron pencil-edit affordance → fields via `Input`: First/Last name (2-col), Username, DOB → **"Hex Territory Colour"** selector: 8 swatches from `colors.player` (`saffron` default, teal/purple/crimson/forest/sky/coral/gold) shown as a row of tappable circles with selected = `bordered` saffron ring → **"Avatar style"** selector (maps INTVL "Current skin").
- **Carve-out:** INTVL "Terra colour" → **Hex Territory Colour** (tints the player's captured hexes on the map). "Current skin" → avatar style. No DOB/Gender are gated to launch-legal needs only.

#### 🟢 P1 — Permissions *(from INTVL 24 Motion Permission; moved upfront)*
- **Layout:** sequence of focused permission cards (one per request): icon `iconSize.xl` → heading `heading-lg` → rationale `body-md ink-800` → `Button primary` "Allow" + `Button ghost`/`secondary` "Not now". Requests: **Location (always/background), Motion & Fitness, Notifications.**
- **Carve-out:** Hexa requests permissions **upfront in the P1 flow**, NOT inline mid-walk like INTVL 24. Use the OS dialog after the rationale card (pre-permission priming pattern).

#### 🟢 P1 — Tab Shell + Home/Map placeholder + Profile placeholder
- **Layout:** Expo Router bottom tabs, **exactly 4: `Map · Leaderboard · Friends · Profile`** (active `saffron-600`, inactive `ink-700`, bar `bg-ink-100` with top hairline `ink-400`). **Home/Map placeholder** = full-bleed `ink-50` with centered `EmptyState` ("Map loads in Phase 2"). **Profile placeholder** = `Card` header (`Avatar` + username + `MetricRow size="sm"` zeros) so the shell is navigable. Leaderboard/Friends = empty route stubs.
- **Carve-out:** Do NOT add Feed as a 5th tab (INTVL 19–22); Feed is Phase 13 and lives off-tab or as a Phase-gated surface.

---

### Phase 2 — Map & Hex Rendering

#### P2 — Map / Home *(from INTVL 03 World Map + INTVL 10 Single-Player Territory Map)*
- **Layout:** full-bleed Mapbox map (light base layer `colors.map.base`, water/road/park tokens) with H3 res-10 hex overlay. Unowned hexes `colors.map.neutral`; player-owned tinted by chosen `player` colour; other players muted. Floating top-left **collapsible legend** (`glass.dark` overlay). Optional floating **status callout** (`Card` w/ glass) showing nearby hex/clan + action. Bottom = the 4-tab nav.
- **Carve-out:** INTVL "Join Club" callout → **"Join Clan"** but clans are Phase 11 — in Phase 2 the callout is hex-info only. "Run nearby" empty state → **"No hexes captured nearby"** (`EmptyState`). Hex cells radius `0`. No filter/sort segmented control until data exists.

#### P2 — Hex Detail *(from INTVL 12 Run Detail, reframed; INTVL 11 King-of-the-Area)*
- **Layout:** `BottomSheet` on hex tap → hex id/region → owner `Avatar` + name + held-since → **MetricRow** (PPH, hold streak, captures) → **"King of the Area"** mini-leaderboard (ranked rows: rank pill + `Avatar` + name + days-held) → action `Button` ("Walk here" / later "Capture").
- **Carve-out:** "King of the Area / run leaders" → **capture holders**; "area" → **hex region**. No pace/elevation.

---

### Phase 4 — Capture FSM & Dwell

#### P4 — Capture Dwell + Success *(from INTVL 23 Start Run, 25 Active, 26 Finish)*
- **Layout (dwell):** map with user pin = **saffron `#FF6F00` circle**; bottom glass panel (`ink-100` semi-transparent) with **`HoldToConfirm` / dwell `ProgressIndicator` ring (20s)** + live `MetricRow` (Distance · Duration · Hexes). Map controls (recenter/layers) = `Button variant="glass"` saffron icons, top-right.
- **Layout (success):** celebration overlay — `display-xl` "HEX CAPTURED", `shadows['glow-saffron']`, Success haptic, `slow` bounce → summary `MetricRow` (hexes captured, clan contribution) → `Button primary` "Save Walk" + `Button ghost` "View Summary".
- **Carve-out:** "Run" → **Walk**; "Avg/Current pace" REMOVED → substitute **Distance · Duration · Hex Captures**. Route line → **hex grid overlay**. **REMOVE "Discard run"** (Hexa simplifies to Save + View). "area m²" → **Hex Count**.

---

### Phase 5 — Levels, Caps, Profile

#### P5 — Profile / Stats *(from INTVL 14 Me-Home, 27 Walk Summary)*
- **Layout:** `Card` header (`Avatar` + username + edit). Three metric cards row: **Level badge** (`Badge tone="saffron"`), **Next-level milestone**, **XP `ProgressIndicator`**. Below: recent captures / activity (`Card` rows). Walk-summary entry rows: distance · duration · hexes, optional `SubToggle`-rated walk, "Tag Clan" toggle.
- **Carve-out:** "XP unlocks" → **capture/hex feature unlocks**; "Add run to Terra" toggle → **"Tag Clan"**; REMOVE "Add INTVL live" (no live streaming); "Community Feed" → **Recent Captures**.

#### P5 — XP / Capture Challenges *(from INTVL 15)*
- **Layout:** "Hex Challenges" header → horizontal-scroll `Card` list (~110×160), each: icon + title + desc + `Badge` (`saffron` unlocked / `neutral` locked) + level-gate via `FeatureGate`.
- **Carve-out:** "XP Challenges" → **Hex/Capture Challenges**; gate by capture milestones, not generic XP.

#### P5+ — Settings *(from INTVL 29)*
- **Layout:** saffron header bar → stacked `Card` rows (icon + label + chevron): Edit profile, App settings, Privacy, Integrations, FAQs, Support, Changelog, **Invite code** → footer `Button primary` "Sign out", `Button danger` "Delete account".
- **Carve-out:** REMOVE "Plans & purchases" / "Restore purchases" (no IAP/sweepstakes). Map INTVL nav "Discover→Leaderboard, Inbox→Friends".

#### P5+ — Visibility / Privacy toggle *(from INTVL 21)*
- **Layout:** "Everyone vs Followers" `SubToggle` (active saffron) inside Settings → friend list `Avatar` rows + "Add friends" `Button primary`.
- **Carve-out:** belongs in **Settings/Privacy, not a feed**. REMOVE the "Share your thoughts" composer (no social posting; share is achievement-only via Share Card P6).

#### P5+ — Invite / Referral Code *(from INTVL 30; reframed)*
- **Layout:** "Invite code" title → explainer → large `Card` (saffron bg) with label + `Input` "Enter code" + helper "4–12 chars, A–Z 0–9" → `Button primary` "Join via invite".
- **Carve-out:** "Unlock Rewards" → **friend/clan invite** (no rewards/sweepstakes). Verify contrast ≥ 4.5:1 for text on saffron card.

---

### Phase 6 — Medals, Streak, Share

#### P6 — Share Card *(from INTVL 26 finish summary, repurposed)*
- **Layout:** generated card: hero stat (`display-lg`), hexes captured, medal `Badge`, clan tag, branded saffron footer → `Button primary` "Share".
- **Carve-out:** **achievement/medal sharing only** — not arbitrary social posts.

---

### Phase 7 — Friends & Leaderboards

#### P7 — Leaderboard *(from INTVL 06 + 07 Club/Member Leaderboard, 11 King-of-Area)*
- **Layout:** header summary `Card` (clan/region badge + name + `MetricRow size="sm"`: hexes captured + members) → `SubToggle` tabs **(Friends · Pincode · City)** (active underline/pill saffron) → optional list/map list/map `SubToggle` thumbnail → scrollable ranked rows: rank pill (top-3 `Badge tone="saffron"`) + `Avatar size={40}` + name `ink-900`/locality `ink-700` + metric `text-saffron-600` for top ranks; alternate `ink-200`/`ink-100`, dividers `ink-400` → 4-tab nav.
- **Carve-out:** "Club"→**Clan**, "Territories/km²"→**Hexes captured**, "Distance run"→**Distance walked**. Tabs are Hexa's **pincode/city/friends** (per phase map), not INTVL's club tabs. No Entry Vault.

#### P7 — Friends *(from INTVL 21 follower list + 20 group suggestions)*
- **Layout:** "Add friends" `Button primary` → contacts-sync prompt → friend `Card` rows (`Avatar` + name + status + add/accept `Button`).
- **Carve-out:** "Followers/Groups" social model → **mutual friends + contacts sync**.

---

### Phase 11 — Clans

#### P11 — Clans Discovery *(from INTVL 04 Browse Clubs, 20 Groups)*
- **Layout:** "Join a Clan" header → optional **6-cell `OtpInput`-style clan-code** entry → "Suggested clans" section → scrollable clan `Card` rows: `Avatar` badge (40–48) + name + meta (`Hexes captured`, members) + `Button primary size="sm"` "Join".
- **Carve-out:** "Club"→**Clan**, "Territory km²"→**Hexes captured**. No sweepstakes/Vault. "Browse all" link = `ghost` saffron.

#### P11 — Clan Confirm Modal *(from INTVL 05)*
- **Layout:** `BottomSheet`/scrim → centered `Avatar size={96}` clan badge → name → "Join this clan?" → footer `Button secondary` "Cancel" + `Button primary` "Confirm".

#### P11 — Clan Detail: Map view *(from INTVL 08 Club Territories)*
- **Layout:** full-bleed map, **multi-colour clan-owned hexes (keep colour distinction — do NOT recolour all to saffron)** → docked summary `Card` (`ink-200`, accents saffron): logo + member count + total hexes + actions. Top-right overflow menu (sort by Date/Owner/Area = `SubToggle`). Legend `glass.dark`.

#### P11 — Clan Detail: Feed/History tab *(from INTVL 09 Club History)*
- **Layout:** `SubToggle` (Feed · History) → activity `Card` rows with **left accent border saffron (3–4px)**: `Avatar size={32}` + title/subtitle + timestamp `ink-700` + action icon.
- **Carve-out:** "run completed"→**hex captured**, "joined club"→**joined clan**. Clans + L3 unlock activate **retroactively at Phase 11** (patch #11) — do not surface earlier.

---

### Phase 13 — Feed (gated)

#### P13 — Feed (+ locked variant) *(from INTVL 19 Explore, 22 Locked)*
- **Layout (unlocked):** "Explore" header + `SubToggle` filters → 2-col `Card` grid of capture posts (image + title + hexes/time + like/comment counts; icons saffron).
- **Layout (locked):** lock icon → "Feed locked" `display-sm` → **"Complete your first walk to unlock"** + `ProgressIndicator`/`FeatureGate` → grayed cards (`ink-400` @50%) → `Button primary` "Start your first walk".
- **Carve-out:** "Runs"→**Captures**. **No leveling/referral gate** — gate by **first-walk-completed** (no PROGA leveling). Remove referral CTA. Feed is NOT a bottom-nav tab.

---

## 3. Carve-outs & conflicts (INTVL → Hexa resolutions)

| # | INTVL pattern | Hexa locked decision | Resolution |
|---|---|---|---|
| 1 | **Email/password + Google/Apple sign-in** (INTVL 01) and **Google account chooser** (INTVL 02) | **Phone-OTP only** (no email/OAuth) | P1 Phone Entry = single phone `Input` + "Continue with Phone". OTP screen = `OtpInput`. **INTVL 02 maps to nothing** — delete from scope. Dev verifies vs Supabase test numbers; MSG91 via Custom SMS Provider at launch. |
| 2 | **Entry Vault / sweepstakes / prizes / IAP** (INTVL 16, 17; "Plans & purchases", "Restore purchases", "$ in Prizes", "Unlock Rewards") | **Excluded — PROGA 2025 compliance gate; not in Phase 1–11** | DROP INTVL 17 entirely. INTVL 16 Competitions → reward-free clan/leaderboard glory only. Settings drops purchase rows. Referral (INTVL 30) reframed as **invite code → join clan/friend**, no rewards. Brand bazaar is Phase 12 behind a PROGA pre-flight. |
| 3 | **Running theme** — runs, pace, splits, elevation, "Terra/km²", route lines, "Start/Finish Run" | **Walking + hex-capture theme** | Global rename: **Run→Walk, club→clan, Terra/km²→hexes, run→capture** (where it's the capture event). Pace/elevation/splits **removed**; charts reframed as **Capture Timeline** (hexes vs walk time). Route line → **hex grid overlay**. User pin = saffron. |
| 4 | **Bottom nav variants** (INTVL: 4 generic icons; 5-tab Feed/Runs/Stats/Leaderboard/Profile; "Discover/Inbox") | **Fixed 4 tabs: Map · Leaderboard · Friends · Profile** | Build exactly these 4 (active saffron, inactive `ink-700`, bar `ink-100`). Map INTVL "Discover→Leaderboard, Inbox→Friends". **Feed is NOT a tab** (Phase 13, gated). |
| 5 | **Inline mid-walk permission prompt** (INTVL 24) | **Permissions requested upfront in P1** | Pre-permission priming cards in the P1 flow (Location/Motion/Notifications) before any walk. No inline permission interrupt during capture. |
| 6 | **Coral `#FF5A5F` brand colour** (all screens) | **Saffron `#FF6F00` (`saffron[600]`)** | Recolour every coral accent (buttons, active toggles, top-rank metrics, chart fills, accent bars, header bars). Primary buttons use **dark `ink-50` label on saffron** (per built `Button`). Saffron-bg cards must keep text contrast ≥ 4.5:1. |
| 7 | **Leveling / XP / referral gating of content** (INTVL 15, 22 locked feed, level-gate badges) | **No PROGA leveling system as a content gate in MVP** | Levels/XP exist as **profile progression** (Phase 5) but DON'T gate feed/features. Locked Feed (P13) gates by **first-walk-completed** via `FeatureGate`, not "Reach Level 2". Remove referral-to-unlock. |
| 8 | **Social composer / "share your thoughts" / following model** (INTVL 21) | **No free-form social posting; friends (mutual) not followers** | Drop the text composer. Sharing = **achievement Share Card (P6)** only. Visibility toggle lives in **Settings/Privacy (P5+)**, not a feed. Friends = mutual + contacts sync (P7). |
| 9 | **Clan-territory hex colours recolour-to-saffron temptation** (INTVL 08, 10) | **Keep per-clan / per-player colour distinction** | On clan/territory maps, use the 8 `colors.player` hues for differentiation; saffron is the *current player's* default + UI accent only — do NOT flatten all hexes to saffron. |
| 10 | **"Discard run" on finish** (INTVL 26) | **Hexa simplifies finish flow** | Replace dual Save/Discard with **"Save Walk" + "View Summary"** — no destructive discard on a completed walk. |
| 11 | **Phase-jumping** (clans, decay, feed visible early) | **Strict phase gating** (PDF + memory) | Build only current-phase screens. Clans/L3 unlock activate **retroactively at Phase 11** (patch #11); decay Phase 10; Feed Phase 13. Mark and defer anything out-of-phase; flag to Sai before advancing. |

---

### Build order summary
1. **Phase 1 (now):** Phone Entry → OTP → Onboarding → Profile Setup → Permissions → Tab shell (Map + Profile placeholders, Leaderboard/Friends stubs).
2. Everything composes from the **13 existing Phase-0 components** at `C:\Users\chara\Code\hexa\components\ui\*` using tokens at `C:\Users\chara\Code\hexa\theme\tokens.ts`. If a screen seems to need a new primitive, it's a signal to re-check the carve-outs above — INTVL almost certainly used a mechanic Hexa excludes.