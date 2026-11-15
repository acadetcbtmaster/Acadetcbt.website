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
  classifyPathStatus,
  getPublicBrandingAndFounder,
  getSeoMetaForPath,
  injectSeoIntoHtml,
  normalizeAppPath,
  resolveBaseUrl,
} from './src/server/lib/branding.js';
import { validateSmtpStartup } from './src/server/lib/email.js';
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

const STATIC_ASSET_EXT_RE =
  /\.(?:js|mjs|cjs|css|map|png|jpg|jpeg|webp|gif|svg|ico|woff|woff2|ttf|eot|json|xml|txt|pdf|doc|docx)$/i;

function decodeLegacySpaQueryRoute(originalUrl: string): string | null {
  const qIndex = originalUrl.indexOf('?/');
  if (qIndex === -1) return null;
  const rawAfter = originalUrl.slice(qIndex + 2);
  const hashIndex = rawAfter.indexOf('#');
  const withoutHash = hashIndex === -1 ? rawAfter : rawAfter.slice(0, hashIndex);
  const ampIndex = withoutHash.indexOf('&');
  const routeSegment = ampIndex === -1 ? withoutHash : withoutHash.slice(0, ampIndex);
  const decodedRoute = decodeURIComponent(routeSegment.replace(/~and~/g, '&'));
  return normalizeAppPath(`/${decodedRoute}`);
}

