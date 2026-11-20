import path from 'node:path';
import { and, desc, eq, inArray, isNull, or, sql } from 'drizzle-orm';
import { Router, type Request } from 'express';
import { z } from 'zod';
import { getDb, getPool } from '../../db/index.js';
import { courses, studyMaterialPurchases, studyMaterials } from '../../db/schema.js';
import {
  signMaterialDownloadToken,
  verifyMaterialDownloadToken,
} from '../lib/jwt.js';
import {
  getStudentRegisteredCourseIds,
  getSuccessfulMaterialPurchaseId,
  initializeStudyMaterialPayment,
  isStudentRegisteredForCourse,
  MaterialPaymentError,
  recordMaterialDownloadAuthorization,
  verifyAndSettleMaterialReference,
} from '../lib/materialPayments.js';
import { getObjectBuffer } from '../lib/objectStorage.js';
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

    if (rawCourseId && rawCourseId !== 'general' && !UUID_REGEX.test(rawCourseId)) {
      res.status(400).json({ error: 'Invalid courseId filter.' });
      return;
    }

    // Strict student access control for every caller in Study Materials:
    // course registration and individual Paystack material purchases are always enforced.
    const registeredCourseIds = req.user
      ? await getStudentRegisteredCourseIds(req.user.id)
      : new Set<string>();

    const courseCountsRes = await pool.query<{
      course_id: string;
      code: string;
      title: string;
      level: string;
      faculty: string;
      department: string;
      semester: string;
      registration_fee: string;
      currency: string;
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
         COALESCE(NULLIF(TRIM(c.faculty), ''), 'General') AS faculty,
         COALESCE(NULLIF(TRIM(c.department), ''), 'General') AS department,
         COALESCE(NULLIF(TRIM(c.semester), ''), 'First Semester') AS semester,
         c.registration_fee::text AS registration_fee,
         c.currency,
         COUNT(sm.id)::int AS material_count,
         COUNT(sm.id) FILTER (WHERE sm.price <= 0)::int AS free_count,
         COUNT(sm.id) FILTER (WHERE sm.price > 0)::int AS paid_count,
         COUNT(sm.id) FILTER (
           WHERE sm.price <= 0
              OR ($1::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM study_material_purchases smp
                WHERE smp.student_id = $1::uuid
                  AND smp.material_id = sm.id
                  AND smp.payment_status = 'successful'
              ))
         )::int AS unlocked_count
       FROM courses c
       LEFT JOIN study_materials sm
         ON sm.course_id = c.id
         AND sm.is_active = TRUE
         AND COALESCE(sm.publication_status, 'published') = 'published'
       WHERE c.is_active = TRUE AND c.publication_status = 'published'
       GROUP BY c.id, c.code, c.title, c.level, c.faculty, c.department, c.semester, c.registration_fee, c.currency
       ORDER BY c.code ASC`,
      [req.user?.id || null]
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
              OR ($1::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM study_material_purchases smp
                WHERE smp.student_id = $1::uuid
                  AND smp.material_id = sm.id
                  AND smp.payment_status = 'successful'
              ))
         )::int AS unlocked_count
       FROM study_materials sm
       WHERE sm.course_id IS NULL
         AND sm.is_active = TRUE
         AND COALESCE(sm.publication_status, 'published') = 'published'`,
      [req.user?.id || null]
    );

    const courseSummaries = courseCountsRes.rows.map((c) => {
      const registered = registeredCourseIds.has(c.course_id);
      return {
        courseId: c.course_id as string | null,
        code: c.code,
        title: c.title,
        level: c.level,
        faculty: c.faculty,
        department: c.department,
        semester: c.semester,
        registrationFee: Number(c.registration_fee ?? 2350),
        currency: c.currency || 'NGN',
        isRegistered: registered,
        locked: !registered,
        materialCount: Number(c.material_count ?? 0),
        freeCount: Number(c.free_count ?? 0),
        paidCount: Number(c.paid_count ?? 0),
        unlockedCount: registered ? Number(c.unlocked_count ?? 0) : 0,
      };
    });

    const genRow = generalCountRes.rows[0];
    if (genRow && Number(genRow.material_count) > 0) {
      courseSummaries.push({
        courseId: null,
        code: 'GENERAL',
        title: 'General Study Resources',
        level: 'All Courses',
        faculty: 'General',
        department: 'General',
        semester: 'All Semesters',
        registrationFee: 0,
        currency: 'NGN',
        isRegistered: true,
        locked: false,
        materialCount: Number(genRow.material_count ?? 0),
        freeCount: Number(genRow.free_count ?? 0),
        paidCount: Number(genRow.paid_count ?? 0),
        unlockedCount: Number(genRow.unlocked_count ?? 0),
      });
    }

    // Course registration gate check when querying a specific course folder
    if (rawCourseId && rawCourseId !== 'general') {
      if (!registeredCourseIds.has(rawCourseId)) {
        const targetCourse = courseSummaries.find((c) => c.courseId === rawCourseId) || null;
        res.json({
          courseLocked: true,
          courseRegistrationRequired: true,
          lockedCourse: targetCourse,
          materials: [],
          courseSummaries,
        });
        return;
      }
    }

    const conditions = [
      eq(studyMaterials.isActive, true),
      sql`COALESCE(${studyMaterials.publicationStatus}, 'published') = 'published'`,
    ];
    if (category) {
      conditions.push(eq(studyMaterials.category, category));
    }
    if (rawCourseId === 'general') {
      conditions.push(isNull(studyMaterials.courseId));
    } else if (rawCourseId) {
      conditions.push(eq(studyMaterials.courseId, rawCourseId));
    } else if (registeredCourseIds.size > 0) {
      const allowedCourseIds = Array.from(registeredCourseIds);
      const courseCond = or(
        isNull(studyMaterials.courseId),
        inArray(studyMaterials.courseId, allowedCourseIds)
      );
      if (courseCond) {
        conditions.push(courseCond);
      }
    } else {
      conditions.push(isNull(studyMaterials.courseId));
    }

    const rows = await db
      .select({
        id: studyMaterials.id,
        courseId: studyMaterials.courseId,
        courseTitle: courses.title,
        courseCode: courses.code,
        courseLevel: courses.level,
        courseFaculty: courses.faculty,
        courseDepartment: courses.department,
        courseSemester: courses.semester,
        faculty: studyMaterials.faculty,
        department: studyMaterials.department,
        academicLevel: studyMaterials.academicLevel,
        semester: studyMaterials.semester,
        title: studyMaterials.title,
        description: studyMaterials.description,
        category: studyMaterials.category,
        fileType: studyMaterials.fileType,
        fileSizeBytes: studyMaterials.fileSizeBytes,
        mimeType: studyMaterials.mimeType,
        price: studyMaterials.price,
        currency: studyMaterials.currency,
        publicationStatus: studyMaterials.publicationStatus,
        downloadCount: studyMaterials.downloadCount,
        createdAt: studyMaterials.createdAt,
      })
      .from(studyMaterials)
      .leftJoin(courses, eq(studyMaterials.courseId, courses.id))
      .where(and(...conditions))
      .orderBy(desc(studyMaterials.createdAt));

    const purchasedSet = new Set<string>();
    const pendingRefMap = new Map<string, string>();

    if (req.user && rows.length > 0) {
      const materialIds = rows.map((r) => r.id);
      const purchaseRows = await db
        .select({
          materialId: studyMaterialPurchases.materialId,
          paymentStatus: studyMaterialPurchases.paymentStatus,
          paymentReference: studyMaterialPurchases.paymentReference,
        })
        .from(studyMaterialPurchases)
        .where(
          and(
            eq(studyMaterialPurchases.studentId, req.user.id),
            inArray(studyMaterialPurchases.materialId, materialIds)
          )
        )
        .orderBy(desc(studyMaterialPurchases.createdAt));

      for (const p of purchaseRows) {
        if (p.paymentStatus === 'successful') {
          purchasedSet.add(p.materialId);
        } else if (p.paymentStatus === 'pending' && !pendingRefMap.has(p.materialId)) {
          pendingRefMap.set(p.materialId, p.paymentReference);
        }
      }
    }

    const materials = rows.map((r) => {
      const priceNum = Number(r.price ?? 0);
      const isFree = priceNum <= 0;
      const isPurchased = isFree ? true : purchasedSet.has(r.id);
      const pendingRef = !isFree && !isPurchased ? (pendingRefMap.get(r.id) ?? null) : null;
      const purchaseStatus: 'free' | 'payment_required' | 'pending' | 'purchased' = isFree
        ? 'free'
        : isPurchased
          ? 'purchased'
          : pendingRef
            ? 'pending'
            : 'payment_required';

      return {
        id: r.id,
        courseId: r.courseId,
        courseTitle: r.courseTitle,
        courseCode: r.courseCode,
        courseLevel: r.courseLevel,
        faculty: r.faculty || r.courseFaculty || 'General',
        department: r.department || r.courseDepartment || 'General',
        academicLevel: r.academicLevel || r.courseLevel || '100 Level',
        semester: r.semester || r.courseSemester || 'First Semester',
        title: r.title,
        description: r.description,
        category: r.category,
        fileType: r.fileType,
        fileSizeBytes: r.fileSizeBytes,
        mimeType: r.mimeType,
        price: priceNum,
        currency: r.currency || 'NGN',
        publicationStatus: (r.publicationStatus === 'unpublished' ? 'unpublished' : 'published') as
          | 'published'
          | 'unpublished',
        isFree,
        isPurchased,
        purchaseStatus,
        pendingPaymentReference: pendingRef,
        downloadCount: r.downloadCount,
        createdAt: r.createdAt,
      };
    });

    res.json({
      courseLocked: false,
      courseRegistrationRequired: false,
      materials,
      courseSummaries,
    });
  } catch (err) {
    handleApiError(res, err, 'fetching study materials');
  }
});

