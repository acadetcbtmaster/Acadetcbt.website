import {
  ArrowLeft,
  ArrowRight,
  Award,
  BookOpen,
  Compass,
  ExternalLink,
  Globe,
  Quote,
  Target,
} from 'lucide-react';
import React, { useState } from 'react';
import type { SocialLinksMap } from '../../types/cbt';
import { AcadetCrest, useBranding } from '../cbt/AcadetLogo';
import { renderSocialLinkLabel } from './PublicShell';

interface FounderViewProps {
  onNavigate: (path: string) => void;
}

function getInitials(name: string): string {
  const cleaned = name
    .replace(/[()]/g, ' ')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (cleaned.length === 0) return 'IM';
  if (cleaned.length === 1) return cleaned[0].slice(0, 2).toUpperCase();
  return `${cleaned[0][0]}${cleaned[1][0]}`.toUpperCase();
}

export const FounderView: React.FC<FounderViewProps> = ({ onNavigate }) => {
  const { branding, founder } = useBranding();
  const [photoFailed, setPhotoFailed] = useState(false);

  const showPhoto = Boolean(founder.photoUrl && !photoFailed);
  const socialEntries = (
    Object.entries(founder.socialLinks || {}) as Array<[keyof SocialLinksMap, string | undefined]>
  ).filter(([, href]) => typeof href === 'string' && href.trim().length > 0);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-6">
      {/* Top Breadcrumb / Back Action */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <a
          href="/"
          onClick={(e) => {
            e.preventDefault();
            onNavigate('/');
          }}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:underline min-h-[40px]"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to {branding.siteName} Home</span>
        </a>

        <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
          {branding.siteName} · Leadership &amp; Origin
        </span>
      </div>

      {/* Founder Profile Hero Card */}
      <section className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-5 sm:px-8 py-6 sm:py-8">
          <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
            {/* Founder Photograph or Clean Editorial Monogram Fallback */}
            <div className="w-36 h-36 sm:w-44 sm:h-44 rounded-2xl overflow-hidden bg-gradient-to-br from-[#0a58ed] to-[#072459] border-2 border-white/25 shadow-lg shrink-0 flex items-center justify-center">
              {showPhoto ? (
                <img
                  src={founder.photoUrl!}
                  alt={`${founder.fullName}, ${founder.positionTitle}`}
                  width={176}
                  height={176}
                  decoding="async"
                  referrerPolicy="no-referrer"
                  onError={() => setPhotoFailed(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex flex-col items-center justify-center text-white select-none">
                  <span className="text-4xl sm:text-5xl font-extrabold tracking-tight">
                    {getInitials(founder.fullName)}
                  </span>
                  <span className="text-[11px] font-semibold uppercase tracking-widest text-blue-100 mt-1">
                    Founder Crest
                  </span>
                </div>
              )}
            </div>

            {/* Founder Name, Title & Quick Links */}
            <div className="flex-1 text-center md:text-left space-y-3 min-w-0">
              <div className="inline-flex items-center gap-2 text-xs font-semibold text-blue-100">
                <AcadetCrest className="w-6 h-6" />
                <span>{branding.siteName} · Acadet Learning Hub</span>
              </div>

              <div>
                <h1 className="text-2xl sm:text-4xl font-extrabold tracking-tight leading-tight text-white">
                  {founder.fullName}
                </h1>
                <p className="text-sm sm:text-lg font-bold text-blue-100 mt-1">
                  {founder.positionTitle}
                </p>
              </div>

              <p className="text-sm text-blue-100/90 max-w-2xl leading-relaxed">
                Building accessible computer-based testing technology and structured course preparation resources for students.
              </p>

              {socialEntries.length > 0 && (
                <div className="pt-1 flex flex-wrap items-center justify-center md:justify-start gap-2">
                  {socialEntries.map(([key, url]) => (
                    <a
                      key={key}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold text-white transition-colors min-h-[36px]"
                    >
                      <Globe className="w-3.5 h-3.5" />
                      <span>{renderSocialLinkLabel(key)}</span>
                      <ExternalLink className="w-3 h-3 opacity-75" />
                    </a>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Biography & Founder's Message */}
        <div className="p-5 sm:p-8 space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center gap-2 text-[#0b337a] dark:text-blue-400">
                <Award className="w-5 h-5 shrink-0" />
                <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-slate-900 dark:text-white">
                  Biography
                </h2>
              </div>
              <p className="text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {founder.biography}
              </p>
            </div>

            <div className="lg:col-span-5 rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-5 space-y-2.5">
              <div className="flex items-center gap-2 text-[#0a58ed] dark:text-blue-400">
                <Quote className="w-5 h-5 shrink-0" />
                <h2 className="text-base sm:text-lg font-extrabold text-[#082252] dark:text-white">
                  Founder&apos;s Message
                </h2>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-200 leading-relaxed whitespace-pre-line italic">
                &ldquo;{founder.founderMessage}&rdquo;
              </p>
              <div className="pt-1 text-xs font-extrabold text-[#0b337a] dark:text-blue-300">
                — {founder.fullName}, {founder.positionTitle}
              </div>
            </div>
          </div>

          <hr className="border-slate-200 dark:border-slate-800" />

          {/* Vision, Mission & Acadet CBT Background */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <article className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#0a58ed] dark:text-blue-400">
                <Compass className="w-5 h-5 shrink-0" />
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Vision Statement
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {founder.visionStatement}
              </p>
            </article>

            <article className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-5 space-y-2">
              <div className="flex items-center gap-2 text-[#0a58ed] dark:text-blue-400">
                <Target className="w-5 h-5 shrink-0" />
                <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                  Mission Statement
                </h2>
              </div>
              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed whitespace-pre-line">
                {founder.missionStatement}
              </p>
            </article>
          </div>

          <article className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-slate-50/80 dark:bg-slate-800/40 p-5 space-y-2">
            <div className="flex items-center gap-2 text-[#0b337a] dark:text-blue-400">
              <BookOpen className="w-5 h-5 shrink-0" />
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 dark:text-white">
                Acadet CBT Background
              </h2>
            </div>
            <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed whitespace-pre-line">
              {founder.backgroundStory}
            </p>
          </article>

          {/* CTA Footer inside Profile */}
          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <a
              href="/courses"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/courses');
              }}
              className="px-4 py-2.5 rounded-xl border border-[#c6daf7] dark:border-slate-700 text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 min-h-[42px] inline-flex items-center gap-2"
            >
              <span>Browse Available Courses</span>
            </a>

            <a
              href="/register"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/register');
              }}
              className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold min-h-[42px] inline-flex items-center gap-2 shadow-xs transition-colors"
            >
              <span>Start Practising on {branding.siteName}</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </section>
    </div>
  );
};
