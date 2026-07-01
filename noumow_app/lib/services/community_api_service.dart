import 'dart:convert';



import 'package:http/http.dart' as http;



import '../utils/auth_headers.dart';

import '../utils/community_age_category.dart';

import '../utils/community_developmental_category.dart';

import '../utils/therapists_api.dart';
import 'api_http_client.dart';



class CommunityApiException implements Exception {

  CommunityApiException(this.message, {this.statusCode});

  final String message;

  final int? statusCode;



  @override

  String toString() => message;

}



/// Author role for peer-support badge rendering.

enum CommunityAuthorRole {

  parent,

  specialist;



  static CommunityAuthorRole fromApi(String? value) {

    switch (value?.trim().toLowerCase()) {

      case 'specialist':

      case 'therapist':

        return CommunityAuthorRole.specialist;

      default:

        return CommunityAuthorRole.parent;

    }

  }

}



class CommunityAuthor {

  CommunityAuthor({

    required this.displayName,

    this.profileImageUrl,

    this.isAnonymous = false,

    this.role = CommunityAuthorRole.parent,

  });



  final String displayName;

  final String? profileImageUrl;

  final bool isAnonymous;

  final CommunityAuthorRole role;



  /// Resolved display name respecting anonymity rules.

  String get resolvedDisplayName {

    if (isAnonymous) return 'Anonymous Parent';

    return displayName;

  }



  /// Profile image hidden when posting anonymously.

  String? get resolvedProfileImageUrl => isAnonymous ? null : profileImageUrl;



  factory CommunityAuthor.fromJson(Map<String, dynamic>? json) {

    if (json == null) {

      return CommunityAuthor(displayName: 'Community member');

    }

    final isAnonymous = json['is_anonymous'] == true;

    return CommunityAuthor(

      displayName: isAnonymous

          ? 'Anonymous Parent'

          : ((json['display_name'] as String?)?.trim().isNotEmpty == true

              ? json['display_name'] as String

              : 'Community member'),

      profileImageUrl: isAnonymous ? null : json['profile_image_url'] as String?,

      isAnonymous: isAnonymous,

      role: CommunityAuthorRole.fromApi(json['role'] as String?),

    );

  }

}



class CommunityPost {

  CommunityPost({

    required this.id,

    this.userId,

    required this.content,

    this.imageUrl,

    required this.ageCategory,

    this.developmentalCategory,

    this.localeTag,

    required this.isAnonymous,

    required this.author,

    required this.hashtags,

    required this.likeCount,

    required this.commentCount,

    required this.isLiked,

    required this.isSaved,

    this.specialistResponded = false,

    this.trendScore,

    this.createdAt,

  });



  final String id;

  final String? userId;

  final String content;

  final String? imageUrl;

  final String ageCategory;

  final String? developmentalCategory;

  final String? localeTag;

  final bool isAnonymous;

  final CommunityAuthor author;

  final List<String> hashtags;

  int likeCount;

  final int commentCount;

  bool isLiked;

  bool isSaved;

  bool specialistResponded;

  final double? trendScore;

  final String? createdAt;



  bool get showNoRepliesYet {
    if (commentCount > 0 || specialistResponded) return false;
    final raw = createdAt?.trim();
    if (raw == null || raw.isEmpty) return false;
    final posted = DateTime.tryParse(raw);
    if (posted == null) return false;
    return DateTime.now().difference(posted.toLocal()).inHours >= 48;
  }



  String get ageCategoryKey =>

      CommunityAgeCategory.normalizeKey(ageCategory) ?? ageCategory;



  String get ageBadgeLabel => CommunityAgeCategory.badgeLabel(ageCategoryKey);



  String? get developmentalCategoryLabel {

    final key = CommunityDevelopmentalCategory.normalizeKey(developmentalCategory);

    if (key == null) return null;

    return CommunityDevelopmentalCategory.label(key);

  }



