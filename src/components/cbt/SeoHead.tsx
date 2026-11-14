import React, { useEffect } from 'react';
import type { FounderProfileData, SiteBrandingData } from '../../types/cbt';

interface SeoHeadProps {
  pathname: string;
  branding: SiteBrandingData;
  founder: FounderProfileData;
  isPrivateAppRoute?: boolean;
  isNotFoundRoute?: boolean;
}

function upsertMeta(attr: 'name' | 'property', key: string, content: string): void {
  let el = document.head.querySelector(`meta[${attr}="${key}"]`) as HTMLMetaElement | null;
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
}

function removeMeta(attr: 'name' | 'property', key: string): void {
  const el = document.head.querySelector(`meta[${attr}="${key}"]`);
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function upsertLink(rel: string, href: string, extra?: Record<string, string>): void {
  const selector = extra?.sizes
    ? `link[rel="${rel}"][sizes="${extra.sizes}"]`
    : `link[rel="${rel}"]`;
  let el = document.head.querySelector(selector) as HTMLLinkElement | null;
  if (!el) {
    el = document.createElement('link');
    el.setAttribute('rel', rel);
    document.head.appendChild(el);
  }
  el.setAttribute('href', href);
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      el.setAttribute(k, v);
    }
  }
}

function removeLink(rel: string): void {
  const el = document.head.querySelector(`link[rel="${rel}"]`);
  if (el && el.parentNode) {
    el.parentNode.removeChild(el);
  }
}

function resolveClientCanonicalOrigin(): string {
  if (typeof window === 'undefined' || !window.location) {
    return 'https://acadetcbt.website';
  }
  const hostname = window.location.hostname.toLowerCase();
  if (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '::1' ||
    hostname === '[::1]'
  ) {
    return window.location.origin.replace(/\/+$/, '');
  }
  if (
    hostname === 'acadetcbt.website' ||
    hostname === 'www.acadetcbt.website' ||
    hostname.endsWith('.onrender.com')
  ) {
    return 'https://acadetcbt.website';
  }
  return `https://${window.location.host}`.replace(/\/+$/, '');
}

