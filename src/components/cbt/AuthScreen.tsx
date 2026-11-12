import { AlertTriangle, Lock, Mail, User, UserPlus } from 'lucide-react';
import React, { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { SafeUser } from '../../types/cbt';
import { AcadetCrest } from './AcadetLogo';

interface AuthScreenProps {
  onAuthenticated: (user: SafeUser) => void;
  dbConfigured: boolean;
  dbConnected: boolean;
  dbError?: string;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  onAuthenticated,
  dbConfigured,
  dbConnected,
  dbError,
}) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [identifier, setIdentifier] = useState('');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [examTarget, setExamTarget] = useState('Acadet CBT Examination');
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      if (mode === 'login') {
        const res = await api.auth.login({ identifier, password });
        onAuthenticated(res.user);
      } else {
        const res = await api.auth.register({
          fullName,
          email,
          username,
          password,
          examTarget,
        });
        onAuthenticated(res.user);
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

  return (
    <div className="min-h-screen flex flex-col bg-[#eef3fb] dark:bg-[#0a0f1e]">
      <header className="bg-[#0b337a] text-white px-4 sm:px-8 py-4 shadow-md">
        <div className="max-w-5xl mx-auto flex items-center gap-3">
          <AcadetCrest className="w-10 h-11" />
          <div>
            <h1 className="text-xl font-extrabold tracking-tight leading-tight">
              Acadet CBT
            </h1>
            <p className="text-xs italic text-blue-100">...Learn, Practice, Excel</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-center justify-center p-4 sm:p-6">
        <div className="w-full max-w-md space-y-4">
          {(!dbConfigured || !dbConnected) && (
            <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-amber-900 dark:text-amber-200 text-sm flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
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
            <div className="bg-[#0b337a] px-6 py-5 text-white">
              <h2 className="text-xl font-extrabold tracking-tight">
                {mode === 'login' ? 'Student & Staff Sign In' : 'Create Student Account'}
              </h2>
              <p className="text-xs text-blue-100 mt-1">
                {mode === 'login'
                  ? 'Sign in to access practice exams, verified results, and study materials.'
                  : 'Register to save exam attempts, track trends, and customize your CBT workspace.'}
              </p>
            </div>

            <div className="p-6 space-y-5">
              <div className="grid grid-cols-2 rounded-xl bg-slate-100 dark:bg-slate-800 p-1">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMessage(null);
                  }}
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
                  onClick={() => {
                    setMode('register');
                    setErrorMessage(null);
                  }}
                  className={`py-2 rounded-lg text-sm font-bold transition-colors ${
                    mode === 'register'
                      ? 'bg-white dark:bg-slate-900 text-[#0b337a] dark:text-blue-400 shadow-sm'
                      : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Create Account
                </button>
              </div>

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
                  <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter your password"
                      className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-sm font-medium focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
                    />
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
            </div>
          </div>
        </div>
      </main>

      <footer className="bg-[#0b337a] text-white/90 text-xs py-3.5 px-6">
        <div className="max-w-5xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>© {new Date().getFullYear()} Acadet CBT. All rights reserved.</span>
          <span>Powered by Acadet Learning Hub</span>
        </div>
      </footer>
    </div>
  );
};
