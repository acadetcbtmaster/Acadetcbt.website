import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  ShieldCheck,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { api, ApiError } from '../../lib/api';
import { AcadetCrest, useBranding } from './AcadetLogo';

interface ResetPasswordScreenProps {
  onNavigate: (path: string) => void;
  onPasswordResetSuccess?: () => void;
}

export const ResetPasswordScreen: React.FC<ResetPasswordScreenProps> = ({
  onNavigate,
  onPasswordResetSuccess,
}) => {
  const { branding } = useBranding();

  const rawToken = useMemo(() => {
    if (typeof window === 'undefined') return '';
    return (new URLSearchParams(window.location.search).get('token') || '').trim();
  }, []);

  const [checkingToken, setCheckingToken] = useState<boolean>(true);
  const [tokenValid, setTokenValid] = useState<boolean>(false);
  const [tokenStatusError, setTokenStatusError] = useState<string | null>(null);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submitSuccess, setSubmitSuccess] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function validateToken() {
      if (!rawToken) {
        setCheckingToken(false);
        setTokenValid(false);
        setTokenStatusError(
          'Missing password reset token. Please open the complete reset link from your email or request a new reset link.'
        );
        return;
      }

      try {
        await api.auth.validateResetToken(rawToken);
        if (!active) return;
        setTokenValid(true);
        setTokenStatusError(null);
      } catch (err) {
        if (!active) return;
        setTokenValid(false);
        setTokenStatusError(
          err instanceof ApiError
            ? err.message
            : 'This password reset link is invalid or has expired.'
        );
      } finally {
        if (active) setCheckingToken(false);
      }
    }

    void validateToken();
    return () => {
      active = false;
    };
  }, [rawToken]);

  const requirements = [
    { label: 'At least 8 characters long', met: newPassword.length >= 8 },
    { label: 'One uppercase letter (A-Z)', met: /[A-Z]/.test(newPassword) },
    { label: 'One lowercase letter (a-z)', met: /[a-z]/.test(newPassword) },
    { label: 'One number (0-9)', met: /\d/.test(newPassword) },
    {
      label: 'Passwords match',
      met: Boolean(newPassword) && newPassword === confirmPassword,
    },
  ];

  const allRequirementsMet = requirements.every((r) => r.met);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitError(null);

    if (newPassword !== confirmPassword) {
      setSubmitError('New password and confirmation password do not match.');
      return;
    }
    if (!allRequirementsMet) {
      setSubmitError('Please ensure your new password meets all listed security requirements.');
      return;
    }

    setSubmitting(true);
    try {
      await api.auth.resetPassword({
        token: rawToken,
        newPassword,
        confirmPassword,
      });
      setSubmitSuccess(
        'Your password has been updated successfully. You can now log in using your new password.'
      );
      onPasswordResetSuccess?.();
      window.setTimeout(() => {
        onNavigate('/login?reset=success');
      }, 1800);
    } catch (err) {
      if (err instanceof ApiError) {
        setSubmitError(err.message);
        if (
          err.code === 'TOKEN_EXPIRED' ||
          err.code === 'TOKEN_ALREADY_USED' ||
          err.code === 'INVALID_TOKEN'
        ) {
          setTokenValid(false);
          setTokenStatusError(err.message);
        }
      } else {
        setSubmitError('Unable to reach the server. Please check your connection and try again.');
      }
    } finally {
      setSubmitting(false);
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
            onClick={() => onNavigate('/login')}
            className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs sm:text-sm font-bold text-white inline-flex items-center gap-1.5"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Sign In</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-3 sm:p-5">
        <div className="w-full max-w-md rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-lg overflow-hidden">
          <div className="bg-[#0b337a] px-4 sm:px-5 py-3.5 text-white flex items-center gap-3">
            <AcadetCrest className="w-9 h-9" />
            <div className="min-w-0">
              <h1 className="text-lg sm:text-xl font-extrabold tracking-tight">
                {submitSuccess ? 'Password Reset Successful!' : 'Create New Password'}
              </h1>
              <p className="text-xs text-blue-100 mt-0.5">
                {submitSuccess
                  ? 'Your password has been updated successfully. You can now log in using your new password.'
                  : `Choose a strong password for your ${branding.siteName} account.`}
              </p>
            </div>
          </div>

          <div className="p-4 sm:p-5 space-y-4">
            {checkingToken ? (
              <div className="py-8 flex flex-col items-center justify-center text-center gap-3">
                <Loader2 className="w-7 h-7 animate-spin text-[#0a58ed]" />
                <p className="text-sm font-semibold text-slate-600 dark:text-slate-300">
                  Verifying your password reset link...
                </p>
              </div>
            ) : submitSuccess ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 p-4 text-emerald-800 dark:text-emerald-200 text-sm flex items-start gap-2.5">
                  <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
                  <div>
                    <div className="font-extrabold">Password Reset Successful!</div>
                    <p className="mt-1 leading-relaxed">{submitSuccess}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => onNavigate('/login?reset=success')}
                  className="w-full py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-extrabold text-sm shadow-sm transition-colors"
                >
                  Login to Your Account
                </button>
              </div>
            ) : !tokenValid ? (
              <div className="space-y-4">
                <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 p-4 text-red-700 dark:text-red-300 text-sm flex items-start gap-2.5">
                  <AlertTriangle className="w-5 h-5 shrink-0 text-red-600 dark:text-red-400 mt-0.5" />
                  <div>
                    <div className="font-extrabold">Reset Link Unavailable</div>
                    <p className="mt-1 leading-relaxed">
                      {tokenStatusError ||
                        'This password reset link is invalid, expired, or has already been used.'}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => onNavigate('/forgot-password')}
                    className="py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-extrabold text-xs sm:text-sm inline-flex items-center justify-center gap-1.5"
                  >
                    <KeyRound className="w-4 h-4" />
                    <span>Request New Link</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => onNavigate('/login')}
                    className="py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 font-bold text-xs sm:text-sm"
                  >
                    Return to Sign In
                  </button>
                </div>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-4">
                {submitError && (
                  <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-sm font-medium text-red-700 dark:text-red-300">
                    {submitError}
                  </div>
                )}

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                    New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Enter new password"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword((prev) => !prev)}
                      aria-label={showNewPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                    >
                      {showNewPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                    Confirm New Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Re-enter new password"
                      autoComplete="new-password"
                      className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword((prev) => !prev)}
                      aria-label={
                        showConfirmPassword ? 'Hide confirm password' : 'Show confirm password'
                      }
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 dark:hover:text-slate-200 p-1"
                    >
                      {showConfirmPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>

                <div className="rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700 p-3 space-y-1.5">
                  <div className="text-xs font-extrabold text-[#082252] dark:text-slate-200 flex items-center gap-1.5">
                    <ShieldCheck className="w-4 h-4 text-[#0a58ed]" />
                    <span>Password Requirements</span>
                  </div>
                  <ul className="space-y-1">
                    {requirements.map((req) => (
                      <li
                        key={req.label}
                        className={`text-xs flex items-center gap-2 font-medium ${
                          req.met
                            ? 'text-emerald-700 dark:text-emerald-400'
                            : 'text-slate-500 dark:text-slate-400'
                        }`}
                      >
                        <CheckCircle2
                          className={`w-3.5 h-3.5 shrink-0 ${
                            req.met
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-slate-300 dark:text-slate-600'
                          }`}
                        />
                        <span>{req.label}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-extrabold text-sm shadow-sm transition-colors flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-60"
                >
                  {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{submitting ? 'Resetting Password...' : 'Reset Password'}</span>
                </button>
              </form>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
