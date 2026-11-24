import { Type, type Part } from '@google/genai';
import { getDb, getPool } from '../../db/index.js';
import {
  AiGenerationError,
  extractTextFromDocxBuffer,
  prepareUploadedDocumentForAi,
} from './aiQuestionGenerator.js';
import {
  executeGeminiGenerateContent,
  formatGeminiErrorMessage,
  getConfiguredGeminiCredentials,
} from './aiSettings.js';
import { createStudentNotification } from './notifications.js';

export type OptionLetter = 'A' | 'B' | 'C' | 'D';
export type RewardChallengeDisplayStatus =
  | 'Upcoming'
  | 'Active'
  | 'Examination in Progress'
  | 'Examination Completed'
  | 'Winner Announced'
  | 'Challenge Closed';

export type RewardChallengePaymentStatus =
  | 'payment_pending'
  | 'payment_processing'
  | 'payment_completed';

export class RewardChallengeError extends Error {
  public readonly statusCode: number;
  public readonly code: string;

  constructor(message: string, statusCode = 400, code = 'REWARD_CHALLENGE_ERROR') {
    super(message);
    this.name = 'RewardChallengeError';
    this.statusCode = statusCode;
    this.code = code;
  }
}

export function formatWatDateTime(isoOrDate: Date | string): string {
  const date = typeof isoOrDate === 'string' ? new Date(isoOrDate) : isoOrDate;
  if (Number.isNaN(date.getTime())) return 'Not scheduled';
  return new Intl.DateTimeFormat('en-NG', {
    timeZone: 'Africa/Lagos',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date) + ' WAT';
}

export function parseScheduleTimestampInput(value: string): Date {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new RewardChallengeError('Scheduled date and time cannot be empty.', 400, 'INVALID_SCHEDULE');
  }
  // If no explicit timezone offset or Z, interpret input strictly as Africa/Lagos (+01:00)
  const hasOffset = /(?:Z|[+-]\d{2}:?\d{2})$/i.test(trimmed);
  const isoCandidate = hasOffset ? trimmed : `${trimmed}${trimmed.length === 16 ? ':00' : ''}+01:00`;
  const parsed = new Date(isoCandidate);
  if (Number.isNaN(parsed.getTime())) {
    throw new RewardChallengeError(
      `Invalid date/time value "${value}". Use valid YYYY-MM-DDTHH:mm format in Africa/Lagos (WAT).`,
      400,
      'INVALID_SCHEDULE'
    );
  }
  return parsed;
}

export interface ChallengeRowJoined {
  id: string;
  title: string;
  description: string;
  isActive: boolean;
  isFeatured: boolean;
  lifecycleStatus: 'draft' | 'active' | 'closed' | 'deactivated';
  rewardAmount: number;
  rewardCurrency: string;
  timezone: string;
  challengeOpenAt: Date;
  examStartAt: Date;
  examEndAt: Date;
  durationMinutes: number;
  questionCount: number;
  selectionMode: 'random' | 'ordered';
  winnerAnnouncementAt: Date;
  challengeCloseAt: Date | null;
  examFinalizedAt: Date | null;
  winnerAnnouncedAt: Date | null;
}

export function computeChallengeDisplayStatus(params: {
  challenge: ChallengeRowJoined;
  hasWinner: boolean;
  uploadedQuestionCount: number;
  now?: Date;
}): {
  displayStatus: RewardChallengeDisplayStatus;
  canStartExam: boolean;
  canJoinWaitingRoom: boolean;
  unavailableReason: string | null;
} {
  const now = params.now ?? new Date();
  const c = params.challenge;
  const tNow = now.getTime();
  const tOpen = c.challengeOpenAt.getTime();
  const tStart = c.examStartAt.getTime();
  const tEnd = c.examEndAt.getTime();
  const tAnnounce = c.winnerAnnouncementAt.getTime();
  const tClose = c.challengeCloseAt ? c.challengeCloseAt.getTime() : null;

  if (!c.isActive && c.lifecycleStatus === 'draft') {
    return {
      displayStatus: 'Upcoming',
      canStartExam: false,
      canJoinWaitingRoom: false,
      unavailableReason: 'This challenge is currently inactive and awaiting administrator activation.',
    };
  }

  if (!c.isActive || c.lifecycleStatus === 'deactivated') {
    return {
      displayStatus: 'Challenge Closed',
      canStartExam: false,
      canJoinWaitingRoom: false,
      unavailableReason: 'This challenge is currently closed or unavailable.',
    };
  }

  const hasFutureOrLiveWindow = tNow < tEnd || tNow < tAnnounce;
  const isStaleClosed =
    !params.hasWinner &&
    c.isActive &&
    hasFutureOrLiveWindow &&
    (tClose === null || tNow < tClose);

  if ((c.lifecycleStatus === 'closed' && !isStaleClosed) || (tClose !== null && tNow >= tClose)) {
    return {
      displayStatus: 'Challenge Closed',
      canStartExam: false,
      canJoinWaitingRoom: false,
      unavailableReason: 'This competition has closed. View the final leaderboard and results.',
    };
  }

  const isStaleEmptyAnnouncement =
    !params.hasWinner && c.winnerAnnouncedAt !== null && hasFutureOrLiveWindow;

  if (params.hasWinner || (c.winnerAnnouncedAt !== null && !isStaleEmptyAnnouncement)) {
    return {
      displayStatus: 'Winner Announced',
      canStartExam: false,
      canJoinWaitingRoom: true,
      unavailableReason: 'This examination has ended and the official winner has been announced.',
    };
  }

  if (tNow >= tStart && tNow < tEnd) {
    return {
      displayStatus: 'Examination in Progress',
      canStartExam: true,
      canJoinWaitingRoom: true,
      unavailableReason: null,
    };
  }

  if (tNow < tOpen) {
    return {
      displayStatus: 'Upcoming',
      canStartExam: false,
      canJoinWaitingRoom: true,
      unavailableReason: `Challenge portal opens ${formatWatDateTime(c.challengeOpenAt)}.`,
    };
  }

  if (tNow < tStart) {
    return {
      displayStatus: 'Active',
      canStartExam: false,
      canJoinWaitingRoom: true,
      unavailableReason: `Examination begins ${formatWatDateTime(c.examStartAt)}. Please wait until the scheduled start time.`,
    };
  }

  if (tNow >= tAnnounce && c.examFinalizedAt && !params.hasWinner) {
    return {
      displayStatus: 'Winner Announced',
      canStartExam: false,
      canJoinWaitingRoom: true,
      unavailableReason: 'Examination completed and finalized.',
    };
  }

  return {
    displayStatus: 'Examination Completed',
    canStartExam: false,
    canJoinWaitingRoom: true,
    unavailableReason: `Examination entry window closed ${formatWatDateTime(c.examEndAt)}. Results are being finalized.`,
  };
}

export interface ParsedChallengeQuestionInput {
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctOption: OptionLetter;
  explanation: string;
  subjectCategory: string;
}

function normalizeOptionLetter(raw: unknown): OptionLetter {
  const val = String(raw || 'A').trim().toUpperCase().replace(/[^A-D]/g, '');
  if (val === 'B' || val === 'C' || val === 'D') return val;
  return 'A';
}

function parseCsvRows(csvText: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  for (let i = 0; i < csvText.length; i += 1) {
    const ch = csvText[i];
    const next = csvText[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i += 1;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field.trim());
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && next === '\n') i += 1;
      row.push(field.trim());
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      field = '';
    } else {
      field += ch;
    }
  }
  row.push(field.trim());
  if (row.some((c) => c.length > 0)) rows.push(row);
  return rows;
}

export function parseStructuredTextQuestions(rawText: string): ParsedChallengeQuestionInput[] {
  const normalized = rawText.replace(/\r\n/g, '\n').trim();
  if (!normalized) return [];

  const blocks = normalized
    .split(/\n(?=(?:Q(?:uestion)?\s*\d+|\d+\s*[.)]))/i)
    .map((b) => b.trim())
    .filter(Boolean);

  const results: ParsedChallengeQuestionInput[] = [];

  for (const block of blocks) {
    const lines = block
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    if (lines.length < 5) continue;

    let optA = '';
    let optB = '';
    let optC = '';
    let optD = '';
    let correct: OptionLetter = 'A';
    let explanation = '';
    let subjectCategory = 'General';
    const questionLines: string[] = [];
    let seenOption = false;

    for (const line of lines) {
      const aMatch = line.match(/^(?:\(?A\)?[.):\-]|Option\s*A\s*:)\s*(.+)$/i);
      const bMatch = line.match(/^(?:\(?B\)?[.):\-]|Option\s*B\s*:)\s*(.+)$/i);
      const cMatch = line.match(/^(?:\(?C\)?[.):\-]|Option\s*C\s*:)\s*(.+)$/i);
      const dMatch = line.match(/^(?:\(?D\)?[.):\-]|Option\s*D\s*:)\s*(.+)$/i);
      const ansMatch = line.match(/^(?:Answer|Correct\s*(?:Answer|Option)?|Ans)\s*[:\-]\s*(.+)$/i);
      const expMatch = line.match(/^(?:Explanation|Note|Reason)\s*[:\-]\s*(.+)$/i);
      const catMatch = line.match(/^(?:Category|Subject|Topic)\s*[:\-]\s*(.+)$/i);

      if (aMatch) {
        seenOption = true;
        optA = aMatch[1].trim();
      } else if (bMatch) {
        seenOption = true;
        optB = bMatch[1].trim();
      } else if (cMatch) {
        seenOption = true;
        optC = cMatch[1].trim();
      } else if (dMatch) {
        seenOption = true;
        optD = dMatch[1].trim();
      } else if (ansMatch) {
        correct = normalizeOptionLetter(ansMatch[1]);
      } else if (expMatch) {
        explanation = expMatch[1].trim();
      } else if (catMatch) {
        subjectCategory = catMatch[1].trim() || 'General';
      } else if (!seenOption) {
        questionLines.push(line.replace(/^(?:Q(?:uestion)?\s*\d+\s*[:.)\-]?|\d+\s*[.)])\s*/i, '').trim());
      }
    }

    const questionText = questionLines.join(' ').trim();
    if (questionText && optA && optB && optC && optD) {
      results.push({
        questionText,
        optionA: optA,
        optionB: optB,
        optionC: optC,
        optionD: optD,
        correctOption: correct,
        explanation,
        subjectCategory: subjectCategory.slice(0, 100),
      });
    }
  }

  return results;
}

const BULK_EXTRACT_SCHEMA = {
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
      subjectCategory: { type: Type.STRING },
    },
    required: ['questionText', 'optionA', 'optionB', 'optionC', 'optionD', 'correctOption'],
  },
};

