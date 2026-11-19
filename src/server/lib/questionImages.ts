import crypto from 'node:crypto';
import path from 'node:path';
import { asc, eq, inArray } from 'drizzle-orm';
import { getDb, getPool } from '../../db/index.js';
import { questionImages } from '../../db/schema.js';
import {
  deleteObjectKey,
  getObjectBuffer,
  isObjectStorageConfigured,
  uploadObjectBuffer,
} from './objectStorage.js';

export const ALLOWED_QUESTION_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
] as const;

export const MAX_QUESTION_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB per image

export interface QuestionImageDto {
  id: string;
  questionId: string;
  sortOrder: number;
  caption: string | null;
  mimeType: string;
  fileName: string;
  fileSizeBytes: number;
  url: string;
  createdAt: string;
}

export class QuestionImageValidationError extends Error {
  statusCode = 400;
  constructor(message: string) {
    super(message);
    this.name = 'QuestionImageValidationError';
  }
}

export function normalizeQuestionImageMime(
  mimeType: string | undefined,
  fileName?: string
): string | null {
  const lowerMime = (mimeType || '').toLowerCase().trim();
  if (
    lowerMime === 'image/jpeg' ||
    lowerMime === 'image/jpg' ||
    lowerMime === 'image/png' ||
    lowerMime === 'image/webp'
  ) {
    return lowerMime === 'image/jpg' ? 'image/jpeg' : lowerMime;
  }

  const ext = path.extname(fileName || '').toLowerCase();
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return null;
}

export function validateQuestionImageFile(input: {
  buffer: Buffer;
  mimeType?: string;
  fileName: string;
}): { mimeType: string; fileName: string; fileSizeBytes: number } {
  if (!input.buffer || input.buffer.length === 0) {
    throw new QuestionImageValidationError(
      `Image file "${input.fileName || 'upload'}" is empty.`
    );
  }
  if (input.buffer.length > MAX_QUESTION_IMAGE_BYTES) {
    throw new QuestionImageValidationError(
      `Image "${input.fileName}" exceeds the 5 MB per-image limit.`
    );
  }

  const normalizedMime = normalizeQuestionImageMime(input.mimeType, input.fileName);
  if (!normalizedMime) {
    throw new QuestionImageValidationError(
      `Unsupported image format for "${input.fileName}". Only JPG, JPEG, PNG, and WEBP images are allowed.`
    );
  }

  const cleanName = path.basename(input.fileName || 'diagram.png').replace(/[^\w.\- ()]/g, '_');
  return {
    mimeType: normalizedMime,
    fileName: cleanName || 'diagram.png',
    fileSizeBytes: input.buffer.length,
  };
}

export function buildQuestionImageUrl(imageId: string): string {
  return `/api/public/question-images/${encodeURIComponent(imageId)}`;
}

export async function attachImagesToQuestion(params: {
  questionId: string;
  files: Array<{
    buffer: Buffer;
    mimeType?: string;
    fileName: string;
    caption?: string | null;
  }>;
  createdBy?: string | null;
}): Promise<QuestionImageDto[]> {
  if (!params.files || params.files.length === 0) return [];

  const db = getDb();
  const pool = getPool();

  const maxSortRes = await pool.query<{ maxOrder: number }>(
    'SELECT COALESCE(MAX(sort_order), -1)::int AS "maxOrder" FROM question_images WHERE question_id = $1',
    [params.questionId]
  );
  let nextSortOrder = (maxSortRes.rows[0]?.maxOrder ?? -1) + 1;

  const useS3 = isObjectStorageConfigured();
  const insertedItems: QuestionImageDto[] = [];

  for (const file of params.files) {
    const validated = validateQuestionImageFile({
      buffer: file.buffer,
      mimeType: file.mimeType,
      fileName: file.fileName,
    });

    const imageId = crypto.randomUUID();
    const ext =
      validated.mimeType === 'image/png'
        ? '.png'
        : validated.mimeType === 'image/webp'
          ? '.webp'
          : '.jpg';

    let storageBackend: 's3' | 'postgres' = 'postgres';
    let objectKey: string | null = null;
    let imageData: Buffer | null = file.buffer;

    if (useS3) {
      objectKey = `question-images/${params.questionId}/${imageId}${ext}`;
      try {
        await uploadObjectBuffer({
          objectKey,
          body: file.buffer,
          contentType: validated.mimeType,
        });
        storageBackend = 's3';
        imageData = null;
      } catch (s3Err) {
        console.warn(
          '[QuestionImages] S3 upload failed, falling back to PostgreSQL BYTEA:',
          s3Err
        );
        objectKey = null;
        storageBackend = 'postgres';
        imageData = file.buffer;
      }
    }

    const [created] = await db
      .insert(questionImages)
      .values({
        id: imageId,
        questionId: params.questionId,
        sortOrder: nextSortOrder,
        caption: file.caption?.trim() || null,
        mimeType: validated.mimeType,
        fileName: validated.fileName,
        fileSizeBytes: validated.fileSizeBytes,
        storageBackend,
        objectKey,
        imageData,
        createdBy: params.createdBy ?? null,
      })
      .returning({
        id: questionImages.id,
        questionId: questionImages.questionId,
        sortOrder: questionImages.sortOrder,
        caption: questionImages.caption,
        mimeType: questionImages.mimeType,
        fileName: questionImages.fileName,
        fileSizeBytes: questionImages.fileSizeBytes,
        createdAt: questionImages.createdAt,
      });

    nextSortOrder += 1;
    insertedItems.push({
      ...created,
      url: buildQuestionImageUrl(created.id),
      createdAt:
        created.createdAt instanceof Date
          ? created.createdAt.toISOString()
          : String(created.createdAt),
    });
  }

  return insertedItems;
}

