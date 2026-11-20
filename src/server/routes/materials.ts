import path from 'node:path';
import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '../../db/index.js';
import { courses, studyMaterials } from '../../db/schema.js';
import {
  signMaterialDownloadToken,
  verifyMaterialDownloadToken,
} from '../lib/jwt.js';
import {
  getMaterialDownloadUrl,
  getObjectBuffer,
  isObjectStorageConfigured,
  ObjectStorageNotConfiguredError,
} from '../lib/objectStorage.js';
import { handleApiError, requireAuth, requireDb } from '../middleware/auth.js';

const router = Router();

function resolveMaterialDownloadFilename(material: {
  title: string;
  fileType: string;
  originalFilename?: string | null;
}): string {
  const originalExt = path.extname(material.originalFilename || '').trim();
  const fallbackExt =
    originalExt ||
    (material.fileType === 'DOC'
      ? '.docx'
      : material.fileType === 'IMAGE'
        ? '.png'
        : '.pdf');
  const safeBase =
    material.title.replace(/[^a-zA-Z0-9-_ ]+/g, '').trim() || 'material';
  return `${safeBase}${fallbackExt.startsWith('.') ? fallbackExt : `.${fallbackExt}`}`;
}

router.get('/', requireDb, async (req, res) => {
  try {
    const db = getDb();
    const category =
      typeof req.query.category === 'string' && req.query.category !== 'All'
        ? req.query.category.trim()
        : null;
    const courseId =
      typeof req.query.courseId === 'string' && req.query.courseId.trim()
        ? req.query.courseId.trim()
        : null;

    const conditions = [eq(studyMaterials.isActive, true)];
    if (category) {
      conditions.push(eq(studyMaterials.category, category));
    }
    if (courseId) {
      conditions.push(eq(studyMaterials.courseId, courseId));
    }

    const items = await db
      .select({
        id: studyMaterials.id,
        courseId: studyMaterials.courseId,
        courseTitle: courses.title,
        courseCode: courses.code,
        title: studyMaterials.title,
        description: studyMaterials.description,
        category: studyMaterials.category,
        fileType: studyMaterials.fileType,
        fileSizeBytes: studyMaterials.fileSizeBytes,
        mimeType: studyMaterials.mimeType,
        downloadCount: studyMaterials.downloadCount,
        createdAt: studyMaterials.createdAt,
      })
      .from(studyMaterials)
      .leftJoin(courses, eq(studyMaterials.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(desc(studyMaterials.createdAt));

    res.json({ materials: items });
  } catch (err) {
    handleApiError(res, err, 'fetching study materials');
  }
});

router.post('/:id/download', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;

    const [material] = await db
      .select({
        id: studyMaterials.id,
        title: studyMaterials.title,
        fileType: studyMaterials.fileType,
        storageBackend: studyMaterials.storageBackend,
        objectKey: studyMaterials.objectKey,
        originalFilename: studyMaterials.originalFilename,
        hasFileData: sql<boolean>`(${studyMaterials.fileData} IS NOT NULL)`,
      })
      .from(studyMaterials)
      .where(and(eq(studyMaterials.id, id), eq(studyMaterials.isActive, true)))
      .limit(1);

    if (!material) {
      res.status(404).json({ error: 'Study material not found.' });
      return;
    }

    const downloadFilename = resolveMaterialDownloadFilename(material);
    let downloadUrl: string | null = null;

    if (material.storageBackend === 's3' && isObjectStorageConfigured()) {
      try {
        downloadUrl = await getMaterialDownloadUrl({
          objectKey: material.objectKey,
          downloadFilename,
        });
      } catch (storageErr) {
        if (!material.hasFileData) {
          throw storageErr;
        }
      }
    }

    if (!downloadUrl) {
      if (!material.hasFileData && material.storageBackend !== 's3') {
        res.status(404).json({ error: 'Study material file content is missing.' });
        return;
      }
      const token = signMaterialDownloadToken(material.id, downloadFilename);
      downloadUrl = `/api/materials/${encodeURIComponent(material.id)}/file?token=${encodeURIComponent(token)}`;
    }

    await db
      .update(studyMaterials)
      .set({
        downloadCount: sql`${studyMaterials.downloadCount} + 1`,
      })
      .where(eq(studyMaterials.id, material.id));

    res.json({
      downloadUrl,
      filename: downloadFilename,
    });
  } catch (err) {
    if (err instanceof ObjectStorageNotConfiguredError) {
      res.status(503).json({
        error: err.message,
        code: 'OBJECT_STORAGE_NOT_CONFIGURED',
      });
      return;
    }
    handleApiError(res, err, 'generating material download URL');
  }
});

router.get('/:id/file', requireDb, async (req, res) => {
  try {
    const { id } = req.params;
    const rawToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const verified = rawToken ? verifyMaterialDownloadToken(rawToken, id) : null;
    if (!verified) {
      res.status(401).json({ error: 'Invalid or expired download token. Please click Download again.' });
      return;
    }

    const db = getDb();
    const [material] = await db
      .select({
        id: studyMaterials.id,
        title: studyMaterials.title,
        fileType: studyMaterials.fileType,
        storageBackend: studyMaterials.storageBackend,
        objectKey: studyMaterials.objectKey,
        originalFilename: studyMaterials.originalFilename,
        fileData: studyMaterials.fileData,
        mimeType: studyMaterials.mimeType,
      })
      .from(studyMaterials)
      .where(and(eq(studyMaterials.id, id), eq(studyMaterials.isActive, true)))
      .limit(1);

    if (!material) {
      res.status(404).json({ error: 'Study material not found.' });
      return;
    }

    let payloadBuffer: Buffer | null =
      material.fileData && material.fileData.length > 0
        ? Buffer.isBuffer(material.fileData)
          ? material.fileData
          : Buffer.from(material.fileData)
        : null;
    let contentType = material.mimeType || 'application/octet-stream';

    if ((!payloadBuffer || payloadBuffer.length === 0) && material.storageBackend === 's3') {
      const obj = await getObjectBuffer(material.objectKey);
      if (obj.buffer.length > 0) {
        payloadBuffer = obj.buffer;
        contentType = obj.contentType || contentType;
      }
    }

    if (!payloadBuffer || payloadBuffer.length === 0) {
      res.status(404).json({ error: 'Study material file content could not be found.' });
      return;
    }

    const filename = verified.filename.replace(/"/g, '');
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Length', String(payloadBuffer.length));
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Cache-Control', 'private, no-store');
    res.send(payloadBuffer);
  } catch (err) {
    handleApiError(res, err, 'streaming study material file');
  }
});

export default router;
