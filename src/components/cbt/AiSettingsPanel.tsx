import {
  AlertCircle,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  RefreshCw,
  Save,
  ShieldCheck,
  Trash2,
  Wifi,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { AiSettingsSummary } from '../../types/cbt';

interface AiSettingsPanelProps {
  onStatusChanged?: (settings: AiSettingsSummary) => void;
}

export const AiSettingsPanel: React.FC<AiSettingsPanelProps> = ({ onStatusChanged }) => {
  const [settings, setSettings] = useState<AiSettingsSummary | null>(null);
  const [apiKeyInput, setApiKeyInput] = useState('');
  const [showKey, setShowKey] = useState(false);
  const [modelName, setModelName] = useState<'gemini-4-hydrogen' | 'gemini-4-neon'>(
    'gemini-4-hydrogen'
  );
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const loadSettings = async () => {
    setLoading(true);
    try {
      const res = await api.admin.ai.getSettings();
      setSettings(res.settings);
      if (
        res.settings.modelName === 'gemini-4-hydrogen' ||
        res.settings.modelName === 'gemini-4-neon'
      ) {
        setModelName(res.settings.modelName);
      }
      onStatusChanged?.(res.settings);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load AI API settings.',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setFeedback(null);
    try {
      const trimmedKey = apiKeyInput.trim();
      const res = await api.admin.ai.saveSettings({
        ...(trimmedKey ? { apiKey: trimmedKey } : {}),
        modelName,
      });
      setSettings(res.settings);
      setApiKeyInput('');
      setShowKey(false);
      onStatusChanged?.(res.settings);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save Gemini API settings.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setFeedback(null);
    try {
      const candidate = apiKeyInput.trim();
      const res = await api.admin.ai.testConnection({
        ...(candidate ? { apiKey: candidate } : {}),
        modelName,
      });
      setSettings(res.settings);
      onStatusChanged?.(res.settings);
      setFeedback({
        type: res.ok ? 'ok' : 'err',
        text: res.message,
      });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Gemini API connection test failed.',
      });
    } finally {
      setTesting(false);
    }
  };

  const handleClearStoredKey = async () => {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await api.admin.ai.saveSettings({ clearStoredKey: true });
      setSettings(res.settings);
      onStatusChanged?.(res.settings);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to remove stored API key.',
      });
    } finally {
      setSaving(false);
    }
  };

  const renderStatusBadge = () => {
    const status = settings?.connectionStatus || 'unconfigured';
    if (status === 'connected') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 text-xs font-extrabold">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>Connected</span>
        </span>
      );
    }
    if (status === 'failed') {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-100 dark:bg-red-950/60 text-red-800 dark:text-red-300 text-xs font-extrabold">
          <AlertCircle className="w-3.5 h-3.5" />
          <span>Connection Failed</span>
        </span>
      );
    }
    if (status === 'unknown' && settings?.configured) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-xs font-extrabold">
          <Wifi className="w-3.5 h-3.5" />
          <span>Saved · Ready to Test</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-extrabold">
        <KeyRound className="w-3.5 h-3.5" />
        <span>Not Configured</span>
      </span>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-[#f8fbff] dark:bg-slate-800/40 p-4 sm:p-5 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#0b337a] text-white flex items-center justify-center shrink-0">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#082252] dark:text-white">
                AI API Settings (Gemini Backend Integration)
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
                Configure your Gemini API key securely on the backend. Keys are encrypted at rest in
                PostgreSQL and never exposed in browser code.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {renderStatusBadge()}
            <button
              type="button"
              onClick={() => void loadSettings()}
              disabled={loading}
              className="p-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800"
              title="Refresh AI connection status"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {feedback && (
          <div
            className={`rounded-xl px-4 py-3 text-sm font-semibold border ${
              feedback.type === 'ok'
                ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-800 dark:text-emerald-200'
                : 'bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-800 text-red-700 dark:text-red-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        {/* Current Active Key Summary */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Configured Key Source
            </div>
            <div className="text-sm font-extrabold text-slate-900 dark:text-white mt-1">
              {settings?.source === 'database'
                ? 'Encrypted Admin Database Key'
                : settings?.source === 'environment'
                  ? 'Server Environment Variable'
                  : 'None Configured'}
            </div>
            {settings?.maskedKey && (
              <div className="text-xs font-mono text-slate-600 dark:text-slate-300 mt-0.5">
                {settings.maskedKey}
              </div>
            )}
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Active AI Model
            </div>
            <div className="text-sm font-extrabold text-[#0b337a] dark:text-blue-300 mt-1">
              {settings?.modelName || 'gemini-4-hydrogen'}
            </div>
            <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              Multimodal PDF, Image OCR &amp; Text
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-3">
            <div className="text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              Last Connection Check
            </div>
            <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 mt-1">
              {settings?.lastTestedAt
                ? new Date(settings.lastTestedAt).toLocaleString()
                : 'Not tested yet'}
            </div>
            {settings?.lastTestMessage && (
              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                {settings.lastTestMessage}
              </div>
            )}
          </div>
        </div>

        {/* Form to enter / update Gemini API key */}
        <form
          onSubmit={handleSave}
          className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 space-y-4"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                {settings?.source === 'database'
                  ? 'Update Gemini API Key (leave blank to keep current key)'
                  : 'Enter Gemini API Key'}
              </label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  autoComplete="off"
                  placeholder={
                    settings?.maskedKey
                      ? `Current: ${settings.maskedKey} — paste new key to replace`
                      : 'AIza...'
                  }
                  value={apiKeyInput}
                  onChange={(e) => setApiKeyInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 pl-3 pr-10 py-2.5 text-sm font-mono min-h-[42px]"
                />
                <button
                  type="button"
                  onClick={() => setShowKey((prev) => !prev)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 dark:hover:text-white"
                  aria-label={showKey ? 'Hide API key' : 'Show API key'}
                >
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                Gemini Model
              </label>
              <select
                value={modelName}
                onChange={(e) =>
                  setModelName(e.target.value as 'gemini-4-hydrogen' | 'gemini-4-neon')
                }
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm font-semibold min-h-[42px]"
              >
                <option value="gemini-4-hydrogen">gemini-4-hydrogen (Fast Default)</option>
                <option value="gemini-4-neon">gemini-4-neon (High Reasoning)</option>
              </select>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
            <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>API key is encrypted via AES-256-GCM and stored strictly on the server.</span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {settings?.source === 'database' && (
                <button
                  type="button"
                  disabled={saving || testing}
                  onClick={() => void handleClearStoredKey()}
                  className="px-3.5 py-2 rounded-lg border border-red-200 dark:border-red-900/60 text-red-700 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-950/30 text-xs font-bold flex items-center gap-1.5 min-h-[40px]"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Remove Saved Key</span>
                </button>
              )}

              <button
                type="button"
                disabled={saving || testing || (!apiKeyInput.trim() && !settings?.configured)}
                onClick={() => void handleTestConnection()}
                className="px-4 py-2 rounded-lg border border-[#0a58ed] text-[#0a58ed] dark:text-blue-300 hover:bg-[#eff5ff] dark:hover:bg-blue-950/30 text-xs font-extrabold flex items-center gap-1.5 min-h-[40px] disabled:opacity-50"
              >
                <Wifi className={`w-3.5 h-3.5 ${testing ? 'animate-pulse' : ''}`} />
                <span>{testing ? 'Testing...' : 'Test Connection'}</span>
              </button>

              <button
                type="submit"
                disabled={saving || testing}
                className="px-4 py-2 rounded-lg bg-[#0b337a] hover:bg-[#072459] text-white text-xs font-extrabold flex items-center gap-1.5 min-h-[40px] disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{saving ? 'Saving...' : 'Save API Key'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
