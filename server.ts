import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closePool, isDatabaseConfigured } from './src/db/index.js';
import { runMigrations } from './src/db/migrate.js';
import { seedDatabaseIfEmpty } from './src/db/seed.js';
import adminRoutes from './src/server/routes/admin.js';
import authRoutes from './src/server/routes/auth.js';
import catalogRoutes from './src/server/routes/catalog.js';
import examRoutes from './src/server/routes/exams.js';
import healthRoutes from './src/server/routes/health.js';
import materialRoutes from './src/server/routes/materials.js';
import resultRoutes from './src/server/routes/results.js';

export async function createApp(options?: { skipVite?: boolean }) {
  const app = express();
  app.set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: false,
      crossOriginEmbedderPolicy: false,
      frameguard: false,
    })
  );
  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // API Routes
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/results', resultRoutes);
  app.use('/api/materials', materialRoutes);
  app.use('/api/admin', adminRoutes);

  // Unknown API routes always return structured JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd && !options?.skipVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (isProd) {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        index: false,
      })
    );
    app.get('*', async (_req, res) => {
      const indexHtmlPath = path.join(distDir, 'index.html');
      try {
        const html = await fs.readFile(indexHtmlPath, 'utf-8');
        res.status(200).type('html').send(html);
      } catch {
        res.status(500).send('Application build artifacts missing. Run npm run build.');
      }
    });
  }

  return app;
}

async function bootstrap() {
  const port = Number(process.env.PORT || 3000);
  const app = await createApp();

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`[Acadet CBT] Server listening on http://0.0.0.0:${port}`);

    if (isDatabaseConfigured()) {
      void (async () => {
        try {
          const migrationResult = await runMigrations();
          console.log(
            `[Acadet CBT] PostgreSQL migrations ready (applied: ${migrationResult.applied.length}, skipped: ${migrationResult.skipped.length})`
          );
          await seedDatabaseIfEmpty();
        } catch (err) {
          console.error('[Acadet CBT] PostgreSQL startup initialization warning:', err);
        }
      })();
    } else {
      console.warn(
        '[Acadet CBT] DATABASE_URL is not configured. Database-backed endpoints will return 503 until DATABASE_URL is set.'
      );
    }
  });

  const shutdown = async () => {
    console.log('[Acadet CBT] Gracefully shutting down...');
    server.close(async () => {
      await closePool();
      process.exit(0);
    });
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

const entryArg = process.argv[1] ? path.resolve(process.argv[1]) : '';
const isDirectEntry =
  (typeof require !== 'undefined' && typeof module !== 'undefined' && require.main === module) ||
  entryArg.endsWith(`${path.sep}server.ts`) ||
  entryArg.endsWith(`${path.sep}server.cjs`);

if (isDirectEntry) {
  bootstrap().catch((err) => {
    console.error('[Acadet CBT] Fatal bootstrap error:', err);
    process.exit(1);
  });
}
