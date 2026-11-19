import zlib from 'node:zlib';
import path from 'node:path';
import { Type, type Part } from '@google/genai';
import {
  createGeminiClient,
  getConfiguredGeminiCredentials,
} from './aiSettings.js';
import { validateQuestionImageFile } from './questionImages.js';

export type CanonicalDbDifficulty = 'Easy' | 'Medium' | 'Hard';
export type InputDifficulty = 'Easy' | 'Medium' | 'Hard' | 'Difficult';

export interface GeneratedQuestionDraft {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: 'A' | 'B' | 'C' | 'D';
  explanation: string;
  topic: string;
  difficulty: CanonicalDbDifficulty;
  matchedImageIndices: number[];
  requiresImage: boolean;
  imageNote: string | null;
}

export class AiGenerationError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.name = 'AiGenerationError';
    this.statusCode = statusCode;
  }
}

export function normalizeDifficultyForDb(raw: string | undefined | null): CanonicalDbDifficulty {
  const norm = (raw || '').trim().toLowerCase();
  if (norm === 'easy') return 'Easy';
  if (norm === 'hard' || norm === 'difficult') return 'Hard';
  return 'Medium';
}

export function formatDifficultyLabel(diff: string): 'Easy' | 'Medium' | 'Difficult' {
  const norm = (diff || '').trim().toLowerCase();
  if (norm === 'easy') return 'Easy';
  if (norm === 'hard' || norm === 'difficult') return 'Difficult';
  return 'Medium';
}

