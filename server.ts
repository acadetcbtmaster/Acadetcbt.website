import 'dotenv/config';
import cookieParser from 'cookie-parser';
import express from 'express';
import helmet from 'helmet';
import fs from 'node:fs/promises';
import path from 'node:path';
import { closePool, isDatabaseConfigured } from './src/db/index.js';
import { runMigrations } from './src/db/migrate.js';
import { seedDatabaseIfEmpty } from './src/db/seed.js';
import {
  getPublicBrandingAndFounder,
  getSeoMetaForPath,
  injectSeoIntoHtml,
  resolveBaseUrl,
} from './src/server/lib/branding.js';
import adminRoutes from './src/server/routes/admin.js';
import authRoutes from './src/server/routes/auth.js';
import catalogRoutes from './src/server/routes/catalog.js';
import examRoutes from './src/server/routes/exams.js';
import healthRoutes from './src/server/routes/health.js';
import materialRoutes from './src/server/routes/materials.js';
import notificationRoutes from './src/server/routes/notifications.js';
import paymentRoutes from './src/server/routes/payments.js';
import publicRoutes from './src/server/routes/public.js';
import resultRoutes from './src/server/routes/results.js';
import webhookRoutes from './src/server/routes/webhooks.js';

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

  // Paystack webhook requires raw bytes for HMAC-SHA512 signature verification
  app.use('/api/webhooks', express.raw({ type: 'application/json' }), webhookRoutes);

  app.use(express.json({ limit: '5mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(cookieParser());

  // API Routes
  app.use('/api/public', publicRoutes);
  app.use('/api/health', healthRoutes);
  app.use('/api/auth', authRoutes);
  app.use('/api/catalog', catalogRoutes);
  app.use('/api/payments', paymentRoutes);
  app.use('/api/exams', examRoutes);
  app.use('/api/results', resultRoutes);
  app.use('/api/materials', materialRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/admin', adminRoutes);

  // Unknown API routes always return structured JSON 404
  app.use('/api', (_req, res) => {
    res.status(404).json({ error: 'API endpoint not found.' });
  });

  // Search Engine Discovery: Dynamic robots.txt & sitemap.xml matched to active domain
  app.get('/robots.txt', (req, res) => {
    const baseUrl = resolveBaseUrl(req);
    const body = [
      'User-agent: *',
      'Allow: /',
      'Allow: /about',
      'Allow: /courses',
      'Allow: /how-it-works',
      'Allow: /contact',
      'Allow: /founder',
      'Allow: /acadet-logo.png',
      'Allow: /favicon.ico',
      'Allow: /favicon-48x48.png',
      'Allow: /favicon-96x96.png',
      'Allow: /favicon-192x192.png',
      'Allow: /favicon-512x512.png',
      'Allow: /apple-touch-icon.png',
      'Allow: /logo.png',
      'Allow: /api/public/assets/',
      'Disallow: /api/',
      'Disallow: /admin',
      'Disallow: /dashboard',
      'Disallow: /exam',
      'Disallow: /results',
      'Disallow: /payments',
      'Disallow: /notifications',
      'Disallow: /materials',
      '',
      'User-agent: Googlebot',
      'Allow: /',
      'Allow: /about',
      'Allow: /courses',
      'Allow: /how-it-works',
      'Allow: /contact',
      'Allow: /founder',
      'Allow: /api/public/assets/',
      'Disallow: /admin',
      'Disallow: /dashboard',
      'Disallow: /exam',
      'Disallow: /results',
      'Disallow: /payments',
      '',
      'User-agent: Googlebot-Image',
      'Allow: /acadet-logo.png',
      'Allow: /favicon-48x48.png',
      'Allow: /favicon-192x192.png',
      'Allow: /favicon-512x512.png',
      'Allow: /apple-touch-icon.png',
      'Allow: /api/public/assets/',
      '',
      `Sitemap: ${baseUrl}/sitemap.xml`,
    ].join('\n');
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(body);
  });

  app.get('/sitemap.xml', async (req, res) => {
    const baseUrl = resolveBaseUrl(req);
    const lastMod = new Date().toISOString().slice(0, 10);
    const urls = [
      { loc: `${baseUrl}/`, changefreq: 'daily', priority: '1.0' },
      { loc: `${baseUrl}/courses`, changefreq: 'daily', priority: '0.9' },
      { loc: `${baseUrl}/about`, changefreq: 'weekly', priority: '0.85' },
      { loc: `${baseUrl}/how-it-works`, changefreq: 'weekly', priority: '0.85' },
      { loc: `${baseUrl}/founder`, changefreq: 'weekly', priority: '0.9' },
      { loc: `${baseUrl}/contact`, changefreq: 'monthly', priority: '0.75' },
    ];

    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls
      .map(
        (u) =>
          `  <url>\n    <loc>${u.loc}</loc>\n    <lastmod>${lastMod}</lastmod>\n    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`
      )
      .join('\n')}\n</urlset>\n`;

    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    res.status(200).send(xml);
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
    app.get('*', async (req, res) => {
      const indexHtmlPath = path.join(distDir, 'index.html');
      try {
        const [htmlTemplate, { branding, founder }] = await Promise.all([
          fs.readFile(indexHtmlPath, 'utf-8'),
          getPublicBrandingAndFounder(),
        ]);
        const baseUrl = resolveBaseUrl(req);
        const seoMeta = getSeoMetaForPath(req.path, baseUrl, branding, founder);
        const html = injectSeoIntoHtml(htmlTemplate, seoMeta);
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
