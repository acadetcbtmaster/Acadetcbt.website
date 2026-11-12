import { Router } from 'express';
import { checkDatabaseHealth } from '../../db/index.js';
import { isObjectStorageConfigured } from '../lib/objectStorage.js';
import { isPaystackConfigured } from '../lib/paystack.js';

const router = Router();

router.get('/', async (_req, res) => {
  const dbHealth = await checkDatabaseHealth();
  const objectStorageConfigured = isObjectStorageConfigured();
  const paystackConfigured = isPaystackConfigured();
  const status = dbHealth.configured && !dbHealth.connected ? 'degraded' : 'ok';

  res.status(200).json({
    status,
    service: 'acadet-cbt-api',
    timestamp: new Date().toISOString(),
    database: dbHealth,
    objectStorage: {
      configured: objectStorageConfigured,
    },
    paystack: {
      configured: paystackConfigured,
    },
  });
});

export default router;
