/** Developmental domain tags for community posts. */



export const DEVELOPMENTAL_CATEGORIES = [

  'speech_language',

  'gross_motor',

  'sensory_autism',

  'feeding_sleep',

];



export function normalizeDevelopmentalCategory(input) {

  const raw = String(input || '').trim().toLowerCase();



  switch (raw) {

    case 'speech_language':

    case 'speech & language':

    case 'speech and language':

      return 'speech_language';



    case 'gross_motor':

    case 'gross motor skills':

    case 'gross motor':

      return 'gross_motor';



    case 'sensory_autism':

    case 'sensory/autism support':

    case 'sensory autism support':

      return 'sensory_autism';



    case 'feeding_sleep':

    case 'feeding & sleep':

    case 'feeding and sleep':

      return 'feeding_sleep';



    default:

      return null;

  }

}



export function developmentalCategoryLabel(category) {

  switch (category) {

    case 'speech_language':

      return 'Speech & Language';

    case 'gross_motor':

      return 'Gross Motor Skills';

    case 'sensory_autism':

      return 'Sensory/Autism Support';

    case 'feeding_sleep':

      return 'Feeding & Sleep';

    default:

      return category || '';

  }

}

