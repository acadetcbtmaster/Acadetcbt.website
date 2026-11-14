import { Check, Copy } from 'lucide-react';
import React, { useEffect, useState } from 'react';

interface CopyReferenceButtonProps {
  reference: string;
  compact?: boolean;
  label?: string;
  className?: string;
}

export async function copyTextSafe(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // Fallback to execCommand below
    }
  }
  if (typeof document === 'undefined') return false;
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.top = '-9999px';
    textarea.style.left = '-9999px';
    document.body.appendChild(textarea);
    textarea.select();
    textarea.setSelectionRange(0, text.length);
    const copied = document.execCommand('copy');
    document.body.removeChild(textarea);
    return copied;
  } catch {
    return false;
  }
}

export const CopyReferenceButton: React.FC<CopyReferenceButtonProps> = ({
  reference,
  compact = false,
  label = 'COPY REFERENCE',
  className = '',
}) => {
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!copied) return;
    const timer = window.setTimeout(() => setCopied(false), 3200);
    return () => window.clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    const ok = await copyTextSafe(reference);
    if (ok) {
      setCopied(true);
    }
  };

  return (
    <span className={`inline-flex flex-col items-start gap-1 ${className}`}>
      <button
        type="button"
        onClick={() => void handleCopy()}
        title="Copy payment reference"
        className={`inline-flex items-center justify-center gap-1.5 rounded-lg border font-extrabold tracking-wide transition-colors ${
          copied
            ? 'border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300'
            : 'border-[#c6daf7] dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-[#eff5ff] dark:hover:bg-slate-700 text-[#0b337a] dark:text-blue-300'
        } ${compact ? 'px-2.5 py-1 text-[11px] min-h-[32px]' : 'px-3 py-1.5 text-xs min-h-[36px]'}`}
      >
        {copied ? <Check className="w-3.5 h-3.5 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
        <span>{copied ? 'COPIED ✓' : label}</span>
      </button>
      {copied && (
        <span className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-400">
          Payment reference copied successfully.
        </span>
      )}
    </span>
  );
};
