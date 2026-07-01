import 'package:geolocator/geolocator.dart';

enum LocationAccessStatus {
  granted,
  denied,
  deniedForever,
  serviceDisabled,
  error,
}

class UserPosition {
  const UserPosition({required this.lat, required this.lng});

  final double lat;
  final double lng;
}

/// Requests device location permission and reads the current GPS fix.
class LocationService {
  Future<({LocationAccessStatus status, UserPosition? position})>
      getCurrentPosition() async {
    try {
      final serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        return (status: LocationAccessStatus.serviceDisabled, position: null);
      }

      var permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
      }

      if (permission == LocationPermission.denied) {
        return (status: LocationAccessStatus.denied, position: null);
      }
      if (permission == LocationPermission.deniedForever) {
        return (status: LocationAccessStatus.deniedForever, position: null);
      }

      final position = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
      );

      return (
        status: LocationAccessStatus.granted,
        position: UserPosition(lat: position.latitude, lng: position.longitude),
      );
    } catch (_) {
      return (status: LocationAccessStatus.error, position: null);
    }
  }

  Future<bool> openAppSettings() => Geolocator.openAppSettings();

  Future<bool> openLocationSettings() => Geolocator.openLocationSettings();
}
