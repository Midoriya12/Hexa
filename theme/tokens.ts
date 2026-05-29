/**
 * Hexa design tokens — the single source of truth for styling.
 * Values are transcribed verbatim from the v3 Design Spec §2 (Design System: Tokens)
 * and §5.1 (Motion). Do not "improve" or substitute — change the spec, then change here.
 *
 * Consumed by:
 *  - tailwind.config.js (NativeWind utility classes)
 *  - components directly (animations, dynamic values where Tailwind doesn't fit)
 */

// §2.1 — Colour palette ------------------------------------------------------

export const colors = {
  // Brand — saffron. 600 is the PRIMARY brand colour.
  saffron: {
    50: '#FFF3E0',
    100: '#FFE0B2',
    200: '#FFCC80',
    300: '#FFB74D',
    400: '#FFA726',
    500: '#FF9800',
    600: '#FF6F00', // PRIMARY
    700: '#E65100',
    800: '#BF360C',
    900: '#8B2500',
  },
  // Neutral — dark mode default.
  ink: {
    0: '#000000', // true black, reserved for OLED states
    50: '#0A0A0A', // app background
    100: '#141414', // elevated surface (sheets)
    200: '#1F1F1F', // cards
    300: '#2A2A2A', // hover/pressed cards
    400: '#3D3D3D', // borders, dividers
    500: '#5C5C5C', // disabled text
    600: '#8A8A8A', // caption text
    700: '#B0B0B0', // secondary text
    800: '#D6D6D6', // body text
    900: '#F5F5F5', // primary text on dark bg
  },
  // Semantic.
  success: '#00C853', // capture success, level up
  danger: '#FF3D00', // hex stolen, errors
  warning: '#FFAB00', // streak at risk, GPS weak
  info: '#2962FF', // tips, notifications
  // The 8 user-pickable hex/player colours.
  player: {
    saffron: '#FF6F00', // default
    teal: '#00ACC1',
    purple: '#7B1FA2',
    crimson: '#C2185B',
    forest: '#2E7D32',
    sky: '#1976D2',
    coral: '#FF5252',
    gold: '#FFB300',
  },
  // Map base layer (light map under dark UI).
  map: {
    base: '#F5F1EB', // warm off-white land
    water: '#C7D9E8',
    road: '#FFFFFF',
    park: '#D4E5C7',
    neutral: 'rgba(180, 180, 180, 0.25)', // unowned hex fill
  },
  // Translucent overlays for glassmorphism on the map.
  glass: {
    light: 'rgba(255, 255, 255, 0.85)',
    dark: 'rgba(10, 10, 10, 0.75)',
    blur: 'rgba(20, 20, 20, 0.6)', // pair with backdrop-blur
  },
} as const;

// §2.2 — Typography ----------------------------------------------------------

export const fontFamily = {
  // Inter (Google Fonts). Weights 400/500/600/700/800. Loaded in Phase 1.
  sans: 'Inter',
} as const;

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

/**
 * Type scale. Each token carries fontSize, lineHeight (px) and fontWeight.
 * Numbers (not strings) so they drop straight into RN <Text> styles.
 */
export const typography = {
  'display-xl': { fontSize: 64, lineHeight: 72, fontWeight: '800' }, // capture success, level up
  'display-lg': { fontSize: 48, lineHeight: 56, fontWeight: '700' }, // onboarding hero, big stats
  'display-md': { fontSize: 36, lineHeight: 44, fontWeight: '700' }, // page titles when no nav bar
  'display-sm': { fontSize: 28, lineHeight: 36, fontWeight: '700' }, // section headers
  'heading-lg': { fontSize: 24, lineHeight: 32, fontWeight: '600' }, // card titles, sheet headers
  'heading-md': { fontSize: 20, lineHeight: 28, fontWeight: '600' }, // subsection headers
  'heading-sm': { fontSize: 18, lineHeight: 26, fontWeight: '600' }, // list item titles
  'body-lg': { fontSize: 16, lineHeight: 24, fontWeight: '400' }, // default body
  'body-md': { fontSize: 15, lineHeight: 22, fontWeight: '400' }, // card body, descriptions
  'body-sm': { fontSize: 14, lineHeight: 20, fontWeight: '400' }, // captions, helper text
  'label-md': { fontSize: 14, lineHeight: 20, fontWeight: '500' }, // form labels, button text
  'label-sm': { fontSize: 12, lineHeight: 16, fontWeight: '500' }, // tags, badges, micro-labels
  'mono-md': { fontSize: 16, lineHeight: 24, fontWeight: '500' }, // numbers (use tabular-nums)
} as const;

