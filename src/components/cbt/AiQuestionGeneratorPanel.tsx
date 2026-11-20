import {
  AlertTriangle,
  CheckCircle2,
  FileText,
  Image as ImageIcon,
  Layers,
  Plus,
  RefreshCw,
  Save,
  Send,
  Sparkles,
  Trash2,
  Type as TypeIcon,
  Upload,
  X,
} from 'lucide-react';
import React, { useEffect, useMemo, useState } from 'react';
import { api } from '../../lib/api';
import type {
  AdminCourseItem,
  AdminQuestionItem,
  AiSettingsSummary,
  OptionLetter,
  QuestionDifficulty,
} from '../../types/cbt';
import { QuestionImageGallery } from './QuestionImageGallery';

interface AiQuestionGeneratorPanelProps {
  courses: AdminCourseItem[];
  onPublishedOrChanged: () => Promise<void>;
  onOpenAiSettings: () => void;
}

type SourceMethod = 'document' | 'image' | 'text';

export const AiQuestionGeneratorPanel: React.FC<AiQuestionGeneratorPanelProps> = ({
  courses,
  onPublishedOrChanged,
  onOpenAiSettings,
}) => {
  const [aiStatus, setAiStatus] = useState<AiSettingsSummary | null>(null);
  const [sourceMethod, setSourceMethod] = useState<SourceMethod>('document');

  // Configuration
  const [courseId, setCourseId] = useState<string>(courses[0]?.id || '');
  const [count, setCount] = useState<number>(5);
  const [difficulty, setDifficulty] = useState<QuestionDifficulty>('Medium');
  const [topicHint, setTopicHint] = useState('');

  // Material Inputs
  const [docFile, setDocFile] = useState<File | null>(null);
  const [imageFiles, setImageFiles] = useState<File[]>([]);
  const [textContent, setTextContent] = useState('');

  // Draft Review Queue State (persisted in PostgreSQL with publication_status = 'draft')
  const [drafts, setDrafts] = useState<AdminQuestionItem[]>([]);
  const [selectedIds, setSelectedIds] = useState<Record<string, boolean>>({});
  const [draftFilterCourseId, setDraftFilterCourseId] = useState<string>('');
  const [loadingDrafts, setLoadingDrafts] = useState(false);

  // Operational States
  const [generating, setGenerating] = useState(false);
  const [busyQuestionId, setBusyQuestionId] = useState<string | null>(null);
  const [publishingBatch, setPublishingBatch] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Sync default course when courses load
  useEffect(() => {
    if (courses.length === 0) return;
    if (!courseId || !courses.some((c) => c.id === courseId)) {
      setCourseId(courses[0].id);
    }
  }, [courses, courseId]);

  // Image preview URLs for selected source image uploads
  const imagePreviews = useMemo(() => {
    return imageFiles.map((file) => ({
      file,
      url: URL.createObjectURL(file),
    }));
  }, [imageFiles]);

  useEffect(() => {
    return () => {
      for (const p of imagePreviews) {
        URL.revokeObjectURL(p.url);
      }
    };
  }, [imagePreviews]);

  const loadAiStatusAndDrafts = async () => {
    setLoadingDrafts(true);
    try {
      const [statusRes, draftsRes] = await Promise.all([
        api.admin.ai.getSettings(),
        api.admin.listQuestions({
          publicationStatus: 'draft',
          courseId: draftFilterCourseId || undefined,
          limit: 200,
        }),
      ]);
      setAiStatus(statusRes.settings);
      setDrafts(draftsRes.questions);
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Unable to load AI drafts.',
      });
    } finally {
      setLoadingDrafts(false);
    }
  };

  useEffect(() => {
    void loadAiStatusAndDrafts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftFilterCourseId]);

  const handleSelectSourceImages = (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const valid = Array.from(files).slice(0, 10);
    setImageFiles((prev) => [...prev, ...valid].slice(0, 10));
  };

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!courseId) {
      setFeedback({ type: 'err', text: 'Select an existing course first.' });
      return;
    }

    if (sourceMethod === 'document' && !docFile && !textContent.trim()) {
      setFeedback({ type: 'err', text: 'Upload a PDF, DOCX, or text document to continue.' });
      return;
    }
    if (sourceMethod === 'image' && imageFiles.length === 0 && !textContent.trim()) {
      setFeedback({ type: 'err', text: 'Upload at least one JPG, JPEG, PNG, or WEBP image.' });
      return;
    }
    if (sourceMethod === 'text' && !textContent.trim()) {
      setFeedback({ type: 'err', text: 'Paste lecture notes or academic text to continue.' });
      return;
    }

    setGenerating(true);
    setFeedback(null);

    try {
      const fd = new FormData();
      fd.append('courseId', courseId);
      fd.append('count', String(Math.max(1, Math.min(50, Number(count) || 5))));
      fd.append('difficulty', difficulty);
      if (topicHint.trim()) fd.append('topicHint', topicHint.trim());
      if (textContent.trim()) fd.append('textContent', textContent.trim());
      if (docFile) fd.append('document', docFile);
      for (const img of imageFiles) {
        fd.append('images', img);
      }

      const res = await api.admin.ai.generateQuestions(fd);
      setDrafts((prev) => [...res.questions, ...prev]);

      const nextSelected: Record<string, boolean> = { ...selectedIds };
      for (const q of res.questions) {
        nextSelected[q.id] = true;
      }
      setSelectedIds(nextSelected);

      setFeedback({
        type: 'ok',
        text: res.message,
      });
      await onPublishedOrChanged();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'AI question generation failed.',
      });
    } finally {
      setGenerating(false);
    }
  };

  const updateDraftField = <K extends keyof AdminQuestionItem>(
    id: string,
    key: K,
    value: AdminQuestionItem[K]
  ) => {
    setDrafts((prev) => prev.map((q) => (q.id === id ? { ...q, [key]: value } : q)));
  };

  const handleSaveDraftChanges = async (q: AdminQuestionItem) => {
    setBusyQuestionId(q.id);
    setFeedback(null);
    try {
      const res = await api.admin.updateQuestion(q.id, {
        courseId: q.courseId || courseId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        difficulty: q.difficulty,
        topic: q.topic,
        explanation: q.explanation,
        publicationStatus: 'draft',
      });
      setDrafts((prev) => prev.map((item) => (item.id === q.id ? res.question : item)));
      setFeedback({ type: 'ok', text: 'Draft changes saved to PostgreSQL.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save draft changes.',
      });
    } finally {
      setBusyQuestionId(null);
    }
  };

  const handleRegenerateDraft = async (q: AdminQuestionItem) => {
    setBusyQuestionId(q.id);
    setFeedback(null);
    try {
      const res = await api.admin.ai.regenerateQuestion(q.id, {
        sourceExcerpt: textContent.trim() || undefined,
      });
      setDrafts((prev) => prev.map((item) => (item.id === q.id ? res.question : item)));
      setFeedback({ type: 'ok', text: 'Draft question regenerated with fresh AI content.' });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to regenerate question.',
      });
    } finally {
      setBusyQuestionId(null);
    }
  };

  const handlePublishSingle = async (q: AdminQuestionItem) => {
    setBusyQuestionId(q.id);
    setFeedback(null);
    try {
      // Persist any pending inline edits before publishing
      await api.admin.updateQuestion(q.id, {
        courseId: q.courseId || courseId,
        questionText: q.questionText,
        optionA: q.optionA,
        optionB: q.optionB,
        optionC: q.optionC,
        optionD: q.optionD,
        correctOption: q.correctOption,
        difficulty: q.difficulty,
        topic: q.topic,
        explanation: q.explanation,
        publicationStatus: 'published',
        isActive: true,
      });
      setDrafts((prev) => prev.filter((item) => item.id !== q.id));
      setSelectedIds((prev) => {
        const copy = { ...prev };
        delete copy[q.id];
        return copy;
      });
      setFeedback({
        type: 'ok',
        text: `Published question to ${q.courseCode} live CBT bank.`,
      });
      await onPublishedOrChanged();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to publish question.',
      });
    } finally {
      setBusyQuestionId(null);
    }
  };

  const handleDeleteDraft = async (id: string) => {
    setBusyQuestionId(id);
    setFeedback(null);
    try {
      await api.admin.deleteQuestion(id);
      setDrafts((prev) => prev.filter((item) => item.id !== id));
      setSelectedIds((prev) => {
        if (!prev[id]) return prev;
        const copy = { ...prev };
        delete copy[id];
        return copy;
      });
      setFeedback({ type: 'ok', text: 'Draft question deleted.' });
      await onPublishedOrChanged();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to delete draft.',
      });
    } finally {
      setBusyQuestionId(null);
    }
  };

  const handleAttachImagesToDraft = async (questionId: string, files: FileList | null) => {
    if (!files || files.length === 0) return;
    setBusyQuestionId(questionId);
    setFeedback(null);
    try {
      const res = await api.admin.uploadQuestionImages(questionId, Array.from(files));
      updateDraftField(questionId, 'images', res.images);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to attach image.',
      });
    } finally {
      setBusyQuestionId(null);
    }
  };

  const handleReplaceDraftImage = async (
    questionId: string,
    imageId: string,
    file: File | undefined
  ) => {
    if (!file) return;
    setBusyQuestionId(questionId);
    setFeedback(null);
    try {
      const res = await api.admin.replaceQuestionImage(questionId, imageId, file);
      updateDraftField(questionId, 'images', res.images);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to replace image.',
      });
    } finally {
      setBusyQuestionId(null);
    }
  };

  const handleRemoveDraftImage = async (questionId: string, imageId: string) => {
    setBusyQuestionId(questionId);
    setFeedback(null);
    try {
      const res = await api.admin.deleteQuestionImage(questionId, imageId);
      updateDraftField(questionId, 'images', res.images);
      setFeedback({ type: 'ok', text: res.message });
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to remove image.',
      });
    } finally {
      setBusyQuestionId(null);
    }
  };

  const selectedList = drafts.filter((d) => selectedIds[d.id]).map((d) => d.id);

  const handlePublishSelected = async () => {
    if (selectedList.length === 0) return;
    setPublishingBatch(true);
    setFeedback(null);
    try {
      // Persist edits for selected drafts first before batch publish
      for (const q of drafts) {
        if (selectedIds[q.id]) {
          await api.admin.updateQuestion(q.id, {
            courseId: q.courseId || courseId,
            questionText: q.questionText,
            optionA: q.optionA,
            optionB: q.optionB,
            optionC: q.optionC,
            optionD: q.optionD,
            correctOption: q.correctOption,
            difficulty: q.difficulty,
            topic: q.topic,
            explanation: q.explanation,
          });
        }
      }
      const res = await api.admin.publishQuestionsBatch(selectedList);
      setDrafts((prev) => prev.filter((item) => !selectedIds[item.id]));
      setSelectedIds({});
      setFeedback({ type: 'ok', text: res.message });
      await onPublishedOrChanged();
    } catch (err) {
      setFeedback({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to publish selected drafts.',
      });
    } finally {
      setPublishingBatch(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Status Banner if Gemini Key not set */}
      {aiStatus && !aiStatus.configured && (
        <div className="rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 text-sm font-semibold text-amber-900 dark:text-amber-200">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <span>
              Gemini API key is not configured yet. Configure and test your API key before generating
              AI questions.
            </span>
          </div>
          <button
            type="button"
            onClick={onOpenAiSettings}
            className="px-3.5 py-2 rounded-lg bg-[#0b337a] hover:bg-[#072459] text-white text-xs font-extrabold whitespace-nowrap"
          >
            Open AI API Settings
          </button>
        </div>
      )}

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

      {/* Generator Configuration & Material Upload Card */}
      <form
        onSubmit={handleGenerate}
        className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-[#f8fbff] dark:bg-slate-800/40 p-4 sm:p-5 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-xl bg-[#0a58ed] text-white flex items-center justify-center shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-extrabold text-[#082252] dark:text-white">
                AI Question Generator
              </h3>
              <p className="text-xs text-slate-600 dark:text-slate-400">
                Submit lecture PDFs, documents, diagram/OCR images, or pasted notes. Questions save
                as drafts for your review before publishing.
              </p>
            </div>
          </div>

          {aiStatus?.configured && (
            <button
              type="button"
              onClick={onOpenAiSettings}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50"
            >
              AI Model: {aiStatus.modelName} ({aiStatus.connectionStatus === 'connected' ? 'Connected' : 'Configured'})
            </button>
          )}
        </div>

        {/* Step 1: Question Generation Configuration */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="sm:col-span-2">
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
              Select Existing Course
            </label>
            <select
              required
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-semibold min-h-[42px]"
            >
              {courses.length === 0 ? (
                <option value="">No courses saved in database</option>
              ) : (
                courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.code} — {c.title}
                  </option>
                ))
              )}
            </select>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
              Number of Questions
            </label>
            <input
              type="number"
              min={1}
              max={50}
              required
              value={count}
              onChange={(e) => setCount(Math.max(1, Math.min(50, Number(e.target.value) || 1)))}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-bold tabular-nums min-h-[42px]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
              Difficulty Category
            </label>
            <select
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as QuestionDifficulty)}
              className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm font-bold min-h-[42px]"
            >
              <option value="Easy">Easy</option>
              <option value="Medium">Medium</option>
              <option value="Hard">Difficult</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
            Focus Topic (Optional)
          </label>
          <input
            type="text"
            placeholder="e.g. Nigerian Constitutional Development, Cellular Respiration, Kinematics..."
            value={topicHint}
            onChange={(e) => setTopicHint(e.target.value)}
            className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm min-h-[42px]"
          />
        </div>

        {/* Step 2: Three Material Input Methods */}
        <div className="rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 overflow-hidden">
          <div className="flex flex-wrap border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/70 p-1.5 gap-1.5">
            <button
              type="button"
              onClick={() => setSourceMethod('document')}
              className={`flex-1 min-w-[160px] px-3 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                sourceMethod === 'document'
                  ? 'bg-[#0b337a] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>A. PDF / Document Upload</span>
            </button>

            <button
              type="button"
              onClick={() => setSourceMethod('image')}
              className={`flex-1 min-w-[160px] px-3 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                sourceMethod === 'image'
                  ? 'bg-[#0b337a] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              <ImageIcon className="w-4 h-4" />
              <span>B. Image Upload (OCR &amp; Diagrams)</span>
            </button>

            <button
              type="button"
              onClick={() => setSourceMethod('text')}
              className={`flex-1 min-w-[160px] px-3 py-2 rounded-lg text-xs font-extrabold flex items-center justify-center gap-1.5 transition-colors ${
                sourceMethod === 'text'
                  ? 'bg-[#0b337a] text-white shadow-xs'
                  : 'text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-700'
              }`}
            >
              <TypeIcon className="w-4 h-4" />
              <span>C. Direct Text Input</span>
            </button>
          </div>

          <div className="p-4 space-y-4">
            {sourceMethod === 'document' && (
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#b6cef5] dark:border-slate-700 bg-[#f8fbff] dark:bg-slate-800/40 p-6 cursor-pointer hover:border-[#0a58ed] transition-colors text-center">
                  <Upload className="w-7 h-7 text-[#0a58ed] mb-2" />
                  <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    {docFile ? docFile.name : 'Click to choose PDF, DOCX, TXT, or Markdown material'}
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Max 20 MB · AI extracts key topics, definitions, and academic concepts directly
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.docx,.doc,.txt,.md,.csv"
                    className="hidden"
                    onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  />
                </label>

                {docFile && (
                  <div className="flex items-center justify-between rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-900 px-3 py-2 text-xs">
                    <span className="font-bold text-[#0b337a] dark:text-blue-200 truncate">
                      Selected: {docFile.name} ({Math.max(1, Math.round(docFile.size / 1024))} KB)
                    </span>
                    <button
                      type="button"
                      onClick={() => setDocFile(null)}
                      className="text-red-600 font-bold hover:underline ml-3"
                    >
                      Remove
                    </button>
                  </div>
                )}
              </div>
            )}

            {sourceMethod === 'image' && (
              <div className="space-y-3">
                <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-[#b6cef5] dark:border-slate-700 bg-[#f8fbff] dark:bg-slate-800/40 p-5 cursor-pointer hover:border-[#0a58ed] transition-colors text-center">
                  <ImageIcon className="w-7 h-7 text-[#0a58ed] mb-2" />
                  <div className="text-sm font-extrabold text-slate-800 dark:text-slate-100">
                    Upload JPG, JPEG, PNG, or WEBP Pages / Diagrams / Specimens
                  </div>
                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                    Up to 10 images (5 MB each) · AI performs OCR &amp; automatically attaches relevant
                    diagrams only to questions that need them
                  </div>
                  <input
                    type="file"
                    multiple
                    accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                    className="hidden"
                    onChange={(e) => handleSelectSourceImages(e.target.files)}
                  />
                </label>

                {imagePreviews.length > 0 && (
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    {imagePreviews.map((item, idx) => (
                      <div
                        key={`${item.file.name}-${idx}`}
                        className="relative rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 overflow-hidden"
                      >
                        <img
                          src={item.url}
                          alt={item.file.name}
                          className="w-full h-24 object-contain bg-white dark:bg-slate-900 p-1"
                        />
                        <div className="px-2 py-1 text-[11px] font-semibold truncate text-slate-700 dark:text-slate-300">
                          Image #{idx}: {item.file.name}
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            setImageFiles((prev) => prev.filter((_, i) => i !== idx))
                          }
                          className="absolute top-1 right-1 p-1 rounded-full bg-slate-900/75 text-white hover:bg-red-600"
                          title="Remove image"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold uppercase tracking-wide text-slate-600 dark:text-slate-400 mb-1.5">
                {sourceMethod === 'text'
                  ? 'Lecture Notes / Academic Content'
                  : 'Additional Notes or Instructions (Optional)'}
              </label>
              <textarea
                rows={sourceMethod === 'text' ? 7 : 3}
                placeholder={
                  sourceMethod === 'text'
                    ? 'Paste lecture notes, textbook excerpts, definitions, or course outlines here...'
                    : 'Optional: Add extra instructions or context to combine with your uploaded document/images...'
                }
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2.5 text-sm leading-relaxed"
              />
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-1">
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Generated questions are staged in the <strong>Draft Review Queue</strong> below and
                are never published automatically.
              </div>
              <button
                type="submit"
                disabled={generating || !courseId}
                className="px-5 py-2.5 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-sm font-extrabold flex items-center gap-2 min-h-[44px] disabled:opacity-50 shadow-xs"
              >
                <Sparkles className={`w-4 h-4 ${generating ? 'animate-spin' : ''}`} />
                <span>{generating ? 'Generating Questions...' : 'Generate Questions'}</span>
              </button>
            </div>
          </div>
        </div>
      </form>

      {/* Draft Review & Approval Section */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 overflow-hidden">
        <div className="px-4 py-3.5 bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Layers className="w-5 h-5 text-[#0b337a] dark:text-blue-300" />
            <div>
              <h4 className="text-sm font-extrabold text-[#082252] dark:text-white">
                Generated Question Review Queue ({drafts.length} Draft{drafts.length === 1 ? '' : 's'})
              </h4>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Edit, attach or replace images, regenerate individual items, save drafts, or publish
                approved questions.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={draftFilterCourseId}
              onChange={(e) => setDraftFilterCourseId(e.target.value)}
              className="rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1.5 text-xs font-bold min-h-[38px]"
            >
              <option value="">All Draft Courses</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.code} — {c.title}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => void loadAiStatusAndDrafts()}
              disabled={loadingDrafts}
              className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold flex items-center gap-1 min-h-[38px]"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingDrafts ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>

            {drafts.length > 0 && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    const allSelected = drafts.every((d) => selectedIds[d.id]);
                    if (allSelected) {
                      setSelectedIds({});
                    } else {
                      const next: Record<string, boolean> = {};
                      for (const d of drafts) next[d.id] = true;
                      setSelectedIds(next);
                    }
                  }}
                  className="px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold min-h-[38px]"
                >
                  {drafts.every((d) => selectedIds[d.id]) ? 'Unselect All' : 'Select All'}
                </button>

                <button
                  type="button"
                  disabled={publishingBatch || selectedList.length === 0}
                  onClick={() => void handlePublishSelected()}
                  className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1.5 min-h-[38px] disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>
                    {publishingBatch
                      ? 'Publishing...'
                      : `Publish Selected (${selectedList.length})`}
                  </span>
                </button>
              </>
            )}
          </div>
        </div>

        <div className="divide-y divide-slate-200 dark:divide-slate-800">
          {drafts.length === 0 ? (
            <div className="py-10 px-4 text-center text-sm text-slate-500 dark:text-slate-400">
              No pending draft questions. Generate questions above to review and approve them here.
            </div>
          ) : (
            drafts.map((q, index) => {
              const isBusy = busyQuestionId === q.id;
              const isChecked = Boolean(selectedIds[q.id]);
              const needsManualImage =
                Boolean(q.aiRequiresImage) && (!q.images || q.images.length === 0);

              return (
                <div key={q.id} className="p-4 sm:p-5 space-y-3.5">
                  {/* Top Bar: Checkbox + Metadata */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <label className="inline-flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={(e) =>
                          setSelectedIds((prev) => ({
                            ...prev,
                            [q.id]: e.target.checked,
                          }))
                        }
                        className="w-4 h-4 rounded border-slate-300 text-emerald-600"
                      />
                      <span className="text-xs font-extrabold uppercase tracking-wide text-[#0b337a] dark:text-blue-300">
                        Draft #{index + 1} · {q.courseCode}
                      </span>
                      <span className="px-2 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 text-[11px] font-bold">
                        Unpublished Draft
                      </span>
                    </label>

                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleRegenerateDraft(q)}
                        className="px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 text-xs font-bold hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-1 disabled:opacity-50"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isBusy ? 'animate-spin' : ''}`} />
                        <span>Regenerate</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleSaveDraftChanges(q)}
                        className="px-2.5 py-1.5 rounded-lg border border-[#0a58ed] text-[#0a58ed] dark:text-blue-300 text-xs font-bold hover:bg-blue-50 dark:hover:bg-blue-950/30 flex items-center gap-1 disabled:opacity-50"
                      >
                        <Save className="w-3.5 h-3.5" />
                        <span>Save Draft</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handlePublishSingle(q)}
                        className="px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold flex items-center gap-1 disabled:opacity-50"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Publish</span>
                      </button>

                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void handleDeleteDraft(q.id)}
                        className="p-1.5 rounded-lg text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 disabled:opacity-50"
                        title="Delete draft question"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {needsManualImage && (
                    <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/30 px-3 py-2 text-xs text-amber-900 dark:text-amber-200 flex items-center gap-2">
                      <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong>Image Recommended:</strong>{' '}
                        {q.aiImageNote ||
                          'This question references a visual diagram or figure. Attach an image below before publishing.'}
                      </span>
                    </div>
                  )}

                  {/* Course, Difficulty, Topic */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={q.courseId || ''}
                      onChange={(e) => {
                        const nextId = e.target.value;
                        const found = courses.find((c) => c.id === nextId);
                        setDrafts((prev) =>
                          prev.map((item) =>
                            item.id === q.id
                              ? {
                                  ...item,
                                  courseId: nextId,
                                  courseCode: found?.code || item.courseCode,
                                  courseTitle: found?.title || item.courseTitle,
                                }
                              : item
                          )
                        );
                      }}
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                    >
                      {courses.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.code} — {c.title}
                        </option>
                      ))}
                    </select>

                    <select
                      value={q.difficulty}
                      onChange={(e) =>
                        updateDraftField(q.id, 'difficulty', e.target.value as QuestionDifficulty)
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-semibold"
                    >
                      <option value="Easy">Difficulty: Easy</option>
                      <option value="Medium">Difficulty: Medium</option>
                      <option value="Hard">Difficulty: Difficult</option>
                    </select>

                    <input
                      type="text"
                      value={q.topic}
                      onChange={(e) => updateDraftField(q.id, 'topic', e.target.value)}
                      placeholder="Topic"
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
                    />
                  </div>

                  {/* Question Text */}
                  <textarea
                    rows={2}
                    value={q.questionText}
                    onChange={(e) => updateDraftField(q.id, 'questionText', e.target.value)}
                    className="w-full rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-sm font-semibold"
                  />

                  {/* Options A-D */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['A', 'B', 'C', 'D'] as const).map((letter) => {
                      const fieldKey = `option${letter}` as
                        | 'optionA'
                        | 'optionB'
                        | 'optionC'
                        | 'optionD';
                      return (
                        <div key={letter} className="flex items-center gap-2">
                          <span className="w-6 text-xs font-extrabold text-center text-slate-600 dark:text-slate-300 shrink-0">
                            {letter}.
                          </span>
                          <input
                            type="text"
                            value={q[fieldKey]}
                            onChange={(e) => updateDraftField(q.id, fieldKey, e.target.value)}
                            className="flex-1 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-2.5 py-1.5 text-xs sm:text-sm"
                          />
                        </div>
                      );
                    })}
                  </div>

                  {/* Correct Answer & Explanation */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <select
                      value={q.correctOption}
                      onChange={(e) =>
                        updateDraftField(q.id, 'correctOption', e.target.value as OptionLetter)
                      }
                      className="rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs font-bold"
                    >
                      {(['A', 'B', 'C', 'D'] as const).map((l) => (
                        <option key={l} value={l}>
                          Correct Answer: {l}
                        </option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={q.explanation}
                      onChange={(e) => updateDraftField(q.id, 'explanation', e.target.value)}
                      placeholder="Post-exam explanation"
                      className="sm:col-span-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 px-3 py-2 text-xs"
                    />
                  </div>

                  {/* Attached Images Review & Management */}
                  <div className="rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-800/40 p-3 space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-bold text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                        <ImageIcon className="w-3.5 h-3.5 text-[#0a58ed]" />
                        <span>
                          Question Image Attachments ({q.images?.length || 0})
                        </span>
                      </span>

                      <label className="px-2.5 py-1 rounded-lg border border-[#0a58ed] text-[#0a58ed] dark:text-blue-300 hover:bg-blue-50 dark:hover:bg-blue-950/30 text-xs font-bold cursor-pointer inline-flex items-center gap-1">
                        <Plus className="w-3.5 h-3.5" />
                        <span>Attach Image(s)</span>
                        <input
                          type="file"
                          multiple
                          accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => {
                            void handleAttachImagesToDraft(q.id, e.target.files);
                            e.target.value = '';
                          }}
                        />
                      </label>
                    </div>

                    {q.images && q.images.length > 0 ? (
                      <div className="space-y-2">
                        <QuestionImageGallery images={q.images} compact />
                        <div className="flex flex-wrap gap-2">
                          {q.images.map((img, imgIdx) => (
                            <div
                              key={img.id}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2.5 py-1 text-[11px]"
                            >
                              <span className="font-semibold truncate max-w-[140px]">
                                #{imgIdx + 1}: {img.fileName}
                              </span>
                              <label className="text-[#0a58ed] font-bold cursor-pointer hover:underline">
                                Replace
                                <input
                                  type="file"
                                  accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                                  className="hidden"
                                  onChange={(e) => {
                                    void handleReplaceDraftImage(
                                      q.id,
                                      img.id,
                                      e.target.files?.[0]
                                    );
                                    e.target.value = '';
                                  }}
                                />
                              </label>
                              <button
                                type="button"
                                disabled={isBusy}
                                onClick={() => void handleRemoveDraftImage(q.id, img.id)}
                                className="text-red-600 font-bold hover:underline"
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        No image attached to this question.
                      </div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
