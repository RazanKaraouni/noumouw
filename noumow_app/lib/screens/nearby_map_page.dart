import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';

import '../models/nearby_provider.dart';
import '../services/chat_service.dart';
import '../services/location_service.dart';
import '../services/nearby_providers_service.dart';
import '../theme/app_colors.dart';

/// OpenStreetMap view of nearby clinics and therapists.
class NearbyMapPage extends StatefulWidget {
  const NearbyMapPage({super.key});

  @override
  State<NearbyMapPage> createState() => _NearbyMapPageState();
}

class _NearbyMapPageState extends State<NearbyMapPage> {
  final _mapController = MapController();
  final _locationService = LocationService();
  final _nearbyService = NearbyProvidersService();
  final _chatService = ChatService();
  final _supabase = Supabase.instance.client;

  static const _radiusOptions = [10.0, 25.0, 50.0];

  double _radiusKm = 25;
  bool _loading = true;
  String? _error;
  LocationAccessStatus? _locationStatus;
  UserPosition? _userPosition;
  List<NearbyProvider> _providers = [];
  NearbyProvider? _selected;
  String? _contactingTherapistId;

  @override
  void initState() {
    super.initState();
    _load();
  }

  Future<void> _load() async {
    setState(() {
      _loading = true;
      _error = null;
      _selected = null;
    });

    final loc = await _locationService.getCurrentPosition();
    if (!mounted) return;

    if (loc.status != LocationAccessStatus.granted || loc.position == null) {
      setState(() {
        _loading = false;
        _locationStatus = loc.status;
        _userPosition = null;
        _providers = [];
      });
      return;
    }

    setState(() {
      _locationStatus = LocationAccessStatus.granted;
      _userPosition = loc.position;
    });

    try {
      final result = await _nearbyService.fetchNearby(
        lat: loc.position!.lat,
        lng: loc.position!.lng,
        radiusKm: _radiusKm,
      );
      if (!mounted) return;
      setState(() {
        _providers = result.providers;
        _loading = false;
      });
      _mapController.move(
        LatLng(loc.position!.lat, loc.position!.lng),
        12,
      );
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _error = userFacingErrorMessage(e);
        _loading = false;
      });
    }
  }

  Future<void> _onRadiusChanged(double radius) async {
    if (_radiusKm == radius) return;
    setState(() => _radiusKm = radius);
    await _load();
  }

  void _selectProvider(NearbyProvider provider) {
    setState(() => _selected = provider);
    _mapController.move(LatLng(provider.lat, provider.lng), 14);
  }

  Future<void> _contactTherapist(NearbyProvider provider) async {
    if (!provider.isTherapist) return;
    if (_supabase.auth.currentUser == null) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('therapists_sign_in_to_contact'.tr())),
      );
      return;
    }

    setState(() => _contactingTherapistId = provider.id);
    try {
      final roomId = await _chatService.ensureParentRoom(provider.id);
      if (!mounted) return;
      if (roomId == null || roomId.isEmpty) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('chat_room_error'.tr())),
        );
        return;
      }
      Navigator.pop<Map<String, String>>(context, {
        'therapistId': provider.id,
        'roomId': roomId,
      });
    } catch (e) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'therapists_contact_error'.tr(namedArgs: {'error': userFacingErrorMessage(e)}),
          ),
        ),
      );
    } finally {
      if (mounted) setState(() => _contactingTherapistId = null);
    }
  }

  Future<void> _callPhone(String? phone) async {
    final digits = (phone ?? '').replaceAll(RegExp(r'[^\d+]'), '');
    if (digits.isEmpty) return;
    final uri = Uri(scheme: 'tel', path: digits);
    if (await canLaunchUrl(uri)) {
      await launchUrl(uri);
    }
  }

  String _distanceLabel(double km) {
    if (km < 1) {
      final meters = (km * 1000).round();
      return 'nearby_distance_m'.tr(namedArgs: {'meters': '$meters'});
    }
    return 'nearby_distance_km'.tr(namedArgs: {'km': km.toStringAsFixed(1)});
  }

  Widget _buildRadiusChips() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      padding: Responsive.padSymmetric(context, horizontal: 16, vertical: 8),
      child: Row(
        children: _radiusOptions.map((radius) {
          final selected = _radiusKm == radius;
          return Padding(
            padding: EdgeInsetsDirectional.only(end: context.rg(8)),
            child: ChoiceChip(
              label: Text(
                'nearby_radius_km'.tr(namedArgs: {'km': '$radius'}),
                style: TextStyle(fontSize: context.rf(13)),
              ),
              selected: selected,
              onSelected: _loading ? null : (_) => _onRadiusChanged(radius),
              selectedColor: AppColors.primary.withOpacity(0.15),
              labelStyle: TextStyle(
                color: selected ? AppColors.primary : AppColors.textSec,
                fontWeight: selected ? FontWeight.w700 : FontWeight.w500,
                fontSize: context.rf(13),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }

  Widget _buildLocationBlocked() {
    final status = _locationStatus;
    String message;
    String actionLabel;
    VoidCallback? onAction;

    switch (status) {
      case LocationAccessStatus.serviceDisabled:
        message = 'nearby_location_disabled'.tr();
        actionLabel = 'nearby_open_location_settings'.tr();
        onAction = () async {
          await _locationService.openLocationSettings();
          await _load();
        };
      case LocationAccessStatus.deniedForever:
        message = 'nearby_location_denied_forever'.tr();
        actionLabel = 'nearby_open_app_settings'.tr();
        onAction = () async {
          await _locationService.openAppSettings();
          await _load();
        };
      case LocationAccessStatus.denied:
        message = 'nearby_location_denied'.tr();
        actionLabel = 'nearby_try_again'.tr();
        onAction = _load;
      default:
        message = 'nearby_location_error'.tr();
        actionLabel = 'nearby_try_again'.tr();
        onAction = _load;
    }

    return Center(
      child: Padding(
        padding: Responsive.padAll(context, 24),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(
              Icons.location_off_rounded,
              size: context.rs(48),
              color: AppColors.textSec.withOpacity(0.7),
            ),
            SizedBox(height: context.rg(16)),
            Text(
              message,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: context.rf(15),
                color: AppColors.textSec.withOpacity(0.95),
                height: 1.4,
              ),
            ),
            SizedBox(height: context.rg(20)),
            FilledButton(
              onPressed: onAction,
              style: FilledButton.styleFrom(
                backgroundColor: AppColors.primary,
              ),
              child: Text(actionLabel),
            ),
          ],
        ),
      ),
    );
  }

  List<Marker> _buildMarkers() {
    final user = _userPosition;
    if (user == null) return const [];

    final markerSize = context.rs(36);
    return [
      Marker(
        point: LatLng(user.lat, user.lng),
        width: markerSize,
        height: markerSize,
        child: Container(
          decoration: BoxDecoration(
            color: const Color(0xFF2563EB),
            shape: BoxShape.circle,
            border: Border.all(color: Colors.white, width: context.rs(3)),
            boxShadow: Responsive.cardShadow(
              context,
              opacity: 0.2,
              blur: 6,
              offsetY: 0,
            ),
          ),
          child: Icon(
            Icons.person_pin_circle,
            color: Colors.white,
            size: context.rs(18),
          ),
        ),
      ),
    ];
  }

  String _locationLabel(NearbyProvider provider) {
    final address = provider.address?.trim();
    if (address != null && address.isNotEmpty) return address;
    return 'nearby_location_unavailable'.tr();
  }

  Widget _buildSelectedCard() {
    final selected = _selected;
    if (selected == null) return const SizedBox.shrink();

    final contacting =
        selected.isTherapist && _contactingTherapistId == selected.id;
    final buttonHeight = context.rs(40);

    return AppCard(
      color: AppColors.white,
      borderColor: AppColors.border,
      margin: Responsive.padDirectional(
        context,
        start: 12,
        end: 12,
        bottom: 12,
      ),
      padding: Responsive.padAll(context, 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  selected.name,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: context.rf(15),
                    fontWeight: FontWeight.w700,
                    color: AppColors.textPri,
                  ),
                ),
              ),
              IconButton(
                onPressed: () => setState(() => _selected = null),
                icon: Icon(Icons.close_rounded, size: context.rs(20)),
                visualDensity: VisualDensity.compact,
                padding: EdgeInsets.zero,
                constraints: BoxConstraints(
                  minWidth: context.rs(32),
                  minHeight: context.rs(32),
                ),
              ),
            ],
          ),
          if (selected.profession != null) ...[
            Text(
              selected.profession!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.rf(12),
                fontWeight: FontWeight.w500,
                color: AppColors.primary,
              ),
            ),
            SizedBox(height: context.rg(4)),
          ],
          Text(
            _distanceLabel(selected.distanceKm),
            style: TextStyle(
              fontSize: context.rf(12),
              color: AppColors.textSec.withOpacity(0.95),
            ),
          ),
          if (selected.address != null) ...[
            SizedBox(height: context.rg(4)),
            Text(
              selected.address!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(
                fontSize: context.rf(12),
                color: AppColors.textSec.withOpacity(0.95),
              ),
            ),
          ],
          SizedBox(height: context.rg(8)),
          Row(
            children: [
              if (selected.phone != null)
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: () => _callPhone(selected.phone),
                    icon: Icon(Icons.phone_rounded, size: context.rs(16)),
                    label: Text(
                      'nearby_call'.tr(),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    style: OutlinedButton.styleFrom(
                      minimumSize: Size(0, buttonHeight),
                      padding: Responsive.padSymmetric(
                        context,
                        horizontal: 8,
                        vertical: 8,
                      ),
                      textStyle: TextStyle(fontSize: context.rf(13)),
                    ),
                  ),
                ),
              if (selected.phone != null && selected.isTherapist)
                SizedBox(width: context.rg(8)),
              if (selected.isTherapist)
                Expanded(
                  child: contacting
                      ? SizedBox(
                          height: buttonHeight,
                          child: const Center(
                            child: CircularProgressIndicator(strokeWidth: 2),
                          ),
                        )
                      : FilledButton.icon(
                          onPressed: () => _contactTherapist(selected),
                          icon: Icon(
                            Icons.chat_bubble_outline_rounded,
                            size: context.rs(16),
                          ),
                          label: Text(
                            'therapists_contact'.tr(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                          style: FilledButton.styleFrom(
                            backgroundColor: AppColors.primary,
                            minimumSize: Size(0, buttonHeight),
                            padding: Responsive.padSymmetric(
                              context,
                              horizontal: 8,
                              vertical: 8,
                            ),
                            textStyle: TextStyle(fontSize: context.rf(13)),
                          ),
                        ),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildProviderList() {
    if (_error != null) {
      return Padding(
        padding: Responsive.padAll(context, 20),
        child: Text(
          _error!,
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: context.rf(14),
            color: AppColors.textSec.withOpacity(0.95),
            height: 1.4,
          ),
        ),
      );
    }

    if (_providers.isEmpty) {
      return Padding(
        padding: Responsive.padAll(context, 20),
        child: Text(
          'nearby_empty'.tr(namedArgs: {'km': '$_radiusKm'}),
          textAlign: TextAlign.center,
          style: TextStyle(
            fontSize: context.rf(14),
            color: AppColors.textSec.withOpacity(0.95),
            height: 1.4,
          ),
        ),
      );
    }

    return ListView.separated(
      padding: Responsive.padSymmetric(context, horizontal: 12, vertical: 8),
      itemCount: _providers.length,
      separatorBuilder: (_, __) => SizedBox(height: context.rg(8)),
      itemBuilder: (context, i) {
        final p = _providers[i];
        final isSelected = _selected?.id == p.id && _selected?.type == p.type;
        return _buildProviderTile(p, isSelected: isSelected);
      },
    );
  }

  Widget _buildProviderTile(NearbyProvider p, {required bool isSelected}) {
    return Material(
      color: isSelected
          ? AppColors.primary.withOpacity(0.06)
          : AppColors.white,
      borderRadius: BorderRadius.circular(context.rs(10)),
      child: InkWell(
        onTap: () => _selectProvider(p),
        borderRadius: BorderRadius.circular(context.rs(10)),
        child: Container(
          width: double.infinity,
          constraints: BoxConstraints(minHeight: context.rs(72)),
          padding: Responsive.padSymmetric(
            context,
            horizontal: 12,
            vertical: 10,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(context.rs(10)),
            border: Border.all(
              color: isSelected ? AppColors.primary : AppColors.border,
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Padding(
                padding: EdgeInsets.only(top: context.rs(2)),
                child: Icon(
                  p.isClinic
                      ? Icons.local_hospital_rounded
                      : Icons.medical_services_rounded,
                  color: AppColors.primary,
                  size: context.rs(22),
                ),
              ),
              SizedBox(width: context.rg(10)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      p.name,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        color: AppColors.textPri,
                        fontSize: context.rf(14),
                        height: 1.25,
                      ),
                    ),
                    SizedBox(height: context.rg(4)),
                    Text(
                      _locationLabel(p),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: context.rf(12),
                        color: AppColors.textSec.withOpacity(0.95),
                        height: 1.3,
                      ),
                    ),
                  ],
                ),
              ),
              SizedBox(width: context.rg(8)),
              Text(
                _distanceLabel(p.distanceKm),
                style: TextStyle(
                  fontSize: context.rf(12),
                  fontWeight: FontWeight.w700,
                  color: AppColors.primary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = _userPosition;
    final initialCenter = user != null
        ? LatLng(user.lat, user.lng)
        : const LatLng(31.95, 35.91);

    return Scaffold(
      appBar: AppBar(
        title: Text('nearby_map_title'.tr()),
        actions: [
          IconButton(
            onPressed: _loading ? null : _load,
            icon: const Icon(Icons.my_location_rounded),
            tooltip: 'nearby_refresh_location'.tr(),
          ),
        ],
      ),
      body: Column(
        children: [
          _buildRadiusChips(),
          Expanded(
            child: _loading && user == null
                ? Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        const CircularProgressIndicator(),
                        SizedBox(height: context.rg(12)),
                        Text(
                          'nearby_loading'.tr(),
                          style: TextStyle(
                            fontSize: context.rf(13),
                            color: AppColors.textSec.withOpacity(0.95),
                          ),
                        ),
                      ],
                    ),
                  )
                : user == null
                    ? _buildLocationBlocked()
                    : LayoutBuilder(
                        builder: (context, constraints) {
                          final listHeight = (constraints.maxHeight * 0.42)
                              .clamp(context.rs(220), context.rs(360));

                          return Column(
                            children: [
                              Expanded(
                                child: Stack(
                                  clipBehavior: Clip.none,
                                  children: [
                                    FlutterMap(
                                      mapController: _mapController,
                                      options: MapOptions(
                                        initialCenter: initialCenter,
                                        initialZoom: 12,
                                        onTap: (_, __) =>
                                            setState(() => _selected = null),
                                      ),
                                      children: [
                                        TileLayer(
                                          urlTemplate:
                                              'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                                          userAgentPackageName:
                                              'com.noumouw.parent',
                                        ),
                                        MarkerLayer(markers: _buildMarkers()),
                                      ],
                                    ),
                                    if (_loading)
                                      Container(
                                        color: Colors.black.withOpacity(0.08),
                                        child: const Center(
                                          child: CircularProgressIndicator(),
                                        ),
                                      ),
                                    if (_error != null && !_loading)
                                      Positioned(
                                        top: context.rs(12),
                                        left: context.rs(16),
                                        right: context.rs(16),
                                        child: AppCard(
                                          color: AppColors.white,
                                          padding:
                                              Responsive.padAll(context, 12),
                                          child: Column(
                                            mainAxisSize: MainAxisSize.min,
                                            children: [
                                              Text(
                                                _error!,
                                                textAlign: TextAlign.center,
                                                style: TextStyle(
                                                  color: Colors.red,
                                                  fontSize: context.rf(13),
                                                ),
                                              ),
                                              SizedBox(height: context.rg(8)),
                                              OutlinedButton(
                                                onPressed: _load,
                                                child: Text(
                                                  'nearby_try_again'.tr(),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ),
                                    if (_selected != null)
                                      Positioned(
                                        left: 0,
                                        right: 0,
                                        bottom: 0,
                                        child: _buildSelectedCard(),
                                      ),
                                  ],
                                ),
                              ),
                              SizedBox(
                                height: listHeight,
                                child: SafeArea(
                                  top: false,
                                  child: Container(
                                    width: double.infinity,
                                    decoration: const BoxDecoration(
                                      color: AppColors.white,
                                      border: Border(
                                        top: BorderSide(
                                          color: AppColors.border,
                                        ),
                                      ),
                                    ),
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Padding(
                                          padding: Responsive.padDirectional(
                                            context,
                                            start: 16,
                                            top: 10,
                                            end: 16,
                                            bottom: 4,
                                          ),
                                          child: Text(
                                            'nearby_providers_list_title'.tr(),
                                            style: TextStyle(
                                              fontSize: context.rf(14),
                                              fontWeight: FontWeight.w700,
                                              color: AppColors.textPri,
                                            ),
                                          ),
                                        ),
                                        Expanded(
                                          child: _loading
                                              ? const Center(
                                                  child:
                                                      CircularProgressIndicator(),
                                                )
                                              : _buildProviderList(),
                                        ),
                                      ],
                                    ),
                                  ),
                                ),
                              ),
                            ],
                          );
                        },
                      ),
          ),
        ],
      ),
    );
  }
}
