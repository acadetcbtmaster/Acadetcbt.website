import {
  BookOpen,
  Download,
  FileText,
  FolderOpen,
  Library,
} from 'lucide-react';
import React, { useEffect, useState } from 'react';
import { api } from '../../lib/api';
import type { MaterialCategory, StudyMaterialItem } from '../../types/cbt';

interface StudyMaterialsViewProps {
  selectedSubjectId?: string | null;
  compact?: boolean;
  onExploreMore?: () => void;
}

const CATEGORIES: Array<'All' | MaterialCategory> = [
  'All',
  'Tutorials',
  'Notes',
  'Past Questions',
  'Guides',
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '—';
  if (bytes < 1024 * 1024) {
    return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export const StudyMaterialsView: React.FC<StudyMaterialsViewProps> = ({
  selectedSubjectId,
  compact = false,
  onExploreMore,
}) => {
  const [activeCategory, setActiveCategory] = useState<'All' | MaterialCategory>('All');
  const [materials, setMaterials] = useState<StudyMaterialItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    api.materials
      .list({
        category: activeCategory,
        ...(selectedSubjectId && compact ? { subjectId: selectedSubjectId } : {}),
      })
      .then((res) => {
        if (active) setMaterials(res.materials);
      })
      .catch((err) => {
        if (active) {
          setError(err instanceof Error ? err.message : 'Unable to fetch study materials.');
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [activeCategory, selectedSubjectId, compact]);

  const handleDownload = async (item: StudyMaterialItem) => {
    setDownloadingId(item.id);
    setError(null);
    try {
      const res = await api.materials.requestDownload(item.id);
      const anchor = document.createElement('a');
      anchor.href = res.downloadUrl;
      anchor.download = res.filename;
      anchor.rel = 'noopener noreferrer';
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);

      setMaterials((prev) =>
        prev.map((m) =>
          m.id === item.id ? { ...m, downloadCount: m.downloadCount + 1 } : m
        )
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Download unavailable.');
    } finally {
      setDownloadingId(null);
    }
  };

  const visibleMaterials = compact ? materials.slice(0, 5) : materials;

  return (
    <div className="rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-800 shadow-sm overflow-hidden flex flex-col">
      {/* Deep Navy Header Strip */}
      <div className="bg-[#0b337a] text-white px-5 py-3.5 flex items-center gap-2.5">
        <BookOpen className="w-5 h-5 shrink-0" />
        <h2 className="text-lg font-extrabold tracking-tight">Study Materials</h2>
      </div>

      <div className="p-4 sm:p-5 space-y-4 flex-1 flex flex-col">
        {/* Resource Banner */}
        <div className="rounded-xl bg-[#eff5ff] dark:bg-slate-800/80 border border-[#d6e4fa] dark:border-slate-700 px-4 py-3.5 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-[#0a58ed]/10 dark:bg-blue-900/40 text-[#0b337a] dark:text-blue-300 flex items-center justify-center shrink-0">
            <Library className="w-7 h-7" />
          </div>
          <div>
            <div className="text-sm sm:text-base font-extrabold text-[#082252] dark:text-white">
              Access Learning Resources
            </div>
            <div className="text-xs text-slate-600 dark:text-slate-400">
              Get course materials, tutorials and guides stored in object storage.
            </div>
          </div>
        </div>

        {/* Category Filter Tabs */}
        <div className="flex flex-wrap items-center gap-2">
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => setActiveCategory(cat)}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition-colors ${
                  active
                    ? 'bg-[#0a58ed] text-white shadow-xs'
                    : 'bg-[#eff5ff] dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-blue-100 dark:hover:bg-slate-700'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        {error && (
          <div className="rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 px-3.5 py-2.5 text-xs sm:text-sm text-red-700 dark:text-red-300">
            {error}
          </div>
        )}

        {/* Materials List */}
        <div className="flex-1 space-y-2.5">
          {loading ? (
            <div className="py-10 text-center text-sm text-slate-500 dark:text-slate-400">
              Loading study materials...
            </div>
          ) : visibleMaterials.length === 0 ? (
            <div className="py-10 text-center space-y-2 text-slate-500 dark:text-slate-400">
              <FolderOpen className="w-8 h-8 mx-auto opacity-60" />
              <div className="text-sm font-semibold">
                No study materials uploaded in this category yet.
              </div>
            </div>
          ) : (
            visibleMaterials.map((item) => {
              const isDoc = item.fileType === 'DOC';
              return (
                <div
                  key={item.id}
                  className="rounded-xl border border-[#dce6f5] dark:border-slate-800 bg-white dark:bg-slate-900 px-3.5 py-3 flex items-center justify-between gap-3 hover:border-[#9dc0f5] dark:hover:border-blue-800 transition-colors"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className={`w-10 h-11 rounded-lg flex flex-col items-center justify-center text-white font-extrabold text-[10px] shrink-0 ${
                        isDoc ? 'bg-[#0a58ed]' : 'bg-[#e03e3e]'
                      }`}
                    >
                      <FileText className="w-4 h-4 mb-0.5" />
                      <span>{item.fileType}</span>
                    </div>
                    <div className="min-w-0">
                      <div className="font-extrabold text-sm text-slate-900 dark:text-white truncate">
                        {item.title}
                      </div>
                      <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                        {item.description || `${item.category}${item.subjectName ? ` · ${item.subjectName}` : ''}`}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 shrink-0">
                    <span className="hidden sm:inline text-xs font-bold text-slate-500 dark:text-slate-400 tabular-nums">
                      {formatBytes(item.fileSizeBytes)}
                    </span>
                    <button
                      type="button"
                      disabled={downloadingId === item.id}
                      onClick={() => handleDownload(item)}
                      className="px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs font-bold shadow-xs flex items-center gap-1.5 min-h-[38px] disabled:opacity-60"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>{downloadingId === item.id ? 'Preparing...' : 'Download'}</span>
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {compact && onExploreMore && (
          <button
            type="button"
            onClick={onExploreMore}
            className="w-full py-2.5 px-4 rounded-xl bg-[#eff5ff] dark:bg-slate-800 hover:bg-blue-100 dark:hover:bg-slate-700 text-[#082252] dark:text-blue-300 font-bold text-sm transition-colors"
          >
            Explore More Materials →
          </button>
        )}
      </div>
    </div>
  );
};