export async function createApp(options?: { skipVite?: boolean }) {
  validateSmtpStartup();
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

  // Single-hop HTTPS & canonical non-www redirect for public requests behind reverse proxy
  app.use((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      next();
      return;
    }
    if (req.path.startsWith('/api/')) {
      next();
      return;
    }
    const rawHost = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    const hostname = rawHost.split(':')[0].toLowerCase();
    if (
      !hostname ||
      hostname === 'localhost' ||
      hostname === '127.0.0.1' ||
      hostname === '::1' ||
      hostname === '[::1]'
    ) {
      next();
      return;
    }

    const protoHeader = (req.get('x-forwarded-proto') || '').split(',')[0].trim().toLowerCase();
    const needsHttpsRedirect = protoHeader === 'http';
    const isWwwAcadet = hostname === 'www.acadetcbt.website';

    if (needsHttpsRedirect || isWwwAcadet) {
      const targetHost = isWwwAcadet ? 'acadetcbt.website' : rawHost;
      res.redirect(301, `https://${targetHost}${req.originalUrl}`);
      return;
    }
    next();
  });

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

  // Search Engine Discovery: Dynamic robots.txt & sitemap.xml matched strictly to authoritative canonical URL
  app.get('/robots.txt', (req, res) => {
    const baseUrl = resolveBaseUrl(req);
    const body = [
      'User-agent: *',
      'Allow: /',
      'Allow: /courses',
      'Allow: /about',
      'Allow: /how-it-works',
      'Allow: /founder',
      'Allow: /faq',
      'Allow: /contact',
      'Allow: /privacy',
      'Allow: /terms',
      'Allow: /acadet-logo.png',
      'Allow: /favicon.ico',
      'Allow: /favicon.png',
      'Allow: /favicon-16x16.png',
      'Allow: /favicon-32x32.png',
      'Allow: /favicon-48x48.png',
      'Allow: /favicon-96x96.png',
      'Allow: /favicon-192x192.png',
      'Allow: /favicon-512x512.png',
      'Allow: /apple-touch-icon.png',
      'Allow: /logo.png',
      'Allow: /manifest.json',
      'Allow: /api/public/assets/logo',
      'Allow: /api/public/assets/favicon',
      'Disallow: /api/',
      'Disallow: /admin',
      'Disallow: /dashboard',
      'Disallow: /exam',
      'Disallow: /results',
      'Disallow: /payments',
      'Disallow: /notifications',
      'Disallow: /materials',
      'Disallow: /forgot-password',
      'Disallow: /reset-password',
      'Disallow: /verify-email',
      'Disallow: /404.html',
      '',
      'User-agent: Googlebot',
      'Allow: /',
      'Allow: /courses',
      'Allow: /about',
      'Allow: /how-it-works',
      'Allow: /founder',
      'Allow: /faq',
      'Allow: /contact',
      'Allow: /privacy',
      'Allow: /terms',
      'Allow: /acadet-logo.png',
      'Allow: /favicon.ico',
      'Allow: /favicon.png',
      'Allow: /favicon-16x16.png',
      'Allow: /favicon-32x32.png',
      'Allow: /favicon-48x48.png',
      'Allow: /favicon-96x96.png',
      'Allow: /favicon-192x192.png',
      'Allow: /favicon-512x512.png',
      'Allow: /apple-touch-icon.png',
      'Allow: /logo.png',
      'Allow: /manifest.json',
      'Allow: /api/public/assets/logo',
      'Allow: /api/public/assets/favicon',
      'Disallow: /api/',
      'Disallow: /admin',
      'Disallow: /dashboard',
      'Disallow: /exam',
      'Disallow: /results',
      'Disallow: /payments',
      'Disallow: /notifications',
      'Disallow: /materials',
      'Disallow: /forgot-password',
      'Disallow: /reset-password',
      'Disallow: /verify-email',
      'Disallow: /404.html',
      '',
      'User-agent: Googlebot-Image',
      'Allow: /acadet-logo.png',
      'Allow: /favicon.ico',
      'Allow: /favicon.png',
      'Allow: /favicon-16x16.png',
      'Allow: /favicon-32x32.png',
      'Allow: /favicon-48x48.png',
      'Allow: /favicon-96x96.png',
      'Allow: /favicon-192x192.png',
      'Allow: /favicon-512x512.png',
      'Allow: /apple-touch-icon.png',
      'Allow: /logo.png',
      'Allow: /api/public/assets/logo',
      'Allow: /api/public/assets/favicon',
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
      { loc: `${baseUrl}/faq`, changefreq: 'weekly', priority: '0.85' },
      { loc: `${baseUrl}/contact`, changefreq: 'monthly', priority: '0.75' },
      { loc: `${baseUrl}/privacy`, changefreq: 'monthly', priority: '0.5' },
      { loc: `${baseUrl}/terms`, changefreq: 'monthly', priority: '0.5' },
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

  // Never serve legacy /404.html JS redirect with 200 OK; return proper 404 + noindex
  app.get('/404.html', async (req, res) => {
    res.setHeader('X-Robots-Tag', 'noindex, nofollow');
    res.setHeader('Cache-Control', 'no-store');
    try {
      const static404Path = path.resolve(process.cwd(), 'public', '404.html');
      const html = await fs.readFile(static404Path, 'utf-8');
      res.status(404).type('html').send(html);
    } catch {
      res.status(404).type('html').send('<!doctype html><html><head><meta name="robots" content="noindex, nofollow"><title>404 Not Found</title></head><body><h1>404 - Page Not Found</h1><p><a href="/">Return to Acadet CBT Home</a></p></body></html>');
    }
  });

  // Canonicalize /index.html -> / so crawlers never see duplicate root HTML
  app.get('/index.html', (req, res) => {
    const queryIdx = req.originalUrl.indexOf('?');
    const suffix = queryIdx !== -1 ? req.originalUrl.slice(queryIdx) : '';
    res.redirect(301, `/${suffix}`);
  });

  const isProd = process.env.NODE_ENV === 'production';

  if (!isProd && !options?.skipVite) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(
      express.static(distDir, {
        maxAge: '1h',
        index: false,
        setHeaders(res, filePath) {
          if (filePath.includes(`${path.sep}assets${path.sep}`)) {
            res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
          } else if (/\.(?:png|jpg|jpeg|webp|gif|svg|ico)$/i.test(filePath)) {
            res.setHeader('Cache-Control', 'public, max-age=86400, stale-while-revalidate=604800');
          }
        },
      })
    );

    app.get('*', async (req, res) => {
      // Handle legacy GitHub Pages ?/path query format cleanly without hiding true 404s
      let effectivePath = req.path;
      if (req.path === '/' && req.originalUrl.startsWith('/?/')) {
        const decodedRoute = decodeLegacySpaQueryRoute(req.originalUrl);
        if (decodedRoute && classifyPathStatus(decodedRoute) !== 'not_found') {
          res.redirect(301, decodedRoute);
          return;
        }
        effectivePath = decodedRoute || '/404';
      }

      // Missing static files (/assets/*.js, missing images, etc.) must return true 404, not index.html
      if (effectivePath.startsWith('/assets/') || STATIC_ASSET_EXT_RE.test(effectivePath)) {
        res.setHeader('Cache-Control', 'no-store');
        res.setHeader('X-Robots-Tag', 'noindex, nofollow');
        res.status(404).type('text/plain').send('Asset not found.');
        return;
      }

      // Normalize trailing slash on known routes (e.g., /about/ -> /about) via clean single-hop 301
      if (effectivePath.length > 1 && effectivePath.endsWith('/')) {
        const cleanPath = normalizeAppPath(effectivePath);
        if (classifyPathStatus(cleanPath) !== 'not_found') {
          const queryIdx = req.originalUrl.indexOf('?');
          const suffix = queryIdx !== -1 ? req.originalUrl.slice(queryIdx) : '';
          res.redirect(301, `${cleanPath}${suffix}`);
          return;
        }
      }

      const routeStatus = classifyPathStatus(effectivePath);
      const distIndexPath = path.join(distDir, 'index.html');
      const rootIndexPath = path.resolve(process.cwd(), 'index.html');

      try {
        const [htmlTemplate, { branding, founder }] = await Promise.all([
          fs.readFile(distIndexPath, 'utf-8').catch(() => fs.readFile(rootIndexPath, 'utf-8')),
          getPublicBrandingAndFounder(),
        ]);
        const baseUrl = resolveBaseUrl(req);
        const seoMeta = getSeoMetaForPath(effectivePath, baseUrl, branding, founder);
        const html = injectSeoIntoHtml(htmlTemplate, seoMeta);

        if (routeStatus === 'not_found') {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
          res.setHeader('Cache-Control', 'no-store');
          res.status(404).type('html').send(html);
          return;
        }

        if (routeStatus === 'private') {
          res.setHeader('X-Robots-Tag', 'noindex, nofollow');
          res.setHeader('Cache-Control', 'no-store');
        } else {
          res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        }

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