router.get('/my-purchases', requireAuth, async (req, res) => {
  try {
    const pool = getPool();
    const studentId = req.user!.id;
    const registeredIds = await getStudentRegisteredCourseIds(studentId);

    const rows = await pool.query<{
      id: string;
      materialId: string;
      materialTitle: string;
      category: string;
      fileType: string;
      fileSizeBytes: number;
      materialIsActive: boolean;
      materialPublicationStatus: string;
      courseId: string | null;
      courseCode: string | null;
      courseTitle: string | null;
      amount: string;
      currency: string;
      paymentReference: string;
      paymentStatus: 'pending' | 'successful' | 'failed' | 'refunded';
      paymentChannel: string | null;
      paidAt: Date | null;
      createdAt: Date;
    }>(
      `SELECT
         smp.id,
         smp.material_id AS "materialId",
         sm.title AS "materialTitle",
         sm.category,
         sm.file_type AS "fileType",
         sm.file_size_bytes AS "fileSizeBytes",
         sm.is_active AS "materialIsActive",
         COALESCE(sm.publication_status, 'published') AS "materialPublicationStatus",
         COALESCE(smp.course_id, sm.course_id) AS "courseId",
         c.code AS "courseCode",
         c.title AS "courseTitle",
         smp.amount::text AS amount,
         smp.currency,
         smp.payment_reference AS "paymentReference",
         smp.payment_status AS "paymentStatus",
         smp.payment_channel AS "paymentChannel",
         smp.paid_at AS "paidAt",
         smp.created_at AS "createdAt"
       FROM study_material_purchases smp
       INNER JOIN study_materials sm ON sm.id = smp.material_id
       LEFT JOIN courses c ON c.id = COALESCE(smp.course_id, sm.course_id)
       WHERE smp.student_id = $1
       ORDER BY smp.created_at DESC`,
      [studentId]
    );

    res.json({
      purchases: rows.rows.map((r) => {
        const isCourseRegistered = r.courseId ? registeredIds.has(r.courseId) : true;
        const isMaterialPublished =
          r.materialIsActive && r.materialPublicationStatus === 'published';
        const canDownload =
          r.paymentStatus === 'successful' && isMaterialPublished && isCourseRegistered;

        return {
          ...r,
          amount: Number(r.amount ?? 0),
          isCourseRegistered,
          isMaterialPublished,
          canDownload,
        };
      }),
    });
  } catch (err) {
    handleApiError(res, err, 'fetching study material purchases');
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
        courseId: studyMaterials.courseId,
        courseCode: courses.code,
        title: studyMaterials.title,
        fileType: studyMaterials.fileType,
        price: studyMaterials.price,
        currency: studyMaterials.currency,
        publicationStatus: studyMaterials.publicationStatus,
        storageBackend: studyMaterials.storageBackend,
        objectKey: studyMaterials.objectKey,
        originalFilename: studyMaterials.originalFilename,
        hasFileData: sql<boolean>`(${studyMaterials.fileData} IS NOT NULL)`,
      })
      .from(studyMaterials)
      .leftJoin(courses, eq(studyMaterials.courseId, courses.id))
      .where(and(eq(studyMaterials.id, id), eq(studyMaterials.isActive, true)))
      .limit(1);

    if (!material) {
      res.status(404).json({ error: 'Study material not found.' });
      return;
    }

    if (material.publicationStatus !== 'published') {
      res.status(404).json({
        error: 'This study material is currently unpublished and unavailable for download.',
        code: 'MATERIAL_UNPUBLISHED',
      });
      return;
    }

    // 1. Mandatory Course Registration Gate
    if (material.courseId) {
      const registered = await isStudentRegisteredForCourse(req.user!.id, material.courseId);
      if (!registered) {
        res.status(403).json({
          error: `You need to register for ${material.courseCode || 'this course'} before accessing its study materials.`,
          code: 'COURSE_REGISTRATION_REQUIRED',
          courseId: material.courseId,
          courseCode: material.courseCode,
        });
        return;
      }
    }

    // 2. Mandatory Individual Study Material Payment Gate
    const priceNum = Number(material.price ?? 0);
    let verifiedPurchaseId: string | null = null;
    if (priceNum > 0) {
      verifiedPurchaseId = await getSuccessfulMaterialPurchaseId(req.user!.id, material.id);
      if (!verifiedPurchaseId) {
        res.status(402).json({
          error: `Please complete Paystack payment of ₦${priceNum.toLocaleString()} to unlock and download "${material.title}".`,
          code: 'MATERIAL_PAYMENT_REQUIRED',
          materialId: material.id,
          price: priceNum,
          currency: material.currency || 'NGN',
        });
        return;
      }
    }

    if (!material.hasFileData && material.storageBackend !== 's3') {
      res.status(404).json({ error: 'Study material file content is missing.' });
      return;
    }

    const downloadFilename = resolveMaterialDownloadFilename(material);
    const token = signMaterialDownloadToken(material.id, downloadFilename, {
      isAdmin: false,
      userId: req.user!.id,
    });
    const downloadUrl = `/api/materials/${encodeURIComponent(material.id)}/file?token=${encodeURIComponent(token)}`;

    await recordMaterialDownloadAuthorization({
      studentId: req.user!.id,
      materialId: material.id,
      courseId: material.courseId,
      purchaseId: verifiedPurchaseId,
      isFreeDownload: priceNum <= 0,
      paymentStatusSnapshot: priceNum <= 0 ? 'free' : 'successful',
      ipAddress: req.ip,
    });

    res.json({
      downloadUrl,
      filename: downloadFilename,
    });
  } catch (err) {
    handleApiError(res, err, 'generating material download URL');
  }
});