function decodeXmlEntities(xml: string): string {
  return xml
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

/**
 * Pure Node.js ZIP reader extracting word/document.xml text from .docx archives
 * without requiring native addons or heavy third-party parsers.
 */
export function extractTextFromDocxBuffer(buffer: Buffer): string {
  // Locate End of Central Directory record (PK\x05\x06)
  let eocdOffset = -1;
  const minOffset = Math.max(0, buffer.length - 65557);
  for (let i = buffer.length - 22; i >= minOffset; i -= 1) {
    if (
      buffer[i] === 0x50 &&
      buffer[i + 1] === 0x4b &&
      buffer[i + 2] === 0x05 &&
      buffer[i + 3] === 0x06
    ) {
      eocdOffset = i;
      break;
    }
  }

  if (eocdOffset === -1) {
    throw new AiGenerationError(
      'Unable to read DOCX file structure. Please upload a valid .docx or .pdf document.'
    );
  }

  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  let cdOffset = buffer.readUInt32LE(eocdOffset + 16);
  const extractedChunks: string[] = [];

  for (let entryIdx = 0; entryIdx < totalEntries; entryIdx += 1) {
    if (cdOffset + 46 > buffer.length) break;
    if (
      buffer[cdOffset] !== 0x50 ||
      buffer[cdOffset + 1] !== 0x4b ||
      buffer[cdOffset + 2] !== 0x01 ||
      buffer[cdOffset + 3] !== 0x02
    ) {
      break;
    }

    const compressionMethod = buffer.readUInt16LE(cdOffset + 10);
    const compressedSize = buffer.readUInt32LE(cdOffset + 20);
    const fileNameLen = buffer.readUInt16LE(cdOffset + 28);
    const extraLen = buffer.readUInt16LE(cdOffset + 30);
    const commentLen = buffer.readUInt16LE(cdOffset + 32);
    const localHeaderOffset = buffer.readUInt32LE(cdOffset + 42);

    const fileName = buffer
      .slice(cdOffset + 46, cdOffset + 46 + fileNameLen)
      .toString('utf8');

    cdOffset += 46 + fileNameLen + extraLen + commentLen;

    if (
      fileName === 'word/document.xml' ||
      /^word\/(?:header|footer)\d*\.xml$/i.test(fileName)
    ) {
      if (localHeaderOffset + 30 > buffer.length) continue;
      const localNameLen = buffer.readUInt16LE(localHeaderOffset + 26);
      const localExtraLen = buffer.readUInt16LE(localHeaderOffset + 28);
      const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen;
      const dataSlice = buffer.slice(dataStart, dataStart + compressedSize);

      let xmlBytes: Buffer;
      if (compressionMethod === 0) {
        xmlBytes = dataSlice;
      } else if (compressionMethod === 8) {
        xmlBytes = zlib.inflateRawSync(dataSlice);
      } else {
        continue;
      }

      const rawXml = xmlBytes.toString('utf8');
      const withBreaks = rawXml
        .replace(/<\/w:p>/g, '\n')
        .replace(/<w:br\s*\/?>/g, '\n')
        .replace(/<w:tab\s*\/?>/g, '\t')
        .replace(/<[^>]+>/g, '');
      const cleanText = decodeXmlEntities(withBreaks)
        .replace(/\n{3,}/g, '\n\n')
        .trim();

      if (cleanText) {
        extractedChunks.push(cleanText);
      }
    }
  }

  const combined = extractedChunks.join('\n\n').trim();
  if (!combined) {
    throw new AiGenerationError(
      'No readable text was found inside the uploaded DOCX file.'
    );
  }
  return combined.slice(0, 120_000);
}

export function prepareUploadedDocumentForAi(file: {
  buffer: Buffer;
  mimeType: string;
  originalname: string;
}):
  | { kind: 'pdf_inline'; mimeType: 'application/pdf'; base64: string; fileName: string }
  | { kind: 'extracted_text'; text: string; fileName: string } {
  if (!file.buffer || file.buffer.length === 0) {
    throw new AiGenerationError('Uploaded document is empty.');
  }
  if (file.buffer.length > 20 * 1024 * 1024) {
    throw new AiGenerationError('Uploaded document exceeds the 20 MB limit.');
  }

  const ext = path.extname(file.originalname || '').toLowerCase();
  const mime = (file.mimeType || '').toLowerCase().trim();

  if (mime === 'application/pdf' || ext === '.pdf') {
    return {
      kind: 'pdf_inline',
      mimeType: 'application/pdf',
      base64: file.buffer.toString('base64'),
      fileName: file.originalname,
    };
  }

  if (
    ext === '.docx' ||
    mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ) {
    return {
      kind: 'extracted_text',
      text: extractTextFromDocxBuffer(file.buffer),
      fileName: file.originalname,
    };
  }

  if (
    ext === '.txt' ||
    ext === '.md' ||
    ext === '.csv' ||
    mime.startsWith('text/')
  ) {
    const decoded = file.buffer.toString('utf8').replace(/\0/g, '').trim();
    if (!decoded) {
      throw new AiGenerationError('Uploaded text document contains no readable content.');
    }
    return {
      kind: 'extracted_text',
      text: decoded.slice(0, 120_000),
      fileName: file.originalname,
    };
  }

  if (ext === '.doc' || mime === 'application/msword') {
    // Best-effort printable ASCII/UTF-8 extraction for legacy binary .doc files, else instruct PDF/DOCX
    const fallbackText = file.buffer
      .toString('utf8')
      .replace(/[^\x20-\x7E\r\n\t]/g, ' ')
      .replace(/\s{3,}/g, ' ')
      .trim();
    if (fallbackText.length >= 120) {
      return {
        kind: 'extracted_text',
        text: fallbackText.slice(0, 120_000),
        fileName: file.originalname,
      };
    }
    throw new AiGenerationError(
      'Legacy binary .doc format could not be cleanly decoded. Please save it as .pdf or .docx and upload again.'
    );
  }

  throw new AiGenerationError(
    `Unsupported document format "${file.originalname}". Supported formats: PDF, DOCX, TXT, MD, CSV.`
  );
}

const QUESTION_ARRAY_SCHEMA = {
  type: Type.ARRAY,
  items: {
    type: Type.OBJECT,
    properties: {
      questionText: { type: Type.STRING },
      optionA: { type: Type.STRING },
      optionB: { type: Type.STRING },
      optionC: { type: Type.STRING },
      optionD: { type: Type.STRING },
      correctOption: { type: Type.STRING, enum: ['A', 'B', 'C', 'D'] },
      explanation: { type: Type.STRING },
      topic: { type: Type.STRING },
      matchedImageIndices: {
        type: Type.ARRAY,
        items: { type: Type.INTEGER },
      },
      requiresImage: { type: Type.BOOLEAN },
      imageNote: { type: Type.STRING },
    },
    required: [
      'questionText',
      'optionA',
      'optionB',
      'optionC',
      'optionD',
      'correctOption',
      'explanation',
      'topic',
      'matchedImageIndices',
      'requiresImage',
    ],
  },
};

const SINGLE_QUESTION_SCHEMA = {
  type: Type.OBJECT,
  properties: QUESTION_ARRAY_SCHEMA.items.properties,
  required: QUESTION_ARRAY_SCHEMA.items.required,
};

function sanitizeGeneratedItem(
  raw: Record<string, unknown>,
  difficulty: CanonicalDbDifficulty,
  fallbackTopic: string,
  maxImageCount: number
): GeneratedQuestionDraft | null {
  const questionText = String(raw.questionText ?? '').trim();
  const optionA = String(raw.optionA ?? '').trim();
  const optionB = String(raw.optionB ?? '').trim();
  const optionC = String(raw.optionC ?? '').trim();
  const optionD = String(raw.optionD ?? '').trim();
  const explanation = String(raw.explanation ?? '').trim();
  const topic = String(raw.topic ?? '').trim() || fallbackTopic || 'General';
  const rawCorrect = String(raw.correctOption ?? 'A').trim().toUpperCase();
  const correctOption: 'A' | 'B' | 'C' | 'D' =
    rawCorrect === 'B' || rawCorrect === 'C' || rawCorrect === 'D' ? rawCorrect : 'A';

  if (!questionText || !optionA || !optionB || !optionC || !optionD) {
    return null;
  }

  const rawIndices = Array.isArray(raw.matchedImageIndices) ? raw.matchedImageIndices : [];
  const validIndices = Array.from(
    new Set(
      rawIndices
        .map((v) => Number(v))
        .filter((n) => Number.isInteger(n) && n >= 0 && n < maxImageCount)
    )
  );

  const requiresImage = Boolean(raw.requiresImage) || validIndices.length > 0;
  const rawNote = raw.imageNote !== undefined && raw.imageNote !== null ? String(raw.imageNote).trim() : '';

  return {
    questionText,
    optionA,
    optionB,
    optionC,
    optionD,
    correctOption,
    explanation,
    topic: topic.slice(0, 120),
    difficulty,
    matchedImageIndices: validIndices,
    requiresImage,
    imageNote: rawNote ? rawNote.slice(0, 400) : null,
  };
}

export async function generateCbtQuestionsWithAi(params: {
  course: { id: string; code: string; title: string; level?: string };
  count: number;
  difficulty: InputDifficulty;
  topicHint?: string;
  textContent?: string;
  documentFile?: { buffer: Buffer; mimeType: string; originalname: string } | null;
  uploadedImages?: Array<{ buffer: Buffer; mimeType: string; originalname: string }>;
}): Promise<GeneratedQuestionDraft[]> {
  const creds = await getConfiguredGeminiCredentials();
  if (!creds.apiKey) {
    throw new AiGenerationError(
      'Gemini API key is not configured. Open AI API Settings in the Admin Panel to add and test your Gemini API key.',
      503
    );
  }

  const trimmedText = (params.textContent || '').trim().slice(0, 120_000);
  const images = params.uploadedImages || [];

  if (!trimmedText && !params.documentFile && images.length === 0) {
    throw new AiGenerationError(
      'Please provide learning material using PDF/Document Upload, Image Upload, or Direct Text Input.'
    );
  }

  const dbDifficulty = normalizeDifficultyForDb(params.difficulty);
  const difficultyLabel = formatDifficultyLabel(dbDifficulty);
  const count = Math.max(1, Math.min(50, Math.floor(params.count)));

  const parts: Part[] = [];

  const difficultyGuidance =
    dbDifficulty === 'Easy'
      ? 'Easy (foundational definitions, direct recall, clear core concepts)'
      : dbDifficulty === 'Hard'
        ? 'Difficult (multi-step analysis, application, synthesis, subtle edge cases)'
        : 'Medium (conceptual understanding, interpretation, and practical problem-solving)';

  const imagePolicyInstruction =
    images.length > 0
      ? `\nUploaded images (${images.length} total) are attached below with indices 0 to ${images.length - 1}.\n` +
        `Perform careful OCR and visual analysis on diagrams, graphs, specimens, tables, formulas, and handwritten/printed notes in each image.\n` +
        `For each question:\n` +
        `- Set "matchedImageIndices" ONLY to the exact image index/indices (from 0 to ${images.length - 1}) that the student MUST inspect to answer that question (for example a diagram, graph, circuit, labelled specimen, or chart).\n` +
        `- If a question is derived from plain text or does NOT strictly depend on a visual diagram in the image, leave "matchedImageIndices" as []. Never attach unrelated images.\n` +
        `- Set "requiresImage" to true if the question references a visual/diagram/figure, otherwise false.\n` +
        `- Set "imageNote" to a concise note describing which diagram or figure applies.`
      : `\nNo standalone image files were uploaded in this request.\n` +
        `- Always set "matchedImageIndices" to [].\n` +
        `- If the uploaded PDF or material contains an essential diagram/graph/specimen that a question specifically asks about, set "requiresImage" to true and explain in "imageNote" what figure/diagram from the source material the admin should attach manually before publishing; otherwise set "requiresImage" to false and "imageNote" to "".`;

  parts.push({
    text: `You are an expert university CBT examination item writer for Acadet CBT.
Generate EXACTLY ${count} high-quality, academically accurate multiple-choice CBT questions for:
Course: ${params.course.code} — ${params.course.title}${params.course.level ? ` (${params.course.level})` : ''}
Difficulty Level: ${difficultyLabel} — ${difficultyGuidance}
${params.topicHint ? `Focus Topic: ${params.topicHint}\n` : ''}
Requirements:
1. Base EVERY question strictly on the learning material submitted below (text, document, and/or images). Do not invent unrelated facts.
2. Each question must have 4 plausible, distinct options labelled optionA, optionB, optionC, optionD (do NOT prefix the option strings with "A.", "B.", etc.).
3. Provide the single unambiguous correctOption ("A", "B", "C", or "D"), a concise post-exam explanation, and a short topic label.
4. Ensure all ${count} questions match the requested "${difficultyLabel}" difficulty level.${imagePolicyInstruction}`,
  });

  if (params.documentFile) {
    const preparedDoc = prepareUploadedDocumentForAi(params.documentFile);
    if (preparedDoc.kind === 'pdf_inline') {
      parts.push({
        text: `\n--- UPLOADED PDF DOCUMENT (${preparedDoc.fileName}) ---`,
      });
      parts.push({
        inlineData: {
          mimeType: preparedDoc.mimeType,
          data: preparedDoc.base64,
        },
      });
    } else {
      parts.push({
        text: `\n--- UPLOADED DOCUMENT CONTENT (${preparedDoc.fileName}) ---\n${preparedDoc.text}`,
      });
    }
  }

  if (images.length > 0) {
    for (let idx = 0; idx < images.length; idx += 1) {
      const img = images[idx];
      const validated = validateQuestionImageFile({
        buffer: img.buffer,
        mimeType: img.mimeType,
        fileName: img.originalname,
      });
      parts.push({
        text: `\n[SOURCE_IMAGE_${idx}] filename="${validated.fileName}"`,
      });
      parts.push({
        inlineData: {
          mimeType: validated.mimeType,
          data: img.buffer.toString('base64'),
        },
      });
    }
  }

  if (trimmedText) {
    parts.push({
      text: `\n--- DIRECT LECTURE NOTES / TEXT INPUT ---\n${trimmedText}`,
    });
  }

  const ai = createGeminiClient(creds.apiKey);

  let responseText = '';
  try {
    const response = await ai.models.generateContent({
      model: creds.modelName,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: QUESTION_ARRAY_SCHEMA,
      },
    });
    responseText = response.text || '';
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'Gemini question generation failed.';
    const safeMsg = rawMsg.replace(/AIza[0-9A-Za-z_-]{10,}/g, 'AIza••••••••');
    throw new AiGenerationError(`AI generation failed: ${safeMsg}`, 502);
  }

  let parsedPayload: unknown;
  try {
    parsedPayload = JSON.parse(responseText || '[]');
  } catch {
    throw new AiGenerationError(
      'AI returned an unreadable response payload. Please retry generation.',
      502
    );
  }

  if (!Array.isArray(parsedPayload) || parsedPayload.length === 0) {
    throw new AiGenerationError(
      'AI could not generate questions from the submitted material. Try providing clearer text or source files.',
      502
    );
  }

  const fallbackTopic = params.topicHint?.trim() || params.course.code;
  const sanitized = parsedPayload
    .slice(0, count)
    .map((item) =>
      sanitizeGeneratedItem(
        (item && typeof item === 'object' ? item : {}) as Record<string, unknown>,
        dbDifficulty,
        fallbackTopic,
        images.length
      )
    )
    .filter((item): item is GeneratedQuestionDraft => item !== null);

  if (sanitized.length === 0) {
    throw new AiGenerationError(
      'AI returned incomplete question drafts. Please try again.',
      502
    );
  }

  return sanitized;
}

