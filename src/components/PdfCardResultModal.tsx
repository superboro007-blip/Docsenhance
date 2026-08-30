import React from 'react';
import {
  FileText,
  Check,
  X,
  CreditCard,
  Sparkles,
  ShieldCheck,
  Eye,
  Sliders,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';
import { ExtractedCard, RenderedPdfPage } from '../utils/pdfProcessor';

interface PdfCardResultModalProps {
  isOpen: boolean;
  onClose: () => void;
  documentType: string;
  documentTitle: string;
  frontCard?: ExtractedCard;
  backCard?: ExtractedCard;
  allCards: ExtractedCard[];
  renderedPages: RenderedPdfPage[];
  onApply: (front?: ExtractedCard, back?: ExtractedCard) => void;
}

export const PdfCardResultModal: React.FC<PdfCardResultModalProps> = ({
  isOpen,
  onClose,
  documentType,
  documentTitle,
  frontCard,
  backCard,
  allCards,
  renderedPages,
  onApply,
}) => {
  if (!isOpen) return null;

  const getDocBadgeColor = (type: string) => {
    switch (type.toLowerCase()) {
      case 'aadhaar':
        return 'bg-orange-500/20 text-orange-300 border-orange-500/30';
      case 'pan':
        return 'bg-blue-500/20 text-blue-300 border-blue-500/30';
      case 'voter_id':
        return 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30';
      case 'driving_license':
        return 'bg-purple-500/20 text-purple-300 border-purple-500/30';
      default:
        return 'bg-indigo-500/20 text-indigo-300 border-indigo-500/30';
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 animate-in fade-in duration-200">
      <div className="bg-slate-900 border border-slate-700/80 rounded-3xl shadow-2xl max-w-4xl w-full max-h-[92vh] flex flex-col overflow-hidden text-slate-100">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-md shadow-emerald-500/20">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white">
                  PDF Identity Document Detected & Isolated
                </h3>
                <span
                  className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase ${getDocBadgeColor(
                    documentType
                  )}`}
                >
                  {documentTitle || documentType}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Front and Back ID card portions were automatically located, cropped, and rectified.
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-6">
          {/* Summary Banner */}
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 text-emerald-400 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-emerald-300">
                  {allCards.length} Card Region{allCards.length > 1 ? 's' : ''} Successfully Isolated
                </h4>
                <p className="text-[11px] text-slate-300 mt-0.5">
                  Ready to auto-slot into ID Card Studio with standard CR-80 sizing and cutting/folding lines.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-400">Target Standard:</span>
              <span className="text-xs font-mono font-bold bg-slate-950 px-2.5 py-1 rounded-lg border border-slate-800 text-emerald-400">
                CR-80 (85.6 × 54 mm)
              </span>
            </div>
          </div>

          {/* Cards Display Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Front Card Preview */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <CreditCard className="w-4 h-4 text-emerald-400" />
                  Front Side Card
                </span>
                {frontCard && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-mono font-semibold border border-emerald-500/30">
                    {Math.round(frontCard.confidence * 100)}% Match
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-[160px] bg-slate-900 rounded-xl border border-slate-800/80 flex items-center justify-center p-2 relative overflow-hidden">
                {frontCard ? (
                  <img
                    src={frontCard.dataUrl}
                    alt="Front Card"
                    className="max-w-full max-h-48 object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-xs text-slate-500 text-center">
                    No distinct front side detected
                  </div>
                )}
              </div>

              {frontCard && (
                <div className="text-[11px] text-slate-400 space-y-1">
                  <p className="font-medium text-slate-300">{frontCard.summary}</p>
                  {frontCard.detectedElements?.holder_name && (
                    <p className="text-[10px] text-slate-400">
                      Name: <strong className="text-white">{frontCard.detectedElements.holder_name}</strong>
                    </p>
                  )}
                  {frontCard.detectedElements?.id_number_masked && (
                    <p className="text-[10px] text-slate-400">
                      ID Number: <strong className="text-white font-mono">{frontCard.detectedElements.id_number_masked}</strong>
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Back Card Preview */}
            <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 flex flex-col space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-teal-400 flex items-center gap-1.5 uppercase tracking-wide">
                  <CreditCard className="w-4 h-4 text-teal-400" />
                  Back Side Card
                </span>
                {backCard && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-teal-500/20 text-teal-300 font-mono font-semibold border border-teal-500/30">
                    {Math.round(backCard.confidence * 100)}% Match
                  </span>
                )}
              </div>

              <div className="flex-1 min-h-[160px] bg-slate-900 rounded-xl border border-slate-800/80 flex items-center justify-center p-2 relative overflow-hidden">
                {backCard ? (
                  <img
                    src={backCard.dataUrl}
                    alt="Back Card"
                    className="max-w-full max-h-48 object-contain rounded-lg shadow-md"
                  />
                ) : (
                  <div className="text-xs text-slate-500 text-center">
                    No back side region detected (Single-side document)
                  </div>
                )}
              </div>

              {backCard && (
                <div className="text-[11px] text-slate-400 space-y-1">
                  <p className="font-medium text-slate-300">{backCard.summary}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400">
            Detected Document: <strong className="text-white">{documentTitle || documentType}</strong>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApply(frontCard, backCard);
                onClose();
              }}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 rounded-xl shadow-lg shadow-emerald-600/30 transition-all"
            >
              <Check className="w-4 h-4" />
              Apply & Auto-Slot into Studio
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
