import {
  ArrowRight,
  Globe,
  LogIn,
  Mail,
  Menu,
  MessageCircle,
  Phone,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import type { SafeUser, SocialLinksMap } from '../../types/cbt';
import { AcadetCrest, useBranding } from '../cbt/AcadetLogo';

export type PublicRoutePath =
  | '/'
  | '/about'
  | '/courses'
  | '/how-it-works'
  | '/founder'
  | '/faq'
  | '/contact'
  | '/privacy'
  | '/terms';

interface PublicShellProps {
  currentPath: string;
  user: SafeUser | null;
  onNavigate: (path: string) => void;
  onReturnToDashboard?: () => void;
  children: React.ReactNode;
}

const NAV_LINKS: Array<{ path: PublicRoutePath; label: string }> = [
  { path: '/', label: 'Home' },
  { path: '/about', label: 'About' },
  { path: '/courses', label: 'Courses' },
  { path: '/how-it-works', label: 'How It Works' },
  { path: '/founder', label: 'Founder' },
  { path: '/contact', label: 'Contact' },
];

const FOOTER_SUPPORT_LINKS: Array<{ path: PublicRoutePath; label: string }> = [
  { path: '/faq', label: 'FAQ' },
  { path: '/privacy', label: 'Privacy Policy' },
  { path: '/terms', label: 'Terms of Use' },
];

export function renderSocialLinkLabel(key: keyof SocialLinksMap): string {
  switch (key) {
    case 'facebook':
      return 'Facebook';
    case 'twitter':
      return 'X (Twitter)';
    case 'instagram':
      return 'Instagram';
    case 'youtube':
      return 'YouTube';
    case 'linkedin':
      return 'LinkedIn';
    case 'whatsapp':
      return 'WhatsApp';
    case 'tiktok':
      return 'TikTok';
    case 'website':
      return 'Website';
    default:
      return String(key);
  }
}

export const PublicShell: React.FC<PublicShellProps> = ({
  currentPath,
  user,
  onNavigate,
  onReturnToDashboard,
  children,
}) => {
  const { branding } = useBranding();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const normalizedPath = (currentPath || '/').replace(/\/+$/, '') || '/';
  const socialEntries = (
    Object.entries(branding.socialLinks || {}) as Array<[keyof SocialLinksMap, string | undefined]>
  ).filter(([, href]) => typeof href === 'string' && href.trim().length > 0);

  const handleLinkClick = (e: React.MouseEvent<HTMLAnchorElement>, path: string) => {
    e.preventDefault();
    setMobileMenuOpen(false);
    onNavigate(path);
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#eef3fb] dark:bg-[#0a0f1e] text-slate-900 dark:text-slate-100">
      {/* Top Bar */}
      <header className="sticky top-0 z-40 bg-[#0b337a] text-white border-b border-white/10 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Crest + Wordmark */}
          <a
            href="/"
            onClick={(e) => handleLinkClick(e, '/')}
            className="flex items-center gap-2.5 shrink-0 group focus:outline-none focus-visible:ring-2 focus-visible:ring-white rounded-lg"
          >
            <AcadetCrest className="w-9 h-9 sm:w-10 sm:h-10" />
            <span className="text-lg sm:text-xl font-extrabold tracking-tight whitespace-nowrap shrink-0">
              {branding.siteName}
            </span>
          </a>

          {/* Zone 2: Clean Single-Line Nav Links */}
          <nav
            aria-label="Primary website navigation"
            className="hidden lg:flex items-center gap-6 text-sm font-semibold text-blue-100"
          >
            {NAV_LINKS.map((item) => {
              const active = normalizedPath === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'text-white border-white font-bold'
                      : 'border-transparent hover:text-white hover:border-white/50'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
          </nav>

          {/* Zone 3: Primary Action + Mobile Menu Trigger */}
          <div className="flex items-center gap-2 shrink-0">
            {user ? (
              <button
                type="button"
                onClick={() => (onReturnToDashboard ? onReturnToDashboard() : onNavigate('/'))}
                className="px-4 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 min-h-[40px] transition-colors"
              >
                <span>Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <a
                  href="/login"
                  onClick={(e) => handleLinkClick(e, '/login')}
                  className="hidden sm:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold text-white/95 hover:bg-white/10 whitespace-nowrap shrink-0 min-h-[40px] transition-colors"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Sign In</span>
                </a>
                <a
                  href="/register"
                  onClick={(e) => handleLinkClick(e, '/register')}
                  className="px-3.5 sm:px-4 py-2 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold whitespace-nowrap shrink-0 inline-flex items-center gap-1.5 min-h-[40px] shadow-xs transition-colors"
                >
                  <span>Get Started</span>
                </a>
              </div>
            )}

            <button
              type="button"
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              aria-label={mobileMenuOpen ? 'Close navigation menu' : 'Open navigation menu'}
              aria-expanded={mobileMenuOpen}
              className="lg:hidden p-2 rounded-lg text-white hover:bg-white/10 min-w-[44px] min-h-[44px] flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Navigation */}
        {mobileMenuOpen && (
          <nav
            aria-label="Mobile navigation"
            className="lg:hidden border-t border-white/10 bg-[#072459] px-4 py-3 space-y-1"
          >
            {NAV_LINKS.map((item) => {
              const active = normalizedPath === item.path;
              return (
                <a
                  key={item.path}
                  href={item.path}
                  onClick={(e) => handleLinkClick(e, item.path)}
                  className={`block px-3 py-2.5 rounded-lg text-sm font-bold min-h-[44px] flex items-center ${
                    active ? 'bg-[#0a58ed] text-white' : 'text-blue-100 hover:bg-white/10'
                  }`}
                >
                  {item.label}
                </a>
              );
            })}
            {!user && (
              <div className="pt-2 border-t border-white/10 grid grid-cols-2 gap-2">
                <a
                  href="/login"
                  onClick={(e) => handleLinkClick(e, '/login')}
                  className="px-3 py-2.5 rounded-lg bg-white/10 text-white text-center text-sm font-bold min-h-[44px] flex items-center justify-center"
                >
                  Sign In
                </a>
                <a
                  href="/register"
                  onClick={(e) => handleLinkClick(e, '/register')}
                  className="px-3 py-2.5 rounded-lg bg-[#0a58ed] text-white text-center text-sm font-extrabold min-h-[44px] flex items-center justify-center"
                >
                  Register
                </a>
              </div>
            )}
          </nav>
        )}
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Consistent Deep Navy Footer */}
      <footer className="bg-[#0b337a] text-white border-t border-white/10">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 grid grid-cols-1 md:grid-cols-12 gap-6">
          <div className="md:col-span-5 space-y-2.5">
            <div className="flex items-center gap-3">
              <AcadetCrest className="w-10 h-10" />
              <div>
                <div className="text-base font-extrabold tracking-tight leading-tight">
                  {branding.siteName}
                </div>
                <div className="text-xs italic text-blue-100">{branding.tagline}</div>
              </div>
            </div>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed max-w-md">
              {branding.siteDescription}
            </p>
          </div>

          <div className="md:col-span-3 space-y-2">
            <div className="text-xs font-extrabold uppercase tracking-wider text-blue-200">
              Platform
            </div>
            <ul className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs sm:text-sm text-blue-100">
              {[...NAV_LINKS, ...FOOTER_SUPPORT_LINKS].map((item) => (
                <li key={item.path}>
                  <a
                    href={item.path}
                    onClick={(e) => handleLinkClick(e, item.path)}
                    className="hover:text-white hover:underline transition-colors"
                  >
                    {item.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="md:col-span-4 space-y-2.5">
            <div className="text-xs font-extrabold uppercase tracking-wider text-blue-200">
              Contact & Links
            </div>
            <div className="space-y-1.5 text-xs sm:text-sm text-blue-100">
              {branding.contactEmail && (
                <a
                  href={`mailto:${branding.contactEmail}`}
                  className="flex items-center gap-2 hover:text-white transition-colors"
                >
                  <Mail className="w-4 h-4 shrink-0 text-blue-200" />
                  <span className="truncate">{branding.contactEmail}</span>
                </a>
              )}
              {branding.contactPhone && (
                <a
                  href={`tel:${branding.contactPhone}`}
                  className="flex items-center gap-2 hover:text-white transition-colors tabular-nums"
                >
                  <Phone className="w-4 h-4 shrink-0 text-blue-200" />
                  <span>{branding.contactPhone}</span>
                </a>
              )}
              {branding.contactWhatsapp && (
                <div className="flex items-center gap-2 tabular-nums">
                  <MessageCircle className="w-4 h-4 shrink-0 text-emerald-300" />
                  <span>WhatsApp: {branding.contactWhatsapp}</span>
                </div>
              )}
            </div>

            {socialEntries.length > 0 && (
              <div className="pt-1 flex flex-wrap gap-2">
                {socialEntries.map(([key, url]) => (
                  <a
                    key={key}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-semibold text-white transition-colors"
                  >
                    <Globe className="w-3.5 h-3.5" />
                    <span>{renderSocialLinkLabel(key)}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="border-t border-white/10 bg-[#072459] px-4 sm:px-6 py-3">
          <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-blue-100">
            <span>
              © {new Date().getFullYear()} {branding.siteName}. All rights reserved.
            </span>
            <span>Powered by Acadet Learning Hub</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
