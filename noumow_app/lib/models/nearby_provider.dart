/// A clinic or therapist pin returned by `/api/nearby-providers`.
class NearbyProvider {
  const NearbyProvider({
    required this.type,
    required this.id,
    required this.name,
    required this.lat,
    required this.lng,
    required this.distanceKm,
    this.profession,
    this.address,
    this.phone,
    this.clinicId,
  });

  final String type;
  final String id;
  final String name;
  final double lat;
  final double lng;
  final double distanceKm;
  final String? profession;
  final String? address;
  final String? phone;
  final String? clinicId;

  bool get isTherapist => type == 'therapist';
  bool get isClinic => type == 'clinic';

  factory NearbyProvider.fromJson(Map<String, dynamic> json) {
    return NearbyProvider(
      type: (json['type'] ?? '').toString(),
      id: (json['id'] ?? '').toString(),
      name: (json['name'] ?? '').toString(),
      lat: _toDouble(json['lat']),
      lng: _toDouble(json['lng']),
      distanceKm: _toDouble(json['distance_km']),
      profession: _optionalString(json['profession']),
      address: _optionalString(json['address']),
      phone: _optionalString(json['phone']),
      clinicId: _optionalString(json['clinic_id']),
    );
  }
}

class NearbyProvidersResult {
  const NearbyProvidersResult({
    required this.userLat,
    required this.userLng,
    required this.radiusKm,
    required this.providers,
  });

  final double userLat;
  final double userLng;
  final double radiusKm;
  final List<NearbyProvider> providers;

  factory NearbyProvidersResult.fromJson(Map<String, dynamic> json) {
    final userLoc = json['user_location'] as Map<String, dynamic>? ?? {};
    final raw = json['providers'] as List<dynamic>? ?? [];
    return NearbyProvidersResult(
      userLat: _toDouble(userLoc['lat']),
      userLng: _toDouble(userLoc['lng']),
      radiusKm: _toDouble(json['radius_km'], fallback: 25),
      providers: raw
          .whereType<Map<String, dynamic>>()
          .map(NearbyProvider.fromJson)
          .toList(),
    );
  }
}

double _toDouble(dynamic value, {double fallback = 0}) {
  if (value is num) return value.toDouble();
  return double.tryParse('$value') ?? fallback;
}

String? _optionalString(dynamic value) {
  final s = (value ?? '').toString().trim();
  return s.isEmpty ? null : s;
}
