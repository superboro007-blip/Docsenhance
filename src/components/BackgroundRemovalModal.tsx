import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Check,
  X,
  Sliders,
  RefreshCw,
  Wand2,
  Palette,
  Eye,
  ShieldCheck,
  Zap,
  SplitSquareVertical,
  Download,
  Info,
} from 'lucide-react';
import { removeImageBackground } from '../utils/imageProcessing';
import { removeAiBackground, compositeOverSolidColor } from '../utils/aiBackgroundRemoval';

interface BackgroundRemovalModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  onApply: (newImageSrc: string) => void;
}

const BG_COLOR_OPTIONS = [
  { id: 'white', label: 'ICAO Pure White', value: '#ffffff', color: '#ffffff', badge: 'Official Passport' },
  { id: 'offwhite', label: 'Off-White / Cream', value: '#f8fafc', color: '#f8fafc', badge: 'Schengen / US' },
  { id: 'lightblue', label: 'Light Blue', value: '#dbeafe', color: '#dbeafe', badge: 'EU / PH Standard' },
  { id: 'blue', label: 'Royal Blue', value: '#1d4ed8', color: '#1d4ed8', badge: 'MY / ASEAN' },
  { id: 'red', label: 'Studio Red', value: '#dc2626', color: '#dc2626', badge: 'ID / CN / SG' },
  { id: 'lightgray', label: 'Light Gray', value: '#e2e8f0', color: '#e2e8f0', badge: 'ID Badges' },
  { id: 'transparent', label: 'Transparent (PNG)', value: 'transparent', color: 'transparent', badge: 'Graphic Asset' },
];