export async function parseBulkChallengeQuestionsFile(file: {
  buffer: Buffer;
  mimeType: string;
  originalname: string;
}): Promise<ParsedChallengeQuestionInput[]> {
  if (!file.buffer || file.buffer.length === 0) {
    throw new RewardChallengeError('Uploaded file is empty.', 400, 'EMPTY_FILE');
  }
  if (file.buffer.length > 20 * 1024 * 1024) {
    throw new RewardChallengeError('Uploaded file exceeds the 20 MB limit.', 400, 'FILE_TOO_LARGE');
  }

  const ext = (file.originalname.split('.').pop() || '').toLowerCase();
  const mime = (file.mimeType || '').toLowerCase();

  if (ext === 'json' || mime.includes('json')) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.buffer.toString('utf8'));
    } catch {
      throw new RewardChallengeError('Invalid JSON file syntax.', 400, 'INVALID_JSON');
    }
    const arr = Array.isArray(parsed)
      ? parsed
      : parsed && typeof parsed === 'object' && Array.isArray((parsed as { questions?: unknown[] }).questions)
        ? (parsed as { questions: unknown[] }).questions
        : [];
    const items: ParsedChallengeQuestionInput[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const questionText = String(r.questionText ?? r.question ?? '').trim();
      const optionA = String(r.optionA ?? r.a ?? '').trim();
      const optionB = String(r.optionB ?? r.b ?? '').trim();
      const optionC = String(r.optionC ?? r.c ?? '').trim();
      const optionD = String(r.optionD ?? r.d ?? '').trim();
      if (!questionText || !optionA || !optionB || !optionC || !optionD) continue;
      items.push({
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption: normalizeOptionLetter(r.correctOption ?? r.correctAnswer ?? r.answer ?? 'A'),
        explanation: String(r.explanation ?? '').trim(),
        subjectCategory: String(r.subjectCategory ?? r.category ?? r.subject ?? 'General').trim() || 'General',
      });
    }
    if (items.length === 0) {
      throw new RewardChallengeError(
        'No valid questions found in JSON file. Ensure objects include questionText, optionA, optionB, optionC, optionD, and correctOption.',
        400,
        'NO_QUESTIONS_PARSED'
      );
    }
    return items;
  }

  if (ext === 'csv' || mime === 'text/csv') {
    const rows = parseCsvRows(file.buffer.toString('utf8'));
    if (rows.length < 2) {
      throw new RewardChallengeError('CSV file has no question rows.', 400, 'NO_QUESTIONS_PARSED');
    }
    const headers = rows[0].map((h) => h.toLowerCase().replace(/[^a-z0-9]/g, ''));
    const findIdx = (names: string[], fallback: number) => {
      const idx = headers.findIndex((h) => names.includes(h));
      return idx !== -1 ? idx : fallback;
    };
    const qIdx = findIdx(['question', 'questiontext', 'prompt'], 0);
    const aIdx = findIdx(['optiona', 'a'], 1);
    const bIdx = findIdx(['optionb', 'b'], 2);
    const cIdx = findIdx(['optionc', 'c'], 3);
    const dIdx = findIdx(['optiond', 'd'], 4);
    const ansIdx = findIdx(['correctoption', 'correctanswer', 'answer', 'correct'], 5);
    const expIdx = findIdx(['explanation', 'note'], 6);
    const catIdx = findIdx(['category', 'subject', 'subjectcategory', 'topic'], 7);

    const items: ParsedChallengeQuestionInput[] = [];
    for (let i = 1; i < rows.length; i += 1) {
      const cols = rows[i];
      const questionText = (cols[qIdx] || '').trim();
      const optionA = (cols[aIdx] || '').trim();
      const optionB = (cols[bIdx] || '').trim();
      const optionC = (cols[cIdx] || '').trim();
      const optionD = (cols[dIdx] || '').trim();
      if (!questionText || !optionA || !optionB || !optionC || !optionD) continue;
      items.push({
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption: normalizeOptionLetter(cols[ansIdx]),
        explanation: (cols[expIdx] || '').trim(),
        subjectCategory: (cols[catIdx] || 'General').trim() || 'General',
      });
    }
    if (items.length === 0) {
      throw new RewardChallengeError(
        'No valid question rows found in CSV. Columns: question, optionA, optionB, optionC, optionD, correctOption, explanation, category.',
        400,
        'NO_QUESTIONS_PARSED'
      );
    }
    return items;
  }

  if (ext === 'docx' || mime === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document') {
    let text = '';
    try {
      text = extractTextFromDocxBuffer(file.buffer);
    } catch (err) {
      if (err instanceof AiGenerationError) {
        throw new RewardChallengeError(err.message, err.statusCode, 'DOCX_PARSE_ERROR');
      }
      throw err;
    }
    const items = parseStructuredTextQuestions(text);
    if (items.length > 0) return items;

    // Fallback to configured Gemini AI extraction if DOCX uses freeform formatting
    const creds = await getConfiguredGeminiCredentials();
    if (creds.apiKey) {
      return extractQuestionsFromContentViaAi(
        [{ text: `Extract all multiple-choice questions cleanly from this DOCX text:\n\n${text}` }],
        creds
      );
    }
    throw new RewardChallengeError(
      'Could not detect numbered Q&A blocks (1. Question / A. / B. / C. / D. / Answer: A) in DOCX. Format with options A–D and Answer, or configure Gemini AI to extract automatically.',
      400,
      'NO_QUESTIONS_PARSED'
    );
  }

  if (ext === 'pdf' || mime === 'application/pdf') {
    const creds = await getConfiguredGeminiCredentials();
    let aiPdfError: unknown = null;
    if (creds.apiKey) {
      try {
        const prepared = prepareUploadedDocumentForAi(file);
        if (prepared.kind === 'pdf_inline') {
          return await extractQuestionsFromContentViaAi(
            [
              {
                text: 'Extract all multiple-choice CBT questions found in this PDF document into JSON with questionText, optionA, optionB, optionC, optionD, correctOption (A|B|C|D), explanation, and subjectCategory.',
              },
              {
                inlineData: { mimeType: 'application/pdf', data: prepared.base64 },
              },
            ],
            creds
          );
        }
      } catch (err) {
        aiPdfError = err;
      }
    }
    // Lightweight plain-text fallback scan inside uncompressed PDF streams
    const rawLatin = file.buffer.toString('latin1');
    const textRuns = Array.from(rawLatin.matchAll(/\(([^()]{4,})\)/g)).map((m) => m[1]);
    const extracted = parseStructuredTextQuestions(textRuns.join('\n'));
    if (extracted.length > 0) return extracted;

    if (aiPdfError) {
      throw aiPdfError;
    }

    throw new RewardChallengeError(
      'PDF bulk extraction requires a configured Gemini API key (in AI API Settings) or structured CSV/JSON/TXT/DOCX format.',
      400,
      'PDF_REQUIRES_AI_OR_TEXT'
    );
  }

  if (ext === 'txt' || ext === 'md' || mime.startsWith('text/')) {
    const text = file.buffer.toString('utf8');
    const items = parseStructuredTextQuestions(text);
    if (items.length > 0) return items;

    const creds = await getConfiguredGeminiCredentials();
    if (creds.apiKey && text.trim().length > 40) {
      return extractQuestionsFromContentViaAi(
        [{ text: `Extract or convert all multiple-choice questions in this text:\n\n${text.slice(0, 120_000)}` }],
        creds
      );
    }
    throw new RewardChallengeError(
      'No formatted questions found in TXT file. Use blocks like: 1. Question? / A. ... / B. ... / C. ... / D. ... / Answer: B',
      400,
      'NO_QUESTIONS_PARSED'
    );
  }

  throw new RewardChallengeError(
    `Unsupported bulk upload format "${file.originalname}". Supported formats: PDF, DOCX, TXT, CSV, JSON.`,
    400,
    'UNSUPPORTED_FORMAT'
  );
}

