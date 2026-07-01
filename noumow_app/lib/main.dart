import 'dart:async';

import 'package:noumouw_parent/screens/home_page.dart';
import 'package:noumouw_parent/screens/forgot_password_page.dart';
import 'package:noumouw_parent/screens/login_page.dart';
import 'package:noumouw_parent/screens/read_resource.dart';
import 'package:noumouw_parent/screens/auth_splash_screen.dart';
import 'package:noumouw_parent/screens/signup_page.dart';
import 'package:noumouw_parent/services/fcm_service.dart';
import 'package:noumouw_parent/services/session_manager.dart';
import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter_dotenv/flutter_dotenv.dart';
import 'package:noumouw_parent/theme/app_colors.dart';
import 'package:noumouw_parent/firebase_options.dart';
import 'package:noumouw_parent/utils/error_feedback.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

const String _definedSupabaseUrl = String.fromEnvironment('SUPABASE_URL');
const String _definedSupabaseAnonKey = String.fromEnvironment(
  'SUPABASE_ANON_KEY',
);

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  try {
    await Firebase.initializeApp(
      options: DefaultFirebaseOptions.currentPlatform,
    );
    FirebaseMessaging.onBackgroundMessage(firebaseMessagingBackgroundHandler);
    await FirebaseMessaging.instance.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
  } catch (e, st) {
    debugPrint('[Startup] Firebase init failed: $e\n$st');
  }

  await EasyLocalization.ensureInitialized();
  await dotenv.load(fileName: 'assets/app.env');

  final supabaseUrl = _configValue('SUPABASE_URL', _definedSupabaseUrl);
  final supabaseAnonKey = _configValue(
    'SUPABASE_ANON_KEY',
    _definedSupabaseAnonKey,
  );

  if (supabaseUrl.isEmpty || supabaseAnonKey.isEmpty) {
    throw StateError(
      'Set SUPABASE_URL and SUPABASE_ANON_KEY in assets/app.env before running the app.',
    );
  }

  try {
    await Supabase.initialize(
      url: supabaseUrl,
      anonKey: supabaseAnonKey,
      authOptions: const FlutterAuthClientOptions(
        authFlowType: AuthFlowType.pkce,
      ),
    );
  } catch (e, st) {
    debugPrint('[Startup] Supabase init failed: $e\n$st');
    runApp(
      EasyLocalization(
        supportedLocales: const [Locale('en'), Locale('ar')],
        path: 'assets/translations',
        fallbackLocale: const Locale('en'),
        child: const _StartupErrorApp(),
      ),
    );
    return;
  }

  runApp(
    EasyLocalization(
      supportedLocales: const [Locale('en'), Locale('ar')],
      path: 'assets/translations',
      fallbackLocale: const Locale('en'),
      child: const NoumouwApp(),
    ),
  );

  unawaited(_bootstrapDeferredServices());
}

Future<void> _bootstrapDeferredServices() async {
  try {
    await SessionManager.instance
        .init()
        .timeout(const Duration(seconds: 10));
  } catch (e, st) {
    debugPrint('[Startup] SessionManager init failed: $e\n$st');
  }

  try {
    await FcmService.instance.init().timeout(const Duration(seconds: 10));
  } catch (e, st) {
    debugPrint('[Startup] FcmService init failed: $e\n$st');
  }
}

String _configValue(String key, String definedValue) {
  if (definedValue.isNotEmpty) return definedValue;
  return dotenv.env[key]?.trim() ?? '';
}

class _StartupErrorApp extends StatelessWidget {
  const _StartupErrorApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Noumouw',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      home: Scaffold(
        body: Center(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Text(
              kErrorOccurredKey.tr(),
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 18,
                fontWeight: FontWeight.w600,
                color: Color(0xFFDC2626),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class NoumouwApp extends StatefulWidget {
  const NoumouwApp({super.key});

  @override
  State<NoumouwApp> createState() => _NoumouwAppState();
}

final GlobalKey<NavigatorState> appNavigatorKey = GlobalKey<NavigatorState>();

class _NoumouwAppState extends State<NoumouwApp> with WidgetsBindingObserver {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed) {
      unawaited(FcmService.instance.syncTokenWithBackend());
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: appNavigatorKey,
      title: 'Noumouw',
      debugShowCheckedModeBanner: false,
      localizationsDelegates: context.localizationDelegates,
      supportedLocales: context.supportedLocales,
      locale: context.locale,
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: AppColors.primary).copyWith(
          primary: AppColors.primary,
        ),
        scaffoldBackgroundColor: const Color(0xFFFFFFFF),
        useMaterial3: true,
      ),
      home: const AuthSplashScreen(),
      routes: {
        '/welcome': (context) => const AuthSplashScreen(skipSessionCheck: true),
        '/login': (context) => const LoginPage(),
        '/forgot-password': (context) => const ForgotPasswordPage(),
        '/signup': (context) => const SignupPage(),
        '/home': (context) => const HomePage(),
        '/resources': (context) => const ReadResourcePage(),
      },
    );
  }
}