  factory CommunityPost.fromJson(Map<String, dynamic> json) {

    final tags = json['hashtags'];

    final isAnonymous = json['is_anonymous'] == true;

    final authorJson = json['author'] is Map

        ? Map<String, dynamic>.from(json['author'] as Map)

        : null;

    if (authorJson != null && isAnonymous) {

      authorJson['is_anonymous'] = true;

    }



    return CommunityPost(

      id: (json['id'] ?? json['post_id'] ?? '').toString(),

      userId: json['user_id'] as String?,

      content: (json['content'] as String?) ?? '',

      imageUrl: json['image_url'] as String?,

      ageCategory: (json['age_category'] as String?) ?? '0-2',

      developmentalCategory: json['developmental_category'] as String?,

      localeTag: json['locale_tag'] as String?,

      isAnonymous: isAnonymous,

      author: CommunityAuthor.fromJson(authorJson),

      hashtags: tags is List ? tags.map((e) => e.toString()).toList() : const [],

      likeCount: _int(json['like_count']),

      commentCount: _int(json['comment_count']),

      isLiked: json['is_liked'] == true,

      isSaved: json['is_saved'] == true,

      specialistResponded: json['specialist_responded'] == true,

      trendScore: json['trend_score'] is num

          ? (json['trend_score'] as num).toDouble()

          : null,

      createdAt: json['created_at'] as String?,

    );

  }



  static int _int(dynamic v) {

    if (v is int) return v;

    if (v is num) return v.toInt();

    return 0;

  }

}



class CommunityComment {

  CommunityComment({

    required this.id,

    required this.postId,

    required this.userId,

    required this.content,

    required this.author,

    this.createdAt,

  });



  final String id;

  final String postId;

  final String userId;

  final String content;

  final CommunityAuthor author;

  final String? createdAt;



  factory CommunityComment.fromJson(Map<String, dynamic> json) {

    return CommunityComment(

      id: (json['id'] ?? json['comment_id'] ?? '').toString(),

      postId: (json['post_id'] ?? '').toString(),

      userId: (json['user_id'] ?? '').toString(),

      content: (json['content'] as String?) ?? '',

      author: CommunityAuthor.fromJson(

        json['author'] is Map ? Map<String, dynamic>.from(json['author'] as Map) : null,

      ),

      createdAt: json['created_at'] as String?,

    );

  }

}



class CommunityApiService {

  CommunityApiService({http.Client? client}) : _client = client ?? createApiHttpClient();



  final http.Client _client;



  String get _root => resolvedTherapistsApiBase();



  void _throwIfBad(http.Response res, String fallback) {

    if (res.statusCode >= 200 && res.statusCode < 300) return;

    String message = fallback;

    try {

      final body = jsonDecode(res.body);

      if (body is Map && body['error'] != null) {

        message = body['error'].toString();

      } else if (body is Map && body['message'] != null) {

        message = body['message'].toString();

      }

    } catch (_) {}

    throw CommunityApiException(message, statusCode: res.statusCode);

  }



  List<CommunityPost> _parsePosts(dynamic decoded) {

    if (decoded is Map && decoded['posts'] is List) {

      return (decoded['posts'] as List)

          .whereType<Map>()

          .map((e) => CommunityPost.fromJson(Map<String, dynamic>.from(e)))

          .toList();

    }

    if (decoded is List) {

      return decoded

          .whereType<Map>()

          .map((e) => CommunityPost.fromJson(Map<String, dynamic>.from(e)))

          .toList();

    }

    return [];

  }



  Future<List<CommunityPost>> fetchFeed({

    String? ageCategory,

    String? developmentalCategory,

    int limit = 20,

    int offset = 0,

    bool excludeSelf = false,

  }) async {

    final q = <String, String>{

      'limit': '$limit',

      'offset': '$offset',

    };

    if (excludeSelf) {

      q['exclude_self'] = 'true';

    }

    if (ageCategory != null && ageCategory.isNotEmpty) {

      q['age_category'] = ageCategory;

    }

    if (developmentalCategory != null && developmentalCategory.isNotEmpty) {

      q['developmental_category'] = developmentalCategory;

    }

    final uri = Uri.parse('$_root/api/community/feed').replace(queryParameters: q);

    final res = await _client

        .get(uri, headers: authHeaders(json: true))

        .timeout(const Duration(seconds: 25));

    _throwIfBad(res, 'Could not load community feed.');

    return _parsePosts(jsonDecode(res.body));

  }



  Future<List<CommunityPost>> fetchMyPosts({

    String? ageCategory,

    String? developmentalCategory,

    int limit = 20,

    int offset = 0,

  }) async {

    final q = <String, String>{

      'limit': '$limit',

      'offset': '$offset',

    };

    if (ageCategory != null && ageCategory.isNotEmpty) {

      q['age_category'] = ageCategory;

    }

    if (developmentalCategory != null && developmentalCategory.isNotEmpty) {

      q['developmental_category'] = developmentalCategory;

    }

    final uri = Uri.parse('$_root/api/community/me/posts').replace(queryParameters: q);

    final res = await _client

        .get(uri, headers: authHeaders(json: true))

        .timeout(const Duration(seconds: 25));

    _throwIfBad(res, 'Could not load your posts.');

    return _parsePosts(jsonDecode(res.body));

  }



