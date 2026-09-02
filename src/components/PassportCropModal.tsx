import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PassportPreset, QuadCorners } from '../types';
import { PHOTO_LIGHTING_PRESETS, LightingPreset } from '../data/presets';
import { FourCornerFreeCrop } from './FourCornerFreeCrop';
import {
  Crop,
  Sparkles,
  Check,
  X,
  User,
  Maximize2,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ZoomIn,
  ZoomOut,
  Crosshair,
  RotateCcw,
  Sun,
  Contrast,
  Sliders,
  Palette,
} from 'lucide-react';

export interface PhotoAdjustments {
  brightness: number;
  contrast: number;
  saturation: number;
}

interface PassportCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  preset: PassportPreset;
  customWidthMm: number;
  customHeightMm: number;
  initialCropBox?: { x: number; y: number; width: number; height: number };
  initialCorners?: QuadCorners;
  initialBrightness?: number;
  initialContrast?: number;
  initialSaturation?: number;
  onApplyCrop: (
    cropBox: { x: number; y: number; width: number; height: number },
    quadCorners?: QuadCorners,
    adjustments?: PhotoAdjustments
  ) => void;
}

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
  initialBrightness = 0,
  initialContrast = 0,
  initialSaturation = 0,
  onApplyCrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const targetWidth = preset.id === 'custom_photo' ? customWidthMm : preset.widthMm;
  const targetHeight = preset.id === 'custom_photo' ? customHeightMm : preset.heightMm;

  // ONLY 2 crop modes: 'box' (Freeform Box Crop) and 'quad' (4-Corner Freecrop)
  const [engineMode, setEngineMode] = useState<CropEngineMode>('box');

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 12,
    y: 8,
    width: 76,
    height: 84,
  });

  const [corners, setCorners] = useState<QuadCorners>({
    tl: { x: 8, y: 6 },
    tr: { x: 92, y: 6 },
    br: { x: 92, y: 94 },
    bl: { x: 8, y: 94 },
  });

  // Lighting & Color State in Crop Modal
  const [brightness, setBrightness] = useState<number>(initialBrightness);
  const [contrast, setContrast] = useState<number>(initialContrast);
  const [saturation, setSaturation] = useState<number>(initialSaturation);

  const [sidebarTab, setSidebarTab] = useState<'framing' | 'lighting'>('framing');

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

  // Initialize crop box, corners, and lighting on modal open
  useEffect(() => {
    if (!isOpen) return;

    setBrightness(initialBrightness);
    setContrast(initialContrast);
    setSaturation(initialSaturation);

    if (initialCropBox) {
      setCropBox(initialCropBox);
    } else {
      setCropBox({
        x: 12,
        y: 8,
        width: 76,
        height: 84,
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
  }, [isOpen, initialCropBox, initialCorners, initialBrightness, initialContrast, initialSaturation]);

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
        setCropBox({
          x: Math.max(0, Math.min(100 - data.cropBox.width, data.cropBox.x)),
          y: Math.max(0, Math.min(100 - data.cropBox.height, data.cropBox.y)),
          width: Math.min(100, Math.max(10, data.cropBox.width)),
          height: Math.min(100, Math.max(10, data.cropBox.height)),
        });
        setAiMessage('Face centered with biometric headroom');
      }
    } catch (err) {
      console.warn('AI assistant fallback:', err);
      setCropBox({
        x: 15,
        y: 8,
        width: 70,
        height: 84,
      });
      setAiMessage('Centered on portrait area');
    } finally {
      setIsAiLoading(false);
      setTimeout(() => setAiMessage(null), 3000);
    }
  };

  // Reset to default freeform box
  const handleResetBox = () => {
    setCropBox({
      x: 12,
      y: 8,
      width: 76,
      height: 84,
    });
  };

  // Zoom / Scale crop box
  const zoomCrop = (scaleFactor: number) => {
    setCropBox((prev) => {
      const newW = Math.max(10, Math.min(100, prev.width * scaleFactor));
      const newH = Math.max(10, Math.min(100, prev.height * scaleFactor));
      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;
      return {
        x: Math.max(0, Math.min(100 - newW, centerX - newW / 2)),
        y: Math.max(0, Math.min(100 - newH, centerY - newH / 2)),
        width: newW,
        height: newH,
      };
    });
  };

  // Maximize crop box to fit full image
  const maximizeCrop = () => {
    setCropBox({
      x: 0,
      y: 0,
      width: 100,
      height: 100,
    });
  };

  // Nudge position
  const nudge = (dx: number, dy: number) => {
    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, Math.min(100 - prev.width, prev.x + dx)),
      y: Math.max(0, Math.min(100 - prev.height, prev.y + dy)),
    }));
  };

  // Center horizontally
  const centerHorizontally = () => {
    setCropBox((prev) => ({
      ...prev,
      x: Math.max(0, (100 - prev.width) / 2),
    }));
  };

  // Center vertically
  const centerVertically = () => {
    setCropBox((prev) => ({
      ...prev,
      y: Math.max(0, (100 - prev.height) / 2),
    }));
  };

  // Mouse / Touch handlers for 8-handle freeform resizing and moving
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

      const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
      const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

      const rect = containerRef.current.getBoundingClientRect();
      const deltaXPct = ((clientX - dragStart.x) / rect.width) * 100;
      const deltaYPct = ((clientY - dragStart.y) / rect.height) * 100;

      if (dragHandle === 'move') {
        const newX = Math.max(0, Math.min(100 - cropStart.width, cropStart.x + deltaXPct));
        const newY = Math.max(0, Math.min(100 - cropStart.height, cropStart.y + deltaYPct));
        setCropBox((prev) => ({ ...prev, x: newX, y: newY }));
      } else {
        // Pure Freeform 8-Handle Resizing
        let x = cropStart.x;
        let y = cropStart.y;
        let w = cropStart.width;
        let h = cropStart.height;

        if (dragHandle?.includes('e')) {
          w = Math.max(10, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
        }
        if (dragHandle?.includes('s')) {
          h = Math.max(10, Math.min(100 - cropStart.y, cropStart.height + deltaYPct));
        }
        if (dragHandle?.includes('w')) {
          const maxDelta = cropStart.x;
          const clampedDelta = Math.min(maxDelta, deltaXPct);
          const newW = cropStart.width - clampedDelta;
          if (newW >= 10) {
            x = cropStart.x + clampedDelta;
            w = newW;
          }
        }
        if (dragHandle?.includes('n')) {
          const maxDelta = cropStart.y;
          const clampedDelta = Math.min(maxDelta, deltaYPct);
          const newH = cropStart.height - clampedDelta;
          if (newH >= 10) {
            y = cropStart.y + clampedDelta;
            h = newH;
          }
        }

        setCropBox({
          x: Math.max(0, Math.min(100 - w, x)),
          y: Math.max(0, Math.min(100 - h, y)),
          width: Math.min(100, Math.max(10, w)),
          height: Math.min(100, Math.max(10, h)),
        });
      }
    },
    [isDragging, dragHandle, dragStart, cropStart]
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
                Photo Cropping & Framing
              </h2>
              <p className="text-xs text-slate-400">
                Target Print Size: <span className="text-blue-400 font-semibold">{preset.name}</span> ({targetWidth} × {targetHeight} mm)
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

        {/* ONLY 2 Crop Modes: Freeform Box Crop & 4-Corner Freecrop */}
        <div className="px-5 py-3 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2 p-1 rounded-xl bg-slate-900 border border-white/10">
            <button
              onClick={() => setEngineMode('box')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                engineMode === 'box'
                  ? 'bg-blue-600 text-white shadow-md ring-1 ring-blue-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Crop className="w-4 h-4 text-blue-300" />
              Freeform Box Crop
            </button>
            <button
              onClick={() => setEngineMode('quad')}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                engineMode === 'quad'
                  ? 'bg-purple-600 text-white shadow-md ring-1 ring-purple-400/50'
                  : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
              }`}
            >
              <Crosshair className="w-4 h-4 text-yellow-300" />
              4-Corner Freecrop (Perspective Warp)
            </button>
          </div>

          <div className="text-xs text-slate-400 font-medium">
            {engineMode === 'box' ? (
              <span className="text-blue-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-blue-400" />
                Drag any of the 8 box handles freely to frame your photo
              </span>
            ) : (
              <span className="text-purple-300 flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                Drag any of the 4 corner pins individually to fix perspective tilt
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
            {/* Freeform Box Quick Actions Toolbar */}
            <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={maximizeCrop}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-semibold transition-all border border-slate-700"
                  title="Fit crop box to full image area"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-blue-400" /> Maximize
                </button>

                <button
                  onClick={handleResetBox}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center gap-1.5 font-semibold transition-all border border-slate-700"
                  title="Reset to default box crop"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-indigo-400" /> Reset Box
                </button>

                <button
                  onClick={() => setShowBiometricGuide(!showBiometricGuide)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-semibold transition-all border ${
                    showBiometricGuide
                      ? 'bg-amber-500/20 border-amber-500/40 text-amber-300'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  {showBiometricGuide ? 'Hide Face Guides' : 'Show Face Guides'}
                </button>
              </div>

              {/* AI Auto-Center Button */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handleAiAutoCrop}
                  disabled={isAiLoading}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold transition-all shadow-md disabled:opacity-50"
                >
                  <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
                  {isAiLoading ? 'Centering Face...' : 'AI Auto-Center'}
                </button>
              </div>
            </div>

              {/* Workspace: Image Canvas + Fine-Tune Nudge Panel */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-[380px] max-h-[580px]">
              {/* Main Visual Freeform Crop Canvas */}
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
                    className="max-h-[480px] max-w-full object-contain pointer-events-none rounded-sm transition-all"
                    style={{
                      filter: `brightness(${100 + brightness}%) contrast(${100 + contrast}%) saturate(${100 + saturation}%)`,
                    }}
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

                  {/* Active Freeform Selection Box */}
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
                            ▲ Hair Crown
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
                            ▼ Chin Base
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

                    {/* 8 Drag Handles for Freeform Resizing */}
                    {/* Top-Left */}
                    <div
                      className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 'nw')}
                      onTouchStart={(e) => handleMouseDown(e, 'nw')}
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
                      onMouseDown={(e) => handleMouseDown(e, 'ne')}
                      onTouchStart={(e) => handleMouseDown(e, 'ne')}
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
                      onMouseDown={(e) => handleMouseDown(e, 'se')}
                      onTouchStart={(e) => handleMouseDown(e, 'se')}
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
                      onMouseDown={(e) => handleMouseDown(e, 'sw')}
                      onTouchStart={(e) => handleMouseDown(e, 'sw')}
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

              {/* Right Manual Fine-Tuning & Lighting Panel */}
              <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 flex flex-col">
                {/* Tabs: Framing / Lighting */}
                <div className="grid grid-cols-2 p-2 gap-1 bg-slate-950 border-b border-slate-800">
                  <button
                    onClick={() => setSidebarTab('framing')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      sidebarTab === 'framing'
                        ? 'bg-blue-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Move className="w-3.5 h-3.5" />
                    Framing & Scale
                  </button>
                  <button
                    onClick={() => setSidebarTab('lighting')}
                    className={`flex items-center justify-center gap-1.5 py-1.5 px-2 rounded-lg text-xs font-bold transition-all ${
                      sidebarTab === 'lighting'
                        ? 'bg-amber-600 text-white shadow-md'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                    }`}
                  >
                    <Sun className="w-3.5 h-3.5 text-amber-300" />
                    Brightness & Contrast
                  </button>
                </div>

                <div className="p-4 space-y-4 overflow-y-auto flex-1">
                  {sidebarTab === 'framing' ? (
                    <>
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
                            <ZoomIn className="w-3.5 h-3.5 text-blue-400" /> Zoom In
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
                            min="10"
                            max="100"
                            value={cropBox.width}
                            onChange={(e) => {
                              const w = parseFloat(e.target.value);
                              setCropBox((prev) => ({
                                ...prev,
                                width: w,
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
                            min="10"
                            max="100"
                            value={cropBox.height}
                            onChange={(e) => {
                              const h = parseFloat(e.target.value);
                              setCropBox((prev) => ({
                                ...prev,
                                height: h,
                                y: Math.max(0, Math.min(100 - h, prev.y)),
                              }));
                            }}
                            className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-purple-500"
                          />
                        </div>
                      </div>
                    </>
                  ) : (
                    /* Lighting & Contrast Tab */
                    <div className="space-y-4">
                      {/* 1-Click Presets */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="text-[11px] font-bold text-slate-300 flex items-center justify-between">
                          <span>Quick Lighting Presets</span>
                          <button
                            onClick={() => {
                              setBrightness(0);
                              setContrast(0);
                              setSaturation(0);
                            }}
                            className="text-[10px] text-blue-400 hover:underline flex items-center gap-1"
                          >
                            <RotateCcw className="w-2.5 h-2.5" /> Reset
                          </button>
                        </div>
                        <div className="grid grid-cols-2 gap-1.5">
                          {PHOTO_LIGHTING_PRESETS.map((preset) => (
                            <button
                              key={preset.id}
                              onClick={() => {
                                setBrightness(preset.brightness);
                                setContrast(preset.contrast);
                                setSaturation(preset.saturation);
                              }}
                              className="px-2 py-1.5 rounded-lg text-[11px] font-semibold text-left bg-slate-800/80 hover:bg-slate-700 text-slate-200 border border-slate-700/60 hover:border-amber-500/40 transition-all truncate"
                              title={preset.description}
                            >
                              {preset.name}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Brightness Slider */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <Sun className="w-3.5 h-3.5 text-amber-400" /> Brightness
                          </span>
                          <span className="text-xs font-mono font-bold text-amber-400">
                            {brightness > 0 ? `+${brightness}` : brightness}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          value={brightness}
                          onChange={(e) => setBrightness(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>-50 (Darker)</span>
                          <button
                            onClick={() => setBrightness(0)}
                            className="text-slate-400 hover:text-white"
                          >
                            0 (Default)
                          </button>
                          <span>+50 (Brighter)</span>
                        </div>
                      </div>

                      {/* Contrast Slider */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <Contrast className="w-3.5 h-3.5 text-blue-400" /> Contrast
                          </span>
                          <span className="text-xs font-mono font-bold text-blue-400">
                            {contrast > 0 ? `+${contrast}` : contrast}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-50"
                          max="50"
                          value={contrast}
                          onChange={(e) => setContrast(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-blue-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>-50 (Flat)</span>
                          <button
                            onClick={() => setContrast(0)}
                            className="text-slate-400 hover:text-white"
                          >
                            0 (Default)
                          </button>
                          <span>+50 (Deep)</span>
                        </div>
                      </div>

                      {/* Saturation Slider */}
                      <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-slate-200 flex items-center gap-1.5">
                            <Palette className="w-3.5 h-3.5 text-emerald-400" /> Color Saturation
                          </span>
                          <span className="text-xs font-mono font-bold text-emerald-400">
                            {saturation > 0 ? `+${saturation}` : saturation}
                          </span>
                        </div>
                        <input
                          type="range"
                          min="-100"
                          max="50"
                          value={saturation}
                          onChange={(e) => setSaturation(parseInt(e.target.value))}
                          className="w-full h-1.5 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                        <div className="flex justify-between text-[10px] text-slate-500">
                          <span>-100 (B&W)</span>
                          <button
                            onClick={() => setSaturation(0)}
                            className="text-slate-400 hover:text-white"
                          >
                            0 (Natural)
                          </button>
                          <span>+50 (Vivid)</span>
                        </div>
                      </div>
                    </div>
                  )}
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
                4-Corner Freecrop: Custom Perspective Warp calibrated for {targetWidth}×{targetHeight} mm
              </span>
            ) : (
              <span>
                Freeform Box Crop: {Math.round(cropBox.width)}% × {Math.round(cropBox.height)}% • Brightness: {brightness >= 0 ? `+${brightness}` : brightness}, Contrast: {contrast >= 0 ? `+${contrast}` : contrast}
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
                onApplyCrop(cropBox, engineMode === 'quad' ? corners : undefined, {
                  brightness,
                  contrast,
                  saturation,
                });
                onClose();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 rounded-xl shadow-lg transition-all"
            >
              <Check className="w-4 h-4" />
              {engineMode === 'quad' ? 'Apply 4-Corner Warp' : 'Apply Crop & Lighting'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
