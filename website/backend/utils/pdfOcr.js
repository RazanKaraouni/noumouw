import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, writeFile } from 'fs/promises';
import { dirname, join } from 'path';
import { tmpdir } from 'os';
import { fileURLToPath } from 'url';
import { pdf } from 'pdf-to-img';
import { PDFParse } from 'pdf-parse';
import { createWorker } from 'tesseract.js';

const MIN_EXTRACTED_CHARS = 120;

function plainFromHtml(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_ROOT = join(__dirname, '..');

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function plainTextToHtml(text) {
  const normalized = String(text || '').replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';
  const paras = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (paras.length === 0) return '';
  return paras.map((p) => `<p>${escapeHtml(p.replace(/\n/g, ' '))}</p>`).join('');
}

async function extractPdfEmbeddedText(buffer) {
  const parser = new PDFParse({ data: buffer });
  try {
    const result = await parser.getText();
    return (result.text || '').trim();
  } finally {
    await parser.destroy();
  }
}

async function extractPdfOcrTextInProcess(buffer, onProgress) {
  const worker = await createWorker('eng');
  const pageTexts = [];

  try {
    const doc = await pdf(buffer, { scale: 2 });
    let pageNum = 0;
    for await (const image of doc) {
      pageNum += 1;
      onProgress?.(`OCR page ${pageNum}/${doc.length}`);
      const {
        data: { text },
      } = await worker.recognize(image);
      const trimmed = (text || '').trim();
      if (trimmed) pageTexts.push(trimmed);
    }
    await doc.destroy();
  } finally {
    await worker.terminate();
  }

  return pageTexts.join('\n\n').trim();
}

/** Run OCR in a child process so pdf-parse and pdf-to-img do not clash on pdfjs workers. */
async function extractPdfOcrText(buffer, onProgress) {
  const dir = await mkdtemp(join(tmpdir(), 'pdf-ocr-'));
  const inPath = join(dir, 'input.pdf');
  const outPath = join(dir, 'result.json');

  try {
    await writeFile(inPath, buffer);
    await new Promise((resolve, reject) => {
      const child = spawn(
        process.execPath,
        [join(BACKEND_ROOT, 'scripts/ocrPdfCli.js'), inPath, outPath],
        { cwd: BACKEND_ROOT, stdio: ['ignore', 'pipe', 'pipe'] },
      );
      child.stderr.on('data', (chunk) => {
        for (const line of chunk.toString().split('\n')) {
          const trimmed = line.trim();
          if (trimmed) onProgress?.(trimmed);
        }
      });
      child.on('error', reject);
      child.on('close', (code) => {
        if (code === 0) resolve();
        else reject(new Error(`OCR child exited with code ${code}`));
      });
    });
    const { html } = JSON.parse(await readFile(outPath, 'utf8'));
    return (html || '').trim() || null;
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/**
 * Extract PDF text (embedded layer first, then OCR for scanned pages).
 * @param {Buffer} buffer
 * @param {{ onProgress?: (message: string) => void }} [options]
 * @returns {Promise<string|null>} HTML or null
 */
export async function extractPdfHtml(buffer, options = {}) {
  if (!buffer?.length) return null;
  const log = (message) => options.onProgress?.(message);

  // Try embedded text without loading pdfjs worker (pdf-parse uses its own runtime).
  const embedded = await extractPdfEmbeddedText(buffer);
  if (embedded.replace(/\s+/g, ' ').trim().length >= MIN_EXTRACTED_CHARS) {
    return plainTextToHtml(embedded);
  }

  log('embedded text too short — running OCR');
  const ocrHtml = await extractPdfOcrText(buffer, log);
  if (!ocrHtml || plainFromHtml(ocrHtml).length < MIN_EXTRACTED_CHARS) return null;
  return ocrHtml;
}

/** OCR-only path for isolated scripts (ocrPdfCli). */
export async function extractPdfHtmlOcrOnly(buffer, options = {}) {
  if (!buffer?.length) return null;
  const log = (message) => options.onProgress?.(message);
  log('running OCR');
  const ocrText = await extractPdfOcrTextInProcess(buffer, log);
  if (!ocrText) return null;
  return plainTextToHtml(ocrText) || null;
}
