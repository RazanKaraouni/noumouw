import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../../constants/home_assets.dart';
import '../../models/appointment_model.dart';
import '../../theme/app_colors.dart';
import '../../utils/appointment_display_utils.dart';
import 'home_storyset_image.dart';
import 'home_styles.dart';

class HomeUpcomingSessionCard extends StatelessWidget {
  const HomeUpcomingSessionCard({
    super.key,
    required this.appointment,
    required this.onJoin,
    this.onEmptyTap,
  });

  final Map<String, dynamic>? appointment;
  final VoidCallback? onJoin;
  final VoidCallback? onEmptyTap;

  static const _illustrationWidth = 112.0;
  static const _illustrationHeight = 84.0;

  static EdgeInsetsDirectional _sectionPadding(BuildContext context) =>
      EdgeInsetsDirectional.fromSTEB(
        context.rs(10),
        context.rs(6),
        context.rs(10),
        0,
      );

  static Widget _buildSessionIllustration(BuildContext context) {
    return SizedBox(
      width: context.rs(_illustrationWidth),
      height: context.rs(_illustrationHeight),
      child: HomeStorysetImage(
        assetPath: HomeAssets.upcomingSession,
        width: _illustrationWidth,
        height: _illustrationHeight,
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    if (appointment == null) {
      return _EmptyCard(onTap: onEmptyTap);
    }

    final model = Appointment.fromMap(appointment!);
    final canJoin = model.canShowZoomJoinButton;
    final waitingForStart = model.isWaitingForTherapistToStart;
    final start = sessionTimeFromAppointment(appointment!, isEnd: false);
    final dayLabel = formatRelativeSessionDay(start);
    final timeLabel = formatSessionHm(start);
    final therapistName = appointmentTherapistName(appointment!);
    final therapistRole = appointmentTherapistRole(appointment!);

    return Padding(
      padding: _sectionPadding(context),
      child: Container(
        width: double.infinity,
        padding: EdgeInsets.symmetric(
          horizontal: context.rs(12),
          vertical: HomeStyles.cardPadding(context),
        ),
        decoration: HomeStyles.cardDecoration(
          context,
          borderColor: canJoin ? AppColors.green : AppColors.border,
          borderWidth: canJoin ? 1.5 : 1,
          shadows: HomeStyles.cardShadow(
            context,
            color: AppColors.green,
          ),
        ),
        child: Row(
          children: [
            _buildSessionIllustration(context),
            SizedBox(width: context.rs(12)),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'home_upcoming_session_title'.tr(),
                    style: TextStyle(
                      fontSize: context.rf(11),
                      fontWeight: FontWeight.w600,
                      color: AppColors.green,
                    ),
                  ),
                  SizedBox(height: context.rs(2)),
                  Text(
                    therapistName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: context.rf(13),
                      fontWeight: FontWeight.w700,
                      color: AppColors.textPri,
                    ),
                  ),
                  Text(
                    therapistRole,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: context.rf(11),
                      color: AppColors.textSec.withOpacity(0.95),
                    ),
                  ),
                  SizedBox(height: context.rs(2)),
                  Row(
                    children: [
                      Icon(
                        Icons.calendar_today_outlined,
                        size: context.rf(11),
                        color: AppColors.textSec.withOpacity(0.9),
                      ),
                      SizedBox(width: context.rs(3)),
                      Flexible(
                        child: Text(
                          dayLabel,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(
                            fontSize: context.rf(10),
                            color: AppColors.textSec.withOpacity(0.95),
                          ),
                        ),
                      ),
                      SizedBox(width: context.rs(8)),
                      Icon(
                        Icons.schedule_rounded,
                        size: context.rf(11),
                        color: AppColors.textSec.withOpacity(0.9),
                      ),
                      SizedBox(width: context.rs(3)),
                      Text(
                        timeLabel,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: context.rf(10),
                          color: AppColors.textSec.withOpacity(0.95),
                        ),
                      ),
                    ],
                  ),
                  if (waitingForStart) ...[
                    SizedBox(height: context.rs(4)),
                    Text(
                      'home_upcoming_wait_therapist_start'.tr(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: context.rf(10),
                        color: AppColors.textSec.withOpacity(0.95),
                      ),
                    ),
                  ],
                ],
              ),
            ),
            if (canJoin && onJoin != null) ...[
              SizedBox(width: context.rs(6)),
              FilledButton(
                onPressed: onJoin,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.green,
                  foregroundColor: AppColors.white,
                  padding: EdgeInsets.symmetric(
                    horizontal: context.rs(10),
                    vertical: context.rs(8),
                  ),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(context.rs(8)),
                  ),
                  textStyle: TextStyle(
                    fontSize: context.rf(11),
                    fontWeight: FontWeight.w600,
                  ),
                ),
                child: Text(
                  'home_upcoming_join_session'.tr(),
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                ),
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _EmptyCard extends StatelessWidget {
  const _EmptyCard({this.onTap});

  final VoidCallback? onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: HomeUpcomingSessionCard._sectionPadding(context),
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          width: double.infinity,
          padding: EdgeInsets.symmetric(
            horizontal: context.rs(12),
            vertical: HomeStyles.cardPadding(context),
          ),
          decoration: HomeStyles.cardDecoration(
            context,
            shadows: HomeStyles.cardShadow(context, color: AppColors.green),
          ),
          child: Row(
            children: [
              HomeUpcomingSessionCard._buildSessionIllustration(context),
              SizedBox(width: context.rs(12)),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'home_upcoming_session_title'.tr(),
                      style: TextStyle(
                        fontSize: context.rf(13),
                        fontWeight: FontWeight.w700,
                        color: AppColors.textPri,
                      ),
                    ),
                    SizedBox(height: context.rs(2)),
                    Text(
                      'home_upcoming_no_session'.tr(),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: context.rf(11),
                        color: AppColors.textSec.withOpacity(0.95),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class HomeUpcomingSessionLoading extends StatelessWidget {
  const HomeUpcomingSessionLoading({super.key});

  @override
  Widget build(BuildContext context) {
    final cardPad = HomeStyles.cardPadding(context);
    return Padding(
      padding: HomeUpcomingSessionCard._sectionPadding(context),
      child: Container(
        width: double.infinity,
        height: context.rs(HomeUpcomingSessionCard._illustrationHeight) +
            cardPad * 2,
        padding: EdgeInsets.symmetric(
          horizontal: context.rs(12),
          vertical: cardPad,
        ),
        decoration: HomeStyles.cardDecoration(context),
        child: Center(
          child: LinearProgressIndicator(
            minHeight: context.rs(2),
            color: AppColors.green,
          ),
        ),
      ),
    );
  }
}
