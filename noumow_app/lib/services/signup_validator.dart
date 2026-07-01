class SignupValidator {
  static final RegExp _emailRegex =
      RegExp(r'^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$');
  static final RegExp _passwordRegex =
      RegExp(r'^(?=.*[A-Z])(?=.*[^A-Za-z0-9]).{8,}$');
  static final RegExp _otpRegex = RegExp(r'^\d{6}$');

  static String? requiredText(String? value, String fieldName) {
    if (value == null || value.trim().isEmpty) return '$fieldName is required';
    return null;
  }

  static String? email(String? value) {
    final required = requiredText(value, 'Email');
    if (required != null) return required;
    if (!_emailRegex.hasMatch(value!.trim())) return 'Enter a valid email';
    return null;
  }

  static String? password(String? value) {
    final required = requiredText(value, 'Password');
    if (required != null) return required;
    if (!_passwordRegex.hasMatch(value!)) {
      return '8+ chars, at least 1 uppercase and 1 symbol';
    }
    return null;
  }

  static String? confirmPassword(String? value, String password) {
    final required = requiredText(value, 'Confirm password');
    if (required != null) return required;
    if (value != password) return 'Passwords do not match';
    return null;
  }

  static const int minimumAge = 18;

  static int ageFromDob(DateTime dob) {
    final now = DateTime.now();
    var age = now.year - dob.year;
    if (now.month < dob.month ||
        (now.month == dob.month && now.day < dob.day)) {
      age--;
    }
    return age;
  }

  static String? dateOfBirth(DateTime? dob) {
    if (dob == null) return 'Date of birth is required';
    final today = DateTime.now();
    final todayDate = DateTime(today.year, today.month, today.day);
    final dobDate = DateTime(dob.year, dob.month, dob.day);
    if (dobDate.isAfter(todayDate)) {
      return 'Date of birth cannot be in the future';
    }
    if (ageFromDob(dobDate) < minimumAge) {
      return 'You must be at least 18 years old to create an account';
    }
    if (ageFromDob(dobDate) > 120) return 'Enter a valid date of birth';
    return null;
  }

  static String? otp(String? value) {
    final required = requiredText(value, 'OTP');
    if (required != null) return required;
    if (!_otpRegex.hasMatch(value!.trim())) return 'OTP must be 6 digits';
    return null;
  }
}