  Future<List<CommunityPost>> fetchTrending({int limit = 20}) async {

    final uri = Uri.parse('$_root/api/community/trending').replace(

      queryParameters: {'limit': '$limit'},

    );

    final res = await _client

        .get(uri, headers: authHeaders(json: true))

        .timeout(const Duration(seconds: 25));

    _throwIfBad(res, 'Could not load trending posts.');

    return _parsePosts(jsonDecode(res.body));

  }



  Future<List<CommunityPost>> fetchSavedPosts({

    int limit = 20,

    int offset = 0,

  }) async {

    final uri = Uri.parse('$_root/api/community/saved').replace(

      queryParameters: {'limit': '$limit', 'offset': '$offset'},

    );

    final res = await _client

        .get(uri, headers: authHeaders(json: true))

        .timeout(const Duration(seconds: 25));

    _throwIfBad(res, 'Could not load saved posts.');

    return _parsePosts(jsonDecode(res.body));

  }



  Future<CommunityPost> createPost({

    required String content,

    required String ageCategory,

    String? developmentalCategory,

    String? localeTag,

    bool isAnonymous = false,

    String? imageUrl,

  }) async {

    final res = await _client

        .post(

          Uri.parse('$_root/api/community/posts'),

          headers: authHeaders(json: true),

          body: jsonEncode({

            'content': content,

            'age_category': ageCategory,

            if (developmentalCategory != null && developmentalCategory.isNotEmpty)

              'developmental_category': developmentalCategory,

            if (localeTag != null && localeTag.trim().isNotEmpty)

              'locale_tag': localeTag.trim(),

            'is_anonymous': isAnonymous,

            if (imageUrl != null && imageUrl.trim().isNotEmpty)

              'image_url': imageUrl.trim(),

          }),

        )

        .timeout(const Duration(seconds: 30));

    _throwIfBad(res, 'Could not publish your post.');

    final decoded = jsonDecode(res.body);

    if (decoded is Map) {

      return CommunityPost.fromJson(Map<String, dynamic>.from(decoded));

    }

    throw CommunityApiException('Unexpected response from server.');

  }



  Future<bool> toggleLike(String postId) async {

    final res = await _client

        .post(

          Uri.parse('$_root/api/community/posts/$postId/like'),

          headers: authHeaders(json: true),

        )

        .timeout(const Duration(seconds: 15));

    _throwIfBad(res, 'Could not update like.');

    final decoded = jsonDecode(res.body);

    if (decoded is Map) return decoded['liked'] == true;

    return false;

  }



  Future<bool> toggleSave(String postId) async {

    final res = await _client

        .post(

          Uri.parse('$_root/api/community/posts/$postId/save'),

          headers: authHeaders(json: true),

        )

        .timeout(const Duration(seconds: 15));

    _throwIfBad(res, 'Could not update saved post.');

    final decoded = jsonDecode(res.body);

    if (decoded is Map) return decoded['saved'] == true;

    return false;

  }



  Future<void> blockUser(String userId) async {

    final res = await _client

        .post(

          Uri.parse('$_root/api/community/users/$userId/block'),

          headers: authHeaders(json: true),

        )

        .timeout(const Duration(seconds: 15));

    _throwIfBad(res, 'Could not block user.');

  }



  Future<List<CommunityComment>> fetchComments(String postId) async {

    final res = await _client

        .get(

          Uri.parse('$_root/api/community/posts/$postId/comments'),

          headers: authHeaders(json: true),

        )

        .timeout(const Duration(seconds: 20));

    _throwIfBad(res, 'Could not load comments.');

    final decoded = jsonDecode(res.body);

    if (decoded is Map && decoded['comments'] is List) {

      return (decoded['comments'] as List)

          .whereType<Map>()

          .map((e) => CommunityComment.fromJson(Map<String, dynamic>.from(e)))

          .toList();

    }

    return [];

  }



  Future<CommunityComment> addComment({

    required String postId,

    required String content,

  }) async {

    final res = await _client

        .post(

          Uri.parse('$_root/api/community/posts/$postId/comments'),

          headers: authHeaders(json: true),

          body: jsonEncode({'content': content}),

        )

        .timeout(const Duration(seconds: 20));

    _throwIfBad(res, 'Could not post comment.');

    final decoded = jsonDecode(res.body);

    if (decoded is Map) {

      return CommunityComment.fromJson(Map<String, dynamic>.from(decoded));

    }

    throw CommunityApiException('Unexpected response from server.');

  }

}

