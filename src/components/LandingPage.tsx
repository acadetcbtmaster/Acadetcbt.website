import React, { useState, useEffect } from 'react';
import {
  Sparkles,
  BookOpen,
  Brain,
  ShieldCheck,
  CheckCircle2,
  Clock,
  ChevronDown,
  ChevronUp,
  Award,
  Zap,
  Building2,
  ArrowRight,
  GraduationCap,
  Target,
  Eye,
  Heart,
  MessageSquare,
  ExternalLink,
  Swords,
  Video,
  Globe,
  Youtube,
  Smartphone,
  Download,
} from 'lucide-react';
import { SubscriptionPlan, UserProfile, QuickLinkItem, HomepageSection } from '../types';
import { StorageService } from '../services/storage';
import cbtCandidatesImg from '../assets/images/cbt_candidates.jpg';

const stripEmojis = (str?: string): string =>
  str ? str.replace(/[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu, '').trim() : '';

interface LandingPageProps {
  onStartPractice: () => void;
  onOpenAuth: (mode?: 'register' | 'login' | 'admin' | 'forgot') => void;
  onOpenSubscribe: () => void;
  plans: SubscriptionPlan[];
  currentUser?: UserProfile | null;
  onOpenFounder?: () => void;
  onStartPreJamb?: () => void;
  onOpenInstallModal?: () => void;
  questionsCount?: number;
  universitiesCount?: number;
}

export const LandingPage: React.FC<LandingPageProps> = ({
  onStartPractice,
  onOpenAuth,
  onOpenSubscribe,
  plans,
  currentUser,
  onOpenFounder,
  onStartPreJamb,
  onOpenInstallModal,
  questionsCount = 0,
  universitiesCount = 0,
}) => {
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);

  // Dynamic Interface Editor Content
  const [quickLinks, setQuickLinks] = useState<QuickLinkItem[]>([]);
  const [homepageSections, setHomepageSections] = useState<HomepageSection[]>([]);

  useEffect(() => {
    const unsubLinks = StorageService.listenQuickLinks((links) => {
      setQuickLinks(
        links.filter(
          (l) => l.status === 'active' && l.id !== 'ql-4' && !l.title?.toLowerCase().includes('scholarship')
        )
      );
    });

    const unsubSections = StorageService.listenHomepageSections((sections) => {
      setHomepageSections(sections.filter((s) => s.status === 'active'));
    });

    return () => {
      unsubLinks();
      unsubSections();
    };
  }, []);

  const renderQuickLinkIcon = (iconName?: string) => {
    switch (iconName) {
      case 'Swords': return <Swords className="w-5 h-5 text-amber-500" />;
      case 'MessageSquare': return <MessageSquare className="w-5 h-5 text-[#1b5e20] dark:text-blue-400" />;
      case 'FileText': return <BookOpen className="w-5 h-5 text-blue-600 dark:text-blue-400" />;
      case 'GraduationCap': return <GraduationCap className="w-5 h-5 text-[#1b5e20] dark:text-purple-400" />;
      case 'Video': return <Video className="w-5 h-5 text-rose-500" />;
      case 'Sparkles': return <Sparkles className="w-5 h-5 text-amber-500" />;
      case 'BookOpen': return <BookOpen className="w-5 h-5 text-[#1b5e20] dark:text-blue-400" />;
      case 'Zap': return <Zap className="w-5 h-5 text-amber-500" />;
      case 'Award': return <Award className="w-5 h-5 text-amber-500" />;
      default: return <Globe className="w-5 h-5 text-slate-500" />;
    }
  };

  const sampleQuestion = {
    q: 'GST101: Which of the following best exemplifies the subject-verb concord rule regarding proximity in "neither... nor"?',
    a: 'Neither the principal nor the teachers were present.',
    b: 'Neither the principal nor the teachers was present.',
    c: 'Neither the teachers nor the principal were present.',
    d: 'Neither the principal nor the teachers is present.',
    correct: 'a',
    explanation: 'According to the rule of proximity, when subjects are connected by "neither... nor", the verb agrees in number with the subject closer to it. Here "the teachers" is plural, requiring "were".',
  };

  const faqs = [
    {
      q: 'How does the free practice trial work?',
      a: 'Every newly registered student receives 30 free practice questions immediately. You can test practice mode and see full step-by-step explanations without entering any payment details.',
    },
    {
      q: 'Can administrators generate questions directly from PDF course outlines?',
      a: 'Yes! Administrators can upload course outlines, lecture notes, or PDF study materials into the Question Generator. The system automatically extracts topics and creates verified multiple-choice questions with answer keys and explanations.',
    },
    {
      q: 'Is the Mock CBT timer realistic to actual university CBT software?',
      a: 'Yes. The Mock CBT practice engine mimics authentic computer-based testing environments used by Nigerian universities (UNILAG, UI, ABU, OAU, CU) including countdown timers, question navigation palettes, mark for review, and auto-submission on timeout.',
    },
    {
      q: 'What payment methods are supported for Nigerian & International students?',
      a: 'We integrate with Paystack and Flutterwave, supporting Debit/Credit Cards, Bank Transfers, USSD codes, and Mobile Money with instant automatic activation.',
    },
    {
      q: 'Can our university or faculty be added to the database?',
      a: 'Absolutely. The platform is designed to scale across unlimited universities, faculties, departments, courses, and academic sessions.',
    },
  ];

  return (
    <div className="w-full max-w-full bg-[#f4f5f7] dark:bg-slate-950 text-slate-900 dark:text-slate-100 min-h-screen font-sans" id="landing-container">
      
      {/* Hero Section */}
      <section className="relative pt-10 pb-14 sm:pt-14 sm:pb-20 border-b border-slate-200 dark:border-white/[0.08] w-full" id="hero-section">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            
            {/* Primary Brand Title: ACADET CBT MASTER at the top only */}
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold text-slate-900 dark:text-white tracking-tight leading-tight mb-2">
              ACADET CBT MASTER
            </h1>

            {/* Immediately at the bottom of the ACADET CBT MASTER name */}
            <p className="text-lg sm:text-xl sm:leading-snug font-bold text-[#1b5e20] dark:text-blue-400 tracking-tight mb-4">
              Master Past Questions & Course Material Exams
            </p>

            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-100 dark:bg-blue-950/60 text-[#1b5e20] dark:text-blue-400 border border-blue-300 dark:border-blue-800 text-xs font-semibold tracking-normal mb-5">
              <GraduationCap className="w-4 h-4 text-[#1b5e20] dark:text-blue-400 shrink-0" />
              <span>Nigerian Tertiary Institutions & Pre-JAMB CBT Examination Portal</span>
            </div>

            <p className="text-slate-600 dark:text-slate-300 text-sm sm:text-base mb-8 leading-relaxed font-normal max-w-2xl mx-auto">
              Practice verified Nigerian university past questions, simulate authentic timed CBT examinations, generate custom questions from lecture notes, and get instant step-by-step explanations to score A’s.
            </p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-8">
              <button
                onClick={onStartPractice}
                className="w-full sm:w-auto px-6 py-3 bg-[#1b5e20] hover:bg-[#155217] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors flex items-center justify-center gap-2 cursor-pointer"
                id="hero-start-btn"
              >
                <BookOpen className="w-4 h-4" />
                Start Free Practice (30 Free Qs)
              </button>
              <button
                onClick={() => onOpenAuth('register')}
                className="w-full sm:w-auto px-6 py-3 bg-white hover:bg-slate-50 dark:bg-slate-900 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-200 hover:text-slate-900 dark:hover:text-white font-semibold text-xs sm:text-sm rounded-xl border border-slate-300 dark:border-white/[0.08] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                id="hero-register-btn"
              >
                Create Student Account
                <ArrowRight className="w-4 h-4 text-slate-500" />
              </button>
              {onOpenInstallModal && (
                <button
                  onClick={onOpenInstallModal}
                  className="w-full sm:w-auto px-5 py-3 bg-blue-50 hover:bg-blue-100 dark:bg-slate-900 dark:hover:bg-slate-800 text-[#1b5e20] dark:text-blue-400 font-bold text-xs sm:text-sm rounded-xl border border-blue-200 dark:border-white/[0.08] transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  id="hero-install-app-btn"
                >
                  <Smartphone className="w-4 h-4 text-[#1b5e20] dark:text-blue-400" />
                  <span>Download Mobile App</span>
                  <Download className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-xs">
              <div className="text-center p-2">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">
                  {questionsCount > 0 ? questionsCount.toLocaleString() : '0'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Database Questions</p>
              </div>
              <div className="text-center p-2">
                <p className="text-xl sm:text-2xl font-bold text-[#1b5e20] dark:text-blue-400">
                  {universitiesCount > 0 ? `${universitiesCount} Universities` : '0 Universities'}
                </p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Accredited Institutions</p>
              </div>
              <div className="text-center p-2">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white">100% Free</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Open Practice Access</p>
              </div>
              <div className="text-center p-2">
                <p className="text-xl sm:text-2xl font-bold text-blue-700 dark:text-blue-400">Timed CBT</p>
                <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1 font-medium">Authentic Exam Engine</p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Dynamic Homepage Sections Managed via Admin Interface Editor */}
      {homepageSections.map((sec) => (
        <section key={sec.id} className="py-10 border-b border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 w-full">
          <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            
            {/* Type: Announcement */}
            {sec.type === 'announcement' && (
              <div className={`p-6 sm:p-8 rounded-2xl border border-blue-200 dark:border-blue-500/30 bg-blue-50 dark:bg-slate-900 relative overflow-hidden shadow-xs`}>
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-10">
                  <div className="space-y-2 max-w-3xl">
                    {sec.badge && (
                      <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-[#1b5e20] text-white mb-1">
                        {stripEmojis(sec.badge)}
                      </span>
                    )}
                    <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{stripEmojis(sec.title)}</h2>
                    {sec.subtitle && <p className="text-sm font-semibold text-[#1b5e20] dark:text-blue-300">{stripEmojis(sec.subtitle)}</p>}
                    {sec.description && <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{stripEmojis(sec.description)}</p>}
                  </div>
                  {sec.buttonText && (
                    <button
                      onClick={onStartPractice}
                      className="px-6 py-3 bg-[#1b5e20] hover:bg-[#155217] text-white rounded-xl text-xs font-bold shadow-xs shrink-0 cursor-pointer"
                    >
                      {stripEmojis(sec.buttonText)}
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* Type: Quick Links */}
            {sec.type === 'quick_links' && quickLinks.length > 0 && (
              <div className="space-y-6">
                <div className="text-center max-w-2xl mx-auto">
                  <span className="text-xs font-bold uppercase tracking-wider text-[#1b5e20] dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 px-3 py-1 rounded-full border border-blue-200 dark:border-blue-500/20">
                    Quick Portals & Resources
                  </span>
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-3">{stripEmojis(sec.title)}</h2>
                  {sec.subtitle && <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">{stripEmojis(sec.subtitle)}</p>}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4">
                  {quickLinks.map((link) => (
                    <a
                      key={link.id}
                      href={link.url}
                      target={link.target || '_self'}
                      rel={link.target === '_blank' ? 'noopener noreferrer' : undefined}
                      className="p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-[#1b5e20] dark:hover:border-blue-500/60 transition-all flex flex-col justify-between group shadow-xs"
                    >
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-50 dark:bg-slate-950 border border-slate-200 dark:border-slate-800 flex items-center justify-center shrink-0">
                            {renderQuickLinkIcon(link.icon)}
                          </div>
                          {link.badge && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-blue-500/20 text-[#1b5e20] dark:text-blue-300 border border-blue-200 dark:border-blue-500/30">
                              {stripEmojis(link.badge)}
                            </span>
                          )}
                        </div>
                        <h3 className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-[#1b5e20] dark:group-hover:text-blue-400 transition-colors flex items-center gap-1.5">
                          <span>{stripEmojis(link.title)}</span>
                          {link.target === '_blank' && <ExternalLink className="w-3 h-3 text-slate-400" />}
                        </h3>
                        {link.description && <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed line-clamp-2">{stripEmojis(link.description)}</p>}
                      </div>
                      <div className="mt-4 pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs font-semibold text-[#1b5e20] dark:text-blue-400 group-hover:translate-x-0.5 transition-transform">
                        <span>Open Link</span>
                        <span>→</span>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Type: Featured Content / Banner */}
            {(sec.type === 'featured_content' || sec.type === 'ad_banner') && (
              <div className={`p-6 sm:p-8 rounded-2xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex flex-col md:flex-row items-center gap-8 shadow-xs`}>
                {(sec.imageUrl || sec.id === 'sec-3' || sec.title?.includes('Pre-JAMB')) && (
                  <img
                    src={
                      sec.id === 'sec-3' || sec.title?.includes('Pre-JAMB') || sec.imageUrl?.includes('516321318423')
                        ? cbtCandidatesImg
                        : (sec.imageUrl || cbtCandidatesImg)
                    }
                    alt={stripEmojis(sec.title)}
                    className="w-full md:w-80 h-48 sm:h-52 object-cover rounded-xl border border-slate-200 dark:border-slate-800 shrink-0"
                    referrerPolicy="no-referrer"
                  />
                )}
                <div className="space-y-3 flex-1">
                  {sec.badge && (
                    <span className="inline-block px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-[#1b5e20] border border-blue-200">
                      {stripEmojis(sec.badge)}
                    </span>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white">{stripEmojis(sec.title)}</h2>
                  {sec.subtitle && <p className="text-sm font-semibold text-[#1b5e20] dark:text-blue-300">{stripEmojis(sec.subtitle)}</p>}
                  {sec.description && <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">{stripEmojis(sec.description)}</p>}
                  {sec.buttonText && (
                    <button
                      onClick={onStartPractice}
                      className="px-6 py-2.5 bg-[#1b5e20] hover:bg-[#155217] text-white font-bold text-xs rounded-xl shadow-xs inline-block mt-2 cursor-pointer"
                    >
                      {stripEmojis(sec.buttonText)}
                    </button>
                  )}
                </div>
              </div>
            )}

          </div>
        </section>
      ))}

      {/* Interactive Sample CBT Teaser */}
      <section className="py-14 bg-white dark:bg-slate-900/40 border-b border-slate-200 dark:border-white/[0.08] w-full" id="sample-cbt-teaser">
        <div className="w-full max-w-4xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1b5e20] dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 px-3.5 py-1 rounded-full shadow-xs">
              Sample CBT Preview
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-3 tracking-tight">Interactive Sample Question</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1">Experience how instant explanations and CBT grading work.</p>
          </div>

          <div className="bg-[#f8fafc] dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/[0.08] p-6 shadow-xs">
            <div className="flex items-center justify-between pb-3.5 border-b border-slate-200 dark:border-white/[0.08] mb-4">
              <span className="text-xs font-bold text-slate-700 dark:text-slate-300">GST101 • General Studies</span>
              <span className="text-xs bg-slate-800 dark:bg-slate-700 text-white px-3 py-1 rounded-md font-bold shadow-xs">Topic: Subject-Verb Concord</span>
            </div>

            <p className="text-slate-900 dark:text-slate-100 font-semibold text-sm sm:text-base mb-6 leading-relaxed">{sampleQuestion.q}</p>

            <div className="space-y-2.5 mb-6">
              {[
                { key: 'a', text: sampleQuestion.a },
                { key: 'b', text: sampleQuestion.b },
                { key: 'c', text: sampleQuestion.c },
                { key: 'd', text: sampleQuestion.d },
              ].map((opt) => {
                const isSelected = selectedAnswer === opt.key;
                const isCorrect = opt.key === sampleQuestion.correct;
                let btnStyle = 'bg-white dark:bg-white/[0.02] border-slate-200 dark:border-white/[0.08] text-slate-800 dark:text-slate-200 hover:border-slate-300 dark:hover:border-white/[0.16]';

                if (selectedAnswer) {
                  if (isCorrect) {
                    btnStyle = 'bg-blue-50 border-blue-500 text-[#1b5e20] dark:bg-blue-500/10 dark:text-blue-200 font-bold';
                  } else if (isSelected) {
                    btnStyle = 'bg-rose-50 border-rose-500 text-rose-800 dark:bg-rose-500/10 dark:text-rose-200';
                  }
                }

                return (
                  <button
                    key={opt.key}
                    onClick={() => {
                      setSelectedAnswer(opt.key);
                      setShowExplanation(true);
                    }}
                    className={`w-full text-left p-3.5 rounded-xl border font-normal text-xs sm:text-sm transition-colors flex items-center justify-between cursor-pointer ${btnStyle}`}
                  >
                    <span><strong className="uppercase mr-2 text-[#1b5e20] dark:text-indigo-400 font-bold">{opt.key})</strong> {opt.text}</span>
                    {selectedAnswer && isCorrect && <CheckCircle2 className="w-5 h-5 text-[#1b5e20] dark:text-blue-400 shrink-0" />}
                  </button>
                );
              })}
            </div>

            {showExplanation && (
              <div className="p-4 rounded-xl bg-white dark:bg-white/[0.03] border border-blue-200 dark:border-white/[0.08] text-xs text-slate-700 dark:text-slate-300 animate-in fade-in">
                <div className="flex items-center gap-2 font-bold text-[#1b5e20] dark:text-blue-400 mb-1.5">
                  <BookOpen className="w-4 h-4 text-[#1b5e20] dark:text-blue-400" />
                  Detailed Explanation Breakdown:
                </div>
                <p className="leading-relaxed">{sampleQuestion.explanation}</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section className="py-14 sm:py-18 border-b border-slate-200 dark:border-white/[0.08] w-full" id="features-section">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Everything You Need for Exam Success</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-2 font-normal">Built specifically to match official Nigerian university CBT software standards.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            
            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-[#1b5e20] dark:text-blue-400 flex items-center justify-center">
                    <BookOpen className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-md bg-[#1b5e20] dark:bg-blue-600 text-white shadow-xs uppercase tracking-wide">
                    UTME & Degree
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Past Questions Vault</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Access categorized past questions filtered by University, Faculty, Department, Course, Semester, and Academic Session.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800/40 text-purple-700 dark:text-purple-400 flex items-center justify-center">
                    <Brain className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-md bg-purple-700 dark:bg-purple-600 text-white shadow-xs uppercase tracking-wide">
                    Smart Question Generator
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Material Question Generator</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Lecturers and admins upload course materials or outlines; the generator extracts realistic multiple-choice questions with answer keys.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400 flex items-center justify-center mb-4">
                    <Clock className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-md bg-blue-700 dark:bg-blue-600 text-white shadow-xs uppercase tracking-wide">
                    Timed Exam Hall
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Timed Mock CBT</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Authentic examination conditions with countdown timers, question grid palette, marked for review, and auto-submit.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800/40 text-amber-700 dark:text-amber-400 flex items-center justify-center">
                    <ShieldCheck className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-md bg-amber-700 dark:bg-amber-600 text-white shadow-xs uppercase tracking-wide">
                    Step-by-Step
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Detailed Explanations</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Never guess again. Every question includes a clear step-by-step reasoning breakdown explaining why the answer is right.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-950/40 border border-blue-200 dark:border-blue-800/40 text-blue-700 dark:text-blue-400 flex items-center justify-center">
                    <Award className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-md bg-blue-700 dark:bg-blue-600 text-white shadow-xs uppercase tracking-wide">
                    Score Analytics
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Performance Analytics</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Identify weak topics, average scores, and learning progress trends to focus your study time effectively.
                </p>
              </div>
            </div>

            <div className="p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800/40 text-rose-700 dark:text-rose-400 flex items-center justify-center">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span className="text-xs font-black px-3 py-1 rounded-md bg-rose-700 dark:bg-rose-600 text-white shadow-xs uppercase tracking-wide">
                    National Scale
                  </span>
                </div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white mb-1.5">Multi-University Scale</h3>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  Supports FUL, UNILAG, UI, ABU, OAU, Covenant University, and easily expandable to any tertiary institution.
                </p>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* Free Access Plan Card */}
      <section className="py-14 sm:py-18 border-b border-slate-200 dark:border-white/[0.08] w-full" id="pricing-section">
        <div className="w-full max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-2xl mx-auto mb-10">
            <span className="text-xs font-semibold uppercase tracking-wider text-[#1b5e20] dark:text-blue-400 bg-blue-100 dark:bg-blue-950/60 border border-blue-300 dark:border-blue-800 px-3.5 py-1.5 rounded-full">
              Zero Payment Required
            </span>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mt-3 tracking-tight">100% Free Practice Access</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-2 font-normal">All past questions, CBT practice sessions, mock exams, study materials, and Smart tools are accessible for all students.</p>
          </div>

          <div className="max-w-2xl mx-auto bg-white dark:bg-slate-900 p-6 sm:p-8 rounded-2xl border border-blue-200 dark:border-blue-500/30 shadow-xs text-center space-y-5">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-[#1b5e20] dark:bg-blue-700 text-white text-xs font-semibold shadow-xs">
              <CheckCircle2 className="w-3.5 h-3.5 text-white" />
              <span>Full Student Plan — ₦0 NGN</span>
            </div>

            <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">
              Complete Student Examination Access
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-left max-w-lg mx-auto text-xs text-slate-700 dark:text-slate-300">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1b5e20] dark:text-blue-400 shrink-0" />
                <span>Unlimited CBT Practice Questions</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1b5e20] dark:text-blue-400 shrink-0" />
                <span>Full Timed Mock Exam Simulations</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1b5e20] dark:text-blue-400 shrink-0" />
                <span>PDF Study Materials & Summaries</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1b5e20] dark:text-blue-400 shrink-0" />
                <span>Instant SMART Explanations</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1b5e20] dark:text-blue-400 shrink-0" />
                <span>Smart Custom Question Generator</span>
              </div>
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#1b5e20] dark:text-blue-400 shrink-0" />
                <span>MenCore Smart Assistant Support</span>
              </div>
            </div>

            <div className="pt-2">
              <button
                onClick={onStartPractice}
                className="px-6 py-3 bg-[#1b5e20] hover:bg-[#155217] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer inline-flex items-center gap-2"
              >
                <span>Start Practicing Now For Free</span>
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Accordion */}
      <section className="py-14 sm:py-18 border-b border-slate-200 dark:border-white/[0.08] w-full" id="faq-section">
        <div className="w-full max-w-3xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight">Frequently Asked Questions</h2>
            <p className="text-slate-500 dark:text-slate-400 text-xs sm:text-sm mt-1 font-normal">Have questions before starting? We have answers.</p>
          </div>

          <div className="space-y-3">
            {faqs.map((faq, index) => {
              const isOpen = activeFaq === index;
              return (
                <div key={index} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-xl overflow-hidden shadow-xs">
                  <button
                    onClick={() => setActiveFaq(isOpen ? null : index)}
                    className="w-full text-left p-4 text-xs sm:text-sm font-semibold text-slate-800 dark:text-slate-200 flex items-center justify-between hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors"
                  >
                    <span>{faq.q}</span>
                    {isOpen ? <ChevronUp className="w-4 h-4 text-[#1b5e20] dark:text-indigo-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                  </button>
                  {isOpen && (
                    <div className="p-4 pt-0 text-xs text-slate-600 dark:text-slate-400 leading-relaxed border-t border-slate-100 dark:border-white/[0.06] bg-slate-50/50 dark:bg-white/[0.01]">
                      {faq.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* About Acadet Section */}
      <section className="py-14 sm:py-18 bg-white dark:bg-slate-900/40 border-b border-slate-200 dark:border-white/[0.08] w-full" id="about-acadet-section">
        <div className="w-full max-w-5xl mx-auto px-4 sm:px-6">
          
          <div className="text-center max-w-3xl mx-auto mb-10">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-blue-700 dark:bg-blue-600 text-white text-xs font-black uppercase tracking-wider mb-3 shadow-xs">
              <GraduationCap className="w-3.5 h-3.5 text-white" />
              <span>Modern Nigerian University Practice Engine</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight mb-2">
              About Acadet
            </h2>
          </div>

          {/* About Text Content */}
          <div className="bg-[#f8fafc] dark:bg-slate-900 border border-slate-200 dark:border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-5 text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed shadow-xs">
            <p>
              <strong>Acadet CBT Master</strong> is a modern CBT learning and examination preparation platform founded by{' '}
              <button
                onClick={onOpenFounder}
                className="text-amber-600 dark:text-amber-400 hover:underline font-bold cursor-pointer transition-colors"
              >
                Menmex
              </button>
              . Acadet CBT Master was founded and developed by{' '}
              <button
                onClick={onOpenFounder}
                className="text-[#1e3a8a] dark:text-indigo-400 hover:underline font-bold cursor-pointer transition-colors"
              >
                Menmex
              </button>
              , a Computer Science student at <strong>Federal University Lokoja</strong> and a digital technology enthusiast.
            </p>
            <p>
              Acadet is designed to help university students prepare smarter, practice confidently, and achieve academic success. The platform provides organized course materials, past questions, mock examinations, performance tracking, and interactive learning tools tailored to each university, level, semester, and course.
            </p>
            <p>
              Built with reliability, simplicity, and innovation in mind, Acadet offers a seamless learning experience where students can access quality academic resources, monitor their progress, and strengthen their knowledge through structured practice. Every feature is designed to deliver accurate, real-time content while providing a secure and user-friendly environment.
            </p>
            <p>
              Whether you're preparing for semester tests, faculty examinations, or mastering challenging course topics, Acadet is built to support your academic journey every step of the way.
            </p>

            {/* Mission & Vision Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-5 rounded-xl space-y-2 shadow-xs">
                <div className="flex items-center gap-2 text-[#1e3a8a] dark:text-indigo-400 font-bold text-sm">
                  <Target className="w-4 h-4 text-[#1e3a8a]" />
                  <span>Our Mission</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  To make quality academic preparation accessible through smart technology, helping students learn efficiently, practice consistently, and perform with confidence.
                </p>
              </div>

              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-5 rounded-xl space-y-2 shadow-xs">
                <div className="flex items-center gap-2 text-blue-700 dark:text-cyan-400 font-bold text-sm">
                  <Eye className="w-4 h-4 text-blue-600" />
                  <span>Our Vision</span>
                </div>
                <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-normal">
                  To become one of the leading digital learning and CBT platforms, empowering students with innovative educational tools that improve learning outcomes across universities.
                </p>
              </div>
            </div>

            {/* Creators & Support */}
            <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-5 rounded-xl grid grid-cols-1 sm:grid-cols-2 gap-4 items-center shadow-xs">
              <div
                onClick={onOpenFounder}
                className="flex items-center gap-3.5 cursor-pointer group hover:bg-slate-50 dark:hover:bg-white/[0.02] p-2 rounded-xl transition-colors"
                id="about-founder-card-link"
              >
                <div className="w-10 h-10 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 flex items-center justify-center text-amber-500 shrink-0">
                  <Award className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">Founder & Creator</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white group-hover:text-amber-600 transition-colors flex items-center gap-1.5">
                    Menmex
                    <span className="text-xs text-amber-600 font-normal">Profile →</span>
                  </span>
                  <span className="text-[11px] text-slate-500 block">Computer Science, Federal University Lokoja</span>
                </div>
              </div>

              <div className="flex items-center gap-3.5 p-2">
                <div className="w-10 h-10 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/20 flex items-center justify-center text-rose-500 shrink-0">
                  <Heart className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">With the Support of</span>
                  <span className="text-sm font-bold text-slate-900 dark:text-white">Joyce & Video Tutorial Team</span>
                  <span className="text-[11px] text-slate-500 block">High-Yield Video Tutorials & Explanations</span>
                </div>
              </div>
            </div>

            {/* Inspiration Quote */}
            <blockquote className="bg-white dark:bg-white/[0.02] border-l-4 border-[#1e3a8a] p-4 rounded-r-xl italic text-slate-700 dark:text-slate-300 text-xs sm:text-sm leading-relaxed shadow-xs">
              "Great ideas become reality through collaboration, dedication, and a shared commitment to excellence. Acadet is a reflection of that vision—built to inspire learning, empower students, and shape academic success."
            </blockquote>

            {/* Official Social Media Links */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* YouTube Channel */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-5 rounded-xl flex flex-col justify-between gap-3.5 shadow-xs">
                <div className="flex items-start gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 flex items-center justify-center text-red-600 shrink-0">
                    <Youtube className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">Acadet CBT Master YouTube</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">Subscribe for step-by-step video tutorials, CBT masterclasses & exam breakdowns by Joyce and team.</p>
                  </div>
                </div>

                <a
                  href="https://youtube.com/@acadetcbtmaster?si=Z05Z-87Vtar00lsr"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  id="landing-youtube-btn"
                >
                  <Youtube className="w-3.5 h-3.5" />
                  <span>Subscribe on YouTube (@acadetcbtmaster)</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>

              {/* Official WhatsApp Channel */}
              <div className="bg-white dark:bg-white/[0.02] border border-slate-200 dark:border-white/[0.08] p-5 rounded-xl flex flex-col justify-between gap-3.5 shadow-xs">
                <div className="flex items-start gap-3 text-left">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 dark:bg-blue-500/10 border border-blue-200 dark:border-blue-500/20 flex items-center justify-center text-[#1e3a8a] shrink-0">
                    <MessageSquare className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-900 dark:text-white">AcadetCBT Learning HUB WhatsApp</h4>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-1 font-normal">Follow the AcadetCBT Learning HUB channel on WhatsApp for real-time academic updates and study materials.</p>
                  </div>
                </div>

                <a
                  href="https://whatsapp.com/channel/0029VbD0s0Y7oQhXIlLM4c3K"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full px-4 py-2 bg-[#1e3a8a] hover:bg-[#172554] text-white text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-xs"
                  id="landing-whatsapp-btn"
                >
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>Follow AcadetCBT Learning HUB</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Footer Banner */}
      <section className="py-14 bg-blue-50 dark:bg-slate-900 border-b border-blue-200 dark:border-white/[0.08] text-center w-full" id="cta-footer">
        <div className="w-full max-w-4xl mx-auto px-4">
          <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white mb-2 tracking-tight">Ready to Score A’s in Your Next CBT Exams?</h2>
          <p className="text-slate-600 dark:text-slate-400 text-xs sm:text-sm mb-6 max-w-xl mx-auto font-normal">Join thousands of university students practicing past questions and course material tests.</p>
          <button
            onClick={onStartPractice}
            className="px-6 py-3 bg-[#1e3a8a] hover:bg-[#172554] text-white font-bold text-xs sm:text-sm rounded-xl shadow-xs transition-colors cursor-pointer"
          >
            Start Free Practice Now
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-8 bg-white dark:bg-slate-950 border-t border-slate-200 dark:border-white/[0.08] text-center text-xs text-slate-500 w-full">
        <div className="w-full max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p className="font-normal text-[11px] sm:text-xs text-slate-600 dark:text-slate-400">
            © 2026 Acadet CBT MASTER.{' '}
            <button
              onClick={onOpenFounder}
              className="text-amber-600 dark:text-amber-400 hover:underline font-bold"
            >
              Created by Menmex
            </button>{' '}
            with the support of Joyce and the video tutorial team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 text-[11px] text-slate-500">
            <button
              onClick={onOpenFounder}
              className="text-amber-600 dark:text-amber-400 hover:underline font-bold"
            >
              Founder Profile
            </button>
            <a
              href="https://youtube.com/@acadetcbtmaster?si=Z05Z-87Vtar00lsr"
              target="_blank"
              rel="noopener noreferrer"
              className="text-red-600 hover:underline font-semibold"
            >
              YouTube Channel
            </a>
            <a
              href="https://whatsapp.com/channel/0029VbD0s0Y7oQhXIlLM4c3K"
              target="_blank"
              rel="noopener noreferrer"
              className="text-[#1e3a8a] hover:underline font-semibold"
            >
              WhatsApp Hub
            </a>
            <button
              onClick={onStartPractice}
              className="text-[#1e3a8a] dark:text-blue-400 hover:underline font-semibold"
            >
              Free Practice
            </button>
          </div>
        </div>
      </footer>

    </div>
  );
};
