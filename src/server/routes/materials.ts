import path from 'node:path';
import { and, desc, eq, inArray, isNull, sql } from 'drizzle-orm';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb, getPool } from '../../db/index.js';
import { courses, studyMaterialPurchases, studyMaterials } from '../../db/schema.js';
import {
  signMaterialDownloadToken,
  verifyMaterialDownloadToken,
} from '../lib/jwt.js';
import {
  hasPurchasedMaterial,
  initializeStudyMaterialPayment,
  MaterialPaymentError,
  verifyAndSettleMaterialReference,
} from '../lib/materialPayments.js';
import {
  getMaterialDownloadUrl,
  getObjectBuffer,
  isObjectStorageConfigured,
  ObjectStorageNotConfiguredError,
} from '../lib/objectStorage.js';
import { PaymentValidationError } from '../lib/paymentSettlement.js';
import { PaystackGatewayError, PaystackNotConfiguredError } from '../lib/paystack.js';
import {
  handleApiError,
  optionalAuth,
  requireAuth,
  requireDb,
} from '../middleware/auth.js';

const router = Router();
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveMaterialCallbackUrl(req: Request): string {
  const configured = process.env.PAYSTACK_CALLBACK_URL?.trim();
  if (configured) {
    return configured;
  }
  const appUrl = process.env.APP_URL?.trim();
  if (appUrl) {
    return appUrl.replace(/\/$/, '') + '/';
  }
  const proto =
    (req.headers['x-forwarded-proto'] as string | undefined)?.split(',')[0]?.trim() ||
    req.protocol ||
    'https';
  const host = req.get('host');
  if (host) {
    return `${proto}://${host}/`;
  }
  return 'http://localhost:3000/';
}

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