export async function regenerateSingleQuestionWithAi(params: {
  course: { id: string; code: string; title: string; level?: string };
  existingQuestion: {
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    correctOption: string;
    topic: string;
    difficulty: string;
    aiImageNote?: string | null;
  };
  instruction?: string;
  sourceExcerpt?: string;
}): Promise<GeneratedQuestionDraft> {
  const creds = await getConfiguredGeminiCredentials();
  if (!creds.apiKey) {
    throw new AiGenerationError(
      'Gemini API key is not configured. Open AI API Settings in the Admin Panel first.',
      503
    );
  }

  const dbDifficulty = normalizeDifficultyForDb(params.existingQuestion.difficulty);
  const difficultyLabel = formatDifficultyLabel(dbDifficulty);

  const ai = createGeminiClient(creds.apiKey);

  const prompt = `Regenerate 1 improved replacement multiple-choice CBT question for Acadet CBT.
Course: ${params.course.code} — ${params.course.title}
Topic: ${params.existingQuestion.topic}
Difficulty Level: ${difficultyLabel}

Previous Draft Question (replace this with a fresh, distinct, high-quality alternative on the same topic and difficulty):
Question: ${params.existingQuestion.questionText}
A. ${params.existingQuestion.optionA}
B. ${params.existingQuestion.optionB}
C. ${params.existingQuestion.optionC}
D. ${params.existingQuestion.optionD}
${params.instruction ? `\nAdministrator Refinement Instruction: ${params.instruction}\n` : ''}
${params.sourceExcerpt ? `\nReference Material Excerpt:\n${params.sourceExcerpt.slice(0, 12000)}\n` : ''}

Return 1 complete JSON object with questionText, optionA, optionB, optionC, optionD (no "A." prefixes), correctOption ("A"|"B"|"C"|"D"), explanation, topic, matchedImageIndices ([]), requiresImage, and imageNote.`;

  let responseText = '';
  try {
    const response = await ai.models.generateContent({
      model: creds.modelName,
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: SINGLE_QUESTION_SCHEMA,
      },
    });
    responseText = response.text || '';
  } catch (err) {
    const rawMsg = err instanceof Error ? err.message : 'AI regeneration failed.';
    const safeMsg = rawMsg.replace(/AIza[0-9A-Za-z_-]{10,}/g, 'AIza••••••••');
    throw new AiGenerationError(`AI regeneration failed: ${safeMsg}`, 502);
  }

  let parsed: Record<string, unknown>;
  try {
    parsed = JSON.parse(responseText || '{}') as Record<string, unknown>;
  } catch {
    throw new AiGenerationError('AI returned an invalid regeneration payload.', 502);
  }

  const sanitized = sanitizeGeneratedItem(
    parsed,
    dbDifficulty,
    params.existingQuestion.topic || params.course.code,
    0
  );

  if (!sanitized) {
    throw new AiGenerationError('AI failed to generate a complete replacement question.', 502);
  }

  return sanitized;
}
