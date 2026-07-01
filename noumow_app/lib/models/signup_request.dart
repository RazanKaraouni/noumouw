class SignupRequest {
  final String fullName;
  final String email;
  final String password;
  final String gender;
  final String dateOfBirth;
  final String role;
  final bool acceptedPrivacyPolicy;

  const SignupRequest({
    required this.fullName,
    required this.email,
    required this.password,
    required this.gender,
    required this.dateOfBirth,
    this.role = 'parent',
    this.acceptedPrivacyPolicy = false,
  });

  Map<String, dynamic> toJson() => {
        'full_name': fullName,
        'email': email,
        'password': password,
        'gender': gender,
        'date_of_birth': dateOfBirth,
        'role': role,
        'accepted_privacy_policy': acceptedPrivacyPolicy,
      };
}