router.get('/', requireDb, optionalAuth, async (req, res) => {
  try {
    const db = getDb();
    const pool = getPool();
    const category =
      typeof req.query.category === 'string' && req.query.category !== 'All'
        ? req.query.category.trim()
        : null;
    const rawCourseId =
      typeof req.query.courseId === 'string' && req.query.courseId.trim()
        ? req.query.courseId.trim()
        : null;

    const conditions = [eq(studyMaterials.isActive, true)];
    if (category) {
      conditions.push(eq(studyMaterials.category, category));
    }
    if (rawCourseId === 'general') {
      conditions.push(isNull(studyMaterials.courseId));
    } else if (rawCourseId) {
      if (!UUID_REGEX.test(rawCourseId)) {
        res.status(400).json({ error: 'Invalid courseId filter.' });
        return;
      }
      conditions.push(eq(studyMaterials.courseId, rawCourseId));
    }

    const rows = await db
      .select({
        id: studyMaterials.id,
        courseId: studyMaterials.courseId,
        courseTitle: courses.title,
        courseCode: courses.code,
        courseLevel: courses.level,
        title: studyMaterials.title,
        description: studyMaterials.description,
        category: studyMaterials.category,
        fileType: studyMaterials.fileType,
        fileSizeBytes: studyMaterials.fileSizeBytes,
        mimeType: studyMaterials.mimeType,
        price: studyMaterials.price,
        currency: studyMaterials.currency,
        downloadCount: studyMaterials.downloadCount,
        createdAt: studyMaterials.createdAt,
      })
      .from(studyMaterials)
      .leftJoin(courses, eq(studyMaterials.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(desc(studyMaterials.createdAt));

    const purchasedSet = new Set<string>();
    const isAdmin =
      req.user?.role === 'admin' || req.user?.role === 'super_admin';

    if (req.user && rows.length > 0 && !isAdmin) {
      const materialIds = rows.map((r) => r.id);
      const purchaseRows = await db
        .select({ materialId: studyMaterialPurchases.materialId })
        .from(studyMaterialPurchases)
        .where(
          and(
            eq(studyMaterialPurchases.studentId, req.user.id),
            eq(studyMaterialPurchases.paymentStatus, 'successful'),
            inArray(studyMaterialPurchases.materialId, materialIds)
          )
        );
      for (const p of purchaseRows) {
        purchasedSet.add(p.materialId);
      }
    }

    const materials = rows.map((r) => {
      const priceNum = Number(r.price ?? 0);
      const isFree = priceNum <= 0;
      const isPurchased = isFree || isAdmin || purchasedSet.has(r.id);
      return {
        id: r.id,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        courseCode: r.courseCode,
        courseLevel: r.courseLevel,
        title: r.title,
        description: r.description,
        category: r.category,
        fileType: r.fileType,
        fileSizeBytes: r.fileSizeBytes,
        mimeType: r.mimeType,
        price: priceNum,
        currency: r.currency || 'NGN',
        isFree,
        isPurchased,
        downloadCount: r.downloadCount,
        createdAt: r.createdAt,
      };
    });

    // Build course-level summaries for the course-based browser
    const courseCountsRes = await pool.query<{
      course_id: string;
      code: string;
      title: string;
      level: string;
      material_count: number;
      free_count: number;
      paid_count: number;
      unlocked_count: number;
    }>(
      `SELECT
         c.id AS course_id,
         c.code,
         c.title,
         c.level,
         COUNT(sm.id)::int AS material_count,
         COUNT(sm.id) FILTER (WHERE sm.price <= 0)::int AS free_count,
         COUNT(sm.id) FILTER (WHERE sm.price > 0)::int AS paid_count,
         COUNT(sm.id) FILTER (
           WHERE sm.price <= 0
              OR $2::boolean = TRUE
              OR ($1::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM study_material_purchases smp
                WHERE smp.student_id = $1::uuid
                  AND smp.material_id = sm.id
                  AND smp.payment_status = 'successful'
              ))
         )::int AS unlocked_count
       FROM courses c
       LEFT JOIN study_materials sm
         ON sm.course_id = c.id AND sm.is_active = TRUE
       WHERE c.is_active = TRUE AND c.publication_status = 'published'
       GROUP BY c.id, c.code, c.title, c.level
       ORDER BY c.code ASC`,
      [req.user?.id || null, isAdmin]
    );

    const generalCountRes = await pool.query<{
      material_count: number;
      free_count: number;
      paid_count: number;
      unlocked_count: number;
    }>(
      `SELECT
         COUNT(sm.id)::int AS material_count,
         COUNT(sm.id) FILTER (WHERE sm.price <= 0)::int AS free_count,
         COUNT(sm.id) FILTER (WHERE sm.price > 0)::int AS paid_count,
         COUNT(sm.id) FILTER (
           WHERE sm.price <= 0
              OR $2::boolean = TRUE
              OR ($1::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM study_material_purchases smp
                WHERE smp.student_id = $1::uuid
                  AND smp.material_id = sm.id
                  AND smp.payment_status = 'successful'
              ))
         )::int AS unlocked_count
       FROM study_materials sm
       WHERE sm.course_id IS NULL AND sm.is_active = TRUE`,
      [req.user?.id || null, isAdmin]
    );

    const courseSummaries = courseCountsRes.rows.map((c) => ({
      courseId: c.course_id as string | null,
      code: c.code,
      title: c.title,
      level: c.level,
      materialCount: Number(c.material_count ?? 0),
      freeCount: Number(c.free_count ?? 0),
      paidCount: Number(c.paid_count ?? 0),
      unlockedCount: Number(c.unlocked_count ?? 0),
    }));

    const genRow = generalCountRes.rows[0];
    if (genRow && Number(genRow.material_count) > 0) {
      courseSummaries.push({
        courseId: null,
        code: 'GENERAL',
        title: 'General Study Resources',
        level: 'All Courses',
        materialCount: Number(genRow.material_count ?? 0),
        freeCount: Number(genRow.free_count ?? 0),
        paidCount: Number(genRow.paid_count ?? 0),
        unlockedCount: Number(genRow.unlocked_count ?? 0),
      });
    }

    res.json({ materials, courseSummaries });
  } catch (err) {
    handleApiError(res, err, 'fetching study materials');
  }
});

router.post('/:id/pay', requireAuth, async (req, res) => {
  try {
    const materialId = req.params.id?.trim();
    if (!materialId || !UUID_REGEX.test(materialId)) {
      res.status(400).json({ error: 'Valid material ID is required.' });
      return;
    }

    const checkout = await initializeStudyMaterialPayment({
      student: {
        id: req.user!.id,
        email: req.user!.email,
        fullName: req.user!.fullName,
      },
      materialId,
      callbackUrl: resolveMaterialCallbackUrl(req),
    });

    res.status(201).json(checkout);
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      res.status(503).json({ error: err.message, code: 'PAYSTACK_NOT_CONFIGURED' });
      return;
    }
    if (err instanceof PaystackGatewayError) {
      res.status(err.statusCode).json({ error: err.message, code: 'PAYSTACK_GATEWAY_ERROR' });
      return;
    }
    if (err instanceof MaterialPaymentError) {
      res.status(err.statusCode).json({ error: err.message, code: err.code });
      return;
    }
    handleApiError(res, err, 'initializing study material payment');
  }
});

const verifyMaterialPaySchema = z.object({
  reference: z.string().trim().min(4, 'Payment reference is required.').max(120),
  source: z.enum(['student_manual', 'callback']).optional(),
});

router.post('/verify-payment', requireAuth, async (req, res) => {
  try {
    const parsed = verifyMaterialPaySchema.parse(req.body ?? {});
    const outcome = await verifyAndSettleMaterialReference({
      reference: parsed.reference,
      requestingUser: {
        id: req.user!.id,
        email: req.user!.email,
        fullName: req.user!.fullName,
        role: req.user!.role,
      },
      source: parsed.source ?? 'student_manual',
      ipAddress: req.ip,
    });
    res.json(outcome);
  } catch (err) {
    if (err instanceof PaystackNotConfiguredError) {
      res.status(503).json({ error: err.message, code: 'PAYSTACK_NOT_CONFIGURED' });
      return;
    }
    if (err instanceof PaystackGatewayError) {
      res.status(err.statusCode).json({ error: err.message, code: 'PAYSTACK_GATEWAY_ERROR' });
      return;
    }
    if (err instanceof PaymentValidationError) {
      res.status(err.statusCode).json({ error: err.message });
      return;
    }
    handleApiError(res, err, 'verifying study material payment');
  }
});

router.post('/:id/download', requireAuth, async (req, res) => {
  try {
    const db = getDb();
    const { id } = req.params;
    if (!id || !UUID_REGEX.test(id)) {
      res.status(400).json({ error: 'Invalid study material ID.' });
      return;
    }

    const [material] = await db
      .select({
        id: studyMaterials.id,
        title: studyMaterials.title,
        fileType: studyMaterials.fileType,
        price: studyMaterials.price,
        currency: studyMaterials.currency,
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

    const priceNum = Number(material.price ?? 0);
    const isAdmin =
      req.user!.role === 'admin' || req.user!.role === 'super_admin';

    if (priceNum > 0 && !isAdmin) {
      const unlocked = await hasPurchasedMaterial(req.user!.id, material.id);
      if (!unlocked) {
        res.status(402).json({
          error: `Please complete payment of ₦${priceNum.toLocaleString()} to unlock and download "${material.title}".`,
          code: 'MATERIAL_PAYMENT_REQUIRED',
          materialId: material.id,
          price: priceNum,
          currency: material.currency || 'NGN',
        });
        return;
      }
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
