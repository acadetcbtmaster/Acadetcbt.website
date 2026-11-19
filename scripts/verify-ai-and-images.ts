import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import http from 'node:http';
import path from 'node:path';
import zlib from 'node:zlib';
import { createApp } from '../server.js';
import {
  extractTextFromDocxBuffer,
  formatDifficultyLabel,
  normalizeDifficultyForDb,
  prepareUploadedDocumentForAi,
} from '../src/server/lib/aiQuestionGenerator.js';
import {
  decryptApiKey,
  DEFAULT_GEMINI_MODEL,
  encryptApiKey,
  maskApiKey,
} from '../src/server/lib/aiSettings.js';
import {
  MAX_QUESTION_IMAGE_BYTES,
  QuestionImageValidationError,
  validateQuestionImageFile,
} from '../src/server/lib/questionImages.js';

function buildMinimalZipDocx(xmlContent: string): Buffer {
  const fileName = Buffer.from('word/document.xml', 'utf8');
  const uncompressed = Buffer.from(xmlContent, 'utf8');
  const compressed = zlib.deflateRawSync(uncompressed);

  const localHeader = Buffer.alloc(30);
  localHeader.writeUInt32LE(0x04034b50, 0);
  localHeader.writeUInt16LE(20, 4);
  localHeader.writeUInt16LE(0, 6);
  localHeader.writeUInt16LE(8, 8); // deflate
  localHeader.writeUInt16LE(0, 10);
  localHeader.writeUInt16LE(0, 12);
  localHeader.writeUInt32LE(0, 14); // crc ignored by extractor
  localHeader.writeUInt32LE(compressed.length, 18);
  localHeader.writeUInt32LE(uncompressed.length, 22);
  localHeader.writeUInt16LE(fileName.length, 26);
  localHeader.writeUInt16LE(0, 28);

  const localRecord = Buffer.concat([localHeader, fileName, compressed]);
  const cdOffset = localRecord.length;

  const centralHeader = Buffer.alloc(46);
  centralHeader.writeUInt32LE(0x02014b50, 0);
  centralHeader.writeUInt16LE(20, 4);
  centralHeader.writeUInt16LE(20, 6);
  centralHeader.writeUInt16LE(0, 8);
  centralHeader.writeUInt16LE(8, 10); // deflate
  centralHeader.writeUInt16LE(0, 12);
  centralHeader.writeUInt16LE(0, 14);
  centralHeader.writeUInt32LE(0, 16);
  centralHeader.writeUInt32LE(compressed.length, 20);
  centralHeader.writeUInt32LE(uncompressed.length, 24);
  centralHeader.writeUInt16LE(fileName.length, 28);
  centralHeader.writeUInt16LE(0, 30);
  centralHeader.writeUInt16LE(0, 32);
  centralHeader.writeUInt16LE(0, 34);
  centralHeader.writeUInt16LE(0, 36);
  centralHeader.writeUInt32LE(0, 38);
  centralHeader.writeUInt32LE(0, 42); // localHeaderOffset

  const centralRecord = Buffer.concat([centralHeader, fileName]);

  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(1, 8);
  eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(centralRecord.length, 12);
  eocd.writeUInt32LE(cdOffset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([localRecord, centralRecord, eocd]);
}

async function run() {
  console.log('[AI & Images Verification] 1. Testing AES-256-GCM key encryption and masking...');
  const sampleKey = 'AIzaSyTestKeyExample1234567890ABCD';
  const encrypted = encryptApiKey(sampleKey);
  assert.notEqual(encrypted, sampleKey);
  assert.equal(encrypted.split(':').length, 3);
  assert.equal(decryptApiKey(encrypted), sampleKey);
  assert.equal(decryptApiKey('corrupted-payload'), null);

  const masked = maskApiKey(sampleKey);
  assert.ok(masked);
  assert.equal(masked?.includes('Example123456'), false);
  assert.ok(masked?.startsWith('AIzaSy'));
  assert.ok(masked?.endsWith('ABCD'));
  assert.equal(DEFAULT_GEMINI_MODEL, 'gemini-4-hydrogen');

  console.log('[AI & Images Verification] 2. Testing difficulty normalization (Difficult <-> Hard)...');
  assert.equal(normalizeDifficultyForDb('Easy'), 'Easy');
  assert.equal(normalizeDifficultyForDb('Medium'), 'Medium');
  assert.equal(normalizeDifficultyForDb('Difficult'), 'Hard');
  assert.equal(normalizeDifficultyForDb('difficult'), 'Hard');
  assert.equal(normalizeDifficultyForDb('Hard'), 'Hard');
  assert.equal(formatDifficultyLabel('Hard'), 'Difficult');
  assert.equal(formatDifficultyLabel('Difficult'), 'Difficult');
  assert.equal(formatDifficultyLabel('Easy'), 'Easy');

  console.log('[AI & Images Verification] 3. Testing .docx ZIP extraction and document preparation...');
  const fakeDocxXml =
    '<?xml version="1.0" encoding="UTF-8"?><w:document><w:body>' +
    '<w:p><w:r><w:t>Cell biology &amp; mitosis overview</w:t></w:r></w:p>' +
    '<w:p><w:r><w:t>DNA replication occurs during S phase.</w:t></w:r></w:p>' +
    '</w:body></w:document>';
  const fakeDocxBuffer = buildMinimalZipDocx(fakeDocxXml);
  const extractedText = extractTextFromDocxBuffer(fakeDocxBuffer);
  assert.ok(extractedText.includes('Cell biology & mitosis overview'));
  assert.ok(extractedText.includes('DNA replication occurs during S phase.'));

  const preparedDocx = prepareUploadedDocumentForAi({
    buffer: fakeDocxBuffer,
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    originalname: 'lecture_notes.docx',
  });
  assert.equal(preparedDocx.kind, 'extracted_text');
  if (preparedDocx.kind === 'extracted_text') {
    assert.ok(preparedDocx.text.includes('Cell biology & mitosis overview'));
  }

  const preparedPdf = prepareUploadedDocumentForAi({
    buffer: Buffer.from('%PDF-1.4\n1 0 obj\n<<>>\nendobj\n', 'utf8'),
    mimeType: 'application/pdf',
    originalname: 'past_questions.pdf',
  });
  assert.equal(preparedPdf.kind, 'pdf_inline');
  if (preparedPdf.kind === 'pdf_inline') {
    assert.equal(preparedPdf.mimeType, 'application/pdf');
    assert.ok(preparedPdf.base64.length > 0);
  }

  console.log('[AI & Images Verification] 4. Testing question image validation (JPG, PNG, WEBP & 5MB cap)...');
  for (const sample of [
    { name: 'specimen.jpg', mime: 'image/jpeg', bytes: Buffer.from([0xff, 0xd8, 0xff, 0xe0]) },
    { name: 'circuit.png', mime: 'image/png', bytes: Buffer.from([0x89, 0x50, 0x4e, 0x47]) },
    { name: 'graph.webp', mime: 'image/webp', bytes: Buffer.from('RIFF1234WEBP', 'utf8') },
  ]) {
    const validated = validateQuestionImageFile({
      buffer: sample.bytes,
      mimeType: sample.mime,
      fileName: sample.name,
    });
    assert.equal(validated.mimeType, sample.mime);
  }

  assert.throws(
    () =>
      validateQuestionImageFile({
        buffer: Buffer.from('<svg></svg>', 'utf8'),
        mimeType: 'image/svg+xml',
        fileName: 'bad.svg',
      }),
    (err: unknown) => err instanceof QuestionImageValidationError
  );

  assert.throws(
    () =>
      validateQuestionImageFile({
        buffer: Buffer.alloc(MAX_QUESTION_IMAGE_BYTES + 1, 1),
        mimeType: 'image/png',
        fileName: 'oversized.png',
      }),
    (err: unknown) => err instanceof QuestionImageValidationError
  );

  console.log('[AI & Images Verification] 5. Auditing source security & draft-isolation guarantees...');
  const viteConfig = await fs.readFile(path.resolve(process.cwd(), 'vite.config.ts'), 'utf-8');
  assert.equal(viteConfig.includes('GEMINI_API_KEY'), false);

  const adminRoutes = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/admin.ts'),
    'utf-8'
  );
  assert.equal(adminRoutes.includes('gemini-2.5-flash'), false);
  assert.ok(adminRoutes.includes("publicationStatus: 'draft'"));
  assert.ok(adminRoutes.includes('isActive: false'));

  const examsRoutes = await fs.readFile(
    path.resolve(process.cwd(), 'src/server/routes/exams.ts'),
    'utf-8'
  );
  assert.ok(examsRoutes.includes("eq(questions.publicationStatus, 'published')"));
  assert.ok(examsRoutes.includes('normalizeDifficultyForDb'));

  console.log('[AI & Images Verification] 6. Verifying admin AI endpoints require authentication...');
  const app = await createApp({ skipVite: true });
  const server = await new Promise<http.Server>((resolve) => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });

  try {
    const addr = server.address();
    assert.ok(addr && typeof addr === 'object');
    const baseUrl = `http://127.0.0.1:${addr.port}`;

    for (const check of [
      { method: 'GET', url: `${baseUrl}/api/admin/ai/settings` },
      { method: 'PUT', url: `${baseUrl}/api/admin/ai/settings` },
      { method: 'POST', url: `${baseUrl}/api/admin/ai/test` },
      { method: 'POST', url: `${baseUrl}/api/admin/ai/generate-questions` },
    ]) {
      const resp = await fetch(check.url, { method: check.method });
      assert.ok(resp.status === 401 || resp.status === 503);
    }

    const imgResp = await fetch(`${baseUrl}/api/public/question-images/not-a-uuid`);
    assert.ok(imgResp.status === 400 || imgResp.status === 404);
  } finally {
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }

  console.log('[AI & Images Verification] PASSED.');
}

run().catch((err) => {
  console.error('[AI & Images Verification] FAILED:', err);
  process.exit(1);
});
