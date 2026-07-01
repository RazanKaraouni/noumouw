/** Detect if the parent message is primarily Arabic. */
export function isArabicText(text) {
  return /[\u0600-\u06FF]/.test(String(text || ''));
}

/** Autism / screening-related play or game requests. */
export function isAutismRelatedGameRequest(question) {
  const q = String(question || '').trim();
  const lower = q.toLowerCase();
  return (
    /autism|autistic|m-?chat|asd|spectrum|screening.{0,20}(game|play|activit)|game.{0,20}autism|play.{0,20}autism/.test(
      lower,
    ) || /توحد|التوحد|طيف|فحص.{0,15}(لعب|ألعاب|نشاط)|ألعاب.{0,15}توحد|لعب.{0,15}توحد/.test(q)
  );
}

/** Required disclaimer for autism-related play suggestions. */
export function medicalAdviceDisclaimer(question) {
  return isArabicText(question)
    ? 'للنصائح الطبية، تواصل مع معالج طفلك!'
    : 'For medical advice, contact your therapist!';
}

/** Mandatory Gemini language block — reply in the same language as the parent. */
export function replyLanguageInstruction(question) {
  if (isArabicText(question)) {
    return `LANGUAGE (mandatory):
- The parent wrote in Arabic — your ENTIRE reply must be in Arabic only
- Use clear, natural Modern Standard Arabic (friendly parent tone)
- Do NOT reply in English — not even one sentence or one label
- Keep only proper names unchanged (child name, therapist name) if needed`;
  }
  return `LANGUAGE (mandatory):
- The parent wrote in English — your ENTIRE reply must be in English only`;
}

/** When parent asks in Arabic, translate English assignment data into Arabic in the reply. */
export function assignmentArabicInstruction(question) {
  if (!isArabicText(question)) return '';
  return `ARABIC ASSIGNMENT TRANSLATION (mandatory):
- Assignment title, instructions, therapist notes, status, and domain may be stored in English in the database
- Translate ALL assignment text into Arabic in your reply — do not quote English instructions
- Explain what the parent should do at home fully in Arabic
- Translate domain names too (e.g. Motor → حركي, Language → لغوي, Cognitive → إدراكي, Social → اجتماعي)
- The parent must understand the activity without reading any English`;
}
