import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PassportPreset, QuadCorners } from '../types';
import { FourCornerFreeCrop } from './FourCornerFreeCrop';
import {
  Crop,
  Sparkles,
  Check,
  X,
  User,
  Maximize2,
  Lock,
  Unlock,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sliders,
  Crosshair,
} from 'lucide-react';

interface PassportCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  preset: PassportPreset;
  customWidthMm: number;
  customHeightMm: number;
  initialCropBox?: { x: number; y: number; width: number; height: number };
  initialCorners?: QuadCorners;
  onApplyCrop: (cropBox: { x: number; y: number; width: number; height: number }, quadCorners?: QuadCorners) => void;
}

type AspectRatioMode = 'preset' | 'free' | '1:1' | '3:4' | '4:3' | 'full';
type CropEngineMode = 'box' | 'quad';

export const PassportCropModal: React.FC<PassportCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  preset,
  customWidthMm,
  customHeightMm,
  initialCropBox,
  initialCorners,
  onApplyCrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const targetWidth = preset.id === 'custom_photo' ? customWidthMm : preset.widthMm;
  const targetHeight = preset.id === 'custom_photo' ? customHeightMm : preset.heightMm;
  const presetAspectRatio = targetWidth / targetHeight;

  const [engineMode, setEngineMode] = useState<CropEngineMode>('box');
  const [aspectMode, setAspectMode] = useState<AspectRatioMode>('preset');
  const [activeTab, setActiveTab] = useState<'manual' | 'ai'>('manual');

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 10,
    y: 5,
    width: 80,
    height: 80 / presetAspectRatio,
  });

  const [corners, setCorners] = useState<QuadCorners>({
    tl: { x: 8, y: 6 },
    tr: { x: 92, y: 6 },
    br: { x: 92, y: 94 },
    bl: { x: 8, y: 94 },
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

  const [showBiometricGuide, setShowBiometricGuide] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Initialize crop box and corners on modal open
  useEffect(() => {
    if (!isOpen) return;

    if (initialCropBox) {
      setCropBox(initialCropBox);
    } else {
      const defaultW = 75;
      const defaultH = defaultW / presetAspectRatio;
      setCropBox({
        x: Math.max(0, (100 - defaultW) / 2),
        y: Math.max(2, (100 - defaultH) / 2),
        width: defaultW,
        height: defaultH > 96 ? 96 : defaultH,
      });
    }

    if (initialCorners) {
      setCorners(initialCorners);
    } else {
      setCorners({
        tl: { x: 8, y: 6 },
        tr: { x: 92, y: 6 },
        br: { x: 92, y: 94 },
        bl: { x: 8, y: 94 },
      });
    }
  }, [isOpen, initialCropBox, initialCorners, presetAspectRatio]);

  // Current ratio factor (or null if freeform)
  const currentRatio =
    aspectMode === 'preset'
      ? presetAspectRatio
      : aspectMode === '1:1'
      ? 1.0
      : aspectMode === '3:4'
      ? 0.75
      : aspectMode === '4:3'
      ? 1.333
      : null;

  // AI Smart Face Detection & Framing
  const handleAiAutoCrop = async () => {
    setIsAiLoading(true);
    setAiMessage('Detecting face & biometric alignment...');
    try {
      const res = await fetch('/api/ai/passport-crop-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageSrc,
          targetRatio: `${targetWidth}x${targetHeight}`,
        }),
      });
      if (!res.ok) throw new Error('Passport assistant service not reachable');
      const data = await res.json();
      if (data.cropBox) {
        let w = data.cropBox.width;
        let h = currentRatio ? w / currentRatio : data.cropBox.height;
        if (h > 98) {
          h = 98;
          if (currentRatio) w = h * currentRatio;
        }
        setCropBox({
          x: Math.max(0, Math.min(100 - w, data.cropBox.x)),
          y: Math.max(0, Math.min(100 - h, data.cropBox.y)),
          width: Math.min(100, w),
          height: Math.min(100, h),
        });
        setAiMessage('Biometric face crop applied (70-80% head height)');
      }
    } catch (err) {
      console.warn('AI assistant failed, using standard center crop:', err);
      const w = 70;
      const h = currentRatio ? w / currentRatio : 80;
      setCropBox({
        x: (100 - w) / 2,
        y: 8,
        width: w,
        height: h,
      });
      setAiMessage('Framed to center portrait');
    } finally {
      setIsAiLoading(false);
      setTimeout(() => setAiMessage(null), 3000);
    }
  };

  // Quick preset ratio change handler
  const handleRatioChange = (mode: AspectRatioMode) => {
    setAspectMode(mode);
    let ratio: number | null = null;
    if (mode === 'preset') ratio = presetAspectRatio;
    else if (mode === '1:1') ratio = 1.0;
    else if (mode === '3:4') ratio = 0.75;
    else if (mode === '4:3') ratio = 1.333;
    else if (mode === 'full') {
      setCropBox({ x: 0, y: 0, width: 100, height: 100 });
      return;
    }

    if (ratio) {
      setCropBox((prev) => {
        let newW = prev.width;
        let newH = newW / ratio;
        if (newH > 98) {
          newH = 98;
          newW = newH * ratio;
        }
        const newX = Math.max(0, Math.min(100 - newW, prev.x));
        const newY = Math.max(0, Math.min(100 - newH, prev.y));
        return { x: newX, y: newY, width: newW, height: newH };
      });
    }
  };

  // Manual Nudge & Transform actions
  const nudge = (dx: number, dy: number) => {
    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(100 - prev.width, prev.x + dx)),
      y: Math.max(0, Math.min(100 - prev.height, prev.y + dy)),
    }));
  };

  const centerHorizontally = () => {
    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, (100 - prev.width) / 2),
    }));
  };

  const centerVertically = () => {
    setCropBox((prev) => ({
      ...prev,
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

  // Mouse / Touch handlers for 8 handles & move
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
        // Aspect ratio locked resizing
        if (dragHandle === 'br' || dragHandle === 'se' || dragHandle === 'e' || dragHandle === 's') {
          let newWidth = Math.max(15, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
          let newHeight = newWidth / currentRatio;

          if (cropStart.y + newHeight > 100) {
            newHeight = 100 - cropStart.y;
            newWidth = newHeight * currentRatio;
          }

          setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight }));
        } else if (dragHandle === 'tl' || dragHandle === 'nw') {
          let newWidth = Math.max(15, cropStart.width - deltaXPct);
          let newHeight = newWidth / currentRatio;
          let newX = cropStart.x + (cropStart.width - newWidth);
          let newY = cropStart.y + (cropStart.height - newHeight);

          if (newX >= 0 && newY >= 0) {
            setCropBox({ x: newX, y: newY, width: newWidth, height: newHeight });
          }
        } else if (dragHandle === 'tr' || dragHandle === 'ne') {
          let newWidth = Math.max(15, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
          let newHeight = newWidth / currentRatio;
          let newY = cropStart.y + (cropStart.height - newHeight);

          if (newY >= 0) {
            setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight, y: newY }));
          }
        } else if (dragHandle === 'bl' || dragHandle === 'sw') {
          let newWidth = Math.max(15, cropStart.width - deltaXPct);
          let newHeight = newWidth / currentRatio;
          let newX = cropStart.x + (cropStart.width - newWidth);

          if (newX >= 0 && cropStart.y + newHeight <= 100) {
            setCropBox({ x: newX, y: cropStart.y, width: newWidth, height: newHeight });
          }
        }
      } else {
        // Freeform unlocked 8-handle resizing
        let x = cropStart.x;
        let y = cropStart.y;
        let w = cropStart.width;
        let h = cropStart.height;

        if (dragHandle?.includes('e')) {
          w = Math.max(10, Math.min(100 - x, cropStart.width + deltaXPct));
        }
        if (dragHandle?.includes('s')) {
          h = Math.max(10, Math.min(100 - y, cropStart.height + deltaYPct));
        }
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
            <div className="p-2 rounded-xl bg-blue-500/20 text-blue-400 border border-blue-500/30">
              <Crop className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Manual & Biometric Photo Crop Studio
              </h2>
              <p className="text-xs text-slate-400">
                Preset: <span className="text-blue-400 font-semibold">{preset.name}</span> ({targetWidth} × {targetHeight} mm)
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

        {/* Primary Crop Mode Switcher */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10">
            <button
              onClick={() => setEngineMode('box')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                engineMode === 'box'
                  ? 'bg-blue-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crop className="w-3.5 h-3.5" />
              Standard Box / Biometric Crop
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
                Drag any of the 4 corner pins individually to fix perspective or skew
              </span>
            ) : (
              <span className="text-blue-300">
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
                  tl: { x: 8, y: 6 },
                  tr: { x: 92, y: 6 },
                  br: { x: 92, y: 94 },
                  bl: { x: 8, y: 94 },
                });
              }}
              onAutoDetectCorners={handleAiAutoCrop}
              isAiLoading={isAiLoading}
            />
          </div>
        ) : (
          <>
            {/* Toolbar & Aspect Ratio Mode Selector */}
            <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              {/* Aspect Ratio Selector Tabs */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-400 font-semibold mr-1 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-blue-400" /> Ratio:
                </span>
                <button
                  onClick={() => handleRatioChange('preset')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
                    aspectMode === 'preset'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Lock className="w-3 h-3" />
                  Locked ({targetWidth}×{targetHeight} mm)
                </button>
                <button
                  onClick={() => handleRatioChange('free')}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1 ${
                    aspectMode === 'free'
                      ? 'bg-purple-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Unlock className="w-3 h-3" />
                  Freeform Box Crop
                </button>
                <button
                  onClick={() => handleRatioChange('1:1')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    aspectMode === '1:1'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  1:1 Square
                </button>
                <button
                  onClick={() => handleRatioChange('3:4')}
                  className={`px-2.5 py-1.5 rounded-lg font-medium transition-all ${
                    aspectMode === '3:4'
                      ? 'bg-blue-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  3:4 Portrait
                </button>
                <button
                  onClick={maximizeCrop}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 font-medium"
                  title="Fit to full area"
                >
                  <Maximize2 className="w-3 h-3" /> Maximize
                </button>
              </div>

              {/* Quick AI & Guide Buttons */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAiAutoCrop}
                  disabled={isAiLoading}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-semibold transition-all shadow-sm disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  {isAiLoading ? 'Centering Face...' : 'AI Auto-Center'}
                </button>

                <button
                  onClick={() => setShowBiometricGuide(!showBiometricGuide)}
                  className={`inline-flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium transition-all border ${
                    showBiometricGuide
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  {showBiometricGuide ? 'Hide Face Guides' : 'Face Guides'}
                </button>
              </div>
            </div>

        {/* Workspace: Image Canvas + Fine-Tune Nudge Panel */}
        <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-[380px] max-h-[580px]">
          {/* Main Visual Crop Canvas */}
          <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-hidden relative select-none">
            <div
              ref={containerRef}
              className="relative inline-block max-w-full max-h-full shadow-2xl rounded-md overflow-hidden"
              style={{ touchAction: 'none' }}
            >
              <img
                ref={imgRef}
                src={imageSrc}
                alt="Crop Source"
                className="max-h-[480px] max-w-full object-contain pointer-events-none rounded-sm"
              />

              {/* Dark Mask around crop box */}
              <div className="absolute inset-0 pointer-events-none">
                {/* Top mask */}
                <div
                  className="absolute bg-black/70 top-0 left-0 right-0 backdrop-blur-[1px]"
                  style={{ height: `${cropBox.y}%` }}
                />
                {/* Bottom mask */}
                <div
                  className="absolute bg-black/70 bottom-0 left-0 right-0 backdrop-blur-[1px]"
                  style={{ height: `${Math.max(0, 100 - (cropBox.y + cropBox.height))}%` }}
                />
                {/* Left mask */}
                <div
                  className="absolute bg-black/70 left-0 backdrop-blur-[1px]"
                  style={{
                    top: `${cropBox.y}%`,
                    height: `${cropBox.height}%`,
                    width: `${cropBox.x}%`,
                  }}
                />
                {/* Right mask */}
                <div
                  className="absolute bg-black/70 right-0 backdrop-blur-[1px]"
                  style={{
                    top: `${cropBox.y}%`,
                    height: `${cropBox.height}%`,
                    width: `${Math.max(0, 100 - (cropBox.x + cropBox.width))}%`,
                  }}
                />
              </div>

              {/* Active Selection Box */}
              <div
                className="absolute border-2 border-blue-400 ring-2 ring-blue-500/40 shadow-2xl cursor-move transition-shadow"
                style={{
                  left: `${cropBox.x}%`,
                  top: `${cropBox.y}%`,
                  width: `${cropBox.width}%`,
                  height: `${cropBox.height}%`,
                }}
                onMouseDown={(e) => handleMouseDown(e, 'move')}
                onTouchStart={(e) => handleMouseDown(e, 'move')}
              >
                {/* Biometric Face Guide Lines Overlay */}
                {showBiometricGuide && (
                  <div className="absolute inset-0 pointer-events-none flex flex-col justify-between p-2">
                    {/* Top hair crown guide line */}
                    <div className="absolute top-[10%] left-0 right-0 border-b border-dashed border-yellow-300/90 flex justify-between px-2">
                      <span className="text-[9px] text-yellow-300 font-mono tracking-tight bg-black/60 px-1 rounded">
                        ▲ Hair Crown Max
                      </span>
                    </div>

                    {/* Eye Level Guide */}
                    <div className="absolute top-[50%] left-0 right-0 border-b border-yellow-400 flex justify-between px-2">
                      <span className="text-[9px] text-yellow-300 font-mono tracking-tight bg-black/60 px-1 rounded">
                        👁 Eye Level Axis
                      </span>
                    </div>

                    {/* Chin Level Guide */}
                    <div className="absolute top-[82%] left-0 right-0 border-b border-dashed border-yellow-300/90 flex justify-between px-2">
                      <span className="text-[9px] text-yellow-300 font-mono tracking-tight bg-black/60 px-1 rounded">
                        ▼ Chin Base (70-80%)
                      </span>
                    </div>

                    {/* Head Oval Silhouette */}
                    <div
                      className="absolute left-1/2 -translate-x-1/2 border border-yellow-300/60 rounded-[50%]"
                      style={{
                        top: '10%',
                        width: '64%',
                        height: '72%',
                      }}
                    />
                    {/* Center vertical axis line */}
                    <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-r border-dotted border-white/50" />
                  </div>
                )}

                {/* 8 Drag Handles for Complete Manual Freedom */}
                {/* Top-Left */}
                <div
                  className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tl')}
                  onTouchStart={(e) => handleMouseDown(e, 'tl')}
                />
                {/* Top-Middle */}
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm cursor-ns-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'n')}
                  onTouchStart={(e) => handleMouseDown(e, 'n')}
                />
                {/* Top-Right */}
                <div
                  className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tr')}
                  onTouchStart={(e) => handleMouseDown(e, 'tr')}
                />
                {/* Middle-Right */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm cursor-ew-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'e')}
                  onTouchStart={(e) => handleMouseDown(e, 'e')}
                />
                {/* Bottom-Right */}
                <div
                  className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'br')}
                  onTouchStart={(e) => handleMouseDown(e, 'br')}
                />
                {/* Bottom-Middle */}
                <div
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm cursor-ns-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 's')}
                  onTouchStart={(e) => handleMouseDown(e, 's')}
                />
                {/* Bottom-Left */}
                <div
                  className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'bl')}
                  onTouchStart={(e) => handleMouseDown(e, 'bl')}
                />
                {/* Middle-Left */}
                <div
                  className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-4 h-4 bg-white border-2 border-blue-600 rounded-sm cursor-ew-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'w')}
                  onTouchStart={(e) => handleMouseDown(e, 'w')}
                />

                {/* Dimension Tag */}
                <div className="absolute bottom-1 right-1 bg-black/80 text-blue-300 text-[10px] px-1.5 py-0.5 rounded font-mono pointer-events-none border border-blue-500/30">
                  {Math.round(cropBox.width)}% × {Math.round(cropBox.height)}%
                </div>
              </div>
            </div>
          </div>

          {/* Right Manual Fine-Tuning & Nudge Control Panel */}
          <div className="w-full lg:w-72 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-4 overflow-y-auto">
            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-blue-400" /> Manual Fine-Tuning
            </h3>

            {/* Position Nudge D-Pad */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400 text-center">
                Nudge Position (1% steps)
              </div>
              <div className="flex flex-col items-center gap-1">
                <button
                  onClick={() => nudge(0, -1)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Nudge Up"
                >
                  <ArrowUp className="w-4 h-4" />
                </button>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => nudge(-1, 0)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    title="Nudge Left"
                  >
                    <ArrowLeft className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      centerHorizontally();
                      centerVertically();
                    }}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-blue-600/30 text-blue-300 border border-blue-500/40 hover:bg-blue-600/50"
                    title="Center Box"
                  >
                    Center
                  </button>
                  <button
                    onClick={() => nudge(1, 0)}
                    className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                    title="Nudge Right"
                  >
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
                <button
                  onClick={() => nudge(0, 1)}
                  className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                  title="Nudge Down"
                >
                  <ArrowDown className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Zoom / Scale Crop Box */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400">Crop Box Scale</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => zoomCrop(0.92)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-blue-400" /> Zoom In (Crop)
                </button>
                <button
                  onClick={() => zoomCrop(1.08)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-indigo-400" /> Zoom Out
                </button>
              </div>
            </div>

            {/* Direct Percent Dimension Sliders */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-3">
              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Width Size</span>
                  <span className="font-mono text-blue-400">{Math.round(cropBox.width)}%</span>
                </div>
                <input
                  type="range"
                  min="15"
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
                  className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                />
              </div>

              <div className="space-y-1">
                <div className="flex justify-between text-[11px] text-slate-400">
                  <span>Height Size</span>
                  <span className="font-mono text-blue-400">{Math.round(cropBox.height)}%</span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="100"
                  disabled={!!currentRatio}
                  value={cropBox.height}
                  onChange={(e) => {
                    const h = parseFloat(e.target.value);
                    setCropBox((prev) => ({
                      ...prev,
                      height: h,
                      y: Math.max(0, Math.min(100 - h, prev.y)),
                    }));
                  }}
                  className={`w-full h-1.5 rounded-lg appearance-none accent-purple-500 ${
                    currentRatio ? 'bg-slate-800/40 cursor-not-allowed' : 'bg-slate-800 cursor-pointer'
                  }`}
                />
                {currentRatio && (
                  <p className="text-[10px] text-slate-500">Height locked to aspect ratio</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </>
    )}

        {/* Footer */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
            {engineMode === 'quad' ? (
              <span>
                4-Corner Mode: Custom Perspective Warp calibrated for {targetWidth}×{targetHeight} mm sheet slot
              </span>
            ) : (
              <span>
                Selection: {Math.round(cropBox.width)}% × {Math.round(cropBox.height)}% (
                {aspectMode === 'free' ? 'Freeform Crop' : `${targetWidth}×${targetHeight} mm aspect`})
              </span>
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
                onApplyCrop(cropBox, engineMode === 'quad' ? corners : undefined);
                onClose();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg transition-all"
            >
              <Check className="w-4 h-4" />
              {engineMode === 'quad' ? 'Apply 4-Corner Warp' : 'Apply Crop & Frame'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

