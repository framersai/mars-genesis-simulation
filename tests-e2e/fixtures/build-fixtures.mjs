#!/usr/bin/env node
/**
 * Generate the two fixture PDFs consumed by `tests-e2e/specs/pdf-upload.spec.ts`.
 *
 *   - `sample.pdf`   — 3 pages of plain text (>= 600 chars total). Exercises the
 *                       happy path through `extractPdfText` so the test asserts
 *                       the parser worker boots cleanly on a fresh page load.
 *   - `scanned.pdf`  — 1 page with an embedded image and NO text layer.
 *                       Exercises the `PDF_NO_TEXT` branch so the user-facing
 *                       "scanned image" copy is exercised end-to-end.
 *
 * Idempotent: skips fixtures that already exist on disk so re-running the
 * script in CI is cheap.
 */
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import { writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function buildSample() {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const lorem = [
    'The Paracosm dashboard simulates agent swarms with measurable HEXACO personalities against deterministic kernels.',
    'Each scenario is compiled into a typed world model and replayed through an event stream.',
    'This fixture exists to verify the PDF parser extracts at least 200 characters of text on a fresh page load with no manual recovery actions required by the user.',
    'The text is repeated across three pages so the byte-budget logic and page-loop both get exercised.',
  ].join(' ');
  for (let p = 0; p < 3; p++) {
    const page = doc.addPage([612, 792]);
    page.drawText(lorem, {
      x: 50,
      y: 700,
      size: 11,
      font,
      color: rgb(0, 0, 0),
      maxWidth: 500,
      lineHeight: 14,
    });
  }
  return doc.save();
}

async function buildScanned() {
  const doc = await PDFDocument.create();
  const page = doc.addPage([612, 792]);
  // 1x1 transparent PNG. No text layer at all — pdf.js will return
  // empty text content and `extractPdfText` will throw with code
  // `PDF_NO_TEXT`, which routes through the "scanned image" message.
  const png = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=',
    'base64',
  );
  const img = await doc.embedPng(png);
  page.drawImage(img, { x: 0, y: 0, width: 612, height: 792 });
  return doc.save();
}

const samplePath = resolve(__dirname, 'sample.pdf');
const scannedPath = resolve(__dirname, 'scanned.pdf');

if (!existsSync(samplePath)) writeFileSync(samplePath, await buildSample());
if (!existsSync(scannedPath)) writeFileSync(scannedPath, await buildScanned());
console.log('Wrote', samplePath, 'and', scannedPath);
