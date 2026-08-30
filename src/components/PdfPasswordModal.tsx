import React, { useState } from 'react';
import { Lock, KeyRound, AlertCircle, X, ArrowRight, ShieldAlert, Sparkles } from 'lucide-react';

interface PdfPasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
  fileName: string;
  onSubmit: (password: string) => void;
  errorMessage?: string | null;
  isLoading?: boolean;
}

export const PdfPasswordModal: React.FC<PdfPasswordModalProps> = ({
  isOpen,
  onClose,
  fileName,
  onSubmit,
  errorMessage,
  isLoading,
}) => {
  const [password, setPassword] = useState('');

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!password.trim()) return;
    onSubmit(password);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-md w-full overflow-hidden text-slate-100">
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-amber-500/20 text-amber-300 border border-amber-500/30">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Password Protected PDF</h3>
              <p className="text-xs text-slate-400 truncate max-w-[240px]">{fileName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Content */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-xs text-amber-200 space-y-1.5">
            <div className="flex items-center gap-2 font-bold text-amber-300">
              <KeyRound className="w-4 h-4 shrink-0" />
              Document Password Required
            </div>
            <p className="text-[11px] text-amber-200/80 leading-relaxed">
              Official e-document PDFs (such as e-Aadhaar or e-PAN) are encrypted by the issuing authority.
            </p>
            <div className="text-[11px] bg-amber-500/15 p-2 rounded-xl border border-amber-500/30 text-amber-100 font-mono">
              💡 <strong>Aadhaar Password Format:</strong> First 4 letters of Name (CAPITAL) + Birth Year (e.g. <em>ANIS1989</em> for Anish Kumar born 1989)
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-300">Enter PDF Password</label>
            <div className="relative">
              <input
                type="password"
                autoFocus
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password..."
                className="w-full bg-slate-950 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 outline-none transition-all"
              />
            </div>
          </div>

          {errorMessage && (
            <div className="p-2.5 bg-red-500/15 border border-red-500/30 rounded-xl text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-400 hover:text-white rounded-xl bg-slate-800 hover:bg-slate-700 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!password.trim() || isLoading}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg shadow-emerald-600/30 transition-all disabled:opacity-50"
            >
              {isLoading ? (
                <span>Unlocking & Scanning...</span>
              ) : (
                <>
                  <span>Unlock & Auto-Detect</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
