import { GoogleGenerativeAI } from '@google/generative-ai';

function toFriendlyGeminiError(err) {
  const status = err?.status;
  const raw = String(err?.message || err || 'Gemini request failed.');

  if (status === 429 || raw.includes('quota') || raw.includes('Too Many Requests')) {
    const friendly = new Error(
      'Gemini free-tier limit reached. Wait 1–2 minutes and try again. Check usage at aistudio.google.com → Rate Limit.',
    );
    friendly.status = 503;
    return friendly;
  }
  if (status === 400 || status === 401 || status === 403 || raw.includes('API key')) {
    const friendly = new Error(
      'Invalid Gemini API key. Create one at https://aistudio.google.com/app/apikey and set GEMINI_API_KEY in backend .env.',
    );
    friendly.status = 503;
    return friendly;
  }
  if (status === 404 || raw.includes('not found')) {
    const friendly = new Error(
      'Gemini model not available. Set GEMINI_MODEL=gemini-2.5-flash in backend .env.',
    );
    friendly.status = 503;
    return friendly;
  }

  const friendly = new Error('Could not reach Gemini. Please try again.');
  friendly.status = 503;
  return friendly;
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Call Gemini and return plain text.
 * @param {string} prompt
 * @param {{ responseMimeType?: string, temperature?: number }} [options]
 */
export async function callGeminiText(prompt, options = {}) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    const err = new Error('Activity suggestions are not configured (missing GEMINI_API_KEY).');
    err.status = 503;
    throw err;
  }

  const modelCandidates = [
    ...new Set(
      [process.env.GEMINI_MODEL, 'gemini-2.5-flash', 'gemini-2.0-flash-lite'].filter(Boolean),
    ),
  ];

  const genAI = new GoogleGenerativeAI(apiKey);
  const generationConfig = {
    temperature: options.temperature ?? 0.7,
    ...(options.responseMimeType
      ? { responseMimeType: options.responseMimeType }
      : {}),
  };

  let result;
  let lastGeminiError = null;
  for (const modelName of modelCandidates) {
    for (let attempt = 0; attempt < 2; attempt += 1) {
      try {
        const model = genAI.getGenerativeModel({ model: modelName, generationConfig });
        result = await model.generateContent(prompt);
        break;
      } catch (err) {
        lastGeminiError = err;
        const isRateLimit = err?.status === 429;
        if (isRateLimit && attempt === 0) {
          await sleep(10_000);
          continue;
        }
        if (!isRateLimit && err?.status !== 503) {
          throw toFriendlyGeminiError(err);
        }
        break;
      }
    }
    if (result) break;
  }

  if (!result) {
    throw toFriendlyGeminiError(lastGeminiError);
  }

  const text = result?.response?.text?.();
  if (!text?.trim()) {
    throw new Error('Gemini returned an empty response.');
  }
  return text.trim();
}

export { toFriendlyGeminiError };
