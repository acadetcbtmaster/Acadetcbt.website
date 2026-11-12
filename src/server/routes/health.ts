import { Router } from 'express';
import { checkDatabaseHealth } from '../../db/index.js';
import { isObjectStorageConfigured } from '../lib/objectStorage.js';

const router = Router();

router.get('/', async (_req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const objectStorageConfigured = isObjectStorageConfigured();

  const statusCode = dbHealth.configured && !dbHealth.connected ? 503 : 200;

  res.status(statusCode).json({
    status: statusCode === 200 ? 'ok' : 'degraded',
    service: 'acadet-cbt-api',
    timestamp: new Date().toISOString(),
    database: dbHealth,
    objectStorage: {
      configured: objectStorageConfigured,
    },
  });
});

export default router;