function parseAiJsonArrayPayload(rawText: string | undefined | null): unknown {
  let cleaned = (rawText || '[]').trim();
  if (cleaned.startsWith('```')) {
    cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  try {
    return JSON.parse(cleaned || '[]');
  } catch {
    const firstBracket = cleaned.indexOf('[');
    const lastBracket = cleaned.lastIndexOf(']');
    if (firstBracket !== -1 && lastBracket > firstBracket) {
      return JSON.parse(cleaned.slice(firstBracket, lastBracket + 1));
    }
    throw new RewardChallengeError(
      'AI returned an unreadable question payload. Please try again.',
      502,
      'AI_PARSE_ERROR'
    );
  }
}

async function extractQuestionsFromContentViaAi(
  parts: Part[],
  creds: { apiKey: string | null; modelName: string }
): Promise<ParsedChallengeQuestionInput[]> {
  if (!creds.apiKey) {
    throw new RewardChallengeError('Gemini API key is not configured.', 503, 'AI_NOT_CONFIGURED');
  }
  try {
    const { response } = await executeGeminiGenerateContent({
      apiKey: creds.apiKey,
      modelName: creds.modelName,
      contents: [{ role: 'user', parts }],
      config: {
        responseMimeType: 'application/json',
        responseSchema: BULK_EXTRACT_SCHEMA,
      },
    });
    const arr = parseAiJsonArrayPayload(response.text);
    if (!Array.isArray(arr) || arr.length === 0) {
      throw new RewardChallengeError('AI could not extract any questions from this file.', 422, 'NO_QUESTIONS_PARSED');
    }
    const items: ParsedChallengeQuestionInput[] = [];
    for (const raw of arr) {
      if (!raw || typeof raw !== 'object') continue;
      const r = raw as Record<string, unknown>;
      const questionText = String(r.questionText ?? '').trim();
      const optionA = String(r.optionA ?? '').trim();
      const optionB = String(r.optionB ?? '').trim();
      const optionC = String(r.optionC ?? '').trim();
      const optionD = String(r.optionD ?? '').trim();
      if (!questionText || !optionA || !optionB || !optionC || !optionD) continue;
      items.push({
        questionText,
        optionA,
        optionB,
        optionC,
        optionD,
        correctOption: normalizeOptionLetter(r.correctOption),
        explanation: String(r.explanation ?? '').trim(),
        subjectCategory: String(r.subjectCategory ?? 'General').trim().slice(0, 100) || 'General',
      });
    }
    return items;
  } catch (err) {
    if (err instanceof RewardChallengeError) throw err;
    throw new RewardChallengeError(`AI extraction failed: ${formatGeminiErrorMessage(err)}`, 502, 'AI_ERROR');
  }
}

export async function generateRewardChallengeQuestionsWithAi(params: {
  challengeTitle: string;
  count: number;
  subjectCategory?: string;
  instructions?: string;
  documentFile?: { buffer: Buffer; mimeType: string; originalname: string } | null;
}): Promise<ParsedChallengeQuestionInput[]> {
  const creds = await getConfiguredGeminiCredentials();
  if (!creds.apiKey) {
    throw new RewardChallengeError(
      'Gemini API key is not configured. Open AI API Settings in the Admin Panel to configure and test your Gemini API key.',
      503,
      'AI_NOT_CONFIGURED'
    );
  }

  const trimmedInstructions = (params.instructions || '').trim().slice(0, 120_000);
  if (!trimmedInstructions && !params.documentFile) {
    throw new RewardChallengeError(
      'Provide a PDF/DOCX/TXT document or paste instructions/learning material to generate questions.',
      400,
      'MISSING_AI_SOURCE'
    );
  }

  const safeCount = Math.max(1, Math.min(60, Math.floor(params.count || 10)));
  const category = (params.subjectCategory || 'General').trim() || 'General';
  const parts: Part[] = [
    {
      text: `You are an academic competition question author for "${params.challengeTitle}" on Acadet CBT.
Generate EXACTLY ${safeCount} clear, rigorous, unambiguous multiple-choice CBT questions based strictly on the provided document and/or instructions.
Default Subject/Category: ${category}
Rules:
1. Return an array of ${safeCount} objects with: questionText, optionA, optionB, optionC, optionD (do NOT prefix options with "A.", "B.", etc.), correctOption ("A" | "B" | "C" | "D"), explanation, and subjectCategory.
2. Each question must have exactly one clearly correct answer and 3 plausible distractors.`,
    },
  ];

  if (params.documentFile) {
    try {
      const prepared = prepareUploadedDocumentForAi(params.documentFile);
      if (prepared.kind === 'pdf_inline') {
        parts.push({ text: `\n--- UPLOADED PDF DOCUMENT (${prepared.fileName}) ---` });
        parts.push({ inlineData: { mimeType: 'application/pdf', data: prepared.base64 } });
      } else {
        parts.push({ text: `\n--- UPLOADED MATERIAL (${prepared.fileName}) ---\n${prepared.text}` });
      }
    } catch (err) {
      if (err instanceof AiGenerationError) {
        throw new RewardChallengeError(err.message, err.statusCode, 'DOCUMENT_PARSE_ERROR');
      }
      throw err;
    }
  }

  if (trimmedInstructions) {
    parts.push({ text: `\n--- INSTRUCTIONS / LEARNING CONTENT ---\n${trimmedInstructions}` });
  }

  const generated = await extractQuestionsFromContentViaAi(parts, creds);
  return generated.slice(0, safeCount);
}

export async function dispatchChallengeNotification(params: {
  challengeId: string;
  studentId: string;
  eventType: string;
  title: string;
  message: string;
  idempotencyKey: string;
  actionLabel?: string | null;
  actionUrl?: string | null;
}): Promise<void> {
  const pool = getPool();
  const inserted = await pool.query<{ id: string }>(
    `INSERT INTO reward_challenge_notifications (
       challenge_id, student_id, event_type, title, message, idempotency_key
     )
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [
      params.challengeId,
      params.studentId,
      params.eventType,
      params.title,
      params.message,
      params.idempotencyKey,
    ]
  );

  if (inserted.rows.length === 0) {
    return;
  }

  const notif = await createStudentNotification({
    recipientUserId: params.studentId,
    senderUserId: null,
    senderName: 'Acadet Reward CBT Challenge',
    notificationType: 'system',
    title: params.title,
    message: params.message,
    actionLabel: params.actionLabel ?? 'Open Reward Challenge',
    actionUrl: params.actionUrl ?? '#reward-challenge',
    idempotencyKey: `reward_challenge:${params.idempotencyKey}`,
  });

  if (notif?.id) {
    await pool.query(
      `UPDATE reward_challenge_notifications SET notification_id = $1 WHERE id = $2`,
      [notif.id, inserted.rows[0].id]
    );
  }
}

export async function broadcastNotificationToStudents(params: {
  challengeId: string;
  eventType: string;
  title: string;
  message: string;
  onlyParticipants?: boolean;
  actionLabel?: string;
}): Promise<void> {
  const pool = getPool();
  const keyPrefix = `${params.eventType}:${params.challengeId}:`;
  const studentRows = params.onlyParticipants
    ? await pool.query<{ studentId: string }>(
        `SELECT p.student_id AS "studentId"
         FROM reward_challenge_participants p
         WHERE p.challenge_id = $1
           AND NOT EXISTS (
             SELECT 1 FROM reward_challenge_notifications n
             WHERE n.idempotency_key = $2 || p.student_id::text
           )`,
        [params.challengeId, keyPrefix]
      )
    : await pool.query<{ studentId: string }>(
        `SELECT u.id AS "studentId"
         FROM users u
         WHERE u.role = 'student'
           AND u.is_active = TRUE
           AND u.account_status = 'active'
           AND NOT EXISTS (
             SELECT 1 FROM reward_challenge_notifications n
             WHERE n.idempotency_key = $1 || u.id::text
           )`,
        [keyPrefix]
      );

  for (const row of studentRows.rows) {
    await dispatchChallengeNotification({
      challengeId: params.challengeId,
      studentId: row.studentId,
      eventType: params.eventType,
      title: params.title,
      message: params.message,
      idempotencyKey: `${keyPrefix}${row.studentId}`,
      actionLabel: params.actionLabel ?? 'Open Reward Challenge',
      actionUrl: '#reward-challenge',
    });
  }
}

async function gradeAndSubmitAttemptInternal(params: {
  attemptId: string;
  submissionSource: 'manual' | 'auto_timer' | 'server_scheduler';
  answersOverride?: Array<{
    questionOrder: number;
    selectedOption: OptionLetter | null;
    isMarkedForReview?: boolean;
  }>;
}): Promise<string> {
  const pool = getPool();
  const client = await pool.connect();
  let committedStudentId = '';
  let committedChallengeId = '';
  let committedScore = 0;
  let committedTotal = 0;
  let committedChallengeTitle = '';
  let wasNewlySubmitted = false;

  try {
    await client.query('BEGIN');

    const attemptRes = await client.query<{
      id: string;
      challengeId: string;
      studentId: string;
      participantId: string;
      totalQuestions: number;
      durationSeconds: number;
      startedAt: Date;
      expiresAt: Date;
      status: string;
    }>(
      `SELECT
         id,
         challenge_id AS "challengeId",
         student_id AS "studentId",
         participant_id AS "participantId",
         total_questions AS "totalQuestions",
         duration_seconds AS "durationSeconds",
         started_at AS "startedAt",
         expires_at AS "expiresAt",
         status
       FROM reward_challenge_attempts
       WHERE id = $1
       FOR UPDATE`,
      [params.attemptId]
    );

    const attempt = attemptRes.rows[0];
    if (!attempt) {
      throw new RewardChallengeError('Challenge attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
    }

    committedStudentId = attempt.studentId;
    committedChallengeId = attempt.challengeId;

    const chalRes = await client.query<{ title: string }>(
      `SELECT title FROM reward_challenges WHERE id = $1`,
      [attempt.challengeId]
    );
    committedChallengeTitle = chalRes.rows[0]?.title || 'Acadet Reward CBT Challenge';

    if (attempt.status !== 'in_progress') {
      await client.query('COMMIT');
      return attempt.id;
    }

    if (params.answersOverride && params.answersOverride.length > 0) {
      for (const ans of params.answersOverride) {
        await client.query(
          `UPDATE reward_challenge_answers
           SET selected_option = $1,
               is_marked_for_review = COALESCE($2, is_marked_for_review),
               answered_at = NOW()
           WHERE attempt_id = $3 AND question_order = $4`,
          [
            ans.selectedOption,
            ans.isMarkedForReview ?? null,
            attempt.id,
            ans.questionOrder,
          ]
        );
      }
    }

    const answerRows = await client.query<{
      answerId: string;
      selectedOption: OptionLetter | null;
      correctOption: OptionLetter;
    }>(
      `SELECT
         a.id AS "answerId",
         a.selected_option AS "selectedOption",
         q.correct_option AS "correctOption"
       FROM reward_challenge_answers a
       INNER JOIN reward_challenge_questions q ON q.id = a.question_id
       WHERE a.attempt_id = $1
       ORDER BY a.question_order ASC`,
      [attempt.id]
    );

    let correctCount = 0;
    let wrongCount = 0;
    let unansweredCount = 0;

    for (const row of answerRows.rows) {
      if (!row.selectedOption) {
        unansweredCount += 1;
        await client.query(`UPDATE reward_challenge_answers SET is_correct = FALSE WHERE id = $1`, [
          row.answerId,
        ]);
      } else if (row.selectedOption === row.correctOption) {
        correctCount += 1;
        await client.query(`UPDATE reward_challenge_answers SET is_correct = TRUE WHERE id = $1`, [
          row.answerId,
        ]);
      } else {
        wrongCount += 1;
        await client.query(`UPDATE reward_challenge_answers SET is_correct = FALSE WHERE id = $1`, [
          row.answerId,
        ]);
      }
    }

    const totalQuestions = Math.max(attempt.totalQuestions, answerRows.rows.length);
    const percentage =
      totalQuestions > 0 ? Math.round((correctCount / totalQuestions) * 100) : 0;

    const now = new Date();
    const effectiveSubmitAt =
      now.getTime() > attempt.expiresAt.getTime() ? attempt.expiresAt : now;
    const rawElapsed = Math.floor(
      (effectiveSubmitAt.getTime() - attempt.startedAt.getTime()) / 1000
    );
    const completionSeconds = Math.max(1, Math.min(attempt.durationSeconds, rawElapsed));

    const nextAttemptStatus =
      params.submissionSource === 'manual' ? 'submitted' : 'auto_submitted';

    await client.query(
      `UPDATE reward_challenge_attempts
       SET status = $1,
           submitted_at = $2,
           completion_seconds = $3,
           submission_source = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [
        nextAttemptStatus,
        effectiveSubmitAt,
        completionSeconds,
        params.submissionSource,
        attempt.id,
      ]
    );

    await client.query(
      `UPDATE reward_challenge_participants
       SET status = 'completed', updated_at = NOW()
       WHERE id = $1`,
      [attempt.participantId]
    );

    await client.query(
      `INSERT INTO reward_challenge_results (
         challenge_id, student_id, attempt_id, total_questions,
         correct_answers, wrong_answers, unanswered_questions,
         score, percentage, completion_time_seconds, submitted_at,
         is_finalized, is_valid
       )
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, FALSE, TRUE)
       ON CONFLICT (attempt_id) DO NOTHING`,
      [
        attempt.challengeId,
        attempt.studentId,
        attempt.id,
        totalQuestions,
        correctCount,
        wrongCount,
        unansweredCount,
        correctCount,
        percentage,
        completionSeconds,
        effectiveSubmitAt,
      ]
    );

    committedScore = correctCount;
    committedTotal = totalQuestions;
    wasNewlySubmitted = true;

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (wasNewlySubmitted) {
    await recalculateLeaderboardForChallenge(committedChallengeId, false);
    await dispatchChallengeNotification({
      challengeId: committedChallengeId,
      studentId: committedStudentId,
      eventType: 'exam_submitted',
      title: `${committedChallengeTitle}: Examination Submitted`,
      message: `Your Acadet Reward CBT Challenge examination has been successfully submitted (${committedScore}/${committedTotal}). Your result and ranking have been recorded and will be finalized according to the competition schedule.`,
      idempotencyKey: `exam_submitted:${committedChallengeId}:${committedStudentId}`,
    });
  }

  return params.attemptId;
}

export async function recalculateLeaderboardForChallenge(
  challengeId: string,
  markFinal: boolean
): Promise<void> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const rankedRows = await client.query<{
      studentId: string;
      attemptId: string;
      studentName: string;
      score: number;
      totalQuestions: number;
      percentage: number;
      completionTimeSeconds: number;
      submittedAt: Date;
    }>(
      `SELECT
         r.student_id AS "studentId",
         r.attempt_id AS "attemptId",
         u.full_name AS "studentName",
         r.score,
         r.total_questions AS "totalQuestions",
         r.percentage,
         r.completion_time_seconds AS "completionTimeSeconds",
         r.submitted_at AS "submittedAt"
       FROM reward_challenge_results r
       INNER JOIN users u ON u.id = r.student_id
       WHERE r.challenge_id = $1 AND r.is_valid = TRUE
       ORDER BY r.score DESC, r.completion_time_seconds ASC, r.submitted_at ASC`,
      [challengeId]
    );

    await client.query(`DELETE FROM reward_challenge_leaderboards WHERE challenge_id = $1`, [
      challengeId,
    ]);

    for (let idx = 0; idx < rankedRows.rows.length; idx += 1) {
      const row = rankedRows.rows[idx];
      await client.query(
        `INSERT INTO reward_challenge_leaderboards (
           challenge_id, student_id, attempt_id, position,
           student_name, score, total_questions, percentage,
           completion_time_seconds, submitted_at, is_final, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
        [
          challengeId,
          row.studentId,
          row.attemptId,
          idx + 1,
          row.studentName,
          row.score,
          row.totalQuestions,
          row.percentage,
          row.completionTimeSeconds,
          row.submittedAt,
          markFinal,
        ]
      );
    }

    if (markFinal) {
      await client.query(
        `UPDATE reward_challenge_results
         SET is_finalized = TRUE, updated_at = NOW()
         WHERE challenge_id = $1`,
        [challengeId]
      );
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function finalizeAndAnnounceChallengeWinner(params: {
  challengeId: string;
  mode: 'scheduler' | 'admin';
  forceEndOpenAttempts?: boolean;
}): Promise<{
  finalizedNow: boolean;
  winner: {
    studentId: string;
    studentName: string;
    score: number;
    totalQuestions: number;
  } | null;
}> {
  const pool = getPool();
  const chRes = await pool.query<{
    id: string;
    title: string;
    rewardAmount: number;
    rewardCurrency: string;
  }>(
    `SELECT id, title, reward_amount::float8 AS "rewardAmount", reward_currency AS "rewardCurrency"
     FROM reward_challenges
     WHERE id = $1
     LIMIT 1`,
    [params.challengeId]
  );
  const ch = chRes.rows[0];
  if (!ch) {
    throw new RewardChallengeError('Challenge not found.', 404, 'CHALLENGE_NOT_FOUND');
  }

  const openRes = await pool.query<{ id: string; expiresAt: Date }>(
    `SELECT id, expires_at AS "expiresAt"
     FROM reward_challenge_attempts
     WHERE challenge_id = $1 AND status = 'in_progress'`,
    [ch.id]
  );

  let remainingActive = 0;
  for (const att of openRes.rows) {
    if (att.expiresAt.getTime() <= Date.now() || params.forceEndOpenAttempts) {
      await gradeAndSubmitAttemptInternal({
        attemptId: att.id,
        submissionSource: 'server_scheduler',
      });
    } else {
      remainingActive += 1;
    }
  }

  if (remainingActive > 0) {
    throw new RewardChallengeError(
      `${remainingActive} student examination attempt(s) are still within their allocated timer. Wait for them to finish or enable force-submission before finalizing.`,
      409,
      'ATTEMPTS_STILL_ACTIVE'
    );
  }

  await recalculateLeaderboardForChallenge(ch.id, true);

  const client = await pool.connect();
  let announcedWinner: {
    studentId: string;
    studentName: string;
    score: number;
    totalQuestions: number;
  } | null = null;
  let finalizedNow = false;

  try {
    await client.query('BEGIN');

    const lockedSetting = await client.query<{ winnerAnnouncedAt: Date | null }>(
      `SELECT winner_announced_at AS "winnerAnnouncedAt"
       FROM reward_challenge_settings
       WHERE challenge_id = $1
       FOR UPDATE`,
      [ch.id]
    );

    if (!lockedSetting.rows[0]?.winnerAnnouncedAt) {
      const topRes = await client.query<{
        resultId: string;
        attemptId: string;
        studentId: string;
        studentName: string;
        registrationCode: string | null;
        score: number;
        totalQuestions: number;
        percentage: number;
        completionTimeSeconds: number;
      }>(
        `SELECT
           r.id AS "resultId",
           r.attempt_id AS "attemptId",
           r.student_id AS "studentId",
           u.full_name AS "studentName",
           u.registration_code AS "registrationCode",
           r.score,
           r.total_questions AS "totalQuestions",
           r.percentage,
           r.completion_time_seconds AS "completionTimeSeconds"
         FROM reward_challenge_results r
         INNER JOIN users u ON u.id = r.student_id
         WHERE r.challenge_id = $1 AND r.is_valid = TRUE
         ORDER BY r.score DESC, r.completion_time_seconds ASC, r.submitted_at ASC
         LIMIT 1`,
        [ch.id]
      );

      const top = topRes.rows[0];
      if (top) {
        const winnerIns = await client.query<{ id: string }>(
          `INSERT INTO reward_challenge_winners (
             challenge_id, student_id, attempt_id, result_id,
             position, student_name, student_registration_code,
             score, total_questions, percentage, completion_time_seconds,
             reward_amount, reward_currency, announced_at, announcement_mode
           )
           VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, $9, $10, $11, $12, NOW(), $13)
           ON CONFLICT (challenge_id) DO NOTHING
           RETURNING id`,
          [
            ch.id,
            top.studentId,
            top.attemptId,
            top.resultId,
            top.studentName,
            top.registrationCode,
            top.score,
            top.totalQuestions,
            top.percentage,
            top.completionTimeSeconds,
            ch.rewardAmount,
            ch.rewardCurrency,
            params.mode,
          ]
        );

        if (winnerIns.rows[0]?.id) {
          await client.query(
            `INSERT INTO reward_challenge_payments (
               challenge_id, winner_id, student_id, reward_amount, currency, payment_status
             )
             VALUES ($1, $2, $3, $4, $5, 'payment_pending')
             ON CONFLICT (challenge_id) DO NOTHING`,
            [ch.id, winnerIns.rows[0].id, top.studentId, ch.rewardAmount, ch.rewardCurrency]
          );
          announcedWinner = {
            studentId: top.studentId,
            studentName: top.studentName,
            score: top.score,
            totalQuestions: top.totalQuestions,
          };
        }
      }

      await client.query(
        `UPDATE reward_challenge_settings
         SET exam_finalized_at = COALESCE(exam_finalized_at, NOW()),
             winner_announced_at = NOW(),
             updated_at = NOW()
         WHERE challenge_id = $1`,
        [ch.id]
      );
      finalizedNow = true;
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  if (finalizedNow) {
    await broadcastNotificationToStudents({
      challengeId: ch.id,
      eventType: 'leaderboard_published',
      title: `${ch.title}: Final Leaderboard Published`,
      message: `The official final leaderboard for ${ch.title} has been published. Open the Reward Challenge Leaderboard to view final verified positions.`,
      onlyParticipants: true,
      actionLabel: 'View Final Leaderboard',
    });

    if (announcedWinner) {
      await dispatchChallengeNotification({
        challengeId: ch.id,
        studentId: announcedWinner.studentId,
        eventType: 'winner_announced_personal',
        title: `CONGRATULATIONS! You Won ${ch.title}!`,
        message: `Congratulations ${announcedWinner.studentName}! You emerged in 1ST PLACE in ${ch.title} with a score of ${announcedWinner.score}/${announcedWinner.totalQuestions}. Kindly open the Reward CBT Challenge section to submit your bank details and claim your ₦${Math.round(ch.rewardAmount).toLocaleString('en-NG')} prize.`,
        idempotencyKey: `winner_personal:${ch.id}:${announcedWinner.studentId}`,
        actionLabel: 'Claim Your Reward',
      });

      const participants = await pool.query<{ studentId: string }>(
        `SELECT student_id AS "studentId" FROM reward_challenge_participants WHERE challenge_id = $1`,
        [ch.id]
      );
      for (const p of participants.rows) {
        if (p.studentId === announcedWinner.studentId) continue;
        await dispatchChallengeNotification({
          challengeId: ch.id,
          studentId: p.studentId,
          eventType: 'winner_announced_public',
          title: `${ch.title}: Official Winner Announced`,
          message: `Final results for ${ch.title} are out! Congratulations to ${announcedWinner.studentName} (1st Place, ${announcedWinner.score}/${announcedWinner.totalQuestions}). Open the Reward Challenge leaderboard to view your final position.`,
          idempotencyKey: `winner_public:${ch.id}:${p.studentId}`,
          actionLabel: 'View Final Leaderboard',
        });
      }
    }
  }

  return { finalizedNow, winner: announcedWinner };
}

export async function syncChallengeAutomations(challengeId?: string): Promise<void> {
  const pool = getPool();
  const now = new Date();

  const challengesRes = await pool.query<ChallengeRowJoined>(
    `SELECT
       c.id,
       c.title,
       c.description,
       c.is_active AS "isActive",
       c.is_featured AS "isFeatured",
       c.lifecycle_status AS "lifecycleStatus",
       c.reward_amount::float8 AS "rewardAmount",
       c.reward_currency AS "rewardCurrency",
       s.timezone,
       s.challenge_open_at AS "challengeOpenAt",
       s.exam_start_at AS "examStartAt",
       s.exam_end_at AS "examEndAt",
       s.duration_minutes AS "durationMinutes",
       s.question_count AS "questionCount",
       s.selection_mode AS "selectionMode",
       s.winner_announcement_at AS "winnerAnnouncementAt",
       s.challenge_close_at AS "challengeCloseAt",
       s.exam_finalized_at AS "examFinalizedAt",
       s.winner_announced_at AS "winnerAnnouncedAt"
     FROM reward_challenges c
     INNER JOIN reward_challenge_settings s ON s.challenge_id = c.id
     ${challengeId ? 'WHERE c.id = $1' : 'WHERE c.is_active = TRUE'}`,
    challengeId ? [challengeId] : []
  );

  for (const ch of challengesRes.rows) {
    // 1. Auto-submit any in-progress attempts whose server expires_at has passed (or if exam finalized cutoff reached)
    const expiredAttempts = await pool.query<{ id: string }>(
      `SELECT id
       FROM reward_challenge_attempts
       WHERE challenge_id = $1
         AND status = 'in_progress'
         AND expires_at <= NOW()`,
      [ch.id]
    );

    for (const att of expiredAttempts.rows) {
      await gradeAndSubmitAttemptInternal({
        attemptId: att.id,
        submissionSource: 'server_scheduler',
      });
    }

    if (!ch.isActive || ch.lifecycleStatus === 'deactivated') {
      continue;
    }

    // Self-heal stale empty finalization / auto-close from a prior schedule after rescheduling
    if (
      (ch.winnerAnnouncedAt !== null || ch.examFinalizedAt !== null || ch.lifecycleStatus === 'closed') &&
      (now < ch.examEndAt || now < ch.winnerAnnouncementAt)
    ) {
      const winnerCheckRes = await pool.query<{ exists: boolean }>(
        `SELECT EXISTS(SELECT 1 FROM reward_challenge_winners WHERE challenge_id = $1) AS exists`,
        [ch.id]
      );
      if (!winnerCheckRes.rows[0]?.exists) {
        if (ch.winnerAnnouncedAt !== null || ch.examFinalizedAt !== null) {
          await pool.query(
            `UPDATE reward_challenge_settings
             SET exam_finalized_at = NULL, winner_announced_at = NULL, updated_at = NOW()
             WHERE challenge_id = $1`,
            [ch.id]
          );
          ch.examFinalizedAt = null;
          ch.winnerAnnouncedAt = null;
        }
        if (ch.lifecycleStatus === 'closed' && (!ch.challengeCloseAt || now < ch.challengeCloseAt)) {
          await pool.query(
            `UPDATE reward_challenges
             SET lifecycle_status = 'active', closed_at = NULL, updated_at = NOW()
             WHERE id = $1 AND is_active = TRUE AND lifecycle_status = 'closed'`,
            [ch.id]
          );
          ch.lifecycleStatus = 'active';
        }
      }
    }

    // 2. Notification milestones for active challenges (never block CBT loading/starting)
    try {
      if (now >= ch.challengeOpenAt && now < ch.examStartAt) {
        await broadcastNotificationToStudents({
          challengeId: ch.id,
          eventType: 'challenge_upcoming',
          title: `${ch.title}: Upcoming Challenge Open`,
          message: `${ch.title} portal is now open! Examination starts ${formatWatDateTime(ch.examStartAt)} (${ch.questionCount} questions · ${ch.durationMinutes} mins). Prize: ₦${Math.round(ch.rewardAmount).toLocaleString('en-NG')}.`,
        });
      }

      if (now >= ch.examStartAt && now < ch.examEndAt) {
        await broadcastNotificationToStudents({
          challengeId: ch.id,
          eventType: 'exam_starting',
          title: `${ch.title} Examination Is Live!`,
          message: `The ${ch.title} examination is now open for participation until ${formatWatDateTime(ch.examEndAt)}. Sign in and click Start Challenge before entry closes.`,
        });
      }
    } catch (notifErr) {
      console.error(
        '[RewardChallenge] Non-fatal notification broadcast error:',
        notifErr instanceof Error ? notifErr.message : notifErr
      );
    }

    // 3. Examination Finalization & Automatic Winner Announcement
    if (
      now >= ch.examEndAt &&
      now >= ch.winnerAnnouncementAt &&
      ch.winnerAnnouncedAt === null
    ) {
      // Ensure any attempts that had already reached expires_at were submitted, or check if active attempts remain
      const remainingOpen = await pool.query<{ id: string; expiresAt: Date }>(
        `SELECT id, expires_at AS "expiresAt"
         FROM reward_challenge_attempts
         WHERE challenge_id = $1 AND status = 'in_progress'`,
        [ch.id]
      );

      // Finalize any attempt whose expiry passed
      let stillActiveCount = 0;
      for (const rem of remainingOpen.rows) {
        if (rem.expiresAt.getTime() <= now.getTime()) {
          await gradeAndSubmitAttemptInternal({
            attemptId: rem.id,
            submissionSource: 'server_scheduler',
          });
        } else {
          stillActiveCount += 1;
        }
      }

      // Respect full configured duration for active writers before declaring winner
      if (stillActiveCount === 0) {
        await finalizeAndAnnounceChallengeWinner({
          challengeId: ch.id,
          mode: 'scheduler',
        });
      }
    }

    // 4. Optional auto-close challenge at challengeCloseAt
    if (ch.challengeCloseAt && now >= ch.challengeCloseAt && ch.lifecycleStatus === 'active') {
      await pool.query(
        `UPDATE reward_challenges
         SET lifecycle_status = 'closed', closed_at = COALESCE(closed_at, NOW()), updated_at = NOW()
         WHERE id = $1 AND lifecycle_status = 'active'`,
        [ch.id]
      );
    }
  }
}

export async function buildChallengeSummaryForUser(params: {
  challengeId?: string;
  userId?: string;
}): Promise<ReturnType<typeof formatChallengeSummary> | null> {
  const pool = getPool();
  let row: ChallengeRowJoined | undefined;

  if (params.challengeId) {
    await syncChallengeAutomations(params.challengeId);
    const res = await pool.query<ChallengeRowJoined>(
      `SELECT
         c.id, c.title, c.description, c.is_active AS "isActive", c.is_featured AS "isFeatured",
         c.lifecycle_status AS "lifecycleStatus", c.reward_amount::float8 AS "rewardAmount",
         c.reward_currency AS "rewardCurrency", s.timezone,
         s.challenge_open_at AS "challengeOpenAt", s.exam_start_at AS "examStartAt",
         s.exam_end_at AS "examEndAt", s.duration_minutes AS "durationMinutes",
         s.question_count AS "questionCount", s.selection_mode AS "selectionMode",
         s.winner_announcement_at AS "winnerAnnouncementAt",
         s.challenge_close_at AS "challengeCloseAt", s.exam_finalized_at AS "examFinalizedAt",
         s.winner_announced_at AS "winnerAnnouncedAt"
       FROM reward_challenges c
       INNER JOIN reward_challenge_settings s ON s.challenge_id = c.id
       WHERE c.id = $1
       LIMIT 1`,
      [params.challengeId]
    );
    row = res.rows[0];
  } else {
    await syncChallengeAutomations();
    const res = await pool.query<ChallengeRowJoined>(
      `SELECT
         c.id, c.title, c.description, c.is_active AS "isActive", c.is_featured AS "isFeatured",
         c.lifecycle_status AS "lifecycleStatus", c.reward_amount::float8 AS "rewardAmount",
         c.reward_currency AS "rewardCurrency", s.timezone,
         s.challenge_open_at AS "challengeOpenAt", s.exam_start_at AS "examStartAt",
         s.exam_end_at AS "examEndAt", s.duration_minutes AS "durationMinutes",
         s.question_count AS "questionCount", s.selection_mode AS "selectionMode",
         s.winner_announcement_at AS "winnerAnnouncementAt",
         s.challenge_close_at AS "challengeCloseAt", s.exam_finalized_at AS "examFinalizedAt",
         s.winner_announced_at AS "winnerAnnouncedAt"
       FROM reward_challenges c
       INNER JOIN reward_challenge_settings s ON s.challenge_id = c.id
       ORDER BY
         c.is_active DESC,
         (c.lifecycle_status = 'active') DESC,
         (c.lifecycle_status = 'draft') DESC,
         c.is_featured DESC,
         c.created_at DESC
       LIMIT 1`
    );
    row = res.rows[0];
  }

  if (!row) return null;

  return formatChallengeSummary(row, params.userId);
}

async function formatChallengeSummary(ch: ChallengeRowJoined, userId?: string) {
  const pool = getPool();
  const [countsRes, winnerRes] = await Promise.all([
    pool.query<{
      uploadedQuestions: number;
      publishedQuestions: number;
      participants: number;
      submitted: number;
    }>(
      `SELECT
         (SELECT COUNT(*)::int FROM reward_challenge_questions WHERE challenge_id = $1) AS "uploadedQuestions",
         (SELECT COUNT(*)::int FROM reward_challenge_questions WHERE challenge_id = $1 AND publication_status = 'published') AS "publishedQuestions",
         (SELECT COUNT(*)::int FROM reward_challenge_participants WHERE challenge_id = $1) AS "participants",
         (SELECT COUNT(*)::int FROM reward_challenge_attempts WHERE challenge_id = $1 AND status IN ('submitted', 'auto_submitted')) AS "submitted"`,
      [ch.id]
    ),
    pool.query<{
      id: string;
      challengeId: string;
      studentId: string;
      position: number;
      studentName: string;
      studentRegistrationCode: string | null;
      score: number;
      totalQuestions: number;
      percentage: number;
      completionTimeSeconds: number;
      rewardAmount: number;
      rewardCurrency: string;
      announcedAt: Date;
    }>(
      `SELECT
         id, challenge_id AS "challengeId", student_id AS "studentId", position,
         student_name AS "studentName", student_registration_code AS "studentRegistrationCode",
         score, total_questions AS "totalQuestions", percentage,
         completion_time_seconds AS "completionTimeSeconds",
         reward_amount::float8 AS "rewardAmount", reward_currency AS "rewardCurrency",
         announced_at AS "announcedAt"
       FROM reward_challenge_winners
       WHERE challenge_id = $1
       LIMIT 1`,
      [ch.id]
    ),
  ]);

  const counts = countsRes.rows[0] || {
    uploadedQuestions: 0,
    publishedQuestions: 0,
    participants: 0,
    submitted: 0,
  };
  const winnerRow = winnerRes.rows[0] || null;
  const now = new Date();

  const statusMeta = computeChallengeDisplayStatus({
    challenge: ch,
    hasWinner: Boolean(winnerRow),
    uploadedQuestionCount: counts.publishedQuestions,
    now,
  });

  let myParticipation: {
    joined: boolean;
    attempt: {
      id: string;
      status: 'in_progress' | 'submitted' | 'auto_submitted';
      startedAt: string;
      expiresAt: string;
      submittedAt: string | null;
      completionSeconds: number | null;
      totalQuestions: number;
      durationSeconds: number;
      submissionSource: string | null;
    } | null;
    result: {
      id: string;
      totalQuestions: number;
      correctAnswers: number;
      wrongAnswers: number;
      unansweredQuestions: number;
      score: number;
      percentage: number;
      completionTimeSeconds: number;
      submittedAt: string;
      isFinalized: boolean;
      position: number | null;
    } | null;
    isWinner: boolean;
    myBankDetails: {
      id: string;
      challengeId: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      editLocked: boolean;
      correctionNote: string | null;
      submittedAt: string;
      updatedAt: string;
    } | null;
    myPayment: {
      id: string;
      challengeId: string;
      winnerId: string;
      studentId: string;
      rewardAmount: number;
      currency: string;
      paymentStatus: RewardChallengePaymentStatus;
      paidByAdminName: string | null;
      paidByAdminEmail: string | null;
      paidAt: string | null;
      paymentReference: string | null;
      adminNote: string | null;
      createdAt: string;
      updatedAt: string;
    } | null;
  } = {
    joined: false,
    attempt: null,
    result: null,
    isWinner: false,
    myBankDetails: null,
    myPayment: null,
  };

  if (userId) {
    const [partRes, attRes, resRes, lbRes] = await Promise.all([
      pool.query<{ id: string }>(
        `SELECT id FROM reward_challenge_participants WHERE challenge_id = $1 AND student_id = $2 LIMIT 1`,
        [ch.id, userId]
      ),
      pool.query<{
        id: string;
        status: 'in_progress' | 'submitted' | 'auto_submitted';
        startedAt: Date;
        expiresAt: Date;
        submittedAt: Date | null;
        completionSeconds: number | null;
        totalQuestions: number;
        durationSeconds: number;
        submissionSource: string | null;
      }>(
        `SELECT id, status, started_at AS "startedAt", expires_at AS "expiresAt",
                submitted_at AS "submittedAt", completion_seconds AS "completionSeconds",
                total_questions AS "totalQuestions", duration_seconds AS "durationSeconds",
                submission_source AS "submissionSource"
         FROM reward_challenge_attempts
         WHERE challenge_id = $1 AND student_id = $2
         LIMIT 1`,
        [ch.id, userId]
      ),
      pool.query<{
        id: string;
        totalQuestions: number;
        correctAnswers: number;
        wrongAnswers: number;
        unansweredQuestions: number;
        score: number;
        percentage: number;
        completionTimeSeconds: number;
        submittedAt: Date;
        isFinalized: boolean;
      }>(
        `SELECT id, total_questions AS "totalQuestions", correct_answers AS "correctAnswers",
                wrong_answers AS "wrongAnswers", unanswered_questions AS "unansweredQuestions",
                score, percentage, completion_time_seconds AS "completionTimeSeconds",
                submitted_at AS "submittedAt", is_finalized AS "isFinalized"
         FROM reward_challenge_results
         WHERE challenge_id = $1 AND student_id = $2
         LIMIT 1`,
        [ch.id, userId]
      ),
      pool.query<{ position: number }>(
        `SELECT position FROM reward_challenge_leaderboards WHERE challenge_id = $1 AND student_id = $2 LIMIT 1`,
        [ch.id, userId]
      ),
    ]);

    const att = attRes.rows[0];
    const rRow = resRes.rows[0];
    const isWinner = Boolean(winnerRow && winnerRow.studentId === userId);

    let myBankDetails = null;
    let myPayment = null;

    if (isWinner) {
      const [bankRes, payRes] = await Promise.all([
        pool.query<{
          id: string;
          challengeId: string;
          bankName: string;
          accountNumber: string;
          accountName: string;
          editLocked: boolean;
          correctionNote: string | null;
          submittedAt: Date;
          updatedAt: Date;
        }>(
          `SELECT id, challenge_id AS "challengeId", bank_name AS "bankName",
                  account_number AS "accountNumber", account_name AS "accountName",
                  edit_locked AS "editLocked", correction_note AS "correctionNote",
                  submitted_at AS "submittedAt", updated_at AS "updatedAt"
           FROM reward_challenge_bank_details
           WHERE challenge_id = $1 AND student_id = $2
           LIMIT 1`,
          [ch.id, userId]
        ),
        pool.query<{
          id: string;
          challengeId: string;
          winnerId: string;
          studentId: string;
          rewardAmount: number;
          currency: string;
          paymentStatus: RewardChallengePaymentStatus;
          paidByAdminName: string | null;
          paidByAdminEmail: string | null;
          paidAt: Date | null;
          paymentReference: string | null;
          adminNote: string | null;
          createdAt: Date;
          updatedAt: Date;
        }>(
          `SELECT id, challenge_id AS "challengeId", winner_id AS "winnerId", student_id AS "studentId",
                  reward_amount::float8 AS "rewardAmount", currency,
                  payment_status AS "paymentStatus", paid_by_admin_name AS "paidByAdminName",
                  paid_by_admin_email AS "paidByAdminEmail", paid_at AS "paidAt",
                  payment_reference AS "paymentReference", admin_note AS "adminNote",
                  created_at AS "createdAt", updated_at AS "updatedAt"
           FROM reward_challenge_payments
           WHERE challenge_id = $1 AND student_id = $2
           LIMIT 1`,
          [ch.id, userId]
        ),
      ]);

      if (bankRes.rows[0]) {
        myBankDetails = {
          ...bankRes.rows[0],
          submittedAt: bankRes.rows[0].submittedAt.toISOString(),
          updatedAt: bankRes.rows[0].updatedAt.toISOString(),
        };
      }
      if (payRes.rows[0]) {
        myPayment = {
          ...payRes.rows[0],
          paidAt: payRes.rows[0].paidAt ? payRes.rows[0].paidAt.toISOString() : null,
          createdAt: payRes.rows[0].createdAt.toISOString(),
          updatedAt: payRes.rows[0].updatedAt.toISOString(),
        };
      }
    }

    myParticipation = {
      joined: partRes.rows.length > 0,
      attempt: att
        ? {
            ...att,
            startedAt: att.startedAt.toISOString(),
            expiresAt: att.expiresAt.toISOString(),
            submittedAt: att.submittedAt ? att.submittedAt.toISOString() : null,
          }
        : null,
      result: rRow
        ? {
            ...rRow,
            submittedAt: rRow.submittedAt.toISOString(),
            position: lbRes.rows[0]?.position ?? null,
          }
        : null,
      isWinner,
      myBankDetails,
      myPayment,
    };
  }

  return {
    id: ch.id,
    title: ch.title,
    description: ch.description,
    isActive: ch.isActive,
    isFeatured: ch.isFeatured,
    lifecycleStatus: ch.lifecycleStatus,
    displayStatus: statusMeta.displayStatus,
    rewardAmount: ch.rewardAmount,
    rewardCurrency: ch.rewardCurrency,
    uploadedQuestionCount: counts.uploadedQuestions,
    publishedQuestionCount: counts.publishedQuestions,
    participantCount: counts.participants,
    submittedCount: counts.submitted,
    settings: {
      timezone: ch.timezone,
      challengeOpenAt: ch.challengeOpenAt.toISOString(),
      examStartAt: ch.examStartAt.toISOString(),
      examEndAt: ch.examEndAt.toISOString(),
      durationMinutes: ch.durationMinutes,
      questionCount: ch.questionCount,
      selectionMode: ch.selectionMode,
      winnerAnnouncementAt: ch.winnerAnnouncementAt.toISOString(),
      challengeCloseAt: ch.challengeCloseAt ? ch.challengeCloseAt.toISOString() : null,
      examFinalizedAt: ch.examFinalizedAt ? ch.examFinalizedAt.toISOString() : null,
      winnerAnnouncedAt: ch.winnerAnnouncedAt ? ch.winnerAnnouncedAt.toISOString() : null,
    },
    canStartExam: statusMeta.canStartExam && counts.publishedQuestions > 0,
    canJoinWaitingRoom: statusMeta.canJoinWaitingRoom,
    unavailableReason:
      statusMeta.canStartExam && counts.publishedQuestions === 0
        ? 'No published challenge questions are available yet.'
        : statusMeta.unavailableReason,
    hasWinner: Boolean(winnerRow),
    winner: winnerRow
      ? {
          id: winnerRow.id,
          challengeId: winnerRow.challengeId,
          studentId: winnerRow.studentId,
          position: winnerRow.position,
          studentName: winnerRow.studentName,
          studentRegistrationCode: winnerRow.studentRegistrationCode,
          score: winnerRow.score,
          totalQuestions: winnerRow.totalQuestions,
          percentage: winnerRow.percentage,
          completionTimeSeconds: winnerRow.completionTimeSeconds,
          rewardAmount: winnerRow.rewardAmount,
          rewardCurrency: winnerRow.rewardCurrency,
          announcedAt: winnerRow.announcedAt.toISOString(),
          isCurrentUserWinner: userId ? winnerRow.studentId === userId : false,
        }
      : null,
    noValidParticipants: Boolean(
      ch.winnerAnnouncedAt && !winnerRow && statusMeta.displayStatus === 'Winner Announced'
    ),
    serverNow: now.toISOString(),
    myParticipation,
  };
}

export async function startOrResumeChallengeAttempt(params: {
  challengeId: string;
  studentId: string;
}) {
  await syncChallengeAutomations(params.challengeId);
  const pool = getPool();
  const summary = await buildChallengeSummaryForUser({
    challengeId: params.challengeId,
    userId: params.studentId,
  });

  if (!summary) {
    throw new RewardChallengeError('Challenge not found.', 404, 'CHALLENGE_NOT_FOUND');
  }

  // If student already has an attempt, check if still in progress or submitted
  const existingAttRes = await pool.query<{
    id: string;
    status: string;
    expiresAt: Date;
  }>(
    `SELECT id, status, expires_at AS "expiresAt"
     FROM reward_challenge_attempts
     WHERE challenge_id = $1 AND student_id = $2
     LIMIT 1`,
    [params.challengeId, params.studentId]
  );

  const existingAtt = existingAttRes.rows[0];
  if (existingAtt) {
    if (existingAtt.status === 'in_progress' && existingAtt.expiresAt.getTime() <= Date.now()) {
      await gradeAndSubmitAttemptInternal({
        attemptId: existingAtt.id,
        submissionSource: 'server_scheduler',
      });
    }
    return getChallengeAttemptState(params);
  }

  if (!summary.isActive || summary.displayStatus === 'Challenge Closed') {
    throw new RewardChallengeError(
      'This challenge is currently closed or deactivated.',
      403,
      'CHALLENGE_CLOSED'
    );
  }

  if (!summary.canStartExam) {
    throw new RewardChallengeError(
      summary.unavailableReason || 'The examination is not open for starting right now.',
      403,
      'EXAM_WINDOW_CLOSED'
    );
  }

  const orderClause =
    summary.settings.selectionMode === 'random'
      ? 'ORDER BY RANDOM()'
      : 'ORDER BY sort_order ASC, created_at ASC';

  const pickedQuestionsRes = await pool.query<{
    id: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    subjectCategory: string;
  }>(
    `SELECT
       id,
       question_text AS "questionText",
       option_a AS "optionA",
       option_b AS "optionB",
       option_c AS "optionC",
       option_d AS "optionD",
       subject_category AS "subjectCategory"
     FROM reward_challenge_questions
     WHERE challenge_id = $1 AND publication_status = 'published'
     ${orderClause}
     LIMIT $2`,
    [params.challengeId, summary.settings.questionCount]
  );

  if (pickedQuestionsRes.rows.length === 0) {
    throw new RewardChallengeError(
      'No published questions exist for this challenge yet.',
      400,
      'NO_QUESTIONS'
    );
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const partRes = await client.query<{ id: string }>(
      `INSERT INTO reward_challenge_participants (challenge_id, student_id, status)
       VALUES ($1, $2, 'in_progress')
       ON CONFLICT (challenge_id, student_id)
       DO UPDATE SET status = 'in_progress', updated_at = NOW()
       RETURNING id`,
      [params.challengeId, params.studentId]
    );
    const participantId = partRes.rows[0].id;

    const totalQuestions = pickedQuestionsRes.rows.length;
    const durationSeconds = summary.settings.durationMinutes * 60;
    const startedAt = new Date();
    const expiresAt = new Date(startedAt.getTime() + durationSeconds * 1000);
    const questionIds = pickedQuestionsRes.rows.map((q) => q.id);

    const attIns = await client.query<{ id: string }>(
      `INSERT INTO reward_challenge_attempts (
         challenge_id, student_id, participant_id, question_ids_order,
         total_questions, duration_seconds, started_at, expires_at, status
       )
       VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8, 'in_progress')
       ON CONFLICT (challenge_id, student_id) DO NOTHING
       RETURNING id`,
      [
        params.challengeId,
        params.studentId,
        participantId,
        JSON.stringify(questionIds),
        totalQuestions,
        durationSeconds,
        startedAt,
        expiresAt,
      ]
    );

    if (attIns.rows.length > 0) {
      const attemptId = attIns.rows[0].id;
      for (let i = 0; i < pickedQuestionsRes.rows.length; i += 1) {
        const q = pickedQuestionsRes.rows[i];
        await client.query(
          `INSERT INTO reward_challenge_answers (
             attempt_id, challenge_id, student_id, question_id, question_order
           )
           VALUES ($1, $2, $3, $4, $5)`,
          [attemptId, params.challengeId, params.studentId, q.id, i + 1]
        );
      }
    }

    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  return getChallengeAttemptState(params);
}

export async function getChallengeAttemptState(params: {
  challengeId: string;
  studentId: string;
}) {
  await syncChallengeAutomations(params.challengeId);
  const pool = getPool();

  const attRes = await pool.query<{
    id: string;
    status: 'in_progress' | 'submitted' | 'auto_submitted';
    startedAt: Date;
    expiresAt: Date;
    submittedAt: Date | null;
    completionSeconds: number | null;
    totalQuestions: number;
    durationSeconds: number;
    submissionSource: string | null;
  }>(
    `SELECT
       id, status, started_at AS "startedAt", expires_at AS "expiresAt",
       submitted_at AS "submittedAt", completion_seconds AS "completionSeconds",
       total_questions AS "totalQuestions", duration_seconds AS "durationSeconds",
       submission_source AS "submissionSource"
     FROM reward_challenge_attempts
     WHERE challenge_id = $1 AND student_id = $2
     LIMIT 1`,
    [params.challengeId, params.studentId]
  );

  const attempt = attRes.rows[0];
  if (!attempt) {
    throw new RewardChallengeError('No attempt found for this challenge.', 404, 'ATTEMPT_NOT_FOUND');
  }

  if (attempt.status === 'in_progress' && attempt.expiresAt.getTime() <= Date.now()) {
    await gradeAndSubmitAttemptInternal({
      attemptId: attempt.id,
      submissionSource: 'server_scheduler',
    });
    return getChallengeAttemptState(params);
  }

  const challenge = await buildChallengeSummaryForUser({
    challengeId: params.challengeId,
    userId: params.studentId,
  });
  if (!challenge) {
    throw new RewardChallengeError('Challenge not found.', 404, 'CHALLENGE_NOT_FOUND');
  }

  const now = new Date();
  const remainingSeconds =
    attempt.status === 'in_progress'
      ? Math.max(0, Math.floor((attempt.expiresAt.getTime() - now.getTime()) / 1000))
      : 0;

  // Reveal correct answers ONLY after competition winner announcement / finalization
  const answersRevealed =
    attempt.status !== 'in_progress' &&
    Boolean(challenge.settings.winnerAnnouncedAt || challenge.hasWinner);

  if (answersRevealed) {
    const qRes = await pool.query<{
      order: number;
      questionId: string;
      questionText: string;
      optionA: string;
      optionB: string;
      optionC: string;
      optionD: string;
      subjectCategory: string;
      selectedOption: OptionLetter | null;
      isMarkedForReview: boolean;
      correctOption: OptionLetter;
      explanation: string;
      isCorrect: boolean | null;
    }>(
      `SELECT
         a.question_order AS "order",
         q.id AS "questionId",
         q.question_text AS "questionText",
         q.option_a AS "optionA",
         q.option_b AS "optionB",
         q.option_c AS "optionC",
         q.option_d AS "optionD",
         q.subject_category AS "subjectCategory",
         a.selected_option AS "selectedOption",
         a.is_marked_for_review AS "isMarkedForReview",
         q.correct_option AS "correctOption",
         q.explanation,
         a.is_correct AS "isCorrect"
       FROM reward_challenge_answers a
       INNER JOIN reward_challenge_questions q ON q.id = a.question_id
       WHERE a.attempt_id = $1
       ORDER BY a.question_order ASC`,
      [attempt.id]
    );

    return {
      challenge,
      attempt: {
        ...attempt,
        startedAt: attempt.startedAt.toISOString(),
        expiresAt: attempt.expiresAt.toISOString(),
        submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
      },
      remainingSeconds,
      serverNow: now.toISOString(),
      questions: qRes.rows,
      answersRevealed: true,
      result: challenge.myParticipation.result,
    };
  }

  // Strictly omit correctOption and explanation while in progress or competition still active
  const qRes = await pool.query<{
    order: number;
    questionId: string;
    questionText: string;
    optionA: string;
    optionB: string;
    optionC: string;
    optionD: string;
    subjectCategory: string;
    selectedOption: OptionLetter | null;
    isMarkedForReview: boolean;
  }>(
    `SELECT
       a.question_order AS "order",
       q.id AS "questionId",
       q.question_text AS "questionText",
       q.option_a AS "optionA",
       q.option_b AS "optionB",
       q.option_c AS "optionC",
       q.option_d AS "optionD",
       q.subject_category AS "subjectCategory",
       a.selected_option AS "selectedOption",
       a.is_marked_for_review AS "isMarkedForReview"
     FROM reward_challenge_answers a
     INNER JOIN reward_challenge_questions q ON q.id = a.question_id
     WHERE a.attempt_id = $1
     ORDER BY a.question_order ASC`,
    [attempt.id]
  );

  return {
    challenge,
    attempt: {
      ...attempt,
      startedAt: attempt.startedAt.toISOString(),
      expiresAt: attempt.expiresAt.toISOString(),
      submittedAt: attempt.submittedAt ? attempt.submittedAt.toISOString() : null,
    },
    remainingSeconds,
    serverNow: now.toISOString(),
    questions: qRes.rows,
    answersRevealed: false,
    result: challenge.myParticipation.result,
  };
}

export async function saveChallengeAnswer(params: {
  challengeId: string;
  studentId: string;
  questionOrder: number;
  selectedOption?: OptionLetter | null;
  isMarkedForReview?: boolean;
}) {
  const pool = getPool();
  const attRes = await pool.query<{ id: string; status: string; expiresAt: Date }>(
    `SELECT id, status, expires_at AS "expiresAt"
     FROM reward_challenge_attempts
     WHERE challenge_id = $1 AND student_id = $2
     LIMIT 1`,
    [params.challengeId, params.studentId]
  );

  const attempt = attRes.rows[0];
  if (!attempt) {
    throw new RewardChallengeError('Challenge attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
  }
  if (attempt.status !== 'in_progress') {
    throw new RewardChallengeError('Challenge attempt has already been submitted.', 409, 'ALREADY_SUBMITTED');
  }

  // 5-second grace window on network roundtrip, never extending real expiry
  if (Date.now() > attempt.expiresAt.getTime() + 5000) {
    await gradeAndSubmitAttemptInternal({
      attemptId: attempt.id,
      submissionSource: 'server_scheduler',
    });
    throw new RewardChallengeError(
      'Your examination time expired and your answers have been automatically submitted.',
      409,
      'ATTEMPT_EXPIRED'
    );
  }

  await pool.query(
    `UPDATE reward_challenge_answers
     SET selected_option = CASE WHEN $1::boolean THEN $2 ELSE selected_option END,
         is_marked_for_review = CASE WHEN $3::boolean THEN $4 ELSE is_marked_for_review END,
         answered_at = NOW()
     WHERE attempt_id = $5 AND question_order = $6`,
    [
      params.selectedOption !== undefined,
      params.selectedOption ?? null,
      params.isMarkedForReview !== undefined,
      Boolean(params.isMarkedForReview),
      attempt.id,
      params.questionOrder,
    ]
  );

  return {
    ok: true,
    remainingSeconds: Math.max(0, Math.floor((attempt.expiresAt.getTime() - Date.now()) / 1000)),
  };
}

export async function submitChallengeAttempt(params: {
  challengeId: string;
  studentId: string;
  submissionSource: 'manual' | 'auto_timer';
  answers?: Array<{
    questionOrder: number;
    selectedOption: OptionLetter | null;
    isMarkedForReview?: boolean;
  }>;
}) {
  const pool = getPool();
  const attRes = await pool.query<{ id: string }>(
    `SELECT id FROM reward_challenge_attempts WHERE challenge_id = $1 AND student_id = $2 LIMIT 1`,
    [params.challengeId, params.studentId]
  );
  const attempt = attRes.rows[0];
  if (!attempt) {
    throw new RewardChallengeError('Challenge attempt not found.', 404, 'ATTEMPT_NOT_FOUND');
  }

  await gradeAndSubmitAttemptInternal({
    attemptId: attempt.id,
    submissionSource: params.submissionSource,
    answersOverride: params.answers,
  });

  return getChallengeAttemptState({
    challengeId: params.challengeId,
    studentId: params.studentId,
  });
}

export async function getChallengeLeaderboard(params: {
  challengeId: string;
  viewerUserId?: string;
}) {
  await syncChallengeAutomations(params.challengeId);
  const pool = getPool();
  const summary = await buildChallengeSummaryForUser({
    challengeId: params.challengeId,
    userId: params.viewerUserId,
  });
  if (!summary) {
    throw new RewardChallengeError('Challenge not found.', 404, 'CHALLENGE_NOT_FOUND');
  }

  const rowsRes = await pool.query<{
    position: number;
    studentId: string;
    studentName: string;
    score: number;
    totalQuestions: number;
    percentage: number;
    completionTimeSeconds: number;
    submittedAt: Date;
    isFinal: boolean;
  }>(
    `SELECT
       position,
       student_id AS "studentId",
       student_name AS "studentName",
       score,
       total_questions AS "totalQuestions",
       percentage,
       completion_time_seconds AS "completionTimeSeconds",
       submitted_at AS "submittedAt",
       is_final AS "isFinal"
     FROM reward_challenge_leaderboards
     WHERE challenge_id = $1
     ORDER BY position ASC`,
    [params.challengeId]
  );

  const entries = rowsRes.rows.map((r) => ({
    position: r.position,
    studentId: r.studentId,
    studentName: r.studentName,
    score: r.score,
    totalQuestions: r.totalQuestions,
    percentage: r.percentage,
    completionTimeSeconds: r.completionTimeSeconds,
    submittedAt: r.submittedAt.toISOString(),
    isFinal: r.isFinal,
    isCurrentUser: Boolean(params.viewerUserId && r.studentId === params.viewerUserId),
  }));

  const myRank = params.viewerUserId
    ? entries.find((e) => e.studentId === params.viewerUserId) || null
    : null;

  return {
    challengeId: summary.id,
    challengeTitle: summary.title,
    displayStatus: summary.displayStatus,
    isFinal: Boolean(summary.settings.winnerAnnouncedAt || summary.hasWinner),
    winnerAnnouncementAt: summary.settings.winnerAnnouncementAt,
    winnerAnnouncedAt: summary.settings.winnerAnnouncedAt,
    winner: summary.winner,
    myRank,
    entries,
    serverNow: new Date().toISOString(),
  };
}

export async function submitWinnerBankDetails(params: {
  challengeId: string;
  studentId: string;
  bankName: string;
  accountNumber: string;
  accountName: string;
  correctionNote?: string;
}) {
  await syncChallengeAutomations(params.challengeId);
  const pool = getPool();

  const winnerRes = await pool.query<{
    id: string;
    studentId: string;
    studentName: string;
    challengeTitle: string;
  }>(
    `SELECT w.id, w.student_id AS "studentId", w.student_name AS "studentName", c.title AS "challengeTitle"
     FROM reward_challenge_winners w
     INNER JOIN reward_challenges c ON c.id = w.challenge_id
     WHERE w.challenge_id = $1
     LIMIT 1`,
    [params.challengeId]
  );

  const winner = winnerRes.rows[0];
  if (!winner) {
    throw new RewardChallengeError(
      'Official winner has not been announced for this challenge yet.',
      403,
      'WINNER_NOT_ANNOUNCED'
    );
  }
  if (winner.studentId !== params.studentId) {
    throw new RewardChallengeError(
      'Only the official challenge winner can submit reward bank details.',
      403,
      'FORBIDDEN_BANK_SUBMISSION'
    );
  }

  const cleanBank = params.bankName.trim();
  const cleanAccNo = params.accountNumber.replace(/\s+/g, '').trim();
  const cleanAccName = params.accountName.trim();

  if (cleanBank.length < 2) {
    throw new RewardChallengeError('Please enter a valid bank name.', 400, 'INVALID_BANK');
  }
  if (!/^\d{10}$/.test(cleanAccNo)) {
    throw new RewardChallengeError(
      'Please enter a valid 10-digit Nigerian bank account number.',
      400,
      'INVALID_ACCOUNT_NUMBER'
    );
  }
  if (cleanAccName.length < 3) {
    throw new RewardChallengeError('Please enter the bank account holder name.', 400, 'INVALID_ACCOUNT_NAME');
  }

  const paymentRes = await pool.query<{ id: string; paymentStatus: RewardChallengePaymentStatus }>(
    `SELECT id, payment_status AS "paymentStatus"
     FROM reward_challenge_payments
     WHERE challenge_id = $1 AND student_id = $2
     LIMIT 1`,
    [params.challengeId, params.studentId]
  );

  if (paymentRes.rows[0]?.paymentStatus === 'payment_completed') {
    throw new RewardChallengeError(
      'Reward payment has already been completed and bank details are locked.',
      409,
      'PAYMENT_ALREADY_COMPLETED'
    );
  }

  const existingBankRes = await pool.query<{ id: string }>(
    `SELECT id FROM reward_challenge_bank_details WHERE challenge_id = $1 LIMIT 1`,
    [params.challengeId]
  );
  if (existingBankRes.rows.length > 0 && !params.correctionNote?.trim()) {
    throw new RewardChallengeError(
      'Bank details have already been submitted. Provide a correction note to submit a controlled update before payout.',
      400,
      'CORRECTION_NOTE_REQUIRED'
    );
  }

  const bankRes = await pool.query<{
    id: string;
    challengeId: string;
    bankName: string;
    accountNumber: string;
    accountName: string;
    editLocked: boolean;
    correctionNote: string | null;
    submittedAt: Date;
    updatedAt: Date;
  }>(
    `INSERT INTO reward_challenge_bank_details (
       challenge_id, winner_id, student_id, bank_name, account_number, account_name, correction_note
     )
     VALUES ($1, $2, $3, $4, $5, $6, $7)
     ON CONFLICT (challenge_id)
     DO UPDATE SET
       bank_name = EXCLUDED.bank_name,
       account_number = EXCLUDED.account_number,
       account_name = EXCLUDED.account_name,
       correction_note = EXCLUDED.correction_note,
       updated_at = NOW()
     RETURNING
       id, challenge_id AS "challengeId", bank_name AS "bankName",
       account_number AS "accountNumber", account_name AS "accountName",
       edit_locked AS "editLocked", correction_note AS "correctionNote",
       submitted_at AS "submittedAt", updated_at AS "updatedAt"`,
    [
      params.challengeId,
      winner.id,
      params.studentId,
      cleanBank,
      cleanAccNo,
      cleanAccName,
      params.correctionNote?.trim() || null,
    ]
  );

  const bankRow = bankRes.rows[0];

  await pool.query(
    `UPDATE reward_challenge_payments
     SET bank_details_id = $1,
         payment_status = CASE
           WHEN payment_status = 'payment_pending' THEN 'payment_processing'
           ELSE payment_status
         END,
         updated_at = NOW()
     WHERE challenge_id = $2`,
    [bankRow.id, params.challengeId]
  );

  await dispatchChallengeNotification({
    challengeId: params.challengeId,
    studentId: params.studentId,
    eventType: 'bank_details_submitted',
    title: `${winner.challengeTitle}: Bank Details Received`,
    message: `Your reward bank details for ${winner.challengeTitle} (${cleanBank}) have been securely submitted and received by Acadet CBT administration for payout processing.`,
    idempotencyKey: `bank_submitted:${params.challengeId}:${bankRow.updatedAt.toISOString()}`,
  });

  // Notify admins cleanly in-app as well
  const adminsRes = await pool.query<{ id: string }>(
    `SELECT id FROM users WHERE role IN ('admin', 'super_admin') AND is_active = TRUE`
  );
  for (const adm of adminsRes.rows) {
    await createStudentNotification({
      recipientUserId: adm.id,
      senderUserId: null,
      senderName: 'Acadet Reward CBT System',
      notificationType: 'system',
      title: `Winner Bank Details Submitted: ${winner.challengeTitle}`,
      message: `${winner.studentName} submitted reward payout bank details for ${winner.challengeTitle}. Open Admin Console -> Reward CBT Challenge -> Reward Payment Management to review and process payout.`,
      actionLabel: 'Open Admin Console',
      actionUrl: '#reward-challenge',
      idempotencyKey: `admin_bank_notice:${params.challengeId}:${adm.id}:${bankRow.updatedAt.toISOString()}`,
    });
  }

  return {
    ...bankRow,
    submittedAt: bankRow.submittedAt.toISOString(),
    updatedAt: bankRow.updatedAt.toISOString(),
  };
}

export async function markRewardPaymentPaid(params: {
  challengeId: string;
  adminUser: { id: string; fullName: string; email: string };
  confirmedTransfer: boolean;
  paymentReference?: string;
  adminNote?: string;
}) {
  if (!params.confirmedTransfer) {
    throw new RewardChallengeError(
      'You must confirm that the reward has been transferred to the winner’s bank account before marking as paid.',
      400,
      'TRANSFER_CONFIRMATION_REQUIRED'
    );
  }

  const pool = getPool();
  const payRes = await pool.query<{
    id: string;
    studentId: string;
    bankDetailsId: string | null;
    paymentStatus: RewardChallengePaymentStatus;
    challengeTitle: string;
  }>(
    `SELECT
       p.id,
       p.student_id AS "studentId",
       p.bank_details_id AS "bankDetailsId",
       p.payment_status AS "paymentStatus",
       c.title AS "challengeTitle"
     FROM reward_challenge_payments p
     INNER JOIN reward_challenges c ON c.id = p.challenge_id
     WHERE p.challenge_id = $1
     LIMIT 1`,
    [params.challengeId]
  );

  const pay = payRes.rows[0];
  if (!pay) {
    throw new RewardChallengeError('Winner reward payment record not found.', 404, 'PAYMENT_NOT_FOUND');
  }
  if (!pay.bankDetailsId) {
    throw new RewardChallengeError(
      'The winner has not submitted their bank details yet.',
      400,
      'MISSING_BANK_DETAILS'
    );
  }

  const updatedRes = await pool.query<{
    id: string;
    challengeId: string;
    paymentStatus: RewardChallengePaymentStatus;
    paidAt: Date;
    paidByAdminName: string;
    paidByAdminEmail: string;
    paymentReference: string | null;
    adminNote: string | null;
  }>(
    `UPDATE reward_challenge_payments
     SET payment_status = 'payment_completed',
         paid_by_admin_id = $1,
         paid_by_admin_name = $2,
         paid_by_admin_email = $3,
         paid_at = NOW(),
         payment_reference = $4,
         admin_note = $5,
         updated_at = NOW()
     WHERE id = $6
     RETURNING
       id,
       challenge_id AS "challengeId",
       payment_status AS "paymentStatus",
       paid_at AS "paidAt",
       paid_by_admin_name AS "paidByAdminName",
       paid_by_admin_email AS "paidByAdminEmail",
       payment_reference AS "paymentReference",
       admin_note AS "adminNote"`,
    [
      params.adminUser.id,
      params.adminUser.fullName,
      params.adminUser.email,
      params.paymentReference?.trim() || null,
      params.adminNote?.trim() || null,
      pay.id,
    ]
  );

  await pool.query(
    `UPDATE reward_challenge_bank_details SET edit_locked = TRUE, updated_at = NOW() WHERE challenge_id = $1`,
    [params.challengeId]
  );

  await dispatchChallengeNotification({
    challengeId: params.challengeId,
    studentId: pay.studentId,
    eventType: 'reward_payment_completed',
    title: `Reward Payment Completed: ${pay.challengeTitle}`,
    message:
      'Congratulations! Your Acadet Reward CBT Challenge reward has been successfully processed and paid into the bank account you provided. Thank you for participating.',
    idempotencyKey: `reward_paid:${params.challengeId}:${pay.studentId}`,
    actionLabel: 'View Reward Payment History',
  });

  const updated = updatedRes.rows[0];
  return {
    ...updated,
    paidAt: updated.paidAt.toISOString(),
  };
}

export async function resetChallengeResultsForRetest(challengeId: string): Promise<{
  deletedAttempts: number;
  clearedWinners: number;
}> {
  const pool = getPool();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const existsRes = await client.query<{ id: string }>(
      `SELECT id FROM reward_challenges WHERE id = $1 FOR UPDATE`,
      [challengeId]
    );
    if (existsRes.rows.length === 0) {
      throw new RewardChallengeError('Reward challenge not found.', 404, 'CHALLENGE_NOT_FOUND');
    }

    const paidCheck = await client.query<{ id: string }>(
      `SELECT id FROM reward_challenge_payments
       WHERE challenge_id = $1 AND payment_status = 'payment_completed'
       LIMIT 1`,
      [challengeId]
    );
    if (paidCheck.rows.length > 0) {
      throw new RewardChallengeError(
        'Cannot reset a competition whose reward payout has already been marked completed.',
        409,
        'PAYMENT_ALREADY_COMPLETED'
      );
    }

    await client.query(`DELETE FROM reward_challenge_payments WHERE challenge_id = $1`, [challengeId]);
    await client.query(`DELETE FROM reward_challenge_bank_details WHERE challenge_id = $1`, [challengeId]);
    const winDel = await client.query(
      `DELETE FROM reward_challenge_winners WHERE challenge_id = $1`,
      [challengeId]
    );
    await client.query(`DELETE FROM reward_challenge_leaderboards WHERE challenge_id = $1`, [challengeId]);
    await client.query(`DELETE FROM reward_challenge_results WHERE challenge_id = $1`, [challengeId]);
    await client.query(
      `DELETE FROM reward_challenge_answers
       WHERE attempt_id IN (SELECT id FROM reward_challenge_attempts WHERE challenge_id = $1)`,
      [challengeId]
    );
    const attDel = await client.query(
      `DELETE FROM reward_challenge_attempts WHERE challenge_id = $1`,
      [challengeId]
    );

    await client.query(
      `UPDATE reward_challenge_settings
       SET exam_finalized_at = NULL,
           winner_announced_at = NULL,
           updated_at = NOW()
       WHERE challenge_id = $1`,
      [challengeId]
    );

    await client.query(
      `UPDATE reward_challenges
       SET lifecycle_status = CASE WHEN is_active THEN 'active' ELSE 'draft' END,
           closed_at = NULL,
           updated_at = NOW()
       WHERE id = $1`,
      [challengeId]
    );

    await client.query('COMMIT');
    return {
      deletedAttempts: attDel.rowCount || 0,
      clearedWinners: winDel.rowCount || 0,
    };
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}