export const SeoHead: React.FC<SeoHeadProps> = ({
  pathname,
  branding,
  founder,
  isPrivateAppRoute = false,
  isNotFoundRoute = false,
}) => {
  useEffect(() => {
    const origin = resolveClientCanonicalOrigin();
    const norm = (pathname || '/').replace(/\/+$/, '') || '/';

    const toAbs = (val: string | null | undefined, fallback: string) => {
      const clean = (val || '').trim() || fallback;
      if (clean.startsWith('http://') || clean.startsWith('https://')) return clean;
      return `${origin}${clean.startsWith('/') ? clean : `/${clean}`}`;
    };

    const ogImage = toAbs(branding.logoUrl, '/acadet-logo.png');
    const favicon48 = toAbs(branding.faviconUrl, '/favicon-48x48.png');

    let title = branding.seoTitle || `${branding.siteName} | ${branding.tagline}`;
    let description = branding.seoDescription || branding.siteDescription;
    let keywords = branding.seoKeywords;
    let robots: 'index, follow' | 'noindex, nofollow' =
      isPrivateAppRoute || isNotFoundRoute ? 'noindex, nofollow' : 'index, follow';
    let ogType: 'website' | 'profile' = 'website';

    if (isNotFoundRoute) {
      title = `Page Not Found (404) | ${branding.siteName}`;
      description =
        'The requested page could not be found on Acadet CBT. Explore available courses, frequently asked questions, or return to the homepage.';
      robots = 'noindex, nofollow';
    } else if (!isPrivateAppRoute) {
      if (norm === '/about') {
        title = `About ${branding.siteName} | ${branding.tagline}`;
        description =
          'Learn about Acadet CBT and Acadet Learning Hub — our goals, commitment, and accessible computer-based examination preparation platform.';
      } else if (norm === '/courses') {
        title = `Available Courses | ${branding.siteName}`;
        description =
          'Explore published courses on Acadet CBT, transparent ₦2,350 course registration, Paystack verification, and CBT exam practice.';
      } else if (norm === '/how-it-works') {
        title = `How It Works | ${branding.siteName}`;
        description =
          'How students register on Acadet CBT, pay securely with Paystack, download study materials, and take timed CBT examinations.';
      } else if (norm === '/faq') {
        title = `Frequently Asked Questions (FAQ) | ${branding.siteName}`;
        description =
          'Answers to common student questions on Acadet CBT course registration, fixed ₦2,350 pricing, Paystack reference verification, official receipts, and CBT exams.';
      } else if (norm === '/contact') {
        title = `Contact ${branding.siteName} | Support & Inquiries`;
        description =
          'Contact Acadet CBT support for course registration assistance, Paystack verification, or academic guidance.';
      } else if (norm === '/privacy') {
        title = `Privacy Policy | ${branding.siteName}`;
        description =
          'Read how Acadet CBT protects student account information, WhatsApp contact numbers, Paystack payment verification records, and examination results.';
      } else if (norm === '/terms') {
        title = `Terms of Use | ${branding.siteName}`;
        description =
          'Review Acadet CBT terms of use covering student accounts, ₦2,350 course registration, Paystack payment verification, and computer-based examination conduct.';
      } else if (norm === '/founder') {
        title = `${founder.fullName} — ${founder.positionTitle}`;
        description = founder.biography.slice(0, 160);
        keywords = `${founder.fullName}, Founder of Acadet CBT, ${branding.seoKeywords}`;
        ogType = 'profile';
      } else if (norm === '/login' || norm === '/register') {
        title = `${norm === '/register' ? 'Create Account' : 'Sign In'} | ${branding.siteName}`;
        robots = 'noindex, nofollow';
      }
    }

    const canonicalUrl = isNotFoundRoute ? null : `${origin}${norm === '/' ? '/' : norm}`;
    document.title = title;
    upsertMeta('name', 'description', description);
    upsertMeta('name', 'keywords', keywords);
    upsertMeta('name', 'robots', robots);
    upsertMeta('property', 'og:title', title);
    upsertMeta('property', 'og:description', description);
    upsertMeta('property', 'og:type', ogType);
    if (canonicalUrl) {
      upsertMeta('property', 'og:url', canonicalUrl);
      upsertLink('canonical', canonicalUrl);
    } else {
      removeMeta('property', 'og:url');
      removeLink('canonical');
    }
    upsertMeta('property', 'og:image', ogImage);
    upsertMeta('name', 'twitter:card', 'summary_large_image');
    upsertMeta('name', 'twitter:title', title);
    upsertMeta('name', 'twitter:description', description);
    upsertMeta('name', 'twitter:image', ogImage);
    upsertLink('icon', favicon48, { type: 'image/png', sizes: '48x48' });

    const sameAs = Object.values(branding.socialLinks || {}).filter(
      (v): v is string => typeof v === 'string' && v.startsWith('http')
    );

    const orgSchema: Record<string, unknown> = {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: branding.siteName || 'Acadet CBT',
      alternateName: 'Acadet Learning Hub',
      url: origin,
      logo: {
        '@type': 'ImageObject',
        url: ogImage,
      },
      image: ogImage,
      description: branding.siteDescription,
      founder: {
        '@type': 'Person',
        name: founder.fullName,
        jobTitle: founder.positionTitle,
        url: `${origin}/founder`,
      },
      contactPoint: {
        '@type': 'ContactPoint',
        contactType: 'customer support',
        email: branding.contactEmail,
        ...(branding.contactPhone ? { telephone: branding.contactPhone } : {}),
      },
      ...(sameAs.length > 0 ? { sameAs } : {}),
    };

    let scriptEl = document.getElementById('acadet-org-jsonld') as HTMLScriptElement | null;
    if (!scriptEl) {
      scriptEl = document.createElement('script');
      scriptEl.id = 'acadet-org-jsonld';
      scriptEl.type = 'application/ld+json';
      document.head.appendChild(scriptEl);
    }
    scriptEl.textContent = JSON.stringify(orgSchema);
  }, [pathname, branding, founder, isPrivateAppRoute, isNotFoundRoute]);

  return null;
};
