import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:noumouw_parent/utils/responsive.dart';
import 'package:noumouw_parent/theme/app_colors.dart';

class WelcomePage extends StatefulWidget {
  const WelcomePage({super.key});

  @override
  State<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends State<WelcomePage>
    with TickerProviderStateMixin {
  late AnimationController _logoController;
  late AnimationController _contentController;
  late Animation<double> _logoScale;
  late Animation<double> _logoFade;
  late Animation<double> _contentFade;
  late Animation<Offset> _contentSlide;

  @override
  void initState() {
    super.initState();
    SystemChrome.setSystemUIOverlayStyle(const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
    ));
    _logoController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 800));
    _contentController = AnimationController(
        vsync: this, duration: const Duration(milliseconds: 600));
    _logoScale = Tween<double>(begin: 0.7, end: 1.0).animate(
        CurvedAnimation(parent: _logoController, curve: Curves.easeOutBack));
    _logoFade = Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _logoController, curve: Curves.easeIn));
    _contentFade = Tween<double>(begin: 0.0, end: 1.0).animate(
        CurvedAnimation(parent: _contentController, curve: Curves.easeIn));
    _contentSlide =
        Tween<Offset>(begin: const Offset(0, 0.15), end: Offset.zero).animate(
            CurvedAnimation(parent: _contentController, curve: Curves.easeOut));
    _logoController.forward().then((_) => _contentController.forward());
  }

  @override
  void dispose() {
    _logoController.dispose();
    _contentController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        width: double.infinity,
        height: double.infinity,
        decoration: BoxDecoration(
          gradient: const LinearGradient(
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
            colors: [AppColors.primary, Color(0xFF1D4040)],
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: Responsive.padSymmetric(context, horizontal: 32),
            child: Column(
              children: [
                const Spacer(flex: 2),
                ScaleTransition(
                  scale: _logoScale,
                  child: FadeTransition(
                    opacity: _logoFade,
                    child: Column(
                      children: [
                        Container(
                          width: context.rs(84),
                          height: context.rs(84),
                          decoration: BoxDecoration(
                            color: Colors.white.withOpacity(0.15),
                            borderRadius: Responsive.radius(context, 24),
                            border: Border.all(
                              color: Colors.white.withOpacity(0.25),
                              width: context.rs(1.5),
                            ),
                          ),
                          child: Center(
                            child: Text(
                              'N',
                              style: TextStyle(
                                fontSize: context.rf(40),
                                color: Colors.white,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ),
                        SizedBox(height: context.rg(22)),
                        Text(
                          'NOUMOUW',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: context.rf(34),
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                            letterSpacing: 6,
                          ),
                        ),
                        SizedBox(height: context.rg(8)),
                        Text(
                          'welcome_tagline'.tr(),
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          textAlign: TextAlign.center,
                          style: TextStyle(
                            fontSize: context.rf(13),
                            color: Colors.white.withOpacity(0.55),
                            letterSpacing: 1.2,
                            fontWeight: FontWeight.w300,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(flex: 1),
                SlideTransition(
                  position: _contentSlide,
                  child: FadeTransition(
                    opacity: _contentFade,
                    child: Column(
                      children: [
                        Text(
                          'welcome_description'.tr(),
                          textAlign: TextAlign.center,
                          maxLines: 5,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: context.rf(16),
                            color: Colors.white.withOpacity(0.75),
                            height: 1.7,
                            fontWeight: FontWeight.w300,
                          ),
                        ),
                        SizedBox(height: context.rg(10)),
                        Text(
                          'welcome_built_for_lebanon'.tr(),
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: context.rf(12),
                            color: Colors.white.withOpacity(0.4),
                            letterSpacing: 0.5,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                const Spacer(flex: 2),
                FadeTransition(
                  opacity: _contentFade,
                  child: Column(
                    children: [
                      SizedBox(
                        width: double.infinity,
                        height: context.rs(52),
                        child: ElevatedButton(
                          onPressed: () =>
                              Navigator.pushNamed(context, '/signup'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: Colors.white,
                            foregroundColor: AppColors.primary,
                            elevation: 0,
                            shape: RoundedRectangleBorder(
                              borderRadius: Responsive.radius(context, 14),
                            ),
                          ),
                          child: Text(
                            'welcome_get_started'.tr(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: context.rf(15),
                              fontWeight: FontWeight.w600,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ),
                      SizedBox(height: context.rg(14)),
                      SizedBox(
                        width: double.infinity,
                        height: context.rs(52),
                        child: OutlinedButton(
                          onPressed: () =>
                              Navigator.pushNamed(context, '/login'),
                          style: OutlinedButton.styleFrom(
                            foregroundColor: Colors.white,
                            side: BorderSide(
                              color: Colors.white.withOpacity(0.45),
                              width: context.rs(1.5),
                            ),
                            shape: RoundedRectangleBorder(
                              borderRadius: Responsive.radius(context, 14),
                            ),
                          ),
                          child: Text(
                            'welcome_sign_in'.tr(),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: context.rf(15),
                              fontWeight: FontWeight.w500,
                              letterSpacing: 0.3,
                            ),
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
                SizedBox(height: context.rg(44)),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
