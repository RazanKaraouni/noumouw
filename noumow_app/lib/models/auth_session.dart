class AuthSession {
  final String token;
  final String? userId;
  final String? email;
  final String? role;
  final DateTime? expiresAt;

  const AuthSession({
    required this.token,
    this.userId,
    this.email,
    this.role,
    this.expiresAt,
  });

  bool get isExpired {
    if (expiresAt == null) return false;
    return DateTime.now().isAfter(expiresAt!);
  }

  Map<String, String> get authHeaders => {'Authorization': 'Bearer $token'};

  Map<String, dynamic> toJson() => {
        'token': token,
        'userId': userId,
        'email': email,
        'role': role,
        'expiresAt': expiresAt?.toIso8601String(),
      };

  factory AuthSession.fromJson(Map<String, dynamic> json) {
    return AuthSession(
      token: (json['token'] ?? '').toString(),
      userId: json['userId']?.toString(),
      email: json['email']?.toString(),
      role: json['role']?.toString(),
      expiresAt: json['expiresAt'] == null
          ? null
          : DateTime.tryParse(json['expiresAt'].toString()),
    );
  }
}
