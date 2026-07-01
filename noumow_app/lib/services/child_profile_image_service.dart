import 'dart:typed_data';

import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

/// Uploads child profile photos to Supabase Storage (`child-profiles` bucket).
class ChildProfileImageService {
  ChildProfileImageService({SupabaseClient? supabase})
      : _supabase = supabase ?? Supabase.instance.client;

  final SupabaseClient _supabase;

  static const bucket = 'child-profiles';
  /// Signed URLs expire in 1 hour. Do not cache these URLs long-term.
  static const signedUrlTtlSec = 3600;

  static String? _extensionFromPath(String path) {
    final dot = path.lastIndexOf('.');
    if (dot <= 0 || dot >= path.length - 1) return null;
    final ext = path.substring(dot + 1).toLowerCase();
    if (ext == 'jpeg') return 'jpg';
    if (ext == 'jpg' || ext == 'png' || ext == 'webp') return ext;
    return null;
  }

  static String _contentTypeForExtension(String ext) {
    switch (ext) {
      case 'png':
        return 'image/png';
      case 'webp':
        return 'image/webp';
      default:
        return 'image/jpeg';
    }
  }

  /// Normalize legacy public URL or storage path to object path.
  static String? storagePathFromStored(String? stored) {
    final raw = (stored ?? '').trim();
    if (raw.isEmpty) return null;
    if (!raw.contains('://') && !raw.startsWith('/')) {
      return raw;
    }
    const markers = [
      '/storage/v1/object/public/child-profiles/',
      '/storage/v1/object/sign/child-profiles/',
      '/storage/v1/object/authenticated/child-profiles/',
    ];
    for (final marker in markers) {
      final idx = raw.indexOf(marker);
      if (idx == -1) continue;
      final rest = raw.substring(idx + marker.length);
      return Uri.decodeComponent(rest.split('?').first);
    }
    return null;
  }

  /// Returns a short-lived signed URL for display. Signed URLs expire in 1 hour.
  Future<String?> resolveDisplayUrl(String? stored) async {
    final path = storagePathFromStored(stored);
    if (path == null || path.isEmpty) return null;
    final signed = await _supabase.storage
        .from(bucket)
        .createSignedUrl(path, signedUrlTtlSec);
    return signed;
  }

  /// Returns storage object path (persist in DB — not a permanent public URL).
  Future<String> upload({
    required String parentId,
    required int childrenId,
    required XFile file,
  }) async {
    final ext = _extensionFromPath(file.path) ?? 'jpg';
    final objectPath = '$parentId/$childrenId/profile.$ext';
    final bytes = await file.readAsBytes();
    final contentType = _contentTypeForExtension(ext);

    await _supabase.storage.from(bucket).uploadBinary(
          objectPath,
          bytes,
          fileOptions: FileOptions(
            contentType: contentType,
            upsert: true,
          ),
        );

    return objectPath;
  }

  /// Convenience for tests or callers that already have bytes.
  Future<String> uploadBytes({
    required String parentId,
    required int childrenId,
    required Uint8List bytes,
    String extension = 'jpg',
  }) async {
    final ext = extension == 'jpeg' ? 'jpg' : extension;
    final objectPath = '$parentId/$childrenId/profile.$ext';

    await _supabase.storage.from(bucket).uploadBinary(
          objectPath,
          bytes,
          fileOptions: FileOptions(
            contentType: _contentTypeForExtension(ext),
            upsert: true,
          ),
        );

    return objectPath;
  }
}