// §2.3 — Spacing scale (4-based, px) -----------------------------------------

export const spacing = {
  0: 0,
  1: 4, // icon-to-text micro gap
  2: 8, // inline padding, tight gaps
  3: 12, // default vertical rhythm
  4: 16, // card padding, section gap
  5: 20, // list item padding
  6: 24, // section padding
  8: 32, // major section gap
  10: 40, // hero spacing
  12: 48, // screen padding (top/bottom)
  16: 64, // empty state vertical
} as const;

// §2.4 — Border radius (px) --------------------------------------------------

export const borderRadius = {
  none: 0,
  sm: 8, // tags, small chips
  md: 12, // DEFAULT — buttons, cards, inputs
  lg: 16, // large cards, hero sections
  xl: 24, // bottom sheets (top corners only)
  '2xl': 32, // hero cards (rare)
  full: 9999, // avatars, pill buttons, fab
} as const;

// §2.5 — Shadow / elevation --------------------------------------------------
// CSS box-shadow strings. RN 0.85 (new arch) supports the `boxShadow` style prop,
// and NativeWind maps these onto `shadow-*` utilities via tailwind.config.js.

export const shadows = {
  none: 'none',
  xs: '0 1px 2px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.04)', // buttons resting
  sm: '0 2px 8px rgba(0,0,0,0.5)', // cards on dark bg
  md: '0 8px 24px rgba(0,0,0,0.55)', // floating buttons, FAB
  lg: '0 16px 48px rgba(0,0,0,0.6)', // bottom sheets, modals
  'glow-saffron': '0 0 24px rgba(255,111,0,0.4)', // active capture, celebration
} as const;

// §2.6 — Iconography ---------------------------------------------------------
// Tabler Icons, outline, stroke width 1.75 (library added in Phase 1).

export const iconSize = {
  inline: 16, // inline with body text
  sm: 20, // list items, secondary actions
  md: 24, // DEFAULT — nav, buttons
  lg: 32, // primary actions
  xl: 48, // empty states, celebrations
} as const;

export const iconStrokeWidth = 1.75;

// §2.7 / §2.8 — Layout -------------------------------------------------------

export const layout = {
  screenPadding: 16, // full-width content horizontal padding on phones
  tabletMaxWidth: 480, // post-MVP: constrain width, don't redesign
} as const;

// §5.1 — Motion (durations in ms, easing curves) -----------------------------

export const motion = {
  duration: {
    instant: 100, // micro-interactions (button press)
    fast: 200, // hover, focus, toggle
    base: 300, // most transitions, modal in/out
    slow: 500, // celebrations, level ups
    crawl: 800, // hero animations, onboarding
  },
  easing: {
    standard: 'cubic-bezier(0.4, 0.0, 0.2, 1)', // default
    decelerate: 'cubic-bezier(0.0, 0.0, 0.2, 1)', // entering
    accelerate: 'cubic-bezier(0.4, 0.0, 1, 1)', // exiting
    spring: { damping: 18, stiffness: 200 }, // spring config
    bounce: { damping: 10, stiffness: 200 }, // celebration spring
  },
} as const;

// Convenience grouped export.
export const tokens = {
  colors,
  fontFamily,
  fontWeight,
  typography,
  spacing,
  borderRadius,
  shadows,
  iconSize,
  iconStrokeWidth,
  layout,
  motion,
} as const;

export type Tokens = typeof tokens;
export type TypographyToken = keyof typeof typography;
export type PlayerColor = keyof typeof colors.player;
export type BadgeTone = 'neutral' | 'success' | 'danger' | 'warning' | 'saffron' | 'info';
