import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Send,
  User,
  UserPlus,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { SafeUser } from '../../types/cbt';
import { AcadetCrest, useBranding } from './AcadetLogo';

export type AuthScreenMode = 'login' | 'register' | 'forgot';

interface AuthScreenProps {
  onAuthenticated: (user: SafeUser, infoNotice?: string | null) => void;
  dbConfigured: boolean;
  dbConnected: boolean;
  dbError?: string;
  suspensionNotice?: string | null;
  initialMode?: AuthScreenMode;
  onNavigatePublic?: (path: string) => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  dbConfigured,
  dbConnected,
  dbError,
  suspensionNotice = null,
  initialMode = 'login',
  onNavigatePublic,
}) => {
  const { branding } = useBranding();
  const [mode, setMode] = useState<AuthScreenMode>(initialMode);

  useEffect(() => {
    setMode(initialMode);
  }, [initialMode]);

  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [examTarget, setExamTarget] = useState('Acadet CBT Examination');

  const [forgotEmail, setForgotEmail] = useState('');
  const [forgotSubmitting, setForgotSubmitting] = useState(false);
  const [forgotSuccess, setForgotSuccess] = useState<string | null>(null);
  const [forgotError, setForgotError] = useState<string | null>(null);

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [bannerSuccess, setBannerSuccess] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null;
    const params = new URLSearchParams(window.location.search);
    if (params.get('reset') === 'success') {
      return 'Your password has been reset successfully. You can now sign in with your new password.';
    }
    if (params.get('verified') === '1') {
      return 'Your email address has been verified. Please sign in to continue.';
    }
    return null;
  });

  const switchMode = (nextMode: AuthScreenMode) => {
    setMode(nextMode);
    setErrorMessage(null);
    setForgotError(null);
    setForgotSuccess(null);
    if (nextMode !== 'login') {
      setBannerSuccess(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setBannerSuccess(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await api.auth.login({ identifier, password });
        onAuthenticated(res.user, null);
      } else {
        const res = await api.auth.register({
          fullName,
          email,
          username,
          password,
          examTarget,
        });
        const notice = res.verificationEmailSent
          ? `Account created! A verification link was sent to ${res.user.email}.`
          : res.verificationNotice || null;
        onAuthenticated(res.user, notice);
      }
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.message);
      } else {
        setErrorMessage('Unable to connect to the authentication server.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setForgotError(null);
    setForgotSuccess(null);
    setForgotSubmitting(true);

    try {
      const res = await api.auth.forgotPassword(forgotEmail.trim());
      setForgotSuccess(
        res.message ||
          'If an active account matches that email address, a password reset link has been sent.'
      );
    } catch (err) {
      if (err instanceof ApiError) {
        setForgotError(err.message);
      } else {
        setForgotError('Unable to reach the password recovery service right now.');
      }
    } finally {
      setForgotSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#eef3fb] dark:bg-[#0a0f1e]">
      <header className="bg-[#0b337a] text-white px-4 sm:px-8 py-3.5 shadow-md border-b border-white/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <a
            href="/"
            onClick={(e) => {
              if (onNavigatePublic) {
                e.preventDefault();
                onNavigatePublic('/');
              }
            }}
            className="flex items-center gap-3 min-w-0"
          >
            <AcadetCrest className="w-10 h-10" />
            <div className="min-w-0">
              <div className="text-lg sm:text-xl font-extrabold tracking-tight leading-tight truncate">
                {branding.siteName}
              </div>
              <p className="text-xs italic text-blue-100 truncate">{branding.tagline}</p>
            </div>
          </a>

          {onNavigatePublic && (
            <div className="flex items-center gap-3 text-xs sm:text-sm font-bold shrink-0">
              <button
                type="button"
                onClick={() => onNavigatePublic('/courses')}
                className="hidden sm:inline text-blue-100 hover:text-white hover:underline"
              >
                Courses
              </button>
              <button
                type="button"
                onClick={() => onNavigatePublic('/founder')}
                className="hidden sm:inline text-blue-100 hover:text-white hover:underline"
              >
                Founder
              </button>
              <button
                type="button"
                onClick={() => onNavigatePublic('/')}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white"
              >
                Public Home
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-md space-y-3">
          {suspensionNotice && (
            <div className="rounded-xl border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/50 px-3.5 py-2.5 text-red-800 dark:text-red-200 text-xs sm:text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-red-600 dark:text-red-400" />
              <div>
                <div className="font-extrabold">Account Suspended</div>
                <p className="mt-0.5 leading-snug">{suspensionNotice}</p>
              </div>
            </div>
          )}

          {(!dbConfigured || !dbConnected) && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-3.5 py-2.5 text-amber-900 dark:text-amber-200 text-xs sm:text-sm flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
              <div>
                <div className="font-bold">
                  {!dbConfigured
                    ? 'Render PostgreSQL Not Connected Yet'
                    : 'PostgreSQL Connection Unreachable'}
                </div>
                <p className="text-xs mt-1 opacity-90 leading-relaxed">
                  {!dbConfigured
                    ? 'Sign in and sign up save directly to PostgreSQL. Set DATABASE_URL (your Render PostgreSQL External URL for preview testing, or deploy to Render via render.yaml where DATABASE_URL connects automatically).'
                    : dbError || 'Unable to reach PostgreSQL using DATABASE_URL.'}
                </p>
              </div>
            </div>
          )}

          <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-lg overflow-hidden">
            <div className="bg-[#0b337a] px-4 sm:px-5 py-3.5 text-white flex items-center gap-3">
              <AcadetCrest className="w-9 h-9" />
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                  {mode === 'login'
                    ? 'Student & Staff Sign In'
                    : mode === 'register'
                      ? 'Create Student Account'
                      : 'Forgot Password'}
                </h1>
                <p className="text-xs text-blue-100 mt-0.5">
                  {mode === 'login'
                    ? `Sign in to access ${branding.siteName} practice exams, verified results, and study materials.`
                    : mode === 'register'
                      ? `Register on ${branding.siteName} to save exam attempts, track trends, and verify your email.`
                      : 'Enter your registered email address to receive a single-use password reset link.'}
                </p>
              </div>
            </div>

            <div className="p-4 sm:p-5 space-y-3.5">
              {mode !== 'forgot' ? (
                <div className="grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                      mode === 'login'
                        ? 'bg-white dark:bg-slate-900 text-[#0b337a] dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Sign In
                  </button>
                  <button
                    type="button"
                    onClick={() => switchMode('register')}
                    className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                      mode === 'register'
                        ? 'bg-white dark:bg-slate-900 text-[#0b337a] dark:text-blue-400 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    Create Account
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 pb-1">
                  <button
                    type="button"
                    onClick={() => switchMode('login')}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-[#0b337a] dark:text-blue-300 hover:underline"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                  <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
                    Link expires in 20 minutes
                  </span>
                </div>
              )}

              {bannerSuccess && mode === 'login' && (
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <span>{bannerSuccess}</span>
                </div>
              )}

              {mode === 'forgot' ? (
                <form onSubmit={handleForgotSubmit} className="space-y-4">
                  <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-3 text-xs text-[#082252] dark:text-slate-200 leading-relaxed flex items-start gap-2">
                    <KeyRound className="w-4 h-4 shrink-0 text-[#0a58ed] mt-0.5" />
                    <span>
                      For security, existing passwords are never emailed. We will send a single-use recovery link valid for 20 minutes to your registered email address.
                    </span>
                  </div>

                  {forgotError && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-300">
                      {forgotError}
                    </div>
                  )}

                  {forgotSuccess && (
                    <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 text-xs sm:text-sm font-medium text-emerald-800 dark:text-emerald-200 flex items-start gap-2">
                      <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                      <span>{forgotSuccess}</span>
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                      Registered Email Address
                    </label>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={forgotEmail}
                        onChange={(e) => setForgotEmail(e.target.value)}
                        placeholder="you@example.com"
                        autoComplete="email"
                        className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={forgotSubmitting}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-extrabold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-60"
                  >
                    {forgotSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>
                      {forgotSubmitting ? 'Sending Reset Link...' : 'Send Password Reset Link'}
                    </span>
                  </button>
                </form>
              ) : (
                <>
                  {errorMessage && (
                    <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-300">
                      {errorMessage}
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-4">
                    {mode === 'login' ? (
                      <div>
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                          Email or Username
                        </label>
                        <div className="relative">
                          <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            required
                            value={identifier}
                            onChange={(e) => setIdentifier(e.target.value)}
                            placeholder="student@example.com or username"
                            className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                          />
                        </div>
                      </div>
                    ) : (
                      <>
                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                            Full Name
                          </label>
                          <div className="relative">
                            <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                            <input
                              type="text"
                              required
                              value={fullName}
                              onChange={(e) => setFullName(e.target.value)}
                              placeholder="e.g. Chinedu Okafor"
                              className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                              Email
                            </label>
                            <input
                              type="email"
                              required
                              value={email}
                              onChange={(e) => setEmail(e.target.value)}
                              placeholder="you@example.com"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                              Username
                            </label>
                            <input
                              type="text"
                              required
                              value={username}
                              onChange={(e) => setUsername(e.target.value)}
                              placeholder="chinedu01"
                              className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                            Target Examination
                          </label>
                          <input
                            type="text"
                            value={examTarget}
                            onChange={(e) => setExamTarget(e.target.value)}
                            className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                          />
                        </div>
                      </>
                    )}

                    <div>
                      <div className="flex items-center justify-between mb-1.5">
                        <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                          Password
                        </label>
                        {mode === 'login' && (
                          <button
                            type="button"
                            onClick={() => switchMode('forgot')}
                            className="text-xs font-bold text-[#0a58ed] dark:text-blue-400 hover:underline"
                          >
                            Forgot Password?
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder="Enter your password"
                          className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((prev) => !prev)}
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                        >
                          {showPassword ? (
                            <EyeOff className="w-4 h-4" />
                          ) : (
                            <Eye className="w-4 h-4" />
                          )}
                        </button>
                      </div>
                    </div>

                    <button
                      type="submit"
                      disabled={submitting}
                      className="w-full py-3 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-extrabold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[46px] disabled:opacity-60"
                    >
                      {mode === 'register' && <UserPlus className="w-4 h-4" />}
                      <span>
                        {submitting
                          ? 'Please wait...'
                          : mode === 'login'
                            ? 'Sign In to Acadet CBT'
                            : 'Create Account & Continue'}
                      </span>
                    </button>
                  </form>
                </>
              )}
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#0b337a] text-white/90 text-xs py-3.5 px-6 border-t border-white/10">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <AcadetCrest className="w-6 h-6" />
            <span>© {new Date().getFullYear()} {branding.siteName}. All rights reserved.</span>
          </div>
          <div className="flex items-center gap-3">
            {onNavigatePublic && (
              <button
                type="button"
                onClick={() => onNavigatePublic('/founder')}
                className="text-blue-100 hover:text-white underline"
              >
                Founder Profile
              </button>
            )}
            <span>Powered by Acadet Learning Hub</span>
          </div>
        </div>
      </footer>
    </div>
  );
};