export const BackgroundRemovalModal: React.FC<BackgroundRemovalModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  onApply,
}) => {
  const [selectedBgColor, setSelectedBgColor] = useState<string>('#ffffff');
  const [tolerance, setTolerance] = useState<number>(32);
  const [featherRadius, setFeatherRadius] = useState<number>(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [transparentBaseSrc, setTransparentBaseSrc] = useState<string | null>(null);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiProgressText, setAiProgressText] = useState<string>('');
  const [aiProgressPercent, setAiProgressPercent] = useState<number>(0);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'split' | 'sideBySide'>('sideBySide');
  const [splitPosition, setSplitPosition] = useState<number>(50);
  const [engineUsed, setEngineUsed] = useState<'neural_ai' | 'color_matting' | 'none'>('none');

  // Trigger AI Neural Background Subtraction
  const handleAiNeuralRemoval = async (targetColor = selectedBgColor) => {
    if (!imageSrc) return;
    setIsAiLoading(true);
    setAiProgressPercent(15);
    setAiProgressText('Initializing neural background subtraction library...');

    try {
      const result = await removeAiBackground(imageSrc, {
        targetBgColor: targetColor,
        featherRadius,
        edgeSmoothing: true,
        onProgress: (step, percent) => {
          setAiProgressText(step);
          setAiProgressPercent(percent);
        },
      });

      setPreviewSrc(result.dataUrl);
      setEngineUsed(result.method);
      setStatusMessage(
        result.method === 'neural_ai'
          ? `Neural AI Segmentation applied (${result.durationMs}ms)`
          : `Studio Color Matting applied (${result.durationMs}ms)`
      );

      // If we got neural output, also store transparent mask for instant color switching
      if (result.isAiSuccess) {
        const transResult = await removeAiBackground(imageSrc, {
          targetBgColor: 'transparent',
          featherRadius,
        });
        setTransparentBaseSrc(transResult.dataUrl);
      }
    } catch (err) {
      console.warn('AI removal error:', err);
      // Fallback
      const fallbackRes = await removeImageBackground(imageSrc, targetColor, tolerance);
      setPreviewSrc(fallbackRes);
      setEngineUsed('color_matting');
      setStatusMessage('Fast color thresholding applied');
    } finally {
      setIsAiLoading(false);
      setTimeout(() => setStatusMessage(null), 4000);
    }
  };

  // Instant fast preview when user adjusts tolerance or color manually
  useEffect(() => {
    if (!isOpen || !imageSrc) return;

    // If we already have transparent AI base, instantly re-composite with new color!
    if (transparentBaseSrc) {
      compositeOverSolidColor(transparentBaseSrc, selectedBgColor, featherRadius)
        .then((res) => setPreviewSrc(res))
        .catch(() => {});
      return;
    }

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
        console.error('Background removal error:', err);
        if (isMounted) setIsProcessing(false);
      }
    }, 120);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [isOpen, imageSrc, selectedBgColor, tolerance, transparentBaseSrc, featherRadius]);

  // Run AI segmentation automatically when opened if not yet analyzed
  useEffect(() => {
    if (isOpen && imageSrc && !transparentBaseSrc && engineUsed === 'none') {
      handleAiNeuralRemoval(selectedBgColor);
    }
  }, [isOpen, imageSrc]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 rounded-3xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-700/80">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-2xl bg-gradient-to-br from-purple-500 to-indigo-600 text-white shadow-md shadow-purple-500/20 border border-purple-400/30">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  AI Background Subtraction & Replacement
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3 text-purple-400" />
                  ICAO Compliant
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Neural network segmentation isolates hair and facial contours to replace background with pure white or official consular colors.
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

        {/* Toolbar & Status Bar */}
        <div className="px-6 py-3 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <button
              onClick={() => handleAiNeuralRemoval(selectedBgColor)}
              disabled={isAiLoading}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-500 hover:to-blue-500 text-white font-bold shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
            >
              {isAiLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Zap className="w-4 h-4 text-amber-300" />
              )}
              {isAiLoading ? 'Segmenting with AI...' : 'Re-Run AI Neural Subtraction'}
            </button>

            {/* Quick ICAO White Button */}
            <button
              onClick={() => {
                setSelectedBgColor('#ffffff');
                if (transparentBaseSrc) {
                  compositeOverSolidColor(transparentBaseSrc, '#ffffff', featherRadius).then(setPreviewSrc);
                } else {
                  handleAiNeuralRemoval('#ffffff');
                }
              }}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white font-medium border border-white/15 transition-all text-xs"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
              Set Pure White (#FFF)
            </button>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center gap-2">
            <div className="bg-slate-900 p-1 rounded-xl border border-slate-800 flex items-center gap-1">
              <button
                onClick={() => setViewMode('sideBySide')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'sideBySide'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Side by Side
              </button>
              <button
                onClick={() => setViewMode('split')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1 ${
                  viewMode === 'split'
                    ? 'bg-purple-600 text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <SplitSquareVertical className="w-3.5 h-3.5" />
                Split Compare
              </button>
            </div>

            {statusMessage && (
              <span className="text-xs font-semibold text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-3 py-1 rounded-lg">
                {statusMessage}
              </span>
            )}
          </div>
        </div>

        {/* AI Progress Bar (when downloading/segmenting) */}
        {isAiLoading && (
          <div className="bg-purple-950/60 border-b border-purple-500/30 px-6 py-2 flex items-center gap-4 animate-pulse">
            <div className="flex-1">
              <div className="flex justify-between text-[11px] font-semibold text-purple-200 mb-1">
                <span>{aiProgressText || 'Processing AI neural background subtraction...'}</span>
                <span>{aiProgressPercent}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-purple-500 to-indigo-400 transition-all duration-300 rounded-full"
                  style={{ width: `${aiProgressPercent}%` }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Workspace: Preview & Controls */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden min-h-[380px] max-h-[580px]">
          {/* Main Visual Preview Area */}
          <div className="flex-1 bg-slate-950 p-6 flex flex-col items-center justify-center overflow-y-auto relative">
            {viewMode === 'sideBySide' ? (
              <div className="flex flex-col sm:flex-row items-center justify-center gap-6 w-full max-w-2xl">
                {/* Original Photo */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-semibold text-slate-400">Original Portrait</span>
                  <div className="w-52 h-64 bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-xl flex items-center justify-center p-1.5 relative group">
                    <img
                      src={imageSrc}
                      alt="Original"
                      className="max-w-full max-h-full object-contain rounded-xl"
                    />
                    <span className="absolute bottom-2 left-2 bg-black/70 backdrop-blur-xs text-slate-300 text-[10px] px-2 py-0.5 rounded font-mono">
                      Source
                    </span>
                  </div>
                </div>

                <div className="text-slate-600 font-bold hidden sm:block text-lg">➔</div>

                {/* Subtracted / Replaced Preview */}
                <div className="flex flex-col items-center gap-2">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-purple-400" />
                    AI Isolated Output
                  </span>
                  <div
                    className={`w-52 h-64 border-2 border-purple-500/50 rounded-2xl overflow-hidden shadow-2xl flex items-center justify-center p-1.5 relative ${
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
                        alt="Subtracted Background"
                        className="max-w-full max-h-full object-contain rounded-xl"
                      />
                    ) : (
                      <div className="flex flex-col items-center gap-2 text-xs text-slate-400">
                        <RefreshCw className="w-6 h-6 animate-spin text-purple-400" />
                        <span>Processing AI Mask...</span>
                      </div>
                    )}

                    <span className="absolute bottom-2 right-2 bg-purple-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow-sm">
                      {selectedBgColor === '#ffffff' ? 'ICAO Pure White' : selectedBgColor}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              /* Interactive Split-Comparison Slider */
              <div className="flex flex-col items-center gap-3 w-full max-w-md">
                <span className="text-xs font-semibold text-slate-300">
                  Drag slider to compare Before / After
                </span>
                <div className="relative w-64 h-80 bg-slate-900 rounded-2xl overflow-hidden border-2 border-purple-500/40 shadow-2xl select-none">
                  {/* Background Layer (Replaced) */}
                  <div
                    className="absolute inset-0 flex items-center justify-center"
                    style={{
                      backgroundColor: selectedBgColor !== 'transparent' ? selectedBgColor : '#ffffff',
                    }}
                  >
                    {previewSrc && (
                      <img
                        src={previewSrc}
                        alt="AI Subtracted"
                        className="max-w-full max-h-full object-contain"
                      />
                    )}
                  </div>

                  {/* Foreground Layer (Original, clipped by split position) */}
                  <div
                    className="absolute inset-0 overflow-hidden"
                    style={{ width: `${splitPosition}%` }}
                  >
                    <div className="w-64 h-80 flex items-center justify-center bg-slate-900">
                      <img
                        src={imageSrc}
                        alt="Original"
                        className="max-w-full max-h-full object-contain"
                      />
                    </div>
                  </div>

                  {/* Split Divider Line */}
                  <div
                    className="absolute top-0 bottom-0 w-0.5 bg-white shadow-[0_0_8px_rgba(255,255,255,0.8)] pointer-events-none"
                    style={{ left: `${splitPosition}%` }}
                  >
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white text-slate-900 flex items-center justify-center text-[10px] font-bold shadow-lg">
                      ↔
                    </div>
                  </div>
                </div>

                {/* Range Slider for Split */}
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={splitPosition}
                  onChange={(e) => setSplitPosition(Number(e.target.value))}
                  className="w-64 accent-purple-500 cursor-pointer"
                />
              </div>
            )}
          </div>

          {/* Right Control Sidebar */}
          <div className="w-full md:w-88 bg-slate-900 border-t md:border-t-0 md:border-l border-slate-800 p-5 space-y-4 overflow-y-auto">
            {/* Color Palette Selector */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-slate-300 flex items-center justify-between uppercase tracking-wider">
                <span className="flex items-center gap-1.5">
                  <Palette className="w-3.5 h-3.5 text-purple-400" /> Passport Background
                </span>
                <span className="text-[10px] font-normal text-purple-400">Official Standards</span>
              </label>

              <div className="space-y-1.5">
                {BG_COLOR_OPTIONS.map((opt) => {
                  const isSelected = selectedBgColor === opt.value;
                  return (
                    <button
                      key={opt.id}
                      onClick={() => {
                        setSelectedBgColor(opt.value);
                      }}
                      className={`w-full flex items-center justify-between p-2.5 rounded-xl text-xs border transition-all text-left ${
                        isSelected
                          ? 'border-purple-500 bg-purple-500/20 text-white font-bold ring-1 ring-purple-500'
                          : 'border-slate-800 bg-slate-950/80 text-slate-300 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <span
                          className="w-5 h-5 rounded-full border border-white/20 shadow-xs flex-shrink-0"
                          style={{
                            backgroundColor: opt.color === 'transparent' ? '#1e293b' : opt.color,
                          }}
                        />
                        <span className="font-semibold">{opt.label}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800">
                        {opt.badge}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Custom Color Input */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
              <label className="text-[11px] font-medium text-slate-400">Custom Background Hex</label>
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
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-xs font-mono text-slate-200"
                  placeholder="#ffffff or transparent"
                />
              </div>
            </div>

            {/* Edge Refinement & Feathering */}
            <div className="bg-slate-950 p-3 rounded-2xl border border-slate-800 space-y-2">
              <div className="flex justify-between items-center text-[11px] text-slate-400">
                <span className="flex items-center gap-1 font-medium">
                  <Sliders className="w-3 h-3 text-purple-400" /> Edge Feathering & Smoothness
                </span>
                <span className="font-mono text-purple-400 font-bold">{featherRadius}px</span>
              </div>
              <input
                type="range"
                min="0"
                max="5"
                step="0.5"
                value={featherRadius}
                onChange={(e) => setFeatherRadius(Number(e.target.value))}
                className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
              />
              <div className="flex justify-between text-[9px] text-slate-500">
                <span>Crisp Hair Edges</span>
                <span>Soft Blend</span>
              </div>
            </div>

            {/* Quick Info Box */}
            <div className="p-3 bg-purple-950/30 rounded-2xl border border-purple-500/20 text-[11px] text-purple-300 space-y-1">
              <div className="flex items-center gap-1.5 font-bold text-purple-200">
                <Info className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                Passport Photo Standard Tip
              </div>
              <p className="text-[10px] text-purple-300/80 leading-relaxed">
                Most passports (USA, UK, EU, Schengen, India, Australia) mandate a plain white or light off-white background with no shadows behind the head.
              </p>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400">
            Selected Background: <strong className="text-purple-400">{selectedBgColor}</strong>
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
                if (previewSrc) {
                  onApply(previewSrc);
                  onClose();
                }
              }}
              disabled={!previewSrc || isProcessing || isAiLoading}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 rounded-xl shadow-lg shadow-purple-600/30 transition-all disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              Apply to Passport Photo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
