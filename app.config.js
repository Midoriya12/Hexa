// Dynamic Expo config. Layers env-driven native config on top of app.json so secrets
// stay out of git: the Mapbox SDK download token (sk.*) comes from MAPBOX_SECRET_TOKEN
// in .env.local (build-time only), and the location permission strings are set here.
// Expo passes the resolved app.json as `config`.
module.exports = ({ config }) => {
  const plugins = (config.plugins || []).map((p) =>
    p === '@rnmapbox/maps'
      ? ['@rnmapbox/maps', { RNMapboxMapsDownloadToken: process.env.MAPBOX_SECRET_TOKEN || '' }]
      : p,
  );

  plugins.push([
    'expo-location',
    {
      locationWhenInUsePermission: 'Hexa uses your location to know which hexes you are standing in.',
      locationAlwaysAndWhenInUsePermission:
        'Hexa checks your location in the background so you can be notified when someone walks into your hex.',
      isAndroidBackgroundLocationEnabled: true,
    },
  ]);

  return { ...config, plugins };
};
