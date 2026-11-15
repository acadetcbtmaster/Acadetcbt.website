import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  MailCheck,
  Send,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { SafeUser } from '../../types/cbt';
import { AcadetCrest, useBranding } from './AcadetLogo';

interface VerifyEmailScreenProps {
  currentUser: SafeUser | null;
  onNavigate: (path: string) => void;
  onVerifiedRefreshUser?: () => Promise<void>;
}

export const VerifyEmailScreen: React.FC<VerifyEmailScreenProps> = ({
  currentUser,
  onNavigate,
  onVerifiedRefreshUser,
}) => {
  const { branding } = useBranding();

  const rawToken = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('token') || '').trim();
  }, []);

  const [verifying, setVerifying] = useState(Boolean(rawToken));
  const [verifiedMessage, setVerifiedMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [resendEmail, setResendEmail] = useState(currentUser?.email || '');
  const [resending, setResending] = useState(false);
  const [resendSuccess, setResendSuccess] = useState<string | null>(null);
  const [resendError, setResendError] = useState<string | null>(null);

  useEffect(() => {
    if (currentUser?.email && !resendEmail) {
      setResendEmail(currentUser.email);
    }
  }, [currentUser?.email, resendEmail]);

  useEffect(() => {
    let active = true;
    async function verifyToken() {
      if (!rawToken) {
        setVerifying(false);
        return;
      }

      try {
        const res = await api.auth.verifyEmail(rawToken);
        if (!active) return;
        setVerifiedMessage(
          res.message || 'Your email address has been verified successfully.'
        );
        setErrorMessage(null);
        await onVerifiedRefreshUser?.();
      } catch (err) {
        if (!active) return;
        setErrorMessage(
          err instanceof ApiError
            ? err.message
            : 'Unable to verify your email address with this link.'
        );
      } finally {
        if (active) setVerifying(false);
      }
    }

    void verifyToken();
    return () => {
      active = false;
    };
  }, [rawToken, onVerifiedRefreshUser]);

  const handleResend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendError(null);
    setResendSuccess(null);
    setResending(true);

    try {
      const res = await api.auth.resendVerification(
        currentUser ? undefined : resendEmail.trim()
      );
      setResendSuccess(res.message);
    } catch (err) {
      setResendError(
        err instanceof ApiError
          ? err.message
          : 'Unable to send verification email right now.'
      );
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#eef3fb] dark:bg-[#0a0f1e]">
      <header className="bg-[#0b337a] text-white px-4 sm:px-8 py-3.5 shadow-md border-b border-white/10">
        <div className="max-w-5xl mx-auto flex items-center justify-between gap-3">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault();
              onNavigate('/');
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

          <button
            type="button"
            onClick={() => onNavigate(currentUser ? '/' : '/login')}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-bold text-white inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>{currentUser ? 'Back to Dashboard' : 'Back to Sign In'}</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-lg overflow-hidden">
          <div className="bg-[#0b337a] px-4 sm:px-5 py-3.5 text-white flex items-center gap-3">
            <AcadetCrest className="w-9 h-9" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                Email Verification
              </h1>
              <p className="text-xs text-blue-100 mt-0.5">
                Confirm your {branding.siteName} student email address.
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {verifying ? (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-[#0a58ed]" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Verifying your email address...
                </p>
              </div>
            ) : verifiedMessage ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <div className="font-extrabold">Email Verified</div>
                    <p className="mt-1 leading-relaxed">{verifiedMessage}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => onNavigate(currentUser ? '/' : '/login?verified=1')}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-extrabold text-sm shadow-sm transition-colors"
                >
                  {currentUser ? 'Continue to Dashboard' : 'Sign In to Acadet CBT'}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {errorMessage ? (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm flex items-start gap-2.5">
                    <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                    <div>
                      <div className="font-extrabold">Verification Link Issue</div>
                      <p className="mt-1 leading-relaxed">{errorMessage}</p>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/70 border border-[#d6e4fa] dark:border-slate-700 p-4 text-sm text-[#082252] dark:text-slate-200 flex items-start gap-2.5">
                    <MailCheck className="w-5 h-5 shrink-0 text-[#0a58ed] mt-0.5" />
                    <div>
                      <div className="font-extrabold">Request Verification Email</div>
                      <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                        Enter your registered email address below to receive a fresh 24-hour verification link.
                      </p>
                    </div>
                  </div>
                )}

                {resendSuccess && (
                  <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3.5 py-2.5 text-sm text-emerald-800 dark:text-emerald-200 font-medium">
                    {resendSuccess}
                  </div>
                )}

                {resendError && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-sm text-red-700 dark:text-red-300 font-medium">
                    {resendError}
                  </div>
                )}

                <form onSubmit={handleResend} className="space-y-3">
                  {!currentUser && (
                    <div>
                      <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                        Registered Email Address
                      </label>
                      <input
                        type="email"
                        required
                        value={resendEmail}
                        onChange={(e) => setResendEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                      />
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={resending}
                    className="w-full py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-extrabold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-60"
                  >
                    {resending ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                    <span>
                      {resending ? 'Sending Link...' : 'Send New Verification Email'}
                    </span>
                  </button>
                </form>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
