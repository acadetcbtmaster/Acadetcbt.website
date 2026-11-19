import { Router } from 'express';
import fs from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import {
  getPublicBrandingAndFounder,
  getPublicPublishedCourses,
} from '../lib/branding.js';
import {
  getObjectBuffer,
  ObjectStorageNotConfiguredError,
} from '../lib/objectStorage.js';
import { getQuestionImageBinary } from '../lib/questionImages.js';
import { handleApiError } from '../middleware/auth.js';

const router = Router();

// Strictly public catalogue, site branding, and founder profile (never returns student/payment/answer data)
router.get('/site-data', async (_req, res) => {
  try {
    const [{ branding, founder }, courses] = await Promise.all([
      getPublicBrandingAndFounder(),
      getPublicPublishedCourses(),
    ]);

    res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
    res.json({
      branding,
      founder,
      courses,
    });
  } catch (err) {
    handleApiError(res, err, 'fetching public site data');
  }
});

// Serves binary question images by unguessable UUID for both Student CBT Hall and Admin Draft Review
router.get('/question-images/:imageId', async (req, res) => {
  const parsedId = z.string().uuid().safeParse(req.params.imageId);
  if (!parsedId.success) {
    res.status(404).json({ error: 'Question image not found.' });
    return;
  }

  try {
    const img = await getQuestionImageBinary(parsedId.data);
    if (!img) {
      res.status(404).json({ error: 'Question image not found.' });
      return;
    }

    res.setHeader('Content-Type', img.mimeType);
    res.setHeader('Content-Length', String(img.buffer.length));
    res.setHeader('Content-Disposition', `inline; filename="${img.fileName}"`);
    res.setHeader('Cache-Control', 'private, max-age=3600');
    res.send(img.buffer);
  } catch (err) {
    handleApiError(res, err, 'serving question image');
  }
});

// Public asset stream for Super Admin uploaded branding & founder images stored in Object Storage
router.get('/assets/:slot', async (req, res) => {
  const slot = req.params.slot;
  if (slot !== 'logo' && slot !== 'favicon' && slot !== 'founder-photo') {
    res.status(404).json({ error: 'Branding asset slot not found.' });
    return;
  }

  try {
    const state = await getPublicBrandingAndFounder();
    const objectKey =
      slot === 'logo'
        ? state.logoObjectKey
        : slot === 'favicon'
          ? state.faviconObjectKey
          : state.founderPhotoObjectKey;

    if (objectKey) {
      try {
        const { buffer, contentType } = await getObjectBuffer(objectKey);
        if (buffer.length > 0) {
          res.setHeader('Content-Type', contentType);
          res.setHeader('Cache-Control', 'public, max-age=3600');
          res.send(buffer);
          return;
        }
      } catch (storageErr) {
        if (!(storageErr instanceof ObjectStorageNotConfiguredError)) {
          console.warn(`[Public Asset Stream Warning:${slot}]`, storageErr);
        }
      }
    }

    if (slot === 'founder-photo') {
      res.status(404).json({ error: 'Founder photo has not been uploaded yet.' });
      return;
    }

    const fallbackFile = slot === 'logo' ? 'acadet-logo.png' : 'favicon-48x48.png';
    const candidatePaths = [
      path.resolve(process.cwd(), 'dist', fallbackFile),
      path.resolve(process.cwd(), 'public', fallbackFile),
    ];

    for (const filePath of candidatePaths) {
      try {
        const bytes = await fs.readFile(filePath);
        res.setHeader('Content-Type', 'image/png');
        res.setHeader('Cache-Control', 'public, max-age=3600');
        res.send(bytes);
        return;
      } catch {
        // Try next candidate
      }
    }

    res.status(404).json({ error: 'Default branding asset not found.' });
  } catch (err) {
    handleApiError(res, err, 'serving public branding asset');
  }
});

export default router;
