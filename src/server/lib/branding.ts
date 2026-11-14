import { getPool, isDatabaseConfigured } from '../../db/index.js';
import type { SocialLinksMap } from '../../db/schema.js';
import { COURSE_VALUE_NAIRA, STANDARD_CURRENCY, TOTAL_STUDENT_PAYABLE_NAIRA } from './pricing.js';

export interface SiteBrandingData {
  siteName: string;
  tagline: string;
  siteDescription: string;
  seoTitle: string;
  seoDescription: string;
  seoKeywords: string;
  logoUrl: string;
  faviconUrl: string;
  contactEmail: string;
  contactPhone: string | null;
  contactWhatsapp: string | null;
  socialLinks: SocialLinksMap;
  updatedAt: string;
}

export interface FounderProfileData {
  fullName: string;
  positionTitle: string;
  biography: string;
  founderMessage: string;
  visionStatement: string;
  missionStatement: string;
  backgroundStory: string;
  photoUrl: string | null;
  socialLinks: SocialLinksMap;
  updatedAt: string;
}

export interface PublicCourseSummary {
  id: string;
  code: string;
  title: string;
  level: string;
  description: string;
  courseValue: number;
  registrationFee: number;
  currency: string;
  examCategory: string;
  defaultDurationMinutes: number;
  questionCount: number;
}

export const DEFAULT_SITE_BRANDING: SiteBrandingData = {
  siteName: 'Acadet CBT',
  tagline: '...Learn, Practice, Excel',
  siteDescription:
    'Acadet CBT is an online computer-based testing and academic preparation platform helping students study course materials, practise examination questions, and track performance.',
  seoTitle: 'Acadet CBT | Online CBT Practice, Courses & Exam Preparation',
  seoDescription:
    'Acadet CBT and Acadet Learning Hub provide realistic online CBT practice, JAMB CBT practice, structured courses, study materials, and instant performance analytics.',
  seoKeywords:
    'Acadet CBT, Acadet Learning Hub, JAMB CBT Practice, Online CBT Practice, Computer-Based Examination, Online Examination Practice',
  logoUrl: '/acadet-logo.png',
  faviconUrl: '/favicon-48x48.png',
  contactEmail: 'support@acadetcbt.website',
  contactPhone: null,
  contactWhatsapp: null,
  socialLinks: {},
  updatedAt: new Date(0).toISOString(),
};

export const DEFAULT_FOUNDER_PROFILE: FounderProfileData = {
  fullName: 'ISAIAH (MENMEX)',
  positionTitle: 'Founder & Creator, Acadet CBT',
  biography:
    'Isaiah, popularly known as Menmex, is the Founder and Creator of Acadet CBT. He is a digital content creator and technology enthusiast interested in building practical digital solutions and supporting students through accessible educational resources and technology-driven learning.',
  founderMessage:
    'Acadet CBT was established to make learning, examination preparation and academic practice more accessible to students. Our goal is to provide a platform where students can improve their understanding, practise effectively and build confidence in their academic journey.',
  visionStatement:
    'To make structured academic preparation, computer-based testing practice, and accessible study materials available to every student preparing for success.',
  missionStatement:
    "To improve students' understanding of registered courses, provide reliable CBT simulations and educational resources, and build academic confidence through consistent practice and performance insight.",
  backgroundStory:
    'Acadet CBT was created under Acadet Learning Hub to bridge the gap between classroom study and realistic computer-based examination readiness, combining curated courses, study materials, verified assessments, and guided tutorial support.',
  photoUrl: null,
  socialLinks: {},
  updatedAt: new Date(0).toISOString(),
};

export function sanitizePublicUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  if (trimmed.startsWith('/')) {
    return trimmed.startsWith('//') ? null : trimmed;
  }
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function sanitizeSocialLinks(input: unknown): SocialLinksMap {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return {};
  const record = input as Record<string, unknown>;
  const keys: Array<keyof SocialLinksMap> = [
    'facebook',
    'twitter',
    'instagram',
    'youtube',
    'linkedin',
    'whatsapp',
    'tiktok',
    'website',
  ];
  const out: SocialLinksMap = {};
  for (const key of keys) {
    const clean = sanitizePublicUrl(record[key]);
    if (clean) out[key] = clean;
  }
  return out;
}

