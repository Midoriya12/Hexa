// Tailwind / NativeWind config. Consumes theme/tokens.ts (the single source of
// truth) so utility classes and component styles never drift apart.
// Tailwind v3.4 loads this config through jiti, which resolves the TS token file.
const {
  colors,
  spacing,
  borderRadius,
  typography,
  shadows,
  fontFamily,
  fontWeight,
} = require('./theme/tokens');

const px = (obj) =>
  Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, `${v}px`]));

const fontSize = Object.fromEntries(
  Object.entries(typography).map(([name, t]) => [
    name,
    [`${t.fontSize}px`, { lineHeight: `${t.lineHeight}px`, fontWeight: t.fontWeight }],
  ]),
);

/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './app/**/*.{js,jsx,ts,tsx}',
    './components/**/*.{js,jsx,ts,tsx}',
  ],
  presets: [require('nativewind/preset')],
  theme: {
    extend: {
      colors,
      spacing: px(spacing),
      borderRadius: px(borderRadius),
      fontSize,
      fontFamily: { sans: [fontFamily.sans] },
      fontWeight,
      boxShadow: shadows,
    },
  },
  plugins: [],
};
