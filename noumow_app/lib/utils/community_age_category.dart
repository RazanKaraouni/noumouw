import 'package:easy_localization/easy_localization.dart';

/// Canonical age bands for community API (switch-case, not enums).

class CommunityAgeCategory {

  CommunityAgeCategory._();



  static const all = 'all';

  static const by2Months = '0-2';

  static const by4Months = '2-4';

  static const by6Months = '4-6';

  static const by9Months = '6-9';

  static const by12Months = '9-12';

  static const by18Months = '12-18';

  static const by2Years = '12-24';

  static const by30Months = '24-30';

  static const by3Years = '30-36';

  static const by4Years = '36-48';

  static const by5Years = '48-60';



  static const filterKeys = [

    all,

    by2Months,

    by4Months,

    by6Months,

    by9Months,

    by12Months,

    by18Months,

    by2Years,

    by30Months,

    by3Years,

    by4Years,

    by5Years,

  ];



  static const createPickerKeys = [

    by2Months,

    by4Months,

    by6Months,

    by9Months,

    by12Months,

    by18Months,

    by2Years,

    by30Months,

    by3Years,

    by4Years,

    by5Years,

  ];



  /// UI label for horizontal capsule list and badges.

  static String label(String key) {

    switch (key) {

      case all:

        return 'community_age_label_all'.tr();

      case by2Months:

        return 'community_age_label_0_2'.tr();

      case by4Months:

        return 'community_age_label_2_4'.tr();

      case by6Months:

        return 'community_age_label_4_6'.tr();

      case by9Months:

        return 'community_age_label_6_9'.tr();

      case by12Months:

        return 'community_age_label_9_12'.tr();

      case by18Months:

        return 'community_age_label_12_18'.tr();

      case by2Years:

        return 'community_age_label_12_24'.tr();

      case by30Months:

        return 'community_age_label_24_30'.tr();

      case by3Years:

        return 'community_age_label_30_36'.tr();

      case by4Years:

        return 'community_age_label_36_48'.tr();

      case by5Years:

        return 'community_age_label_48_60'.tr();

      default:

        return key;

    }

  }



  /// Human-readable month window for subtitles.

  static String rangeSubtitle(String key) {

    switch (key) {

      case by2Months:

        return 'community_age_range_0_2'.tr();

      case by4Months:

        return 'community_age_range_2_4'.tr();

      case by6Months:

        return 'community_age_range_4_6'.tr();

      case by9Months:

        return 'community_age_range_6_9'.tr();

      case by12Months:

        return 'community_age_range_9_12'.tr();

      case by18Months:

        return 'community_age_range_12_18'.tr();

      case by2Years:

        return 'community_age_range_12_24'.tr();

      case by30Months:

        return 'community_age_range_24_30'.tr();

      case by3Years:

        return 'community_age_range_30_36'.tr();

      case by4Years:

        return 'community_age_range_36_48'.tr();

      case by5Years:

        return 'community_age_range_48_60'.tr();

      default:

        return '';

    }

  }



  /// Stylized badge text shown on post cards.

  static String badgeLabel(String key) {

    switch (key) {

      case by2Months:

      case by4Months:

      case by6Months:

      case by9Months:

      case by12Months:

      case by18Months:

      case by2Years:

      case by30Months:

      case by3Years:

      case by4Years:

      case by5Years:

        return '[${label(key)}]';

      default:

        return key.isEmpty ? '' : '[$key]';

    }

  }



  /// Map capsule key → API query value (null = no filter).

  static String? apiValue(String key) {

    switch (key) {

      case all:

        return null;

      case by2Months:

        return by2Months;

      case by4Months:

        return by4Months;

      case by6Months:

        return by6Months;

      case by9Months:

        return by9Months;

      case by12Months:

        return by12Months;

      case by18Months:

        return by18Months;

      case by2Years:

        return by2Years;

      case by30Months:

        return by30Months;

      case by3Years:

        return by3Years;

      case by4Years:

        return by4Years;

      case by5Years:

        return by5Years;

      default:

        return null;

    }

  }



  /// Map stored/API text to canonical tier key.

  static String? normalizeKey(String? input) {

    final raw = input?.trim().toLowerCase() ?? '';

    if (raw.isEmpty) return null;



    switch (raw) {

      case 'all':

        return all;

      case '0-2':

      case '0_2':

      case 'by 2 months':

      case 'by 2 month':

        return by2Months;

      case '2-4':

      case '2_4':

      case 'by 4 months':

        return by4Months;

      case '4-6':

      case '4_6':

      case 'by 6 months':

        return by6Months;

      case '6-9':

      case '6_9':

      case 'by 9 months':

        return by9Months;

      case '9-12':

      case '9_12':

      case 'by 12 months':

        return by12Months;

      case '12-18':

      case '12_18':

      case 'by 18 months':

        return by18Months;

      case '12-24':
      case '12_24':
      case '1-2y':
      case 'by 2 years':
        return by2Years;

      case '24-30':

      case '24_30':

      case 'by 30 months':

        return by30Months;

      case '30-36':

      case '30_36':

      case 'by 3 years':

        return by3Years;

      case '36-48':

      case '36_48':

      case 'by 4 years':

        return by4Years;

      case '48-60':

      case '48_60':

      case 'by 5 years':

        return by5Years;

      // Legacy coarse buckets

      case '0-6m':

      case '0-6 months':

      case '0–6 months':

        return by6Months;

      case '6-12m':

      case '6-12 months':

      case '6–12 months':

        return by12Months;

      case '1-2 years':
      case '1–2 years':
        return by2Years;

      default:

        return null;

    }

  }



  /// Map child age in months → canonical tier key.

  static String tierKeyForAgeMonths(int ageMonths) {

    final age = ageMonths < 0 ? 0 : ageMonths;

    switch (age) {

      case <= 2:

        return by2Months;

      case <= 4:

        return by4Months;

      case <= 6:

        return by6Months;

      case <= 9:

        return by9Months;

      case <= 12:

        return by12Months;

      case <= 18:

        return by18Months;

      case <= 24:

        return by2Years;

      case <= 30:

        return by30Months;

      case <= 36:

        return by3Years;

      case <= 48:

        return by4Years;

      default:

        return by5Years;

    }

  }



  /// Map create-post picker label → API body value.

  static String? fromPickerLabel(String labelText) {

    final raw = labelText.trim().toLowerCase();

    switch (raw) {

      case 'by 2 months':

        return by2Months;

      case 'by 4 months':

        return by4Months;

      case 'by 6 months':

        return by6Months;

      case 'by 9 months':

        return by9Months;

      case 'by 12 months':

        return by12Months;

      case 'by 18 months':

        return by18Months;

      case 'by 2 years':

        return by2Years;

      case 'by 30 months':

        return by30Months;

      case 'by 3 years':

        return by3Years;

      case 'by 4 years':

        return by4Years;

      case 'by 5 years':

        return by5Years;

      default:

        return normalizeKey(labelText);

    }

  }

}