export async function getPublicBrandingAndFounder(): Promise<{
  branding: SiteBrandingData;
  founder: FounderProfileData;
  logoObjectKey: string | null;
  faviconObjectKey: string | null;
  founderPhotoObjectKey: string | null;
}> {
  if (!isDatabaseConfigured()) {
    return {
      branding: DEFAULT_SITE_BRANDING,
      founder: DEFAULT_FOUNDER_PROFILE,
      logoObjectKey: null,
      faviconObjectKey: null,
      founderPhotoObjectKey: null,
    };
  }

  try {
    const pool = getPool();
    const [bRes, fRes] = await Promise.all([
      pool.query<{
        siteName: string;
        tagline: string;
        siteDescription: string;
        seoTitle: string;
        seoDescription: string;
        seoKeywords: string;
        logoUrl: string;
        logoObjectKey: string | null;
        faviconUrl: string;
        faviconObjectKey: string | null;
        contactEmail: string;
        contactPhone: string | null;
        contactWhatsapp: string | null;
        socialLinks: SocialLinksMap;
        updatedAt: Date;
      }>(
        `SELECT
           site_name AS "siteName",
           tagline,
           site_description AS "siteDescription",
           seo_title AS "seoTitle",
           seo_description AS "seoDescription",
           seo_keywords AS "seoKeywords",
           logo_url AS "logoUrl",
           logo_object_key AS "logoObjectKey",
           favicon_url AS "faviconUrl",
           favicon_object_key AS "faviconObjectKey",
           contact_email AS "contactEmail",
           contact_phone AS "contactPhone",
           contact_whatsapp AS "contactWhatsapp",
           social_links AS "socialLinks",
           updated_at AS "updatedAt"
         FROM site_branding
         WHERE id = 'default'
         LIMIT 1`
      ),
      pool.query<{
        fullName: string;
        positionTitle: string;
        biography: string;
        founderMessage: string;
        visionStatement: string;
        missionStatement: string;
        backgroundStory: string;
        photoUrl: string | null;
        photoObjectKey: string | null;
        socialLinks: SocialLinksMap;
        updatedAt: Date;
      }>(
        `SELECT
           full_name AS "fullName",
           position_title AS "positionTitle",
           biography,
           founder_message AS "founderMessage",
           vision_statement AS "visionStatement",
           mission_statement AS "missionStatement",
           background_story AS "backgroundStory",
           photo_url AS "photoUrl",
           photo_object_key AS "photoObjectKey",
           social_links AS "socialLinks",
           updated_at AS "updatedAt"
         FROM founder_profile
         WHERE id = 'default'
         LIMIT 1`
      ),
    ]);

    const b = bRes.rows[0];
    const f = fRes.rows[0];

    return {
      branding: b
        ? {
            siteName: b.siteName || DEFAULT_SITE_BRANDING.siteName,
            tagline: b.tagline || DEFAULT_SITE_BRANDING.tagline,
            siteDescription: b.siteDescription || DEFAULT_SITE_BRANDING.siteDescription,
            seoTitle: b.seoTitle || DEFAULT_SITE_BRANDING.seoTitle,
            seoDescription: b.seoDescription || DEFAULT_SITE_BRANDING.seoDescription,
            seoKeywords: b.seoKeywords || DEFAULT_SITE_BRANDING.seoKeywords,
            logoUrl: sanitizePublicUrl(b.logoUrl) || DEFAULT_SITE_BRANDING.logoUrl,
            faviconUrl: sanitizePublicUrl(b.faviconUrl) || DEFAULT_SITE_BRANDING.faviconUrl,
            contactEmail: b.contactEmail || DEFAULT_SITE_BRANDING.contactEmail,
            contactPhone: b.contactPhone || null,
            contactWhatsapp: b.contactWhatsapp || null,
            socialLinks: sanitizeSocialLinks(b.socialLinks),
            updatedAt: b.updatedAt ? new Date(b.updatedAt).toISOString() : DEFAULT_SITE_BRANDING.updatedAt,
          }
        : DEFAULT_SITE_BRANDING,
      founder: f
        ? {
            fullName: f.fullName || DEFAULT_FOUNDER_PROFILE.fullName,
            positionTitle: f.positionTitle || DEFAULT_FOUNDER_PROFILE.positionTitle,
            biography: f.biography || DEFAULT_FOUNDER_PROFILE.biography,
            founderMessage: f.founderMessage || DEFAULT_FOUNDER_PROFILE.founderMessage,
            visionStatement: f.visionStatement || DEFAULT_FOUNDER_PROFILE.visionStatement,
            missionStatement: f.missionStatement || DEFAULT_FOUNDER_PROFILE.missionStatement,
            backgroundStory: f.backgroundStory || DEFAULT_FOUNDER_PROFILE.backgroundStory,
            photoUrl: sanitizePublicUrl(f.photoUrl),
            socialLinks: sanitizeSocialLinks(f.socialLinks),
            updatedAt: f.updatedAt ? new Date(f.updatedAt).toISOString() : DEFAULT_FOUNDER_PROFILE.updatedAt,
          }
        : DEFAULT_FOUNDER_PROFILE,
      logoObjectKey: b?.logoObjectKey || null,
      faviconObjectKey: b?.faviconObjectKey || null,
      founderPhotoObjectKey: f?.photoObjectKey || null,
    };
  } catch {
    return {
      branding: DEFAULT_SITE_BRANDING,
      founder: DEFAULT_FOUNDER_PROFILE,
      logoObjectKey: null,
      faviconObjectKey: null,
      founderPhotoObjectKey: null,
    };
  }
}

