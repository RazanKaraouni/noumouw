import 'package:easy_localization/easy_localization.dart';
import 'package:flutter/material.dart';
import 'package:noumouw_parent/utils/responsive.dart';

import '../services/child_progress_controller.dart';
import '../widgets/milestone_tracker_panel.dart';
import 'milestones_page.dart';

class TrackMilestonesPage extends StatelessWidget {
  final ChildProgressController? childProgress;
  final String? initialChildId;

  const TrackMilestonesPage({
    super.key,
    this.childProgress,
    this.initialChildId,
  });

  @override
  Widget build(BuildContext context) {
    final controller = childProgress;
    if (controller == null) {
      return Scaffold(
        appBar: AppBar(title: Text('milestones_track_title'.tr())),
        body: Center(child: Text('milestones_track_no_children'.tr())),
      );
    }

    return Scaffold(
      appBar: AppBar(
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'milestones_track_title'.tr(),
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
            ),
            Text(
              'milestones_track_subtitle'.tr(),
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    fontWeight: FontWeight.w400,
                    fontSize: context.rf(12),
                  ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
        ),
      ),
      body: MilestoneTrackerPanel(
        childProgress: controller,
        initialChildId: initialChildId,
        showLibraryLink: true,
        onOpenLibrary: () {
          Navigator.of(context).push<void>(
            MaterialPageRoute<void>(
              builder: (_) => const MilestonesPage(),
            ),
          );
        },
      ),
    );
  }
}
