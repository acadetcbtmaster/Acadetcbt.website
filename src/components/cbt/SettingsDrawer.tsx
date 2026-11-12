import {
  BarChart3,
  BookOpen,
  Check,
  Clock,
  Flag,
  Monitor,
  RotateCcw,
  Settings as SettingsIcon,
  Type,
  Volume2,
  X,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { DifficultyLevel, SubjectSummary, UserPreferences } from '../../types/cbt';

interface SettingsDrawerProps {
  open: boolean;
  onClose: () => void;
  preferences: UserPreferences;
  subjects: SubjectSummary[];
  selectedSubjectId: string | null;
  onSavePreferences: (nextPrefs: UserPreferences) => Promise<void>;
  saving?: boolean;
}

const DEFAULT_RESET: UserPreferences = {
  theme: 'light',
  fontSize: 'medium',
  soundNotifications: true,
  autoNextQuestion: false,
  showQuestionPalette: true,
  defaultSubjectId: null,
  defaultDifficulty: 'All Levels',
};

export const SettingsDrawer: React.FC<SettingsDrawerProps> = ({
  open,
  onClose,
  preferences,
  subjects,
  selectedSubjectId,
  onSavePreferences,
  saving = false,
}) => {
  const [draft, setDraft] = useState<UserPreferences>(preferences);

  useEffect(() => {
    if (open) {
      setDraft({
        ...preferences,
        defaultSubjectId: preferences.defaultSubjectId || selectedSubjectId || subjects[0]?.id || null,
      });
    }
  }, [open, preferences, selectedSubjectId, subjects]);

  if (!open) return null;

  const difficulties: DifficultyLevel[] = ['All Levels', 'Easy', 'Medium', 'Hard'];

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div
        className="fixed inset-0 bg-slate-950/45 backdrop-blur-[1px]"
        onClick={onClose}
      />

      <aside className="relative z-10 w-full max-w-sm bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col h-full">
        {/* Deep Navy Drawer Header */}
        <div className="bg-[#0b337a] text-white px-5 py-4 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <SettingsIcon className="w-5 h-5" />
            <h2 className="text-lg font-extrabold tracking-tight">Settings</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close settings"
            className="p-2 rounded-lg hover:bg-white/15 transition-colors min-w-[40px] min-h-[40px] flex items-center justify-center"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Exam Settings */}
          <section className="space-y-3.5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              Exam Settings
            </h3>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <BookOpen className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
                <span>Subject</span>
              </label>
              <select
                value={draft.defaultSubjectId || ''}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    defaultSubjectId: e.target.value || null,
                  }))
                }
                className="w-44 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
              >
                {subjects.map((sub) => (
                  <option key={sub.id} value={sub.id}>
                    {sub.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <BarChart3 className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
                <span>Difficulty Level</span>
              </label>
              <select
                value={draft.defaultDifficulty}
                onChange={(e) =>
                  setDraft((prev) => ({
                    ...prev,
                    defaultDifficulty: e.target.value as DifficultyLevel,
                  }))
                }
                className="w-44 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-[#0052cc]"
              >
                {difficulties.map((level) => (
                  <option key={level} value={level}>
                    {level}
                  </option>
                ))}
              </select>
            </div>
          </section>

          {/* Display Settings */}
          <section className="space-y-3.5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              Display Settings
            </h3>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <Monitor className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
                <span>Theme</span>
              </span>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800">
                {(['light', 'dark'] as const).map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setDraft((prev) => ({ ...prev, theme: t }))}
                    className={`px-3.5 py-1.5 text-sm font-bold capitalize transition-colors ${
                      draft.theme === t
                        ? 'bg-[#0a58ed] text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex items-center justify-between gap-3">
              <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                <Type className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
                <span>Font Size</span>
              </span>
              <div className="inline-flex rounded-lg border border-slate-300 dark:border-slate-700 overflow-hidden bg-slate-100 dark:bg-slate-800">
                {(
                  [
                    { key: 'small', label: 'A-' },
                    { key: 'medium', label: 'A' },
                    { key: 'large', label: 'A+' },
                  ] as const
                ).map((item) => (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, fontSize: item.key }))
                    }
                    className={`px-3 py-1.5 text-sm font-bold transition-colors ${
                      draft.fontSize === item.key
                        ? 'bg-[#0a58ed] text-white'
                        : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* Other Settings */}
          <section className="space-y-3.5">
            <h3 className="text-sm font-extrabold text-slate-900 dark:text-white border-b border-slate-200 dark:border-slate-800 pb-2">
              Other Settings
            </h3>

            {[
              {
                key: 'soundNotifications' as const,
                label: 'Sound Notifications',
                icon: Volume2,
              },
              {
                key: 'autoNextQuestion' as const,
                label: 'Auto Next Question',
                icon: Clock,
              },
              {
                key: 'showQuestionPalette' as const,
                label: 'Show Question Palette',
                icon: Flag,
              },
            ].map((item) => {
              const Icon = item.icon;
              const checked = draft[item.key];
              return (
                <div
                  key={item.key}
                  className="flex items-center justify-between gap-3 py-1"
                >
                  <span className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-slate-300">
                    <Icon className="w-4 h-4 text-[#0b337a] dark:text-blue-400" />
                    <span>{item.label}</span>
                  </span>

                  <button
                    type="button"
                    role="switch"
                    aria-checked={checked}
                    onClick={() =>
                      setDraft((prev) => ({ ...prev, [item.key]: !checked }))
                    }
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      checked ? 'bg-[#0a58ed]' : 'bg-slate-300 dark:bg-slate-700'
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${
                        checked ? 'translate-x-5' : 'translate-x-0'
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </section>
        </div>

        {/* Footer Buttons */}
        <div className="p-4 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950/60 flex items-center gap-3 shrink-0">
          <button
            type="button"
            disabled={saving}
            onClick={() =>
              setDraft({
                ...DEFAULT_RESET,
                defaultSubjectId: subjects[0]?.id || null,
              })
            }
            className="flex-1 py-2.5 px-4 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 font-bold text-sm hover:bg-slate-100 dark:hover:bg-slate-700 flex items-center justify-center gap-2 min-h-[44px]"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Reset</span>
          </button>
          <button
            type="button"
            disabled={saving}
            onClick={async () => {
              await onSavePreferences(draft);
              onClose();
            }}
            className="flex-1 py-2.5 px-4 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white font-bold text-sm shadow-sm flex items-center justify-center gap-2 min-h-[44px] disabled:opacity-60"
          >
            <Check className="w-4 h-4" />
            <span>{saving ? 'Saving...' : 'Apply'}</span>
          </button>
        </div>
      </aside>
    </div>
  );
};
