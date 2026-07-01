import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:video_player/video_player.dart';

import '../utils/resource_media_urls.dart';

/// Downloads therapist resource videos for offline playback in Learn.
class ResourceVideoCacheService {
  ResourceVideoCacheService._();

  static final ResourceVideoCacheService instance = ResourceVideoCacheService._();

  static const _subdir = 'resource_videos';

  final Map<String, Future<File?>> _inFlight = {};

  Future<Directory> _cacheDir() async {
    final base = await getApplicationDocumentsDirectory();
    final dir = Directory('${base.path}/$_subdir');
    if (!await dir.exists()) {
      await dir.create(recursive: true);
    }
    return dir;
  }

  String _fileNameForUrl(String url) {
    final hash = url.trim().hashCode.abs().toRadixString(16);
    return '$hash${_extensionForUrl(url)}';
  }

  String? _fileNameForResourceId(String? resourceId, String url) {
    final id = (resourceId ?? '').trim();
    if (id.isEmpty) return null;
    final safe = id.replaceAll(RegExp(r'[^a-zA-Z0-9_-]'), '_');
    return 'res_$safe${_extensionForUrl(url)}';
  }

  String _extensionForUrl(String url) {
    final path = url.split('?').first.toLowerCase();
    if (path.endsWith('.webm')) return '.webm';
    if (path.endsWith('.mov')) return '.mov';
    if (path.endsWith('.mp4')) return '.mp4';
    return '.mp4';
  }

  String _inFlightKey(String url, {String? resourceId}) {
    final id = (resourceId ?? '').trim();
    if (id.isNotEmpty) return 'id:$id';
    return 'url:${url.trim()}';
  }

  bool isCacheableUrl(String url) {
    final trimmed = url.trim();
    if (trimmed.isEmpty) return false;
    if (trimmed.toLowerCase().contains('.m3u8')) return false;
    return isVideoMediaUrl(trimmed);
  }

  Future<File?> cachedFile(String url, {String? resourceId}) async {
    if (kIsWeb || !isCacheableUrl(url)) return null;

    final dir = await _cacheDir();
    final byIdName = _fileNameForResourceId(resourceId, url);
    if (byIdName != null) {
      final byId = File('${dir.path}/$byIdName');
      if (await byId.exists() && await byId.length() > 0) return byId;
    }

    final byUrl = File('${dir.path}/${_fileNameForUrl(url)}');
    if (await byUrl.exists() && await byUrl.length() > 0) return byUrl;

    return null;
  }

  Future<File?> download(String url, {String? resourceId}) async {
    if (kIsWeb || !isCacheableUrl(url)) return null;

    final key = _inFlightKey(url, resourceId: resourceId);
    final existing = _inFlight[key];
    if (existing != null) return existing;

    final future = _downloadImpl(url, resourceId: resourceId);
    _inFlight[key] = future;
    try {
      return await future;
    } finally {
      _inFlight.remove(key);
    }
  }

  Future<File?> _downloadImpl(String url, {String? resourceId}) async {
    final existing = await cachedFile(url, resourceId: resourceId);
    if (existing != null) return existing;

    try {
      final response = await http
          .get(Uri.parse(url.trim()))
          .timeout(const Duration(minutes: 10));
      if (response.statusCode != 200 || response.bodyBytes.isEmpty) {
        return null;
      }

      final dir = await _cacheDir();
      final fileName =
          _fileNameForResourceId(resourceId, url) ?? _fileNameForUrl(url);
      final file = File('${dir.path}/$fileName');
      await file.writeAsBytes(response.bodyBytes, flush: true);
      return file;
    } catch (_) {
      return null;
    }
  }

  void prefetchAll(Iterable<String> urls) {
    for (final url in urls) {
      final trimmed = url.trim();
      if (!isCacheableUrl(trimmed)) continue;
      download(trimmed);
    }
  }

  void prefetchResources(Iterable<Map<String, dynamic>> resources) {
    for (final resource in resources) {
      final url = resolveResourceVideoUrl(resource);
      if (!isCacheableUrl(url)) continue;
      final id = (resource['resources_id'] ?? '').toString().trim();
      download(url, resourceId: id.isEmpty ? null : id);
    }
  }

  /// Waits for a local copy when the URL is cacheable (no-op if already stored).
  Future<File?> ensureCached(String url, {String? resourceId}) async {
    if (kIsWeb || !isCacheableUrl(url)) return null;
    final existing = await cachedFile(url, resourceId: resourceId);
    if (existing != null) return existing;
    return download(url, resourceId: resourceId);
  }

  /// Prefers a cached file so Learn videos still play offline.
  Future<VideoPlayerController?> createController(
    String url, {
    String? resourceId,
  }) async {
    final trimmed = url.trim();
    final uri = Uri.tryParse(trimmed);
    if (uri == null || !uri.hasScheme) return null;

    if (!kIsWeb && isCacheableUrl(trimmed)) {
      var local = await cachedFile(trimmed, resourceId: resourceId);
      local ??= await download(trimmed, resourceId: resourceId);
      if (local != null) {
        return VideoPlayerController.file(local);
      }
    }

    return VideoPlayerController.networkUrl(uri);
  }
}
