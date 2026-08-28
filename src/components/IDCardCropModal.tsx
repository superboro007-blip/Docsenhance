import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IDCardPreset, QuadCorners } from '../types';
import { FourCornerFreeCrop } from './FourCornerFreeCrop';
import {
  Crop,
  Sparkles,
  Check,
  X,
  CreditCard,
  Lock,
  Unlock,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Sliders,
  Crosshair,
} from 'lucide-react';

interface IDCardCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  side: 'front' | 'back';
  preset: IDCardPreset;
  customWidthMm: number;
  customHeightMm: number;
  initialCropBox?: { x: number; y: number; width: number; height: number };
  initialCorners?: QuadCorners;
  onApplyCrop: (cropBox: { x: number; y: number; width: number; height: number }, quadCorners?: QuadCorners) => void;
}

type CropEngineMode = 'box' | 'quad';

export const IDCardCropModal: React.FC<IDCardCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  side,
  preset,
  customWidthMm,
  customHeightMm,
  initialCropBox,
  initialCorners,
  onApplyCrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetWidth = preset.id === 'dl_custom' ? customWidthMm : preset.widthMm;
  const targetHeight = preset.id === 'dl_custom' ? customHeightMm : preset.heightMm;
  const presetAspectRatio = targetWidth / targetHeight; // approx 1.586 for CR80

  const [engineMode, setEngineMode] = useState<CropEngineMode>('box');
  const [isFreeform, setIsFreeform] = useState(false);

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 5,
    y: 5,
    width: 90,
    height: 90 / presetAspectRatio,
  });

  const [corners, setCorners] = useState<QuadCorners>({
    tl: { x: 6, y: 6 },
    tr: { x: 94, y: 6 },
    br: { x: 94, y: 94 },
    bl: { x: 6, y: 94 },
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0,
    y: 0,
    width: 0,
    height: 0,
  });

  const [isAiDetecting, setIsAiDetecting] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialCropBox) {
      setCropBox(initialCropBox);
    } else {
      const defaultW = 88;
      const defaultH = defaultW / presetAspectRatio;
      setCropBox({
        x: (100 - defaultW) / 2,
        y: Math.max(4, (100 - defaultH) / 2),
        width: defaultW,
        height: defaultH > 92 ? 92 : defaultH,
      });
    }

    if (initialCorners) {
      setCorners(initialCorners);
    } else {
      setCorners({
        tl: { x: 6, y: 6 },
        tr: { x: 94, y: 6 },
        br: { x: 94, y: 94 },
        bl: { x: 6, y: 94 },
      });
    }
  }, [isOpen, initialCropBox, initialCorners, presetAspectRatio]);

  const currentRatio = isFreeform ? null : presetAspectRatio;

  const handleAiDetectCardBounds = async () => {
    setIsAiDetecting(true);
    setAiNote('Detecting ID card edges...');
    try {
      const res = await fetch('/api/ai/detect-card-side', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageSrc }),
      });
      if (!res.ok) throw new Error('AI detect service not reachable');
      const data = await res.json();
      if (data.cardBoundingBox) {
        const x = (data.cardBoundingBox.xMin / 1000) * 100;
        const y = (data.cardBoundingBox.yMin / 1000) * 100;
        const w = ((data.cardBoundingBox.xMax - data.cardBoundingBox.xMin) / 1000) * 100;
        const h = currentRatio ? w / currentRatio : ((data.cardBoundingBox.yMax - data.cardBoundingBox.yMin) / 1000) * 100;

        setCropBox({
          x: Math.max(0, Math.min(100 - w, x)),
          y: Math.max(0, Math.min(100 - h, y)),
          width: Math.min(100, w),
          height: Math.min(100, h),
        });
        setAiNote(`Card detected (${data.summary || 'aligned'})`);
      } else {
        setAiNote('Standard ID card crop fitted');
      }
    } catch (err) {
      console.warn('AI card detect failed:', err);
      setAiNote('Center frame applied');
    } finally {
      setIsAiDetecting(false);
      setTimeout(() => setAiNote(null), 3000);
    }
  };

  const nudge = (dx: number, dy: number) => {
    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(100 - prev.width, prev.x + dx)),
      y: Math.max(0, Math.min(100 - prev.height, prev.y + dy)),
    }));
  };

  const centerBox = () => {
    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, (100 - prev.width) / 2),
      y: Math.max(0, (100 - prev.height) / 2),
    }));
  };

  const zoomCrop = (scaleFactor: number) => {
    setCropBox((prev) => {
      let newW = Math.max(15, Math.min(100, prev.width * scaleFactor));
      let newH = currentRatio ? newW / currentRatio : Math.max(15, Math.min(100, prev.height * scaleFactor));

      if (newH > 100 && currentRatio) {
        newH = 100;
        newW = newH * currentRatio;
      }

      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;

      let newX = centerX - newW / 2;
      let newY = centerY - newH / 2;

      newX = Math.max(0, Math.min(100 - newW, newX));
      newY = Math.max(0, Math.min(100 - newH, newY));

      return { x: newX, y: newY, width: newW, height: newH };
    });
  };

  const maximizeCrop = () => {
    if (currentRatio) {
      let w = 100;
      let h = w / currentRatio;
      if (h > 100) {
        h = 100;
        w = h * currentRatio;
      }
      setCropBox({
        x: (100 - w) / 2,
        y: (100 - h) / 2,
        width: w,
        height: h,
      });
    } else {
      setCropBox({ x: 0, y: 0, width: 100, height: 100 });
    }
  };

  const handleMouseDown = (e: React.MouseEvent | React.TouchEvent, handle: string) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
    setDragHandle(handle);

    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

    setDragStart({ x: clientX, y: clientY });
    setCropStart({ ...cropBox });
  };

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDragging || !containerRef.current) return;

      const rect = containerRef.current.getBoundingClientRect();
      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const deltaXPct = ((clientX - dragStart.x) / rect.width) * 100;
      const deltaYPct = ((clientY - dragStart.y) / rect.height) * 100;

      if (dragHandle === 'move') {
        let newX = cropStart.x + deltaXPct;
        let newY = cropStart.y + deltaYPct;

        newX = Math.max(0, Math.min(100 - cropStart.width, newX));
        newY = Math.max(0, Math.min(100 - cropStart.height, newY));

        setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
      } else if (currentRatio) {
        // Locked aspect ratio
        if (dragHandle === 'br' || dragHandle === 'se' || dragHandle === 'e' || dragHandle === 's') {
          let newWidth = Math.max(20, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
          let newHeight = newWidth / currentRatio;

          if (cropStart.y + newHeight > 100) {
            newHeight = 100 - cropStart.y;
            newWidth = newHeight * currentRatio;
          }

          setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight }));
        } else if (dragHandle === 'tl' || dragHandle === 'nw') {
          let newWidth = Math.max(20, cropStart.width - deltaXPct);
          let newHeight = newWidth / currentRatio;
          let newX = cropStart.x + (cropStart.width - newWidth);
          let newY = cropStart.y + (cropStart.height - newHeight);

          if (newX >= 0 && newY >= 0) {
            setCropBox({ x: newX, y: newY, width: newWidth, height: newHeight });
          }
        } else if (dragHandle === 'tr' || dragHandle === 'ne') {
          let newWidth = Math.max(20, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
          let newHeight = newWidth / currentRatio;
          let newY = cropStart.y + (cropStart.height - newHeight);

          if (newY >= 0) {
            setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight, y: newY }));
          }
        } else if (dragHandle === 'bl' || dragHandle === 'sw') {
          let newWidth = Math.max(20, cropStart.width - deltaXPct);
          let newHeight = newWidth / currentRatio;
          let newX = cropStart.x + (cropStart.width - newWidth);

          if (newX >= 0 && cropStart.y + newHeight <= 100) {
            setCropBox({ x: newX, y: cropStart.y, width: newWidth, height: newHeight });
          }
        }
      } else {
        // Freeform
        let x = cropStart.x;
        let y = cropStart.y;
        let w = cropStart.width;
        let h = cropStart.height;

        if (dragHandle?.includes('e')) w = Math.max(10, Math.min(100 - x, cropStart.width + deltaXPct));
        if (dragHandle?.includes('s')) h = Math.max(10, Math.min(100 - y, cropStart.height + deltaYPct));
        if (dragHandle?.includes('w')) {
          const newW = Math.max(10, cropStart.width - deltaXPct);
          const newX = cropStart.x + (cropStart.width - newW);
          if (newX >= 0) {
            x = newX;
            w = newW;
          }
        }
        if (dragHandle?.includes('n')) {
          const newH = Math.max(10, cropStart.height - deltaYPct);
          const newY = cropStart.y + (cropStart.height - newH);
          if (newY >= 0) {
            y = newY;
            h = newH;
          }
        }

        setCropBox({ x, y, width: w, height: h });
      }
    },
    [isDragging, dragHandle, dragStart, cropStart, currentRatio]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragHandle(null);
  }, []);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      window.addEventListener('touchmove', handleMouseMove);
      window.addEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-700 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                ID Card Manual Crop Studio ({side === 'front' ? 'FRONT SIDE' : 'BACK SIDE'})
              </h2>
              <p className="text-xs text-slate-400">
                Preset: <span className="text-emerald-400 font-semibold">{preset.name}</span> ({targetWidth} × {targetHeight} mm)
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

        {/* Primary Crop Engine Mode Switcher */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10">
            <button
              onClick={() => setEngineMode('box')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                engineMode === 'box'
                  ? 'bg-emerald-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              Standard Box Crop
            </button>
            <button
              onClick={() => setEngineMode('quad')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                engineMode === 'quad'
                  ? 'bg-purple-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-yellow-300" />
              4-Corner Freecrop (Perspective Warp)
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            {engineMode === 'quad' ? (
              <span className="text-purple-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                Drag any of the 4 corner pins individually to fix perspective, tilt, or scanner skew
              </span>
            ) : (
              <span className="text-emerald-300">
                Preset frame size: {targetWidth} × {targetHeight} mm ({preset.name})
              </span>
            )}
          </div>
        </div>

        {engineMode === 'quad' ? (
          <div className="p-4 flex-1 overflow-y-auto max-h-[620px]">
            <FourCornerFreeCrop
              imageSrc={imageSrc}
              targetWidthMm={targetWidth}
              targetHeightMm={targetHeight}
              corners={corners}
              onChangeCorners={setCorners}
              onResetCorners={() => {
                setCorners({
                  tl: { x: 6, y: 6 },
                  tr: { x: 94, y: 6 },
                  br: { x: 94, y: 94 },
                  bl: { x: 6, y: 94 },
                });
              }}
              onAutoDetectCorners={handleAiDetectCardBounds}
              isAiLoading={isAiDetecting}
            />
          </div>
        ) : (
          <>
            {/* Toolbar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Mode:
            </span>
            <button
              onClick={() => setIsFreeform(false)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
                !isFreeform
                  ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Lock className="w-3 h-3" />
              Standard CR80 Ratio ({targetWidth}×{targetHeight} mm)
            </button>
            <button
              onClick={() => setIsFreeform(true)}
              className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
                isFreeform
                  ? 'bg-purple-600 text-white shadow-sm font-semibold'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Unlock className="w-3 h-3" />
              Freeform Manual Crop
            </button>
            <button
              onClick={maximizeCrop}
              className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 font-medium"
            >
              <Maximize2 className="w-3 h-3" /> Maximize
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAiDetectCardBounds}
              disabled={isAiDetecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-600/30 hover:bg-emerald-600/50 text-emerald-300 border border-emerald-500/40 font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiDetecting ? 'animate-spin' : ''}`} />
              {isAiDetecting ? 'Detecting Edges...' : 'AI Auto-Detect Card'}
            </button>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-[380px] max-h-[580px]">
          {/* Visual Canvas */}
          <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-hidden relative select-none">
            <div
              ref={containerRef}
              className="relative inline-block max-w-full max-h-full shadow-2xl rounded-md overflow-hidden"
              style={{ touchAction: 'none' }}
            >
              <img
                src={imageSrc}
                alt="ID Card Crop"
                className="max-h-[480px] max-w-full object-contain pointer-events-none rounded-sm"
              />

              {/* Dark Mask */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute bg-black/70 top-0 left-0 right-0" style={{ height: `${cropBox.y}%` }} />
                <div
                  className="absolute bg-black/70 bottom-0 left-0 right-0"
                  style={{ height: `${Math.max(0, 100 - (cropBox.y + cropBox.height))}%` }}
                />
                <div
                  className="absolute bg-black/70 left-0"
                  style={{ top: `${cropBox.y}%`, height: `${cropBox.height}%`, width: `${cropBox.x}%` }}
                />
                <div
                  className="absolute bg-black/70 right-0"
                  style={{
                    top: `${cropBox.y}%`,
                    height: `${cropBox.height}%`,
                    width: `${Math.max(0, 100 - (cropBox.x + cropBox.width))}%`,
                  }}
                />
              </div>

              {/* Selection Box */}
              <div
                className="absolute border-2 border-emerald-400 ring-2 ring-emerald-500/30 rounded-lg shadow-2xl cursor-move"
                style={{
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                onTouchStart={(e) => handleMouseDown(e, 'move')}
              >
                {/* 8 Drag Handles */}
                <div
                  className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tl')}
                  onTouchStart={(e) => handleMouseDown(e, 'tl')}
                />
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-sm cursor-ns-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'n')}
                  onTouchStart={(e) => handleMouseDown(e, 'n')}
                />
                <div
                  className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tr')}
                  onTouchStart={(e) => handleMouseDown(e, 'tr')}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-4 h-4 bg-white border-2 border-emerald-600 rounded-sm cursor-ew-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'e')}
                  onTouchStart={(e) => handleMouseDown(e, 'e')}
                />
                <div
                  className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'br')}
                  onTouchStart={(e) => handleMouseDown(e, 'br')}
                />
                <div
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-emerald-600 rounded-sm cursor-ns-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 's')}
                  onTouchStart={(e) => handleMouseDown(e, 's')}
                />
                <div
                  className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'bl')}
                  onTouchStart={(e) => handleMouseDown(e, 'bl')}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-4 h-4 bg-white border-2 border-emerald-600 rounded-sm cursor-ew-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'w')}
                  onTouchStart={(e) => handleMouseDown(e, 'w')}
                />

                {/* Dimension Tag */}
                <div className="absolute bottom-1 right-1 bg-black/80 text-emerald-300 text-[10px] px-1.5 py-0.5 rounded font-mono pointer-events-none border border-emerald-500/30">
                  {Math.round(cropBox.width)}% × {Math.round(cropBox.height)}%
                </div>
              </div>
            </div>
          </div>

          {/* Right Fine-Tuning Panel */}
          <div className="w-full lg:w-72 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-emerald-400" /> Card Nudge & Scale
            </h3>

            {/* Position Nudge */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400 text-center">Nudge Position</div>
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => nudge(0, -1)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => nudge(-1, 0)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={centerBox}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 hover:bg-emerald-600/50"
                  >
                    Center
                  </button>
                  <button
                    onClick={() => nudge(1, 0)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => nudge(0, 1)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Zoom / Scale */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400">Crop Box Scale</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => zoomCrop(0.92)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-emerald-400" /> Zoom In
                </button>
                <button
                  onClick={() => zoomCrop(1.08)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-teal-400" /> Zoom Out
                </button>
              </div>
            </div>

            {/* Width Slider */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Width Size</span>
                  <span className="font-mono text-emerald-400">{Math.round(cropBox.width)}%</span>
                </div>
                <input
                  type="range"
                  min="20"
                  max="100"
                  value={cropBox.width}
                  onChange={(e) => {
                    const w = parseFloat(e.target.value);
                    const h = currentRatio ? w / currentRatio : cropBox.height;
                    setCropBox((prev) => ({
                      ...prev,
                      width: w,
                      height: Math.min(100, h),
                      x: Math.max(0, Math.min(100 - w, prev.x)),
                    }));
                  }}
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                />
              </div>
            </div>
          </div>
        </div>
      </>
    )}

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {engineMode === 'quad' ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-purple-300 font-medium">
                  4-Corner Perspective Warp active ({targetWidth} × {targetHeight} mm target)
                </span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                {isFreeform ? 'Freeform Crop' : `Locked to ${targetWidth} × ${targetHeight} mm`}
              </>
            )}
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
                if (engineMode === 'quad') {
                  onApplyCrop(cropBox, corners);
                } else {
                  onApplyCrop(cropBox, undefined);
                }
                onClose();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg transition-all"
            >
              <Check className="w-4 h-4" />
              {engineMode === 'quad' ? 'Apply Perspective Freecrop' : 'Apply Crop & Frame'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

