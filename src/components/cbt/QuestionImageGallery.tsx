import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import React, { useEffect, useState } from 'react';
import type { QuestionImageItem } from '../../types/cbt';

interface QuestionImageGalleryProps {
  images?: QuestionImageItem[];
  compact?: boolean;
}

export const QuestionImageGallery: React.FC<QuestionImageGalleryProps> = ({
  images,
  compact = false,
}) => {
  const [zoomIndex, setZoomIndex] = useState<number | null>(null);

  useEffect(() => {
    if (zoomIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setZoomIndex(null);
      } else if (e.key === 'ArrowRight' && images && images.length > 1) {
        setZoomIndex((prev) => (prev === null ? null : (prev + 1) % images.length));
      } else if (e.key === 'ArrowLeft' && images && images.length > 1) {
        setZoomIndex((prev) =>
          prev === null ? null : (prev - 1 + images.length) % images.length
        );
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [zoomIndex, images]);

  if (!images || images.length === 0) {
    return null;
  }

  const activeZoomImage =
    zoomIndex !== null && images[zoomIndex] ? images[zoomIndex] : null;

  return (
    <>
      <div
        className={`grid gap-3 ${
          images.length === 1 ? 'grid-cols-1' : 'grid-cols-1 sm:grid-cols-2'
        }`}
      >
        {images.map((img, idx) => (
          <div
            key={img.id}
            className="group relative rounded-xl border border-[#dce6f5] dark:border-slate-700 bg-slate-50/80 dark:bg-slate-800/50 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => setZoomIndex(idx)}
              className="w-full block focus:outline-none focus:ring-2 focus:ring-[#0a58ed] text-left"
              title="Click to enlarge image"
            >
              <div className="flex items-center justify-center p-2 sm:p-3 bg-white dark:bg-slate-900">
                <img
                  src={img.url}
                  alt={img.caption || img.fileName || `Question diagram ${idx + 1}`}
                  loading="lazy"
                  className={`w-full object-contain rounded-lg ${
                    compact ? 'max-h-[220px]' : 'max-h-[340px]'
                  }`}
                />
              </div>
              <div className="px-3 py-1.5 border-t border-slate-200/80 dark:border-slate-700/80 flex items-center justify-between gap-2 text-xs text-slate-600 dark:text-slate-300 bg-slate-50/90 dark:bg-slate-800/90">
                <span className="truncate font-medium">
                  {img.caption || (images.length > 1 ? `Figure ${idx + 1}` : 'Question Figure')}
                </span>
                <span className="inline-flex items-center gap-1 text-[#0a58ed] dark:text-blue-400 font-bold shrink-0">
                  <ZoomIn className="w-3.5 h-3.5" />
                  <span>Enlarge</span>
                </span>
              </div>
            </button>
          </div>
        ))}
      </div>

      {activeZoomImage && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center p-3 sm:p-6 bg-slate-950/85 backdrop-blur-xs"
          onClick={() => setZoomIndex(null)}
          role="dialog"
          aria-modal="true"
          aria-label="Enlarged question image"
        >
          <div
            className="relative max-w-5xl w-full max-h-[92vh] flex flex-col rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 bg-[#0b337a] text-white flex items-center justify-between gap-3 shrink-0">
              <div className="text-sm font-bold truncate">
                {activeZoomImage.caption || activeZoomImage.fileName || 'Question Figure'}
                {images.length > 1 ? ` (${zoomIndex! + 1} of ${images.length})` : ''}
              </div>
              <button
                type="button"
                onClick={() => setZoomIndex(null)}
                className="p-1.5 rounded-lg hover:bg-white/15 transition-colors"
                aria-label="Close enlarged view"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="relative flex-1 overflow-auto bg-slate-100 dark:bg-slate-950 flex items-center justify-center p-3 sm:p-5">
              <img
                src={activeZoomImage.url}
                alt={activeZoomImage.caption || activeZoomImage.fileName}
                className="max-w-full max-h-[75vh] object-contain rounded-lg shadow-md"
              />

              {images.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setZoomIndex((prev) =>
                        prev === null ? 0 : (prev - 1 + images.length) % images.length
                      )
                    }
                    className="absolute left-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white shadow-lg hover:bg-white"
                    aria-label="Previous figure"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setZoomIndex((prev) =>
                        prev === null ? 0 : (prev + 1) % images.length
                      )
                    }
                    className="absolute right-3 top-1/2 -translate-y-1/2 p-2.5 rounded-full bg-white/90 dark:bg-slate-800/90 text-slate-900 dark:text-white shadow-lg hover:bg-white"
                    aria-label="Next figure"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
