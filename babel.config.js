// babel-preset-expo auto-includes the reanimated/worklets plugin; do not add it
// manually. jsxImportSource + nativewind/babel wire up className styling.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
  };
};