export async function getPublicPublishedCourses(): Promise<PublicCourseSummary[]> {
  if (!isDatabaseConfigured()) return [];
  try {
    const pool = getPool();
    const result = await pool.query<{
      id: string;
      code: string;
      title: string;
      level: string;
      description: string;
      examCategory: string;
      defaultDurationMinutes: number;
      questionCount: number;
    }>(
      `SELECT
         c.id,
         c.code,
         c.title,
         c.level,
         c.description,
         c.exam_category AS "examCategory",
         c.default_duration_minutes AS "defaultDurationMinutes",
         (
           SELECT COUNT(*)::int FROM questions q
           WHERE (q.course_id = c.id OR (q.course_id IS NULL AND c.subject_id IS NOT NULL AND q.subject_id = c.subject_id))
             AND q.is_active = TRUE
         ) AS "questionCount"
       FROM courses c
       WHERE c.is_active = TRUE AND c.publication_status = 'published'
       ORDER BY c.code ASC`
    );

    return result.rows.map((r) => ({
      ...r,
      courseValue: COURSE_VALUE_NAIRA,
      registrationFee: TOTAL_STUDENT_PAYABLE_NAIRA,
      currency: STANDARD_CURRENCY,
    }));
  } catch {
    return [];
  }
}

export const PUBLIC_INDEXABLE_PATHS = [
  '/',
  '/courses',
  '/about',
  '/how-it-works',
  '/founder',
  '/faq',
  '/contact',
  '/privacy',
  '/terms',
] as const;

export const APP_PRIVATE_PATHS = [
  '/login',
  '/register',
  '/dashboard',
  '/exam',
  '/results',
  '/payments',
  '/notifications',
  '/materials',
  '/admin',
] as const;

const PUBLIC_INDEXABLE_SET = new Set<string>(PUBLIC_INDEXABLE_PATHS);
const APP_PRIVATE_SET = new Set<string>(APP_PRIVATE_PATHS);

export function normalizeAppPath(pathname: string | null | undefined): string {
  const withoutQuery = (pathname || '/').split('?')[0].split('#')[0].trim();
  const collapsed = withoutQuery.replace(/\/+/g, '/');
  if (!collapsed || collapsed === '/') return '/';
  const trimmed = collapsed.replace(/\/+$/, '');
  return trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
}

