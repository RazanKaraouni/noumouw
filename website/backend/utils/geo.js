const EARTH_RADIUS_KM = 6371;

/** Great-circle distance in kilometres (Haversine). */
export function haversineDistanceKm(lat1, lng1, lat2, lng2) {
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return EARTH_RADIUS_KM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function parseCoordinate(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Approximate lat/lng bounding box for a radius in km (pre-filter before Haversine). */
export function boundingBoxFromCenter(lat, lng, radiusKm) {
  const latDelta = radiusKm / 111.32;
  const lngScale = Math.max(Math.cos((lat * Math.PI) / 180), 0.01);
  const lngDelta = radiusKm / (111.32 * lngScale);
  return {
    minLat: lat - latDelta,
    maxLat: lat + latDelta,
    minLng: lng - lngDelta,
    maxLng: lng + lngDelta,
  };
}
