import { and, desc, eq, sql } from 'drizzle-orm';
import { Router } from 'express';
import { getDb } from '../../db/index.js';
import { studyMaterials, subjects } from '../../db/schema.js';
import {
  getMaterialDownloadUrl,
  ObjectStorageNotConfiguredError,
} from '../lib/objectStorage.js';
import { handleApiError, requireAuth, requireDb } from '../middleware/auth.js';

const router = Router();

router.get('/', requireDb, async (req, res) => {
  try {
    const db = getDb();
    const category =
      typeof req.query.category === 'string' && req.query.category !== 'All'
        ? req.query.category.trim()
        : null;
    const subjectId =
      typeof req.query.subjectId === 'string' && req.query.subjectId.trim()
        ? req.query.subjectId.trim()
        : null;

    const conditions = [eq(studyMaterials.isActive, true)];
    if (category) {
      conditions.push(eq(studyMaterials.category, category));
    }
    if (subjectId) {
      conditions.push(eq(studyMaterials.subjectId, subjectId));
    }

    const items = await db
      .select({
        id: studyMaterials.id,
        subjectId: studyMaterials.subjectId,
        subjectName: subjects.name,
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
      .leftJoin(subjects, eq(studyMaterials.subjectId, subjects.id))
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
      .select()
      .from(studyMaterials)
      .where(and(eq(studyMaterials.id, id), eq(studyMaterials.isActive, true)))
      .limit(1);

    if (!material) {
      res.status(404).json({ error: 'Study material not found.' });
      return;
    }

    const ext =
      material.fileType === 'DOC'
        ? 'docx'
        : material.fileType === 'IMAGE'
          ? 'png'
          : 'pdf';
    const downloadFilename = `${material.title.replace(/[^a-zA-Z0-9-_ ]+/g, '').trim() || 'material'}.${ext}`;

    const downloadUrl = await getMaterialDownloadUrl({
      objectKey: material.objectKey,
      downloadFilename,
    });

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

export default router;
