import {
  CheckCircle2,
  Download,
  ExternalLink,
  MessageCircle,
  Printer,
  ShieldCheck,
  X,
} from 'lucide-react';
import React, { useState } from 'react';
import type { PaymentReceiptData } from '../../types/cbt';
import { AcadetCrest, useBranding } from './AcadetLogo';
import { CopyReferenceButton } from './CopyReferenceButton';
import { formatCurrency } from './CourseRegistrationView';

interface PaymentReceiptModalProps {
  receipt: PaymentReceiptData | null;
  onClose: () => void;
}

function escapeHtml(raw: string): string {
  return raw
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatReceiptDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export const PaymentReceiptModal: React.FC<PaymentReceiptModalProps> = ({
  receipt,
  onClose,
}) => {
  const { branding } = useBranding();
  const [downloading, setDownloading] = useState(false);

  if (!receipt) return null;

  const formattedDate = formatReceiptDate(receipt.paymentDate);
  const formattedAmount = formatCurrency(receipt.amountPaid, receipt.currency);

  const handleDownloadPng = async () => {
    setDownloading(true);
    try {
      const width = 960;
      const height = 1140;
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // White receipt sheet background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Outer border
      ctx.strokeStyle = '#d6e4fa';
      ctx.lineWidth = 4;
      ctx.strokeRect(24, 24, width - 48, height - 48);

      // Navy Header Band
      ctx.fillStyle = '#0b337a';
      ctx.fillRect(24, 24, width - 48, 152);

      // Load crest logo cleanly if same-origin / accessible
      const logoUrl = branding.logoUrl || '/assets/aistudio/WA_1794571707704_e8aabc00.png';
      try {
        const img = await new Promise<HTMLImageElement>((resolve, reject) => {
          const i = new Image();
          i.crossOrigin = 'anonymous';
          i.onload = () => resolve(i);
          i.onerror = () => reject(new Error('Logo load failed'));
          i.src = logoUrl;
        });
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.roundRect(56, 52, 92, 92, 16);
        ctx.fill();
        ctx.drawImage(img, 62, 58, 80, 80);
      } catch {
        // Proceed without embedded crest bitmap
      }

      ctx.fillStyle = '#ffffff';
      ctx.font = '800 32px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('ACADET CBT', 168, 92);
      ctx.fillStyle = '#bfdbfe';
      ctx.font = '700 20px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('OFFICIAL PAYMENT RECEIPT', 168, 128);

      // Status Pill Summary Bar
      ctx.fillStyle = '#ecfdf5';
      ctx.fillRect(56, 206, width - 112, 74);
      ctx.strokeStyle = '#a7f3d0';
      ctx.lineWidth = 2;
      ctx.strokeRect(56, 206, width - 112, 74);

      ctx.fillStyle = '#065f46';
      ctx.font = '800 20px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText('Payment Status: SUCCESSFUL', 82, 248);
      ctx.textAlign = 'right';
      ctx.fillText('Registration Status: ACTIVE', width - 82, 248);
      ctx.textAlign = 'left';

      // Receipt Field Rows
      const rows: Array<[string, string, boolean?]> = [
        ['Student Name', receipt.studentName],
        ['Email', receipt.studentEmail],
        ['WhatsApp Number', receipt.whatsappNumber || 'Not provided'],
        ['Course Code', receipt.courseCode],
        ['Course Title', receipt.courseTitle],
        ['Amount Paid', `${formattedAmount} (Course Value ₦${receipt.courseValue.toLocaleString()} · Charges Absorbed)`, true],
        ['Payment Reference', receipt.paymentReference, true],
        ['Payment Gateway', `${receipt.paymentGateway}${receipt.paymentChannel ? ` (${receipt.paymentChannel})` : ''}`],
        ['Payment Date', formattedDate],
        ['Payment Status', 'SUCCESSFUL'],
        ['Registration Status', 'ACTIVE'],
      ];

      let y = 326;
      rows.forEach(([label, val, highlight], index) => {
        if (index % 2 === 0) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(56, y - 34, width - 112, 54);
        }
        ctx.strokeStyle = '#e2e8f0';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(56, y + 20);
        ctx.lineTo(width - 56, y + 20);
        ctx.stroke();

        ctx.fillStyle = '#475569';
        ctx.font = '700 18px Inter, system-ui, -apple-system, sans-serif';
        ctx.fillText(label, 74, y);

        ctx.textAlign = 'right';
        ctx.fillStyle = highlight ? '#0b337a' : '#0f172a';
        ctx.font = highlight
          ? '800 19px ui-monospace, SFMono-Regular, Menlo, monospace'
          : '700 18px Inter, system-ui, -apple-system, sans-serif';

        const clipped = val.length > 52 ? `${val.slice(0, 49)}...` : val;
        ctx.fillText(clipped, width - 74, y);
        ctx.textAlign = 'left';
        y += 60;
      });

      // Verification Footer
      ctx.fillStyle = '#082252';
      ctx.font = '700 16px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText(
        `Verified against Paystack server-side records · Issued by ${branding.siteName}`,
        56,
        height - 74
      );
      ctx.fillStyle = '#64748b';
      ctx.font = '500 14px Inter, system-ui, -apple-system, sans-serif';
      ctx.fillText(
        `Receipt ID: ${receipt.paymentId} · Support: ${branding.contactEmail}`,
        56,
        height - 48
      );

      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = url;
      link.download = `Acadet-Receipt-${receipt.paymentReference}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } finally {
      setDownloading(false);
    }
  };

  const handlePrintReceipt = () => {
    if (typeof document === 'undefined') return;
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.setAttribute('aria-hidden', 'true');

    const rowsHtml = [
      ['Student Name', receipt.studentName],
      ['Email', receipt.studentEmail],
      ['WhatsApp Number', receipt.whatsappNumber || 'Not provided'],
      ['Course Title', receipt.courseTitle],
      ['Course Code', receipt.courseCode],
      ['Amount Paid', `${formattedAmount} (Course value ₦${receipt.courseValue.toLocaleString()} · Charges absorbed)`],
      ['Payment Reference', receipt.paymentReference],
      ['Payment Gateway', `${receipt.paymentGateway}${receipt.paymentChannel ? ` (${receipt.paymentChannel})` : ''}`],
      ['Payment Date', formattedDate],
      ['Payment Status', 'SUCCESSFUL'],
      ['Registration Status', 'ACTIVE'],
    ]
      .map(
        ([k, v]) => `
        <tr>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#475569;font-weight:600;">${escapeHtml(k)}</td>
          <td style="padding:10px 12px;border-bottom:1px solid #e2e8f0;color:#0f172a;font-weight:700;text-align:right;">${escapeHtml(v)}</td>
        </tr>`
      )
      .join('');

    const html = `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <title>ACADET CBT Official Payment Receipt - ${escapeHtml(receipt.paymentReference)}</title>
  <style>
    body { font-family: Inter, -apple-system, BlinkMacSystemFont, sans-serif; color: #0f172a; margin: 24px; }
    .card { max-width: 680px; margin: 0 auto; border: 2px solid #cbd5e1; border-radius: 12px; overflow: hidden; }
    .hdr { background: #0b337a; color: #fff; padding: 20px 24px; }
    .hdr h1 { margin: 0; font-size: 20px; letter-spacing: 0.02em; }
    .hdr p { margin: 4px 0 0; font-size: 13px; color: #dbeafe; font-weight: 700; }
    .badge-bar { display:flex; justify-content:space-between; background:#ecfdf5; border-bottom:1px solid #a7f3d0; padding:12px 24px; font-weight:800; color:#065f46; font-size:13px; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    .ftr { padding: 14px 24px; font-size: 11px; color: #475569; background: #f8fafc; }
    @media print { body { margin: 0; } .card { border-color: #94a3b8; } }
  </style>
</head>
<body>
  <div class="card">
    <div class="hdr">
      <h1>ACADET CBT</h1>
      <p>OFFICIAL PAYMENT RECEIPT</p>
    </div>
    <div class="badge-bar">
      <span>Payment Status: SUCCESSFUL</span>
      <span>Registration Status: ACTIVE</span>
    </div>
    <div style="padding: 12px 16px;">
      <table>${rowsHtml}</table>
    </div>
    <div class="ftr">
      Verified server-side with Paystack · ${escapeHtml(branding.siteName)} · ${escapeHtml(branding.contactEmail)}
    </div>
  </div>
</body>
</html>`;

    iframe.onload = () => {
      try {
        const win = iframe.contentWindow;
        if (!win) return;
        const cleanup = () => {
          window.setTimeout(() => {
            if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
          }, 500);
        };
        win.onafterprint = cleanup;
        win.focus();
        win.print();
        window.setTimeout(cleanup, 60000);
      } catch {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
      }
    };

    document.body.appendChild(iframe);
    const doc = iframe.contentDocument || iframe.contentWindow?.document;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2.5 sm:p-4 bg-slate-950/65 backdrop-blur-[1px]">
      <div className="w-full max-w-lg max-h-[94dvh] rounded-2xl bg-white dark:bg-slate-900 border border-[#dce6f5] dark:border-slate-700 shadow-2xl flex flex-col overflow-hidden">
        {/* Institutional Receipt Header */}
        <div className="bg-[#0b337a] text-white px-4 py-3 flex items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <AcadetCrest className="w-9 h-9" />
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-extrabold tracking-wide leading-tight">
                ACADET CBT
              </div>
              <div className="text-[11px] font-bold text-blue-100 tracking-wider uppercase">
                OFFICIAL PAYMENT RECEIPT
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label="Close official payment receipt"
            className="p-1.5 rounded-lg hover:bg-white/15 shrink-0"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Receipt Body */}
        <div className="p-3.5 sm:p-5 space-y-3 overflow-y-auto flex-1">
          <div className="rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs font-extrabold text-emerald-800 dark:text-emerald-300">
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>Payment Status: SUCCESSFUL</span>
            </span>
            <span className="inline-flex items-center gap-1">
              <ShieldCheck className="w-4 h-4 shrink-0" />
              <span>Registration Status: ACTIVE</span>
            </span>
          </div>

          <div className="rounded-xl border border-slate-200 dark:border-slate-800 divide-y divide-slate-200 dark:divide-slate-800 text-xs sm:text-sm">
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Student Name</span>
              <span className="font-bold text-slate-900 dark:text-white text-right">
                {receipt.studentName}
              </span>
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Email</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 text-right break-all">
                {receipt.studentEmail}
              </span>
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">WhatsApp Number</span>
              <span className="font-bold text-slate-800 dark:text-slate-200 tabular-nums text-right">
                {receipt.whatsappNumber || 'Not provided'}
              </span>
            </div>
            <div className="px-3 py-2 flex items-start justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400 shrink-0">Course Title</span>
              <span className="font-extrabold text-[#0b337a] dark:text-blue-300 text-right">
                {receipt.courseTitle}
              </span>
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Course Code</span>
              <span className="font-extrabold text-slate-900 dark:text-white tabular-nums">
                {receipt.courseCode}
              </span>
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-2 bg-[#eff5ff]/70 dark:bg-slate-800/60">
              <span className="font-bold text-slate-700 dark:text-slate-200">Amount Paid</span>
              <div className="text-right">
                <div className="font-extrabold text-[#0a58ed] dark:text-blue-400 tabular-nums">
                  {formattedAmount}
                </div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                  Course Value: {formatCurrency(receipt.courseValue, receipt.currency)} · Charges Absorbed
                </div>
              </div>
            </div>
            <div className="px-3 py-2 space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-slate-500 dark:text-slate-400">Payment Reference</span>
                <span className="font-mono text-xs sm:text-sm font-extrabold text-slate-900 dark:text-white break-all">
                  {receipt.paymentReference}
                </span>
              </div>
              <div className="flex justify-end">
                <CopyReferenceButton reference={receipt.paymentReference} compact />
              </div>
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Payment Gateway</span>
              <span className="font-bold text-slate-900 dark:text-white capitalize">
                {receipt.paymentGateway}
                {receipt.paymentChannel ? ` (${receipt.paymentChannel})` : ''}
              </span>
            </div>
            <div className="px-3 py-2 flex items-center justify-between gap-2">
              <span className="text-slate-500 dark:text-slate-400">Payment Date</span>
              <span className="font-semibold text-slate-800 dark:text-slate-200 tabular-nums text-right">
                {formattedDate}
              </span>
            </div>
          </div>

          {receipt.whatsappGroupLink && (
            <a
              href={receipt.whatsappGroupLink}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-2.5 px-3 rounded-xl border border-emerald-300 dark:border-emerald-700 bg-emerald-50 dark:bg-emerald-950/30 hover:bg-emerald-100 dark:hover:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 min-h-[42px]"
            >
              <MessageCircle className="w-4 h-4" />
              <span>Join Course Tutorial WhatsApp Group</span>
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>

        {/* Actions Footer */}
        <div className="px-3.5 sm:px-5 py-3 border-t border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/95 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <button
              type="button"
              disabled={downloading}
              onClick={() => void handleDownloadPng()}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl bg-[#0a58ed] hover:bg-[#0044b8] text-white text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[40px] disabled:opacity-60"
            >
              <Download className="w-4 h-4" />
              <span>{downloading ? 'Preparing...' : 'DOWNLOAD RECEIPT'}</span>
            </button>
            <button
              type="button"
              onClick={handlePrintReceipt}
              className="flex-1 sm:flex-none px-3.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 text-xs sm:text-sm font-extrabold inline-flex items-center justify-center gap-1.5 min-h-[40px]"
            >
              <Printer className="w-4 h-4" />
              <span>PRINT RECEIPT</span>
            </button>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3 py-2 rounded-xl text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-200/60 dark:hover:bg-slate-800 min-h-[40px]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
