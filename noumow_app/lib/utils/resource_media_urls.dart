bool isVideoMediaUrl(String? url) {
  final path = (url ?? '').trim().toLowerCase().split('?').first;
  return path.endsWith('.mp4') ||
      path.endsWith('.webm') ||
      path.endsWith('.mov') ||
      path.endsWith('.m3u8');
}

bool isImageMediaUrl(String? url) {
  final path = (url ?? '').trim().toLowerCase().split('?').first;
  return path.endsWith('.jpg') ||
      path.endsWith('.jpeg') ||
      path.endsWith('.png') ||
      path.endsWith('.gif') ||
      path.endsWith('.webp') ||
      path.endsWith('.bmp');
}

String resolveResourceVideoUrl(Map<String, dynamic> resource) {
  final direct = (resource['video_url'] ?? '').toString().trim();
  if (direct.isNotEmpty) return direct;

  final media = (resource['media_url'] ?? '').toString().trim();
  if (media.isEmpty) return '';

  final type = (resource['content_type'] ?? '').toString().trim().toLowerCase();
  if (type == 'video' || (type == 'article' && isVideoMediaUrl(media))) {
    return media;
  }
  return '';
}

String resolveResourceImageUrl(Map<String, dynamic> resource) {
  final direct = (resource['image_url'] ?? '').toString().trim();
  if (direct.isNotEmpty) return direct;

  final media = (resource['media_url'] ?? '').toString().trim();
  if (media.isEmpty || isVideoMediaUrl(media)) return '';

  final type = (resource['content_type'] ?? '').toString().trim().toLowerCase();
  if (type == 'image' || isImageMediaUrl(media)) return media;
  return '';
}

String resolveResourceAttachmentUrl(Map<String, dynamic> resource) {
  final media = (resource['media_url'] ?? '').toString().trim();
  if (media.isEmpty) return '';
  if (isVideoMediaUrl(media) || isImageMediaUrl(media)) return '';
  return media;
}

String? learnThumbnailUrl(Map<String, dynamic> resource) {
  final imageUrl = resolveResourceImageUrl(resource);
  if (imageUrl.isNotEmpty) return imageUrl;

  final videoUrl = resolveResourceVideoUrl(resource);
  if (videoUrl.isNotEmpty) return videoUrl;

  return null;
}

bool shouldOpenResourceAsArticle(Map<String, dynamic> resource) {
  final contentType =
      (resource['content_type'] ?? '').toString().trim().toLowerCase();
  final body = (resource['body_text'] ?? '').toString();
  final attachmentUrl = resolveResourceAttachmentUrl(resource);

  switch (contentType) {
    case 'article':
      return true;
    case 'video':
    case 'image':
      return false;
    case 'resource':
      return _resourceHasTextOrAttachment(body, attachmentUrl);
    default:
      return _resourceHasTextOrAttachment(body, attachmentUrl);
  }
}

bool _resourceHasTextOrAttachment(String body, String attachmentUrl) {
  if (attachmentUrl.trim().isNotEmpty) return true;
  final plain = body.replaceAll(RegExp(r'<[^>]*>'), ' ').trim();
  return plain.replaceAll(RegExp(r'\s+'), ' ').length >= 120;
}

bool shouldOpenResourceAsVideo(Map<String, dynamic> resource) {
  final videoUrl = resolveResourceVideoUrl(resource);
  if (videoUrl.isEmpty) return false;
  if (shouldOpenResourceAsArticle(resource)) return false;

  final contentType =
      (resource['content_type'] ?? '').toString().trim().toLowerCase();
  return contentType == 'video' || contentType == 'resource';
}

bool learnThumbnailIsVideo(Map<String, dynamic> resource) {
  final imageUrl = resolveResourceImageUrl(resource);
  if (imageUrl.isNotEmpty) return false;

  final videoUrl = resolveResourceVideoUrl(resource);
  if (videoUrl.isNotEmpty) return true;

  return (resource['content_type'] ?? '').toString().trim().toLowerCase() ==
      'video';
}
