/** API / DB age category strings for community posts (11 CDC-style tiers). */



export const AGE_CATEGORY_ALL = 'all';



/** Canonical tier keys stored in community_posts.age_category. */

export const AGE_CATEGORIES = [

  '0-2',

  '2-4',

  '4-6',

  '6-9',

  '9-12',

  '12-18',

  '12-24',

  '24-30',

  '30-36',

  '36-48',

  '48-60',

];



/**

 * Map UI labels or loose inputs to canonical age_category via switch-case.

 * Returns null when the value is not recognized.

 */

export function normalizeAgeCategory(input) {

  const raw = String(input || '').trim().toLowerCase();



  switch (raw) {

    case '0-2':

    case '0_2':

    case 'by 2 months':

    case 'by 2 month':

      return '0-2';



    case '2-4':

    case '2_4':

    case 'by 4 months':

      return '2-4';



    case '4-6':

    case '4_6':

    case 'by 6 months':

      return '4-6';



    case '6-9':

    case '6_9':

    case 'by 9 months':

      return '6-9';



    case '9-12':

    case '9_12':

    case 'by 12 months':

      return '9-12';



    case '12-18':

    case '12_18':

    case 'by 18 months':

      return '12-18';



    case '12-24':

    case '12_24':

    case 'by 2 years':

      return '12-24';



    case '24-30':

    case '24_30':

    case 'by 30 months':

      return '24-30';



    case '30-36':

    case '30_36':

    case 'by 3 years':

      return '30-36';



    case '36-48':

    case '36_48':

    case 'by 4 years':

      return '36-48';



    case '48-60':

    case '48_60':

    case 'by 5 years':

      return '48-60';



    // Legacy coarse buckets

    case '0-6m':

    case '0-6 months':

    case '0–6 months':

      return '4-6';



    case '6-12m':

    case '6-12 months':

    case '6–12 months':

      return '9-12';



    case '1-2y':

    case '1-2 years':

    case '1–2 years':

      return '12-24';



    default:

      return null;

  }

}



/** Human label for mobile capsule UI. */

export function ageCategoryLabel(category) {

  switch (category) {

    case '0-2':

      return 'By 2 Months';

    case '2-4':

      return 'By 4 Months';

    case '4-6':

      return 'By 6 Months';

    case '6-9':

      return 'By 9 Months';

    case '9-12':

      return 'By 12 Months';

    case '12-18':

      return 'By 18 Months';

    case '12-24':

      return 'By 2 Years';

    case '24-30':

      return 'By 30 Months';

    case '30-36':

      return 'By 3 Years';

    case '36-48':

      return 'By 4 Years';

    case '48-60':

      return 'By 5 Years';

    default:

      return category || '';

  }

}

