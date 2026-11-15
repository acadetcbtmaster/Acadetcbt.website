import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  Mail,
  RefreshCw,
  Send,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import React, { useState } from 'react';
import { api, ApiError } from '../../lib/api';
import type { AdminEmailStatusOverview } from '../../types/cbt';

interface AdminEmailStatusPanelProps {
  status: AdminEmailStatusOverview | null;
  adminEmail: string;
  onUpdated: (next: AdminEmailStatusOverview) => void;
}

function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  try {
    return new Date(iso).toLocaleString('en-NG', {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  } catch {
    return iso;
  }
}

export const AdminEmailStatusPanel: React.FC<AdminEmailStatusPanelProps> = ({
  status,
  adminEmail,
  onUpdated,
}) => {
  const [testingConn, setTestingConn] = useState(false);
  const [sendingTest, setSendingTest] = useState(false);
  const [testRecipient, setTestRecipient] = useState(adminEmail);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(
    null
  );

  const handleTestConnection = async () => {
    setTestingConn(true);
    setFeedback(null);
    try {
      const res = await api.admin.testEmailConnection();
      onUpdated(res);
      setFeedback({
        type: res.ok ? 'ok' : 'err',
        text: res.ok
          ? `SMTP connection verified successfully (${res.smtp.host}:${res.smtp.port}).`
          : res.smtp.lastError || 'SMTP connection test failed.',
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text:
          err instanceof ApiError
            ? err.message
            : 'Unable to test SMTP connection right now.',
      });
    } finally {
      setTestingConn(false);
    }
  };

  const handleSendTestEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendingTest(true);
    setFeedback(null);
    try {
      const res = await api.admin.sendTestEmail(testRecipient.trim() || undefined);
      onUpdated(res);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text:
          err instanceof ApiError
            ? err.message
            : 'Unable to send test email right now.',
      });
    } finally {
      setSendingTest(false);
    }
  };

  if (!status) {
    return (
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 p-5 text-sm text-slate-500 dark:text-slate-400">
        Loading SMTP email &amp; password recovery diagnostics...
      </div>
    );
  }

  const { smtp, delivery, verificationStats, passwordRecoveryStats } = status;

  return (
    <div className="space-y-4">
      {!smtp.configured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 p-4 text-xs sm:text-sm text-amber-900 dark:text-amber-200 flex items-start gap-2.5">
          <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
          <div className="space-y-1">
            <div className="font-extrabold">
              Administrative Notice: SMTP Credentials Not Fully Configured
            </div>
            <p className="leading-relaxed">
              Password recovery links and verification emails cannot be delivered until the following Render environment variables are configured:
            </p>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {smtp.missingVariables.map((v) => (
                <code
                  key={v}
                  className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-900/60 font-mono text-xs font-bold"
                >
                  {v}
                </code>
              ))}
            </div>
            {smtp.validationErrors.length > 0 && (
              <p className="text-xs font-semibold text-red-700 dark:text-red-300 pt-1">
                {smtp.validationErrors.join(' ')}
              </p>
            )}
          </div>
        </div>
      )}

      {feedback && (
        <div
          className={`rounded-xl px-4 py-3 text-xs sm:text-sm font-medium border ${
            feedback.type === 'ok'
              ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
              : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
          }`}
        >
          {feedback.text}
        </div>
      )}

      {/* Top Status Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            SMTP Configuration
          </div>
          <div className="flex items-center gap-2">
            {smtp.configured ? (
              <ShieldCheck className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
            ) : (
              <ShieldAlert className="w-5 h-5 text-amber-600 dark:text-amber-400" />
            )}
            <span className="text-base font-extrabold text-slate-900 dark:text-white">
              {smtp.configured ? 'Configured' : 'Missing Vars'}
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
            {smtp.host ? `${smtp.host}:${smtp.port ?? '—'}` : 'No SMTP host configured'}
          </div>
        </div>

        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Email Service Connection
          </div>
          <div className="flex items-center gap-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                smtp.connectionStatus === 'connected'
                  ? 'bg-emerald-500'
                  : smtp.connectionStatus === 'connection_failed'
                    ? 'bg-red-500'
                    : 'bg-amber-500'
              }`}
            />
            <span className="text-base font-extrabold text-slate-900 dark:text-white capitalize">
              {smtp.connectionStatus.replace('_', ' ')}
            </span>
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 truncate">
            From: {smtp.fromEmail || 'Not set'}
          </div>
        </div>

        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Last Successful Delivery
          </div>
          <div className="text-sm font-extrabold text-[#0b337a] dark:text-blue-400">
            {formatDateTime(delivery.lastSuccessfulAttemptAt)}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400 tabular-nums">
            Sent: {delivery.totalSent} · Failed: {delivery.totalFailed}
          </div>
        </div>

        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-1.5">
          <div className="text-xs font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
            Base URL &amp; Transport
          </div>
          <div className="text-xs font-bold text-slate-800 dark:text-slate-200 truncate">
            {smtp.appBaseUrl}
          </div>
          <div className="text-xs text-slate-600 dark:text-slate-400">
            User: {smtp.userMasked || '—'} · TLS: {smtp.secure ? 'Implicit TLS' : 'STARTTLS'}
          </div>
        </div>
      </div>

      {/* Verification & Password Recovery Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#082252] dark:text-white flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
              <span>Email Verification Statistics</span>
            </h3>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              24h link expiry
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5">
              <div className="text-lg font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums">
                {verificationStats.verifiedUsers}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Verified Users
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5">
              <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {verificationStats.unverifiedUsers}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Unverified Users
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5">
              <div className="text-lg font-extrabold text-slate-800 dark:text-slate-200 tabular-nums">
                {verificationStats.activePendingTokens}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Active Tokens
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5">
              <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {verificationStats.totalVerificationsCompleted}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Confirmed Links
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-extrabold text-[#082252] dark:text-white flex items-center gap-2">
              <Mail className="w-4 h-4 text-[#0a58ed]" />
              <span>Password Recovery Statistics</span>
            </h3>
            <span className="text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
              20m link expiry
            </span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-center">
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5">
              <div className="text-lg font-extrabold text-[#0b337a] dark:text-blue-400 tabular-nums">
                {passwordRecoveryStats.requestsLast24h}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Requests (24h)
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5">
              <div className="text-lg font-extrabold text-slate-800 dark:text-slate-200 tabular-nums">
                {passwordRecoveryStats.requestsTotal}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Total Requests
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5">
              <div className="text-lg font-extrabold text-emerald-700 dark:text-emerald-400 tabular-nums">
                {passwordRecoveryStats.completedResetsTotal}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Completed Resets
              </div>
            </div>
            <div className="rounded-lg bg-slate-50 dark:bg-slate-800/70 p-2.5">
              <div className="text-lg font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
                {passwordRecoveryStats.activePendingTokens}
              </div>
              <div className="text-[11px] font-semibold text-slate-600 dark:text-slate-400">
                Active Reset Links
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Diagnostic Controls */}
      <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-[#eff5ff]/60 dark:bg-slate-800/40 p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={testingConn}
            className="px-3.5 py-2 rounded-lg bg-[#0b337a] hover:bg-[#082252] text-white text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-60"
          >
            {testingConn ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>{testingConn ? 'Testing SMTP...' : 'Test SMTP Connection'}</span>
          </button>

          {smtp.lastError && (
            <span className="text-xs font-semibold text-red-700 dark:text-red-300">
              Last diagnostic: {smtp.lastError}
            </span>
          )}
        </div>

        <form onSubmit={handleSendTestEmail} className="flex flex-wrap items-center gap-2">
          <input
            type="email"
            required
            value={testRecipient}
            onChange={(e) => setTestRecipient(e.target.value)}
            placeholder="admin@acadetcbt.website"
            className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-semibold min-w-[210px]"
          />
          <button
            type="submit"
            disabled={sendingTest || !smtp.configured}
            className="px-3.5 py-1.5 rounded-lg bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
          >
            {sendingTest ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Send className="w-3.5 h-3.5" />
            )}
            <span>{sendingTest ? 'Sending...' : 'Send Test Email'}</span>
          </button>
        </form>
      </div>

      {/* Recent Delivery Log */}
      <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-2.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <h3 className="text-xs sm:text-sm font-extrabold text-[#082252] dark:text-white">
            Recent Email Delivery Attempts
          </h3>
          <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400">
            Last 10 records (passwords &amp; raw tokens excluded)
          </span>
        </div>

        {delivery.recentLogs.length === 0 ? (
          <div className="p-4 text-xs text-slate-500 dark:text-slate-400">
            No transactional emails have been attempted yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800 text-slate-500 dark:text-slate-400">
                  <th className="py-2 px-3 font-bold">Time</th>
                  <th className="py-2 px-3 font-bold">Recipient</th>
                  <th className="py-2 px-3 font-bold">Type</th>
                  <th className="py-2 px-3 font-bold">Status</th>
                  <th className="py-2 px-3 font-bold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {delivery.recentLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="py-2 px-3 whitespace-nowrap text-slate-600 dark:text-slate-400">
                      {formatDateTime(log.createdAt)}
                    </td>
                    <td className="py-2 px-3 font-semibold text-slate-800 dark:text-slate-200">
                      {log.recipientEmail}
                    </td>
                    <td className="py-2 px-3 capitalize text-slate-600 dark:text-slate-300">
                      {log.emailType.replace('_', ' ')}
                    </td>
                    <td className="py-2 px-3">
                      <span
                        className={`inline-block px-2 py-0.5 rounded font-bold text-[11px] ${
                          log.deliveryStatus === 'sent'
                            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300'
                            : log.deliveryStatus === 'failed'
                              ? 'bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300'
                              : 'bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300'
                        }`}
                      >
                        {log.deliveryStatus}
                      </span>
                    </td>
                    <td className="py-2 px-3 text-slate-500 dark:text-slate-400 max-w-xs truncate">
                      {log.errorMessage || log.subject}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