export function classifyPathStatus(
  pathname: string | null | undefined
): 'public' | 'private' | 'not_found' {
  const norm = normalizeAppPath(pathname);
  if (PUBLIC_INDEXABLE_SET.has(norm)) return 'public';
  if (APP_PRIVATE_SET.has(norm)) return 'private';
  return 'not_found';
}

function isLocalHostname(host: string): boolean {
  const hostname = host.split(':')[0].toLowerCase();
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]' ||
    hostname.endsWith('.local')
  );
}

export function resolveBaseUrl(req?: {
  protocol?: string;
  get?: (name: string) => string | undefined;
}): string {
  const configured = sanitizePublicUrl(process.env.APP_URL);
  if (configured) {
    try {
      const parsed = new URL(configured);
      if (!isLocalHostname(parsed.hostname) && parsed.protocol === 'http:') {
        parsed.protocol = 'https:';
      }
      return parsed.toString().replace(/\/+$/, '');
    } catch {
      return configured.replace(/\/+$/, '');
    }
  }
  if (req?.get) {
    const host = (req.get('x-forwarded-host') || req.get('host') || '').split(',')[0].trim();
    if (host) {
      if (isLocalHostname(host)) {
        const protoHeader = req.get('x-forwarded-proto');
        const proto = protoHeader ? protoHeader.split(',')[0].trim() : req.protocol || 'http';
        return `${proto}://${host}`.replace(/\/+$/, '');
      }
      const hostname = host.split(':')[0].toLowerCase();
      if (
        hostname === 'acadetcbt.website' ||
        hostname === 'www.acadetcbt.website' ||
        hostname.endsWith('.onrender.com')
      ) {
        return 'https://acadetcbt.website';
      }
      return `https://${host}`.replace(/\/+$/, '');
    }
  }
  return 'https://acadetcbt.website';
}

export function toAbsoluteAssetUrl(baseUrl: string, assetPathOrUrl: string | null | undefined, fallback: string): string {
  const clean = sanitizePublicUrl(assetPathOrUrl) || fallback;
  if (clean.startsWith('http://') || clean.startsWith('https://')) {
    return clean;
  }
  return `${baseUrl}${clean.startsWith('/') ? clean : `/${clean}`}`;
}

export function buildOrganizationJsonLd(
  baseUrl: string,
  branding: SiteBrandingData,
  founder: FounderProfileData
): Record<string, unknown> {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const logoAbs = toAbsoluteAssetUrl(cleanBase, branding.logoUrl, '/acadet-logo.png');
  const sameAs = Object.values(branding.socialLinks || {}).filter(
    (v): v is string => typeof v === 'string' && v.startsWith('http')
  );

  const contactPoint: Record<string, string> = {
    '@type': 'ContactPoint',
    contactType: 'customer support',
    email: branding.contactEmail || DEFAULT_SITE_BRANDING.contactEmail,
  };
  if (branding.contactPhone) {
    contactPoint.telephone = branding.contactPhone;
  }

  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: branding.siteName || 'Acadet CBT',
    alternateName: 'Acadet Learning Hub',
    url: cleanBase,
    logo: {
      '@type': 'ImageObject',
      url: logoAbs,
    },
    image: logoAbs,
    description: branding.siteDescription,
    founder: {
      '@type': 'Person',
      name: founder.fullName,
      jobTitle: founder.positionTitle,
      url: `${cleanBase}/founder`,
    },
    contactPoint,
    ...(sameAs.length > 0 ? { sameAs } : {}),
  };
}

export interface RouteSeoMeta {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string | null;
  robots: 'index, follow' | 'noindex, nofollow';
  ogType: 'website' | 'profile';
  ogImage: string;
  faviconUrl: string;
  jsonLd: Array<Record<string, unknown>>;
  isNotFound?: boolean;
}

