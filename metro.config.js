const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// Windows stability: stop Metro from crawling/watching huge generated trees. The
// native android/ folder (Gradle build outputs) is thousands of files and was a
// prime cause of EMFILE "too many open files" + slow/crashing bundles. Excluding it
// (plus other non-source dirs) cuts the file-handle load dramatically.
config.resolver.blockList = [
  /[/\\]android[/\\].*/,
  /[/\\]ios[/\\].*/,
  /[/\\]\.expo[/\\].*/,
  /[/\\]\.git[/\\].*/,
  /[/\\]docs[/\\].*/,
  /[/\\]dist[/\\].*/,
];

// Cap parallel transform workers — fewer concurrent open files = no EMFILE on Windows.
config.maxWorkers = 2;

module.exports = withNativeWind(config, { input: './global.css' });
