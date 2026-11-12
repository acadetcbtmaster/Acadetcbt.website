import { Calculator, Delete, X } from 'lucide-react';
import React, { useState } from 'react';

interface CalculatorModalProps {
  open: boolean;
  onClose: () => void;
}

export const CalculatorModal: React.FC<CalculatorModalProps> = ({ open, onClose }) => {
  const [expression, setExpression] = useState('0');
  const [error, setError] = useState(false);

  if (!open) return null;

  const append = (val: string) => {
    setError(false);
    setExpression((prev) => {
      if (prev === '0' && /[0-9]/.test(val)) return val;
      if (prev === 'Error') return val;
      return prev + val;
    });
  };

  const clearAll = () => {
    setError(false);
    setExpression('0');
  };

  const backspace = () => {
    setError(false);
    setExpression((prev) => (prev.length <= 1 || prev === 'Error' ? '0' : prev.slice(0, -1)));
  };

  const evaluate = () => {
    try {
      const sanitized = expression.replace(/[^0-9+\-*/().%\s]/g, '');
      if (!sanitized) return;
      // eslint-disable-next-line no-new-func
      const result = Function(`"use strict"; return (${sanitized})`)();
      if (typeof result === 'number' && Number.isFinite(result)) {
        const rounded = Math.round(result * 1e10) / 1e10;
        setExpression(String(rounded));
        setError(false);
      } else {
        setExpression('Error');
        setError(true);
      }
    } catch {
      setExpression('Error');
      setError(true);
    }
  };

  const keys = [
    ['C', '(', ')', '/'],
    ['7', '8', '9', '*'],
    ['4', '5', '6', '-'],
    ['1', '2', '3', '+'],
    ['0', '.', 'DEL', '='],
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/50 backdrop-blur-[1px]">
      <div className="w-full max-w-xs rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 shadow-2xl overflow-hidden">
        <div className="bg-[#0b337a] text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2 font-bold text-sm">
            <Calculator className="w-4 h-4" />
            <span>CBT Calculator</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close calculator"
            className="p-1.5 rounded-lg hover:bg-white/15"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-3">
          <div
            className={`rounded-xl px-3.5 py-3 text-right font-mono text-2xl font-bold tabular-nums overflow-x-auto border ${
              error
                ? 'bg-red-50 dark:bg-red-950/30 border-red-300 dark:border-red-800 text-red-600 dark:text-red-400'
                : 'bg-slate-50 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-900 dark:text-white'
            }`}
          >
            {expression}
          </div>

          <div className="grid grid-cols-4 gap-2">
            {keys.flat().map((key) => {
              const isOp = ['/', '*', '-', '+'].includes(key);
              const isEquals = key === '=';
              const isClear = key === 'C';
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => {
                    if (key === 'C') clearAll();
                    else if (key === 'DEL') backspace();
                    else if (key === '=') evaluate();
                    else append(key);
                  }}
                  className={`h-11 rounded-xl font-bold text-sm transition-colors flex items-center justify-center ${
                    isEquals
                      ? 'bg-[#0a58ed] hover:bg-[#0044b8] text-white'
                      : isClear
                        ? 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300 hover:bg-red-200'
                        : isOp
                          ? 'bg-blue-50 dark:bg-blue-950/50 text-[#0b337a] dark:text-blue-300 hover:bg-blue-100'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-slate-100 hover:bg-slate-200 dark:hover:bg-slate-700'
                  }`}
                >
                  {key === 'DEL' ? <Delete className="w-4 h-4" /> : key}
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
