import supabase from '../config/supabase.js';
import { haversineDistanceKm, parseCoordinate, boundingBoxFromCenter } from '../utils/geo.js';
import { apiCache } from '../utils/ttlCache.js';

const THERAPIST_NEARBY_COLUMNS =
  'therapist_id, full_name, profession, address, phone, latitude, longitude, clinic_id';

const CLINIC_NEARBY_COLUMNS =
  'clinic_id, name, address, latitude, longitude, phone, is_active';

const PROVIDER_LOCATIONS_TTL_MS = 5 * 60 * 1000;

function mapTherapist(row, userLat, userLng) {
  const lat = parseCoordinate(row.latitude);
  const lng = parseCoordinate(row.longitude);
  if (lat == null || lng == null) return null;

  return {
    type: 'therapist',
    id: row.therapist_id,
    name: row.full_name || 'Therapist',
    profession: row.profession || null,
    address: row.address || null,
    lat,
    lng,
    distance_km: haversineDistanceKm(userLat, userLng, lat, lng),
    phone: row.phone || null,
    clinic_id: row.clinic_id || null,
  };
}

function mapClinic(row, userLat, userLng) {
  const lat = parseCoordinate(row.latitude);
  const lng = parseCoordinate(row.longitude);
  if (lat == null || lng == null) return null;

  return {
    type: 'clinic',
    id: row.clinic_id,
    name: row.name || 'Clinic',
    address: row.address || null,
    lat,
    lng,
    distance_km: haversineDistanceKm(userLat, userLng, lat, lng),
    phone: row.phone || null,
  };
}

function inBoundingBox(lat, lng, bbox) {
  return lat >= bbox.minLat && lat <= bbox.maxLat && lng >= bbox.minLng && lng <= bbox.maxLng;
}

async function loadTherapistsWithCoords() {
  return apiCache.getOrSet('nearby:therapists:all', PROVIDER_LOCATIONS_TTL_MS, async () => {
    const { data, error } = await supabase
      .from('therapists')
      .select(THERAPIST_NEARBY_COLUMNS)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    if (error) throw error;
    return data || [];
  });
}

async function loadClinicsWithCoords() {
  return apiCache.getOrSet('nearby:clinics:all', PROVIDER_LOCATIONS_TTL_MS, async () => {
    const { data, error } = await supabase
      .from('clinics')
      .select(CLINIC_NEARBY_COLUMNS)
      .eq('is_active', true)
      .not('latitude', 'is', null)
      .not('longitude', 'is', null);
    if (error) throw error;
    return data || [];
  });
}

/** GET /api/nearby-providers?lat=&lng=&radiusKm=25 */
export async function listNearbyProviders(req, res) {
  const userLat = parseCoordinate(req.query.lat);
  const userLng = parseCoordinate(req.query.lng);
  const radiusKm = parseCoordinate(req.query.radiusKm) ?? 25;

  if (userLat == null || userLng == null) {
    return res.status(400).json({ error: 'lat and lng query parameters are required' });
  }

  const bbox = boundingBoxFromCenter(userLat, userLng, radiusKm);
  const providers = [];

  try {
    const [therapists, clinics] = await Promise.all([
      loadTherapistsWithCoords(),
      loadClinicsWithCoords(),
    ]);

    for (const row of therapists) {
      const lat = parseCoordinate(row.latitude);
      const lng = parseCoordinate(row.longitude);
      if (lat == null || lng == null || !inBoundingBox(lat, lng, bbox)) continue;
      const mapped = mapTherapist(row, userLat, userLng);
      if (mapped && mapped.distance_km <= radiusKm) {
        providers.push(mapped);
      }
    }

    for (const row of clinics) {
      const lat = parseCoordinate(row.latitude);
      const lng = parseCoordinate(row.longitude);
      if (lat == null || lng == null || !inBoundingBox(lat, lng, bbox)) continue;
      const mapped = mapClinic(row, userLat, userLng);
      if (mapped && mapped.distance_km <= radiusKm) {
        providers.push(mapped);
      }
    }
  } catch (err) {
    console.warn('nearby-providers query:', err?.message || err);
    return res.status(500).json({ error: 'Failed to load nearby providers.' });
  }

  providers.sort((a, b) => a.distance_km - b.distance_km);

  return res.json({
    user_location: { lat: userLat, lng: userLng },
    radius_km: radiusKm,
    providers,
  });
}