export async function getQuestionImagesMap(
  questionIds: string[]
): Promise<Map<string, QuestionImageDto[]>> {
  const map = new Map<string, QuestionImageDto[]>();
  const uniqueIds = Array.from(new Set(questionIds.filter(Boolean)));
  if (uniqueIds.length === 0) return map;

  const db = getDb();
  const rows = await db
    .select({
      id: questionImages.id,
      questionId: questionImages.questionId,
      sortOrder: questionImages.sortOrder,
      caption: questionImages.caption,
      mimeType: questionImages.mimeType,
      fileName: questionImages.fileName,
      fileSizeBytes: questionImages.fileSizeBytes,
      createdAt: questionImages.createdAt,
    })
    .from(questionImages)
    .where(inArray(questionImages.questionId, uniqueIds))
    .orderBy(asc(questionImages.sortOrder), asc(questionImages.createdAt));

  for (const r of rows) {
    const dto: QuestionImageDto = {
      id: r.id,
      questionId: r.questionId,
      sortOrder: r.sortOrder,
      caption: r.caption,
      mimeType: r.mimeType,
      fileName: r.fileName,
      fileSizeBytes: r.fileSizeBytes,
      url: buildQuestionImageUrl(r.id),
      createdAt: r.createdAt instanceof Date ? r.createdAt.toISOString() : String(r.createdAt),
    };
    const existing = map.get(r.questionId);
    if (existing) existing.push(dto);
    else map.set(r.questionId, [dto]);
  }

  return map;
}

export async function deleteQuestionImage(
  questionId: string,
  imageId: string
): Promise<boolean> {
  const db = getDb();
  const [deleted] = await db
    .delete(questionImages)
    .where(eq(questionImages.id, imageId))
    .returning({
      id: questionImages.id,
      questionId: questionImages.questionId,
      storageBackend: questionImages.storageBackend,
      objectKey: questionImages.objectKey,
    });

  if (!deleted) return false;
  if (deleted.questionId !== questionId) {
    return true;
  }

  if (deleted.storageBackend === 's3' && deleted.objectKey) {
    try {
      await deleteObjectKey(deleted.objectKey);
    } catch {
      // Ignore cleanup errors
    }
  }
  return true;
}

export async function cleanupS3ObjectsForQuestion(questionId: string): Promise<void> {
  const db = getDb();
  const rows = await db
    .select({
      storageBackend: questionImages.storageBackend,
      objectKey: questionImages.objectKey,
    })
    .from(questionImages)
    .where(eq(questionImages.questionId, questionId));

  for (const r of rows) {
    if (r.storageBackend === 's3' && r.objectKey) {
      try {
        await deleteObjectKey(r.objectKey);
      } catch {
        // Ignore cleanup failure
      }
    }
  }
}

export async function getQuestionImageBinary(
  imageId: string
): Promise<{ buffer: Buffer; mimeType: string; fileName: string } | null> {
  const db = getDb();
  const [row] = await db
    .select({
      id: questionImages.id,
      mimeType: questionImages.mimeType,
      fileName: questionImages.fileName,
      storageBackend: questionImages.storageBackend,
      objectKey: questionImages.objectKey,
      imageData: questionImages.imageData,
    })
    .from(questionImages)
    .where(eq(questionImages.id, imageId))
    .limit(1);

  if (!row) return null;

  if (row.storageBackend === 's3' && row.objectKey) {
    const obj = await getObjectBuffer(row.objectKey);
    if (obj.buffer.length > 0) {
      return {
        buffer: obj.buffer,
        mimeType: obj.contentType || row.mimeType,
        fileName: row.fileName,
      };
    }
  }

  if (row.imageData && row.imageData.length > 0) {
    return {
      buffer: Buffer.isBuffer(row.imageData) ? row.imageData : Buffer.from(row.imageData),
      mimeType: row.mimeType,
      fileName: row.fileName,
    };
  }

  return null;
}
