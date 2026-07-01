import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';

import '../models/signup_request.dart';
import '../services/auth_service.dart';

class SignupController extends ChangeNotifier {
  SignupController({required AuthService authService}) : _authService = authService;

  final AuthService _authService;

  bool isLoading = false;
  String? errorMessage;
  String selectedGender = 'Female';
  bool obscurePassword = true;
  bool obscureConfirmPassword = true;
  String? otpErrorMessage;
  bool otpLoading = false;

  void setGender(String value) {
    selectedGender = value;
    notifyListeners();
  }

  void togglePasswordVisibility() {
    obscurePassword = !obscurePassword;
    notifyListeners();
  }

  void toggleConfirmPasswordVisibility() {
    obscureConfirmPassword = !obscureConfirmPassword;
    notifyListeners();
  }

  void setOtpErrorMessage(String? message) {
    otpErrorMessage = message;
    notifyListeners();
  }

  Future<bool> signup({
    required String fullName,
    required String email,
    required String password,
    required DateTime dateOfBirth,
    required bool acceptedPrivacyPolicy,
  }) async {
    isLoading = true;
    errorMessage = null;
    notifyListeners();
    try {
      final dob = DateTime(
        dateOfBirth.year,
        dateOfBirth.month,
        dateOfBirth.day,
      );
      final request = SignupRequest(
        fullName: fullName.trim(),
        email: email.trim().toLowerCase(),
        password: password,
        gender: selectedGender,
        dateOfBirth:
            '${dob.year}-${dob.month.toString().padLeft(2, '0')}-${dob.day.toString().padLeft(2, '0')}',
        acceptedPrivacyPolicy: acceptedPrivacyPolicy,
      );
      await _authService.signup(request);
      return true;
    } on AuthException catch (e) {
      errorMessage = sanitizeUserMessage(e.message);
      return false;
    } finally {
      isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> verifyOtp({required String email, required String otp}) async {
    otpLoading = true;
    otpErrorMessage = null;
    notifyListeners();
    try {
      await _authService.verifyOtp(
        email: email.trim().toLowerCase(),
        otpCode: otp,
        role: 'parent',
      );
      return true;
    } on AuthException catch (e) {
      otpErrorMessage = sanitizeUserMessage(e.message);
      return false;
    } finally {
      otpLoading = false;
      notifyListeners();
    }
  }

  Future<bool> resendOtp({required String email}) async {
    otpLoading = true;
    otpErrorMessage = null;
    notifyListeners();
    try {
      await _authService.resendOtp(email: email.trim().toLowerCase(), role: 'parent');
      otpErrorMessage = 'A new OTP has been sent.';
      return true;
    } on AuthException catch (e) {
      otpErrorMessage = sanitizeUserMessage(e.message);
      return false;
    } finally {
      otpLoading = false;
      notifyListeners();
    }
  }
}