router.get('/:id/file', requireDb, requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const rawToken = typeof req.query.token === 'string' ? req.query.token.trim() : '';
    const verified = rawToken ? verifyMaterialDownloadToken(rawToken, id) : null;
    if (!verified) {
      res.status(401).json({
        error: 'Invalid or expired download authorization token. Please click Download again.',
      });
      return;
    }

    // Strictly prevent one student from using another student's copied download URL
    if (!verified.userId || verified.userId !== req.user!.id) {
      res.status(403).json({
        error: 'This download authorization belongs to another student account.',
        code: 'DOWNLOAD_OWNERSHIP_MISMATCH',
      });
      return;
    }

    const db = getDb();
    const [material] = await db
      .select({
        id: studyMaterials.id,
        courseId: studyMaterials.courseId,
        courseCode: courses.code,
        title: studyMaterials.title,
        fileType: studyMaterials.fileType,
        price: studyMaterials.price,
        currency: studyMaterials.currency,
        publicationStatus: studyMaterials.publicationStatus,
        storageBackend: studyMaterials.storageBackend,
        objectKey: studyMaterials.objectKey,
        originalFilename: studyMaterials.originalFilename,
        fileData: studyMaterials.fileData,
        mimeType: studyMaterials.mimeType,
      })
      .from(studyMaterials)
      .leftJoin(courses, eq(studyMaterials.courseId, courses.id))
      .where(and(eq(studyMaterials.id, id), eq(studyMaterials.isActive, true)))
      .limit(1);

    if (!material || material.publicationStatus !== 'published') {
      res.status(404).json({ error: 'Study material not found or unavailable.' });
      return;
    }

    // Re-verify active course registration in database before streaming file bytes
    if (material.courseId) {
      const registered = await isStudentRegisteredForCourse(req.user!.id, material.courseId);
      if (!registered) {
        res.status(403).json({
          error: `Active registration for ${material.courseCode || 'this course'} is required to download this study material.`,
          code: 'COURSE_REGISTRATION_REQUIRED',
        });
        return;
      }
    }

    // Re-verify verified Paystack purchase in database before streaming paid PDF bytes
    const priceNum = Number(material.price ?? 0);
    if (priceNum > 0) {
      const purchaseId = await getSuccessfulMaterialPurchaseId(req.user!.id, material.id);
      if (!purchaseId) {
        res.status(402).json({
          error: `Payment verification required before downloading "${material.title}".`,
          code: 'MATERIAL_PAYMENT_REQUIRED',
        });
        return;
      }
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
