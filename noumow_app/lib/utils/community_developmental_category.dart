import 'package:easy_localization/easy_localization.dart';

/// Developmental domain tags for peer-support posts (switch-case, not enums).

class CommunityDevelopmentalCategory {

  CommunityDevelopmentalCategory._();



  static const all = 'all';

  static const speechLanguage = 'speech_language';

  static const grossMotor = 'gross_motor';

  static const sensoryAutism = 'sensory_autism';

  static const feedingSleep = 'feeding_sleep';



  static const filterKeys = [

    all,

    speechLanguage,

    grossMotor,

    sensoryAutism,

    feedingSleep,

  ];



  static const createPickerKeys = [

    speechLanguage,

    grossMotor,

    sensoryAutism,

    feedingSleep,

  ];



  static String label(String key) {

    switch (key) {

      case all:

        return 'community_dev_label_all'.tr();

      case speechLanguage:

        return 'community_dev_label_speech_language'.tr();

      case grossMotor:

        return 'community_dev_label_gross_motor'.tr();

      case sensoryAutism:

        return 'community_dev_label_sensory_autism'.tr();

      case feedingSleep:

        return 'community_dev_label_feeding_sleep'.tr();

      default:

        return key;

    }

  }



  static String? apiValue(String key) {

    switch (key) {

      case all:

        return null;

      case speechLanguage:

        return speechLanguage;

      case grossMotor:

        return grossMotor;

      case sensoryAutism:

        return sensoryAutism;

      case feedingSleep:

        return feedingSleep;

      default:

        return null;

    }

  }



  static String? normalizeKey(String? input) {

    final raw = input?.trim().toLowerCase() ?? '';

    if (raw.isEmpty) return null;



    switch (raw) {

      case 'speech_language':

      case 'speech & language':

      case 'speech and language':

        return speechLanguage;

      case 'gross_motor':

      case 'gross motor skills':

      case 'gross motor':

        return grossMotor;

      case 'sensory_autism':

      case 'sensory/autism support':

      case 'sensory autism support':

        return sensoryAutism;

      case 'feeding_sleep':

      case 'feeding & sleep':

      case 'feeding and sleep':

        return feedingSleep;

      default:

        return null;

    }

  }

}

