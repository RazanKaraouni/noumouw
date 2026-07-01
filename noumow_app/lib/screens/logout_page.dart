import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/services/auth_sign_out.dart';
import 'package:noumouw_parent/utils/responsive.dart';

/// Sign out and return to the auth splash screen.
class LogoutPage extends StatelessWidget {
  const LogoutPage({super.key});

  Future<void> _logout(BuildContext context) async {
    try {
      await AuthSignOut.signOutAndNavigateToAuthSplash(context);
    } catch (_) {
      if (!context.mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('logout_error_snackbar'.tr())),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text('logout_title'.tr())),
      body: ResponsiveScrollBody(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              'logout_message'.tr(),
              style: TextStyle(
                fontSize: context.rf(15),
                color: Colors.grey.shade800,
              ),
            ),
            SizedBox(height: context.rg(28)),
            FilledButton.icon(
              onPressed: () => _logout(context),
              icon: const Icon(Icons.logout_rounded),
              label: Text('logout_button'.tr()),
            ),
          ],
        ),
      ),
    );
  }
}