export function getSeoMetaForPath(
  pathname: string,
  baseUrl: string,
  branding: SiteBrandingData,
  founder: FounderProfileData
): RouteSeoMeta {
  const cleanBase = baseUrl.replace(/\/+$/, '');
  const norm = normalizeAppPath(pathname);
  const orgJsonLd = buildOrganizationJsonLd(cleanBase, branding, founder);
  const ogImage = toAbsoluteAssetUrl(cleanBase, branding.logoUrl, '/acadet-logo.png');
  const faviconUrl = toAbsoluteAssetUrl(cleanBase, branding.faviconUrl, '/favicon-48x48.png');

  if (norm === '/') {
    return {
      title: branding.seoTitle || `${branding.siteName} | Online CBT Practice & Exam Preparation`,
      description: branding.seoDescription,
      keywords: branding.seoKeywords,
      canonicalUrl: `${cleanBase}/`,
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  if (norm === '/about') {
    return {
      title: `About ${branding.siteName} | ${branding.tagline}`,
      description:
        'Learn about Acadet CBT and Acadet Learning Hub — our mission, student-centered goals, and commitment to accessible computer-based examination practice.',
      keywords: branding.seoKeywords,
      canonicalUrl: `${cleanBase}/about`,
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  if (norm === '/courses') {
    return {
      title: `Available Courses | ${branding.siteName}`,
      description:
        'Browse published university and JAMB CBT preparation courses on Acadet CBT, transparent ₦2,350 course registration, and timed examination access.',
      keywords: branding.seoKeywords,
      canonicalUrl: `${cleanBase}/courses`,
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  if (norm === '/how-it-works') {
    return {
      title: `How It Works | ${branding.siteName} Registration & CBT Access`,
      description:
        'Step-by-step guide to creating an Acadet CBT student account, registering courses securely with Paystack, downloading study materials, and taking CBT exams.',
      keywords: branding.seoKeywords,
      canonicalUrl: `${cleanBase}/how-it-works`,
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  if (norm === '/faq') {
    return {
      title: `Frequently Asked Questions (FAQ) | ${branding.siteName}`,
      description:
        'Answers to common student questions on Acadet CBT course registration, fixed ₦2,350 pricing, Paystack reference verification, official receipts, and CBT exams.',
      keywords: `Acadet CBT FAQ, Course Registration FAQ, Paystack Payment Verification, ${branding.seoKeywords}`,
      canonicalUrl: `${cleanBase}/faq`,
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  if (norm === '/contact') {
    return {
      title: `Contact ${branding.siteName} | Student Support`,
      description:
        'Get in touch with Acadet CBT support for course registration assistance, Paystack verification help, or academic platform inquiries.',
      keywords: branding.seoKeywords,
      canonicalUrl: `${cleanBase}/contact`,
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  if (norm === '/privacy') {
    return {
      title: `Privacy Policy | ${branding.siteName}`,
      description:
        'Read how Acadet CBT protects student account information, WhatsApp contact numbers, Paystack payment verification records, and examination results.',
      keywords: `Acadet CBT Privacy Policy, Student Data Protection, ${branding.seoKeywords}`,
      canonicalUrl: `${cleanBase}/privacy`,
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  if (norm === '/terms') {
    return {
      title: `Terms of Use | ${branding.siteName}`,
      description:
        'Review Acadet CBT terms of use covering student accounts, ₦2,350 course registration, Paystack payment verification, and computer-based examination conduct.',
      keywords: `Acadet CBT Terms of Use, Course Registration Policy, ${branding.seoKeywords}`,
      canonicalUrl: `${cleanBase}/terms`,
      robots: 'index, follow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  if (norm === '/founder') {
    const founderPhotoAbs = founder.photoUrl
      ? toAbsoluteAssetUrl(cleanBase, founder.photoUrl, branding.logoUrl)
      : ogImage;
    const founderSameAs = Object.values(founder.socialLinks || {}).filter(
      (v): v is string => typeof v === 'string' && v.startsWith('http')
    );
    const personJsonLd: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Person',
      name: founder.fullName,
      jobTitle: founder.positionTitle,
      description: founder.biography,
      url: `${cleanBase}/founder`,
      worksFor: {
        '@type': 'Organization',
        name: branding.siteName,
        url: cleanBase,
      },
      ...(founder.photoUrl ? { image: founderPhotoAbs } : {}),
      ...(founderSameAs.length > 0 ? { sameAs: founderSameAs } : {}),
    };

    return {
      title: `${founder.fullName} — ${founder.positionTitle}`,
      description: founder.biography.slice(0, 160),
      keywords: `${founder.fullName}, Founder of Acadet CBT, ${branding.seoKeywords}`,
      canonicalUrl: `${cleanBase}/founder`,
      robots: 'index, follow',
      ogType: 'profile',
      ogImage: founderPhotoAbs,
      faviconUrl,
      jsonLd: [orgJsonLd, personJsonLd],
    };
  }

  if (classifyPathStatus(norm) === 'private') {
    const pageLabel =
      norm === '/login'
        ? 'Student & Staff Sign In'
        : norm === '/register'
          ? 'Create Student Account'
          : branding.tagline;
    return {
      title: `${pageLabel} | ${branding.siteName}`,
      description: branding.seoDescription,
      keywords: branding.seoKeywords,
      canonicalUrl: `${cleanBase}${norm}`,
      robots: 'noindex, nofollow',
      ogType: 'website',
      ogImage,
      faviconUrl,
      jsonLd: [orgJsonLd],
    };
  }

  // Genuine 404 routes never advertise a canonical link or indexable meta
  return {
    title: `Page Not Found (404) | ${branding.siteName}`,
    description:
      'The requested page could not be found on Acadet CBT. Explore available courses, frequently asked questions, or return to the homepage.',
    keywords: branding.seoKeywords,
    canonicalUrl: null,
    robots: 'noindex, nofollow',
    ogType: 'website',
    ogImage,
    faviconUrl,
    jsonLd: [orgJsonLd],
    isNotFound: true,
  };
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function injectSeoIntoHtml(
  htmlTemplate: string,
  meta: RouteSeoMeta
): string {
  const safeJsonLd = meta.jsonLd
    .map(
      (schema, idx) =>
        `<script id="${idx === 0 ? 'acadet-org-jsonld' : `acadet-extra-jsonld-${idx}`}" type="application/ld+json">${JSON.stringify(schema).replace(/</g, '\\u003c')}</script>`
    )
    .join('\n    ');

  const canonicalTags = meta.canonicalUrl
    ? `\n    <link rel="canonical" href="${escapeHtmlAttr(meta.canonicalUrl)}" />\n    <meta property="og:url" content="${escapeHtmlAttr(meta.canonicalUrl)}" />`
    : '';

  const headTags = `
    <title>${escapeHtmlAttr(meta.title)}</title>
    <meta name="description" content="${escapeHtmlAttr(meta.description)}" />
    <meta name="keywords" content="${escapeHtmlAttr(meta.keywords)}" />
    <meta name="robots" content="${meta.robots}" />${canonicalTags}
    <meta property="og:title" content="${escapeHtmlAttr(meta.title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(meta.description)}" />
    <meta property="og:type" content="${meta.ogType}" />
    <meta property="og:image" content="${escapeHtmlAttr(meta.ogImage)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(meta.ogImage)}" />
    <link rel="icon" type="image/x-icon" href="/favicon.ico" />
    <link rel="icon" type="image/png" sizes="48x48" href="${escapeHtmlAttr(meta.faviconUrl)}" />
    <link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
    ${safeJsonLd}`;

  // Replace existing title/description/robots/canonical/icon/jsonld block cleanly before </head>
  let cleaned = htmlTemplate
    .replace(/<title>[\s\S]*?<\/title>/gi, '')
    .replace(/<meta\s+[^>]*name="(?:description|keywords|robots)"[^>]*>/gi, '')
    .replace(/<meta\s+[^>]*property="og:[^"]*"[^>]*>/gi, '')
    .replace(/<meta\s+[^>]*name="twitter:[^"]*"[^>]*>/gi, '')
    .replace(/<link\s+[^>]*rel="(?:canonical|icon|apple-touch-icon)"[^>]*>/gi, '')
    .replace(/<script\s+[^>]*type="application\/ld\+json"[^>]*>[\s\S]*?<\/script>/gi, '');

  return cleaned.replace('</head>', `${headTags}\n  </head>`);
}
