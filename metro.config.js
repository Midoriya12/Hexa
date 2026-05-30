const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Windows EMFILE mitigation: cap parallel transform workers so Metro opens fewer
// files at once. (Do NOT add a blockList for /dist/ — it blocks
// react-native-css-interop/dist/runtime/jsx-runtime.js and breaks NativeWind.)
config.maxWorkers = 2;

module.exports = withNativeWind(config, { input: './global.css' });
