// Mapbox walking Directions — a route line from the player to a target hex (Start's crosshair).
// Uses the public token (already bundled). Returns the route as a GeoJSON LineString, or null.
const TOKEN = process.env.EXPO_PUBLIC_MAPBOX_PUBLIC_TOKEN ?? '';

export async function getWalkingRoute(
  from: [number, number], // [lng, lat]
  to: [number, number],
): Promise<GeoJSON.LineString | null> {
  if (!TOKEN) return null;
  const coords = `${from[0]},${from[1]};${to[0]},${to[1]}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${coords}?geometries=geojson&overview=full&access_token=${TOKEN}`;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const json = await res.json();
    const geom = json.routes?.[0]?.geometry;
    return geom?.type === 'LineString' ? (geom as GeoJSON.LineString) : null;
  } catch {
    return null;
  }
}
