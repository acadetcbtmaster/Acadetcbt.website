import {
  ArrowRight,
  BarChart3,
  BookCheck,
  BookOpen,
  CheckCircle2,
  Clock,
  CreditCard,
  FileCheck2,
  GraduationCap,
  HelpCircle,
  Lock,
  Mail,
  Megaphone,
  MessageCircle,
  Phone,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import React, { useMemo, useState } from 'react';
import type { PublicCourseSummary, SafeUser } from '../../types/cbt';
import { AcadetCrest, HeroStudyGraphic, useBranding } from '../cbt/AcadetLogo';
import { formatCurrency } from '../cbt/CourseRegistrationView';

interface PublicPageBaseProps {
  courses: PublicCourseSummary[];
  user: SafeUser | null;
  onNavigate: (path: string) => void;
  onOpenDashboard?: () => void;
}

export const PublicHomeView: React.FC<PublicPageBaseProps> = ({
  courses,
  user,
  onNavigate,
  onOpenDashboard,
}) => {
  const { branding, founder } = useBranding();
  const featuredCourses = courses.slice(0, 6);

  return (
    <div className="space-y-8 pb-10">
      {/* Section 1: Hero Proposition */}
      <section className="bg-gradient-to-b from-[#eff5ff] to-[#eef3fb] dark:from-slate-900 dark:to-[#0a0f1e] border-b border-[#dce6f5] dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 sm:py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          <div className="lg:col-span-7 space-y-4 text-center lg:text-left">
            <div className="inline-flex items-center gap-2.5 text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300">
              <AcadetCrest className="w-7 h-7" />
              <span>
                {branding.siteName} · {branding.tagline}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight text-[#082252] dark:text-white leading-tight [text-wrap:balance]">
              Computer-Based Examination Practice Built for Student Mastery
            </h1>

            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 max-w-2xl mx-auto lg:mx-0 leading-relaxed">
              {branding.siteDescription} Powered by{' '}
              <strong className="text-[#0b337a] dark:text-blue-300">Acadet Learning Hub</strong>{' '}
              for university 100 Level courses and JAMB CBT practice.
            </p>

            <div className="pt-1 flex flex-wrap items-center justify-center lg:justify-start gap-3">
              {user ? (
                <button
                  type="button"
                  onClick={() => (onOpenDashboard ? onOpenDashboard() : onNavigate('/'))}
                  className="px-6 py-3 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold shadow-sm inline-flex items-center gap-2 min-h-[44px] transition-colors"
                >
                  <span>Open Student Dashboard</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <>
                  <a
                    href="/register"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/register');
                    }}
                    className="px-6 py-3 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold shadow-sm inline-flex items-center gap-2 min-h-[44px] transition-colors"
                  >
                    <span>Register &amp; Start Practising</span>
                    <ArrowRight className="w-4 h-4" />
                  </a>
                  <a
                    href="/login"
                    onClick={(e) => {
                      e.preventDefault();
                      onNavigate('/login');
                    }}
                    className="px-5 py-3 rounded-xl bg-white dark:bg-slate-900 border border-[#c6daf7] dark:border-slate-700 text-[#082252] dark:text-white hover:bg-blue-50 dark:hover:bg-slate-800 text-sm font-bold min-h-[44px] inline-flex items-center transition-colors"
                  >
                    Student &amp; Staff Sign In
                  </a>
                </>
              )}
            </div>
          </div>

          <div className="lg:col-span-5 flex flex-col items-center">
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm p-5 flex flex-col items-center gap-3">
              <HeroStudyGraphic />
              <div className="w-full pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <div className="font-extrabold text-[#0b337a] dark:text-blue-300 tabular-nums text-sm">
                    {courses.length > 0 ? courses.length : 'Multiple'}
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">Active Courses</div>
                </div>
                <div>
                  <div className="font-extrabold text-[#0b337a] dark:text-blue-300 tabular-nums text-sm">
                    ₦2,350
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">Per Course</div>
                </div>
                <div>
                  <div className="font-extrabold text-[#0b337a] dark:text-blue-300 text-sm">
                    Instant
                  </div>
                  <div className="text-slate-500 dark:text-slate-400">CBT Grading</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Section 2: Important Notice + Goal & Commitment */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-5">
        <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
          <div className="bg-[#0b337a] text-white px-5 py-3 flex items-center gap-2.5">
            <Megaphone className="w-4 h-4 shrink-0" />
            <h2 className="text-sm sm:text-base font-extrabold tracking-wide">
              IMPORTANT NOTICE: WELCOME TO ACADET CBT PRACTICE PLATFORM
            </h2>
          </div>
          <div className="p-5 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold tracking-wide text-[#0a58ed] dark:text-blue-400">
                OUR GOAL
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                Our goal is to improve students&apos; understanding of each registered course, build confidence through timed computer-based examination practice, and provide structured academic resources in one reliable platform.
              </p>
            </div>
            <div className="space-y-2">
              <h3 className="text-sm font-extrabold tracking-wide text-[#0a58ed] dark:text-blue-400">
                OUR COMMITMENT
              </h3>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                We are committed to transparent ₦2,350 course registration via Paystack (with processing charges absorbed by Acadet CBT), verified instant course unlocking, downloadable study materials, and detailed answer explanations.{' '}
                <strong className="text-[#082252] dark:text-white">Learn. Practice. Excel.</strong>
              </p>
            </div>
          </div>
        </div>

        {/* Who Uses Acadet CBT & Services */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <article className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-5 space-y-2 shadow-xs">
            <GraduationCap className="w-6 h-6 text-[#0a58ed]" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              University &amp; JAMB Candidates
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Designed for 100 Level university students, UTME / JAMB CBT candidates, and pre-exam tutorial learners preparing for computer-based assessments.
            </p>
          </article>

          <article className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-5 space-y-2 shadow-xs">
            <BookOpen className="w-6 h-6 text-[#0a58ed]" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Timed CBT &amp; Study Notes
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Practice with question palettes, difficulty filters, mark-for-review controls, built-in calculator, and downloadable PDF/DOC study materials.
            </p>
          </article>

          <article className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-5 space-y-2 shadow-xs">
            <BarChart3 className="w-6 h-6 text-[#0a58ed]" />
            <h3 className="text-base font-extrabold text-slate-900 dark:text-white">
              Instant Performance Insight
            </h3>
            <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
              Every completed CBT attempt is graded automatically on the server with score trends, question-by-question feedback, and full explanations.
            </p>
          </article>
        </div>
      </section>

      {/* Section 3: Published Courses Preview from PostgreSQL */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 space-y-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-extrabold tracking-tight text-[#082252] dark:text-white">
              Available Preparation Courses
            </h2>
            <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400">
              All published courses on Acadet CBT are standardized at ₦2,350 total payable (₦2,300 course value, Paystack charges absorbed).
            </p>
          </div>
          <a
            href="/courses"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/courses');
            }}
            className="text-xs sm:text-sm font-extrabold text-[#0a58ed] dark:text-blue-400 hover:underline inline-flex items-center gap-1"
          >
            <span>View Full Course Catalogue</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>

        {featuredCourses.length === 0 ? (
          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-8 text-center text-sm text-slate-500 dark:text-slate-400">
            Published courses load live from PostgreSQL once configured.
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {featuredCourses.map((course) => (
              <article
                key={course.id}
                className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-4 flex flex-col justify-between gap-3 shadow-xs"
              >
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#0b337a] dark:text-blue-300">
                    <span>
                      {course.code} · {course.level}
                    </span>
                    <span className="tabular-nums text-slate-500 dark:text-slate-400">
                      {course.questionCount} CBT Questions
                    </span>
                  </div>
                  <h3 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                    {course.title}
                  </h3>
                  <p className="text-xs text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                    {course.description || course.examCategory}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                  <div>
                    <div className="text-base font-extrabold text-[#082252] dark:text-white tabular-nums">
                      {formatCurrency(course.registrationFee, course.currency)}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      Charges absorbed
                    </div>
                  </div>
                  <a
                    href={user ? '/' : '/register'}
                    onClick={(e) => {
                      e.preventDefault();
                      if (user && onOpenDashboard) onOpenDashboard();
                      else onNavigate('/register');
                    }}
                    className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold min-h-[38px] inline-flex items-center gap-1.5 transition-colors"
                  >
                    <span>{user ? 'Go to Catalogue' : 'Register Now'}</span>
                  </a>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>

      {/* Section 4: Registration Steps & Founder Intro */}
      <section className="max-w-7xl mx-auto px-4 sm:px-6 grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 p-5 sm:p-6 space-y-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-lg sm:text-xl font-extrabold text-[#082252] dark:text-white">
              How Registration &amp; CBT Practice Works
            </h2>
            <a
              href="/how-it-works"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/how-it-works');
              }}
              className="text-xs font-bold text-[#0a58ed] dark:text-blue-400 hover:underline"
            >
              Read Full Guide
            </a>
          </div>
          <ol className="space-y-3 text-sm text-slate-700 dark:text-slate-300">
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#0a58ed] text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                1
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white">Create Your Student Account:</strong>{' '}
                Sign up with your name, email, and target examination.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#0a58ed] text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                2
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white">Register Selected Course (₦2,350):</strong>{' '}
                Confirm your WhatsApp number and complete Paystack checkout securely.
              </div>
            </li>
            <li className="flex items-start gap-3">
              <span className="w-6 h-6 rounded-full bg-[#0a58ed] text-white text-xs font-extrabold flex items-center justify-center shrink-0 mt-0.5 tabular-nums">
                3
              </span>
              <div>
                <strong className="text-slate-900 dark:text-white">Unlock Exams &amp; Track Results:</strong>{' '}
                Access unlimited practice runs, tutorial groups, study notes, and score analytics.
              </div>
            </li>
          </ol>
        </div>

        <div className="lg:col-span-5 rounded-2xl bg-[#0b337a] text-white p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div className="space-y-2">
            <div className="text-xs font-bold uppercase tracking-wider text-blue-200">
              Founder &amp; Creator
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">{founder.fullName}</h2>
            <div className="text-xs font-semibold text-blue-100">{founder.positionTitle}</div>
            <p className="text-xs sm:text-sm text-blue-100/90 leading-relaxed line-clamp-4">
              {founder.founderMessage}
            </p>
          </div>
          <a
            href="/founder"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/founder');
            }}
            className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-white text-[#0b337a] hover:bg-blue-50 text-xs sm:text-sm font-extrabold min-h-[42px] transition-colors"
          >
            <span>Read Full Founder Profile</span>
            <ArrowRight className="w-4 h-4" />
          </a>
        </div>
      </section>
    </div>
  );
};

export const PublicAboutView: React.FC<PublicPageBaseProps> = ({ onNavigate, user, onOpenDashboard }) => {
  const { branding, founder } = useBranding();

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-6 py-6 flex items-center gap-4">
          <AcadetCrest className="w-12 h-12" />
          <div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              About {branding.siteName}
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 italic">{branding.tagline}</p>
          </div>
        </div>

        <div className="p-6 space-y-6 text-sm sm:text-base text-slate-700 dark:text-slate-300 leading-relaxed">
          <div className="space-y-2">
            <h2 className="text-lg font-extrabold text-[#082252] dark:text-white">
              What Is {branding.siteName}?
            </h2>
            <p>
              {branding.siteDescription} Operating under{' '}
              <strong>Acadet Learning Hub</strong>, the platform bridges classroom tutorials and realistic computer-based examination readiness.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 space-y-1.5">
              <h3 className="font-extrabold text-[#0b337a] dark:text-blue-300">OUR GOAL</h3>
              <p className="text-sm">{founder.visionStatement}</p>
            </div>
            <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 space-y-1.5">
              <h3 className="font-extrabold text-[#0b337a] dark:text-blue-300">OUR COMMITMENT</h3>
              <p className="text-sm">{founder.missionStatement}</p>
            </div>
          </div>

          <div className="space-y-2">
            <h2 className="text-lg font-extrabold text-[#082252] dark:text-white">
              Why Students Choose Acadet Learning Hub
            </h2>
            <ul className="space-y-2 text-sm">
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                <span>
                  Authentic timed CBT practice environment with question palette, difficulty filtering, and built-in scientific calculator.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                <span>
                  Fixed ₦2,350 course registration fee with Paystack charges absorbed by Acadet CBT.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-1" />
                <span>
                  Immediate graded feedback, explanations, and curated course study materials.
                </span>
              </li>
            </ul>
          </div>

          <div className="pt-2 flex flex-wrap items-center gap-3">
            <a
              href="/founder"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/founder');
              }}
              className="px-4 py-2.5 rounded-xl border border-[#c6daf7] dark:border-slate-700 text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 min-h-[42px] inline-flex items-center"
            >
              Meet Founder: {founder.fullName}
            </a>
            <button
              type="button"
              onClick={() => {
                if (user && onOpenDashboard) onOpenDashboard();
                else onNavigate('/register');
              }}
              className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold min-h-[42px] inline-flex items-center gap-2"
            >
              <span>{user ? 'Open Dashboard' : 'Create Student Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PublicCoursesView: React.FC<PublicPageBaseProps> = ({
  courses,
  user,
  onNavigate,
  onOpenDashboard,
}) => {
  const [query, setQuery] = useState('');

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter(
      (c) =>
        c.code.toLowerCase().includes(q) ||
        c.title.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q)
    );
  }, [courses, query]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-5">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-5 py-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight">
              Course Catalogue
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
              Published courses on Acadet CBT — ₦2,350 per course (₦2,300 course value, Paystack charges absorbed).
            </p>
          </div>
          <div className="text-xs font-bold text-blue-100 tabular-nums">
            {courses.length} Published {courses.length === 1 ? 'Course' : 'Courses'}
          </div>
        </div>

        <div className="p-4 sm:p-5 space-y-4">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search courses by code, title, or level..."
            className="w-full max-w-md px-3.5 py-2.5 rounded-xl border border-[#dce6f5] dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm focus:outline-none focus:ring-2 focus:ring-[#0a58ed]"
          />

          {filtered.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              No published courses matched your search.
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filtered.map((course) => (
                <article
                  key={course.id}
                  className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 flex flex-col justify-between gap-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs font-bold text-[#0b337a] dark:text-blue-300">
                      <span>
                        {course.code} · {course.level}
                      </span>
                      <span className="tabular-nums text-slate-500 dark:text-slate-400">
                        {course.questionCount} Qs · {course.defaultDurationMinutes} mins
                      </span>
                    </div>
                    <h2 className="text-base font-extrabold text-slate-900 dark:text-white leading-snug">
                      {course.title}
                    </h2>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed line-clamp-3">
                      {course.description || course.examCategory}
                    </p>
                  </div>

                  <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
                    <div>
                      <div className="text-base font-extrabold text-[#082252] dark:text-white tabular-nums">
                        {formatCurrency(course.registrationFee, course.currency)}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400">
                        Fees absorbed by Acadet CBT
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => {
                        if (user && onOpenDashboard) onOpenDashboard();
                        else onNavigate('/register');
                      }}
                      className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold min-h-[40px] inline-flex items-center gap-1.5 transition-colors"
                    >
                      <Lock className="w-3.5 h-3.5" />
                      <span>{user ? 'Register in App' : 'Register Now'}</span>
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const PublicHowItWorksView: React.FC<PublicPageBaseProps> = ({
  onNavigate,
  user,
  onOpenDashboard,
}) => {
  const steps = [
    {
      num: '01',
      title: 'Create Your Student Profile',
      detail:
        'Register on Acadet CBT with your full name, email address, username, and target examination. Your account profile, preferences, and progress are stored securely in PostgreSQL.',
      icon: UserPlus,
    },
    {
      num: '02',
      title: 'Choose a Course & Confirm WhatsApp Number',
      detail:
        'Browse all published courses in Course Registration, review the fixed ₦2,350 fee (with Paystack fees absorbed by Acadet CBT), and input your correct WhatsApp number for verification and tutorial notifications.',
      icon: BookCheck,
    },
    {
      num: '03',
      title: 'Complete Secure Paystack Checkout',
      detail:
        'Pay safely through Paystack. Once verified, course CBT examinations unlock automatically and any linked course tutorial group invite appears in your dashboard and Notification Centre.',
      icon: CreditCard,
    },
    {
      num: '04',
      title: 'Take Timed CBT Practice & Inspect Solutions',
      detail:
        'Launch timed sessions with question palettes, review flags, and instant server-side grading. Review explanations after submission to strengthen weak areas.',
      icon: FileCheck2,
    },
  ];

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-6 py-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            How Acadet CBT Works
          </h1>
          <p className="text-xs sm:text-sm text-blue-100 mt-1">
            Step-by-step student guide from account creation to Paystack verification and timed CBT exams.
          </p>
        </div>

        <div className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {steps.map((s) => {
              const Icon = s.icon;
              return (
                <article
                  key={s.num}
                  className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-5 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                      STEP {s.num}
                    </span>
                    <Icon className="w-5 h-5 text-[#0b337a] dark:text-blue-300" />
                  </div>
                  <h2 className="text-base font-extrabold text-slate-900 dark:text-white">
                    {s.title}
                  </h2>
                  <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                    {s.detail}
                  </p>
                </article>
              );
            })}
          </div>

          <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 text-sm font-bold text-[#082252] dark:text-white">
              <ShieldCheck className="w-5 h-5 text-[#0a58ed] shrink-0" />
              <span>Ready to begin your next CBT preparation session?</span>
            </div>
            <button
              type="button"
              onClick={() => {
                if (user && onOpenDashboard) onOpenDashboard();
                else onNavigate('/register');
              }}
              className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold min-h-[42px] inline-flex items-center gap-1.5"
            >
              <span>{user ? 'Open Dashboard' : 'Create Student Account'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PublicContactView: React.FC<PublicPageBaseProps> = ({ onNavigate }) => {
  const { branding } = useBranding();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-6 py-6 flex items-center gap-3">
          <HelpCircle className="w-6 h-6 shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Contact {branding.siteName} Support
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
              Reach out for course registration inquiries, payment verification help, or tutorial group access.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#0a58ed] dark:text-blue-400">
                <Mail className="w-4 h-4" />
                <span>Support Email</span>
              </div>
              <a
                href={`mailto:${branding.contactEmail}`}
                className="text-sm sm:text-base font-extrabold text-slate-900 dark:text-white hover:underline break-all"
              >
                {branding.contactEmail}
              </a>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Include your registered email and Paystack payment reference for fast resolution.
              </p>
            </div>

            <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 space-y-1.5">
              <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
                <Clock className="w-4 h-4" />
                <span>Self-Service Payment Verification</span>
              </div>
              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                If Paystack returned before your course unlocked, sign in and click <strong>Verify</strong> beside any pending course card in <strong>Course Registration</strong>.
              </p>
            </div>
          </div>

          {(branding.contactPhone || branding.contactWhatsapp) && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {branding.contactPhone && (
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-[#0b337a] dark:text-blue-300">
                    <Phone className="w-4 h-4" />
                    <span>Phone Support</span>
                  </div>
                  <div className="text-sm font-bold tabular-nums">{branding.contactPhone}</div>
                </div>
              )}
              {branding.contactWhatsapp && (
                <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-extrabold uppercase text-emerald-700 dark:text-emerald-400">
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp Support</span>
                  </div>
                  <div className="text-sm font-bold tabular-nums">{branding.contactWhatsapp}</div>
                </div>
              )}
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <a
              href="/founder"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/founder');
              }}
              className="text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:underline"
            >
              About the Founder ({branding.siteName})
            </a>
            <a
              href="/login"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/login');
              }}
              className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold min-h-[40px] inline-flex items-center gap-1.5"
            >
              <span>Student Sign In</span>
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PublicFaqView: React.FC<PublicPageBaseProps> = ({
  onNavigate,
  user,
  onOpenDashboard,
}) => {
  const { branding } = useBranding();

  const faqs = [
    {
      q: 'How much does one course registration cost on Acadet CBT?',
      a: 'Every published course on Acadet CBT has a fixed total student payable amount of ₦2,350 (comprising ₦2,300 course registration value with Paystack transaction charges absorbed by Acadet CBT). Students are never charged extra gateway fees above ₦2,350.',
    },
    {
      q: 'How do I verify my payment if my browser closed before activation?',
      a: 'Copy your Paystack transaction reference from your payment confirmation email or Paystack receipt, sign in to your Acadet CBT student dashboard, open Payment Verification, paste the reference, and click VERIFY PAYMENT. Your course unlocks automatically once confirmed.',
    },
    {
      q: 'Why am I asked to input my correct WhatsApp number before paying?',
      a: 'Your WhatsApp number allows course administrators and tutors to confirm your registration record and connect you with official course tutorial group updates after payment confirmation.',
    },
    {
      q: 'Can I download an official payment receipt?',
      a: 'Yes. Open My Payment History in your dashboard and click View Receipt beside any confirmed transaction to view, print, or download your official PDF payment receipt.',
    },
    {
      q: 'How are CBT exams graded and saved?',
      a: 'Every selected option and examination timer update is persisted securely to PostgreSQL. Correct answers are never exposed to the browser during an active attempt; all scores and full answer explanations are computed server-side upon submission.',
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-6">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-6 py-6 flex items-center gap-3">
          <HelpCircle className="w-6 h-6 shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">
              Frequently Asked Questions
            </h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
              Helpful answers about {branding.siteName} course registration, Paystack payments, and CBT practice exams.
            </p>
          </div>
        </div>

        <div className="p-5 sm:p-6 space-y-4">
          {faqs.map((item) => (
            <article
              key={item.q}
              className="rounded-xl border border-[#dce6f5] dark:border-slate-800 p-4 sm:p-5 space-y-1.5"
            >
              <h2 className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
                {item.q}
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {item.a}
              </p>
            </article>
          ))}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 dark:border-slate-800">
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/contact');
              }}
              className="text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:underline"
            >
              Still need assistance? Contact Support
            </a>
            <button
              type="button"
              onClick={() => {
                if (user && onOpenDashboard) onOpenDashboard();
                else onNavigate('/courses');
              }}
              className="px-4 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold min-h-[40px] inline-flex items-center gap-1.5"
            >
              <span>{user ? 'Open Dashboard' : 'Browse Available Courses'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PublicPrivacyView: React.FC<PublicPageBaseProps> = ({ onNavigate }) => {
  const { branding } = useBranding();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-6 py-6 flex items-center gap-3">
          <ShieldCheck className="w-6 h-6 shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Privacy Policy</h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
              How {branding.siteName} handles student accounts, payment verification, and academic records.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <section className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#082252] dark:text-white">
              1. Information We Collect
            </h2>
            <p>
              When you register on {branding.siteName}, we collect your full name, email address, username, target examination, and (when enrolling in a course) your WhatsApp contact number. Passwords are stored exclusively as salted cryptographic hashes.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#082252] dark:text-white">
              2. Payment Processing &amp; Financial Records
            </h2>
            <p>
              All course payments are processed securely through Paystack. {branding.siteName} never stores raw card numbers, CVVs, or bank PINs. We store transaction references, course registration associations, and gateway verification metadata solely for course activation, official receipts, and financial audit integrity.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#082252] dark:text-white">
              3. Examination Attempts &amp; Study Data
            </h2>
            <p>
              Practice attempts, timer states, and results are stored in our PostgreSQL database to display your personal score analytics and answer reviews. Student records are never sold or shared with third-party advertisers.
            </p>
          </section>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <a
              href="/terms"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/terms');
              }}
              className="text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:underline"
            >
              Read Terms of Use
            </a>
            <a
              href="/contact"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/contact');
              }}
              className="text-xs sm:text-sm font-bold text-[#0a58ed] dark:text-blue-400 hover:underline"
            >
              Contact {branding.siteName} Support
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PublicTermsView: React.FC<PublicPageBaseProps> = ({ onNavigate }) => {
  const { branding } = useBranding();

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden">
        <div className="bg-[#0b337a] text-white px-6 py-6 flex items-center gap-3">
          <FileCheck2 className="w-6 h-6 shrink-0" />
          <div>
            <h1 className="text-2xl font-extrabold tracking-tight">Terms of Use</h1>
            <p className="text-xs sm:text-sm text-blue-100 mt-0.5">
              Platform guidelines for student accounts, course registration, and CBT practice on {branding.siteName}.
            </p>
          </div>
        </div>

        <div className="p-6 space-y-5 text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
          <section className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#082252] dark:text-white">
              1. Course Registration &amp; Pricing
            </h2>
            <p>
              Each published course unlocks access to its timed CBT simulations, practice banks, and associated study resources at a standardized registration fee of ₦2,350 total payable (₦2,300 course value, Paystack charges absorbed by {branding.siteName}). Access is bound to the verified student account and payment reference.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#082252] dark:text-white">
              2. Account Responsibility
            </h2>
            <p>
              Students are responsible for providing accurate registration details (including an active WhatsApp number) and keeping account credentials private. Accounts found attempting unauthorized access, payment tampering, or automated scraping may be suspended.
            </p>
          </section>

          <section className="space-y-1.5">
            <h2 className="text-base font-extrabold text-[#082252] dark:text-white">
              3. Payment Reference Verification
            </h2>
            <p>
              Each Paystack transaction reference can activate only one matching course registration for the paying student account. If an automatic callback is interrupted, use Payment Verification in your dashboard to re-verify your reference.
            </p>
          </section>

          <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
            <a
              href="/privacy"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/privacy');
              }}
              className="text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:underline"
            >
              Read Privacy Policy
            </a>
            <a
              href="/courses"
              onClick={(e) => {
                e.preventDefault();
                onNavigate('/courses');
              }}
              className="text-xs sm:text-sm font-bold text-[#0a58ed] dark:text-blue-400 hover:underline"
            >
              Browse Available Courses
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export const PublicNotFoundView: React.FC<{
  pathname: string;
  onNavigate: (path: string) => void;
}> = ({ pathname, onNavigate }) => {
  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-12 sm:py-16">
      <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm p-6 sm:p-8 text-center space-y-5">
        <div className="inline-flex items-center px-3 py-1 rounded-lg bg-[#eff5ff] dark:bg-slate-800 text-[#0a58ed] dark:text-blue-300 text-xs font-extrabold tracking-widest uppercase">
          404 · Page Not Found
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold text-[#082252] dark:text-white tracking-tight">
          This Page Could Not Be Found
        </h1>
        <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
          The URL <code className="px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-xs font-mono">{pathname}</code> does not match an active page on Acadet CBT. Choose a valid destination below.
        </p>

        <div className="pt-1 flex flex-wrap items-center justify-center gap-2.5">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
            }}
            className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold min-h-[42px] inline-flex items-center gap-1.5"
          >
            <span>Go to Homepage</span>
            <ArrowRight className="w-4 h-4" />
          </a>
          <a
            href="/courses"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/courses');
            }}
            className="px-4 py-2.5 rounded-xl border border-[#c6daf7] dark:border-slate-700 text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 min-h-[42px] inline-flex items-center"
          >
            Browse Courses
          </a>
          <a
            href="/faq"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/faq');
            }}
            className="px-4 py-2.5 rounded-xl border border-[#c6daf7] dark:border-slate-700 text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 min-h-[42px] inline-flex items-center"
          >
            Read FAQ
          </a>
          <a
            href="/contact"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/contact');
            }}
            className="px-4 py-2.5 rounded-xl border border-[#c6daf7] dark:border-slate-700 text-xs sm:text-sm font-bold text-[#0b337a] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-slate-800 min-h-[42px] inline-flex items-center"
          >
            Contact Support
          </a>
        </div>
      </div>
    </div>
  );
};
