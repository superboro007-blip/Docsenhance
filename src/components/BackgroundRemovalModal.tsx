import React, { useState, useEffect, useRef } from 'react';
import { Sparkles, Check, X, Sliders, RefreshCw, Wand2, Palette, Eye } from 'lucide-react';
import { removeImageBackground } from '../utils/imageProcessing';

interface BackgroundRemovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onApply: (newImageSrc: string) => void;
}

const BG_COLOR_OPTIONS = [
  { id: 'transparent', label: 'Transparent', value: 'transparent', previewClass: 'bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:8px_8px] bg-slate-100' },
  { id: 'white', label: 'Pure White (Passport)', value: '#ffffff', color: '#ffffff' },
  { id: 'offwhite', label: 'Off-White', value: '#f8fafc', color: '#f8fafc' },
  { id: 'lightblue', label: 'Light Blue', value: '#dbeafe', color: '#dbeafe' },
  { id: 'blue', label: 'Royal Blue', value: '#1d4ed8', color: '#1d4ed8' },
  { id: 'red', label: 'Studio Red', value: '#dc2626', color: '#dc2626' },
  { id: 'lightgray', label: 'Light Gray', value: '#e5e7eb', color: '#e5e7eb' },
];

export const BackgroundRemovalModal: React.FC<BackgroundRemovalModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onApply,
}) => {
  const [selectedBgColor, setSelectedBgColor] = useState<string>('#ffffff');
  const [tolerance, setTolerance] = useState<number>(32);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [mode, setMode] = useState<'instant' | 'ai'>('instant');
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Debounced auto-preview when settings change
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    let isMounted = true;
    setIsProcessing(true);

    const timer = setTimeout(async () => {
      try {
        const result = await removeImageBackground(imageSrc, selectedBgColor, tolerance);
        if (isMounted) {
          setPreviewSrc(result);
          setIsProcessing(false);
        }
      } catch (err) {
        console.error('Background removal failed:', err);
        if (isMounted) setIsProcessing(false);
      }
    }, 150);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, imageSrc, selectedBgColor, tolerance]);

  // AI-Assisted Background Removal using Server Fallback
  const handleAiRemoveBackground = async () => {
    setIsAiLoading(true);
    setStatusMessage('Analyzing photo background with AI...');
    try {
      const res = await fetch('/api/ai/remove-background', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageSrc,
          targetBackground: selectedBgColor,
        }),
      });
      if (!res.ok) throw new Error('AI background service not reachable');
      const data = await res.json();
      if (data.processedImageBase64) {
        setPreviewSrc(data.processedImageBase64);
        setStatusMessage('AI background removal completed');
      } else if (data.fallbackUsed) {
        // Fallback to client algorithm with smart tolerance
        const fallbackRes = await removeImageBackground(imageSrc, selectedBgColor, 35);
        setPreviewSrc(fallbackRes);
        setStatusMessage('Background cleaned with studio engine');
      }
    } catch (err) {
      console.warn('AI BG removal error, applying instant engine:', err);
      const fallbackRes = await removeImageBackground(imageSrc, selectedBgColor, tolerance);
      setPreviewSrc(fallbackRes);
      setStatusMessage('Cleaned using smart threshold filter');
    } finally {
      setIsAiLoading(false);
      setTimeout(() => setStatusMessage(null), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <Wand2 className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Remove & Replace Background
              </h2>
              <p className="text-xs text-slate-400">
                Replace busy backgrounds with pure white or official passport colors
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAiRemoveBackground}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-semibold shadow-md transition-all disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
              {isAiLoading ? 'AI Removing Background...' : 'AI Auto-Clean Background'}
            </button>
          </div>

          {statusMessage && (
            <span className="text-xs font-semibold text-purple-300 bg-purple-500/20 border border-purple-500/30 px-3 py-1 rounded-md">
              {statusMessage}
            </span>
          )}

          <div className="text-xs text-slate-400 flex items-center gap-1">
            <Eye className="w-3.5 h-3.5 text-blue-400" />
            {isProcessing ? 'Rendering preview...' : 'Live Instant Preview'}
          </div>
        </div>

        {/* Workspace: Comparison View & Control Panel */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[360px] max-h-[550px]">
          {/* Visual Previews */}
          <div className="flex-1 bg-slate-950 p-5 flex flex-col sm:flex-row items-center justify-center gap-4 overflow-y-auto">
            {/* Original */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-slate-400">Original Photo</span>
              <div className="w-48 h-60 bg-slate-900 border border-slate-800 rounded-xl overflow-hidden shadow-lg flex items-center justify-center p-1">
                <img
                  src={imageSrc}
                  alt="Original"
                  className="max-w-full max-h-full object-contain rounded-lg"
                />
              </div>
            </div>

            {/* Arrow Divider */}
            <div className="text-slate-600 font-bold hidden sm:block">➔</div>

            {/* Background Removed Output */}
            <div className="flex flex-col items-center gap-2">
              <span className="text-xs font-semibold text-purple-300 flex items-center gap-1">
                <Sparkles className="w-3 h-3" /> Result Preview
              </span>
              <div
                className={`w-48 h-60 border-2 border-purple-500/40 rounded-xl overflow-hidden shadow-2xl flex items-center justify-center p-1 relative ${
                  selectedBgColor === 'transparent'
                    ? 'bg-[radial-gradient(#94a3b8_1px,transparent_1px)] [background-size:12px_12px] bg-slate-900'
                    : ''
                }`}
                style={{
                  backgroundColor: selectedBgColor !== 'transparent' ? selectedBgColor : undefined,
                }}
              >
                {previewSrc ? (
                  <img
                    src={previewSrc}
                    alt="Processed"
                    className="max-w-full max-h-full object-contain rounded-lg"
                  />
                ) : (
                  <div className="flex flex-col items-center gap-2 text-xs text-slate-500">
                    <RefreshCw className="w-5 h-5 animate-spin text-purple-400" />
                    <span>Processing...</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="w-full md:w-80 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-4 space-y-4 overflow-y-auto">
            {/* Color Palette Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center gap-1.5 uppercase tracking-wider">
                <Palette className="w-3.5 h-3.5 text-purple-400" /> Replace Background Color
              </label>
              <div className="grid grid-cols-2 gap-2">
                {BG_COLOR_OPTIONS.map((opt) => (
                  <button
                    key={opt.id}
                    onClick={() => setSelectedBgColor(opt.value)}
                    className={`flex items-center gap-2 px-2.5 py-2 rounded-xl text-xs font-medium border transition-all text-left ${
                      selectedBgColor === opt.value
                        ? 'border-purple-500 bg-purple-500/20 text-white font-bold ring-1 ring-purple-500'
                        : 'border-slate-800 bg-slate-950 text-slate-300 hover:border-slate-700'
                    }`}
                  >
                    <span
                      className="w-4 h-4 rounded-full border border-white/20 shadow-xs flex-shrink-0"
                      style={{ backgroundColor: opt.color || '#fff' }}
                    />
                    <span className="truncate">{opt.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Custom Color Hex */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <label className="text-[11px] font-medium text-slate-400">Custom Color Picker</label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={selectedBgColor.startsWith('#') ? selectedBgColor : '#ffffff'}
                  onChange={(e) => setSelectedBgColor(e.target.value)}
                  className="w-8 h-8 rounded-lg border-0 bg-transparent cursor-pointer"
                />
                <input
                  type="text"
                  value={selectedBgColor}
                  onChange={(e) => setSelectedBgColor(e.target.value)}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono text-slate-200"
                  placeholder="#ffffff or transparent"
                />
              </div>
            </div>

            {/* Sensitivity / Tolerance Slider */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span className="flex items-center gap-1">
                  <Sliders className="w-3 h-3 text-purple-400" /> Color Tolerance
                </span>
                <span className="font-mono text-purple-400 font-bold">{tolerance}</span>
              </div>
              <input
                type="range"
                min="10"
                max="75"
                value={tolerance}
                onChange={(e) => setTolerance(parseInt(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>Lower (Keep edges)</span>
                <span>Higher (Remove more)</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400">
            Background Color: <span className="text-purple-400 font-semibold">{selectedBgColor}</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (previewSrc) {
                  onApply(previewSrc);
                  onClose();
                }
              }}
              disabled={!previewSrc || isProcessing}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Apply New Background
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
