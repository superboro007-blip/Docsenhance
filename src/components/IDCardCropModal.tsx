import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IDCardPreset, QuadCorners } from '../types';
import { FourCornerFreeCrop } from './FourCornerFreeCrop';
import {
  Crop,
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
  RotateCcw,
  Eye,
  AlertCircle,
  Sparkles,
  Layers,
  Info,
} from 'lucide-react';
import { warpPerspectiveCanvas } from '../utils/imageProcessing';

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
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const sourceImageRef = useRef<HTMLImageElement | null>(null);

  const targetWidth = preset.id === 'dl_custom' ? customWidthMm : preset.widthMm;
  const targetHeight = preset.id === 'dl_custom' ? customHeightMm : preset.heightMm;
  const presetAspectRatio = targetWidth / targetHeight; // ~1.585 for CR-80 (85.60 x 54.00 mm)

  const [engineMode, setEngineMode] = useState<CropEngineMode>('box');
  const [isFreeform, setIsFreeform] = useState(false);
  const [statusNotification, setStatusNotification] = useState<string | null>(null);
  const [imageAspect, setImageAspect] = useState<number>(1.0);

  // Calculate default standard size crop box intelligently based on image natural aspect ratio
  const getStandardCropBox = useCallback((customImgAspect?: number) => {
    const imgRatio = customImgAspect || imageAspect || 1.0;
    const targetRatio = presetAspectRatio; // physical target aspect ratio (e.g. 1.585)
    // In percentage coordinates: (w_pct / h_pct) * imgRatio = targetRatio => w_pct / h_pct = targetRatio / imgRatio
    const rPct = targetRatio / imgRatio;

    let width = 86;
    let height = width / rPct;

    if (height > 90) {
      height = 85;
      width = height * rPct;
    }
    if (width > 92) {
      width = 90;
      height = width / rPct;
    }

    width = Math.max(10, Math.min(96, width));
    height = Math.max(10, Math.min(96, height));

    return {
      x: Math.max(0, (100 - width) / 2),
      y: Math.max(0, (100 - height) / 2),
      width,
      height,
    };
  }, [imageAspect, presetAspectRatio]);

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 5,
    y: 15,
    width: 86,
    height: 54,
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

  // Load and cache source image for real-time live preview & aspect ratio extraction
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      sourceImageRef.current = img;
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const aspect = img.naturalWidth / img.naturalHeight;
        setImageAspect(aspect);
        if (!initialCropBox) {
          setCropBox(getStandardCropBox(aspect));
        }
      }
      renderLivePreview();
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Reset to initial or standard on open
  useEffect(() => {
    if (!isOpen) return;

    if (initialCropBox) {
      setCropBox(initialCropBox);
    } else {
      setCropBox(getStandardCropBox());
    }

    if (initialCorners) {
      setCorners(initialCorners);
      setEngineMode('quad');
    } else {
      setCorners({
        tl: { x: 6, y: 6 },
        tr: { x: 94, y: 6 },
        br: { x: 94, y: 94 },
        bl: { x: 6, y: 94 },
      });
      setEngineMode('box');
    }
  }, [isOpen, initialCropBox, initialCorners, getStandardCropBox]);

  // Update Live Preview Canvas
  const renderLivePreview = useCallback(() => {
    const canvas = previewCanvasRef.current;
    const img = sourceImageRef.current;
    if (!canvas || !img || !img.complete || img.naturalWidth === 0) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const previewW = 340;
    const previewH = Math.round(previewW / presetAspectRatio);
    canvas.width = previewW;
    canvas.height = previewH;

    ctx.clearRect(0, 0, previewW, previewH);
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';

    if (engineMode === 'quad') {
      // Perspective quad warp preview
      try {
        const warpedCanvas = warpPerspectiveCanvas(img, corners, previewW, previewH, true);
        ctx.drawImage(warpedCanvas, 0, 0, previewW, previewH);
      } catch {
        // fallback
      }
    } else {
      // Standard box crop preview
      const sx = (cropBox.x / 100) * img.naturalWidth;
      const sy = (cropBox.y / 100) * img.naturalHeight;
      const sw = (cropBox.width / 100) * img.naturalWidth;
      const sh = (cropBox.height / 100) * img.naturalHeight;

      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, previewW, previewH);
    }
  }, [cropBox, corners, engineMode, presetAspectRatio]);

  useEffect(() => {
    renderLivePreview();
  }, [cropBox, corners, engineMode, renderLivePreview]);

  const currentRatio = isFreeform ? null : presetAspectRatio;

  // Step 5: Reset to standard size
  const handleResetToStandardSize = () => {
    const stdBox = getStandardCropBox();
    setCropBox(stdBox);
    setIsFreeform(false);
    setCorners({
      tl: { x: 6, y: 6 },
      tr: { x: 94, y: 6 },
      br: { x: 94, y: 94 },
      bl: { x: 6, y: 94 },
    });
    setStatusNotification(`✓ Reset to Standard Size (${targetWidth.toFixed(2)} mm × ${targetHeight.toFixed(2)} mm)`);
    setTimeout(() => setStatusNotification(null), 3000);
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
      const rPct = currentRatio ? currentRatio / imageAspect : null;
      let newW = Math.max(10, Math.min(100, prev.width * scaleFactor));
      let newH = rPct ? newW / rPct : Math.max(10, Math.min(100, prev.height * scaleFactor));

      if (rPct && newH > 100) {
        newH = 100;
        newW = newH * rPct;
      }
      if (rPct && newW > 100) {
        newW = 100;
        newH = newW / rPct;
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
      const rPct = currentRatio / imageAspect;
      let w = 100;
      let h = w / rPct;
      if (h > 100) {
        h = 100;
        w = h * rPct;
      }
      if (w > 100) {
        w = 100;
        h = w / rPct;
      }
      setCropBox({
        x: Math.max(0, (100 - w) / 2),
        y: Math.max(0, (100 - h) / 2),
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
        // Locked aspect ratio for standard ID card
        const rPct = currentRatio / imageAspect;
        if (dragHandle === 'br' || dragHandle === 'se' || dragHandle === 'e' || dragHandle === 's') {
          let newWidth = Math.max(10, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
          let newHeight = newWidth / rPct;

          if (cropStart.y + newHeight > 100) {
            newHeight = 100 - cropStart.y;
            newWidth = newHeight * rPct;
          }

          setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight }));
        } else if (dragHandle === 'tl' || dragHandle === 'nw') {
          let newWidth = Math.max(10, cropStart.width - deltaXPct);
          let newHeight = newWidth / rPct;
          let newX = cropStart.x + (cropStart.width - newWidth);
          let newY = cropStart.y + (cropStart.height - newHeight);

          if (newX < 0) {
            newX = 0;
            newWidth = cropStart.x + cropStart.width;
            newHeight = newWidth / rPct;
            newY = cropStart.y + (cropStart.height - newHeight);
          }
          if (newY < 0) {
            newY = 0;
            newHeight = cropStart.y + cropStart.height;
            newWidth = newHeight * rPct;
            newX = cropStart.x + (cropStart.width - newWidth);
          }

          setCropBox({ x: Math.max(0, newX), y: Math.max(0, newY), width: newWidth, height: newHeight });
        } else if (dragHandle === 'tr' || dragHandle === 'ne') {
          let newWidth = Math.max(10, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
          let newHeight = newWidth / rPct;
          let newY = cropStart.y + (cropStart.height - newHeight);

          if (newY < 0) {
            newY = 0;
            newHeight = cropStart.y + cropStart.height;
            newWidth = newHeight * rPct;
          }

          setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight, y: Math.max(0, newY) }));
        } else if (dragHandle === 'bl' || dragHandle === 'sw') {
          let newWidth = Math.max(10, cropStart.width - deltaXPct);
          let newHeight = newWidth / rPct;
          let newX = cropStart.x + (cropStart.width - newWidth);

          if (cropStart.y + newHeight > 100) {
            newHeight = 100 - cropStart.y;
            newWidth = newHeight * rPct;
          }
          if (newX < 0) {
            newX = 0;
            newWidth = cropStart.x + cropStart.width;
            newHeight = newWidth / rPct;
          }

          setCropBox((prev) => ({ ...prev, x: Math.max(0, newX), width: newWidth, height: newHeight }));
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
    [isDragging, dragHandle, dragStart, cropStart, currentRatio, imageAspect]
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-2 sm:p-4">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl max-w-6xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-700/80 animate-in fade-in zoom-in-95 duration-200">
        
        {/* Top Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/90">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white">
                  Manual Crop Studio
                </h2>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border uppercase tracking-wider ${
                  side === 'front' 
                    ? 'bg-blue-500/20 text-blue-300 border-blue-500/30' 
                    : 'bg-amber-500/20 text-amber-300 border-amber-500/30'
                }`}>
                  {side === 'front' ? 'Front Side' : 'Back Side'}
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Standard CR-80 format: <span className="text-emerald-400 font-semibold">{targetWidth.toFixed(2)} mm × {targetHeight.toFixed(2)} mm</span> (300 DPI ready)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleResetToStandardSize}
              className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-all hover:scale-[1.02] active:scale-95"
              title="Reset the crop box to standard 85.60 mm × 54.00 mm dimensions"
            >
              <RotateCcw className="w-3.5 h-3.5 text-emerald-400" />
              Reset to Standard Size ({targetWidth.toFixed(2)} × {targetHeight.toFixed(2)} mm)
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Prompt & Guidance Banner */}
        <div className="px-5 py-2.5 bg-gradient-to-r from-emerald-950/40 via-slate-900 to-blue-950/40 border-b border-emerald-500/20 flex items-start gap-2.5 text-xs">
          <Info className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
          <div className="flex-1 text-slate-300 leading-relaxed">
            <span className="font-semibold text-emerald-300">Manual Crop Guide: </span>
            Adjust your ID card manually. The standard crop size is <strong className="text-white">{targetWidth.toFixed(2)} mm × {targetHeight.toFixed(2)} mm</strong>. If the automatic box does not fit correctly in your PDF, use the manual crop tool to drag, resize, and align the box until the card fits perfectly.
          </div>
        </div>

        {/* Primary Crop Mode Switcher & Flow Bar */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-900 border border-white/10">
              <button
                onClick={() => setEngineMode('box')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  engineMode === 'box'
                    ? 'bg-emerald-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Crop className="w-3.5 h-3.5" />
                Manual Crop Mode
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
                4-Corner Perspective Warp
              </button>
            </div>

            {/* Quick action: Reset button on mobile */}
            <button
              onClick={handleResetToStandardSize}
              className="sm:hidden inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-800 text-xs font-medium text-slate-300"
            >
              <RotateCcw className="w-3 h-3 text-emerald-400" /> Reset Size
            </button>
          </div>

          {/* Step Indicator Flow */}
          <div className="hidden md:flex items-center gap-2 text-[11px] font-medium text-slate-400">
            <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 border border-slate-700">
              Step 1: Standard Box
            </span>
            <span className="text-slate-600">→</span>
            <span className="px-2 py-0.5 rounded bg-emerald-950/60 text-emerald-300 border border-emerald-500/30">
              Step 2: Drag & Adjust
            </span>
            <span className="text-slate-600">→</span>
            <span className="px-2 py-0.5 rounded bg-blue-950/60 text-blue-300 border border-blue-500/30">
              Step 3: Live Preview
            </span>
          </div>
        </div>

        {/* Status / Reset Notification Alert */}
        {statusNotification && (
          <div className="px-5 py-2 bg-emerald-500/20 border-b border-emerald-500/40 text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-in fade-in duration-150">
            <Check className="w-4 h-4 text-emerald-400 shrink-0" />
            {statusNotification}
          </div>
        )}

        {/* Main Workspace Body */}
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
                setStatusNotification('✓ Reset 4 corner pins to perimeter');
                setTimeout(() => setStatusNotification(null), 3000);
              }}
            />
          </div>
        ) : (
          <>
            {/* Box Mode Secondary Toolbar */}
            <div className="px-5 py-2 bg-slate-950/70 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-slate-400 font-semibold flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-emerald-400" /> Ratio Mode:
                </span>
                <button
                  onClick={() => setIsFreeform(false)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    !isFreeform
                      ? 'bg-emerald-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Lock className="w-3.5 h-3.5" />
                  Locked CR-80 ({targetWidth.toFixed(2)} × {targetHeight.toFixed(2)} mm)
                </button>
                <button
                  onClick={() => setIsFreeform(true)}
                  className={`px-3 py-1.5 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                    isFreeform
                      ? 'bg-purple-600 text-white shadow-sm font-semibold'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  <Unlock className="w-3.5 h-3.5" />
                  Freeform Manual Crop
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={centerBox}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 font-medium transition-colors"
                >
                  Center Frame
                </button>
                <button
                  onClick={maximizeCrop}
                  className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <Maximize2 className="w-3.5 h-3.5" /> Maximize
                </button>
              </div>
            </div>

            {/* Workspace: Interactive Image Canvas + Controls + Real-Time Live Preview */}
            <div className="flex-1 flex flex-col lg:flex-row overflow-hidden min-h-[380px] max-h-[580px]">
              {/* Visual Canvas Area */}
              <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-hidden relative select-none">
                <div
                  ref={containerRef}
                  className="relative inline-block max-w-full max-h-full shadow-2xl rounded-lg overflow-hidden border border-slate-800"
                  style={{ touchAction: 'none' }}
                >
                  <img
                    src={imageSrc}
                    alt="ID Card Source Scan"
                    className="max-h-[480px] max-w-full object-contain pointer-events-none rounded-sm"
                  />

                  {/* Dark Perimeter Mask */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute bg-black/75 top-0 left-0 right-0" style={{ height: `${cropBox.y}%` }} />
                    <div
                      className="absolute bg-black/75 bottom-0 left-0 right-0"
                      style={{ height: `${Math.max(0, 100 - (cropBox.y + cropBox.height))}%` }}
                    />
                    <div
                      className="absolute bg-black/75 left-0"
                      style={{ top: `${cropBox.y}%`, height: `${cropBox.height}%`, width: `${cropBox.x}%` }}
                    />
                    <div
                      className="absolute bg-black/75 right-0"
                      style={{
                        top: `${cropBox.y}%`,
                        height: `${cropBox.height}%`,
                        width: `${Math.max(0, 100 - (cropBox.x + cropBox.width))}%`,
                      }}
                    />
                  </div>

                  {/* Selection Crop Box */}
                  <div
                    className="absolute border-2 border-emerald-400 ring-2 ring-emerald-500/40 rounded-lg shadow-2xl cursor-move group"
                    style={{
                      left: `${cropBox.x}%`,
                      top: `${cropBox.y}%`,
                      width: `${cropBox.width}%`,
                      height: `${cropBox.height}%`,
                    }}
                    onMouseDown={(e) => handleMouseDown(e, 'move')}
                    onTouchStart={(e) => handleMouseDown(e, 'move')}
                  >
                    {/* Drag to Adjust Central Label */}
                    <div className="absolute top-2 left-2 bg-emerald-950/85 backdrop-blur-sm text-emerald-300 text-[10px] font-bold px-2 py-0.5 rounded-full pointer-events-none border border-emerald-500/40 flex items-center gap-1 shadow-md">
                      <Move className="w-3 h-3" />
                      Drag to Adjust
                    </div>

                    {/* Standard Dimensions Badge */}
                    <div className="absolute bottom-2 right-2 bg-slate-950/90 text-emerald-300 text-[10px] px-2 py-0.5 rounded font-mono pointer-events-none border border-emerald-500/40 shadow-md">
                      {targetWidth.toFixed(1)} × {targetHeight.toFixed(1)} mm
                    </div>

                    {/* 8 Drag Resize Handles */}
                    {/* Corners */}
                    <div
                      className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-xl hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 'tl')}
                      onTouchStart={(e) => handleMouseDown(e, 'tl')}
                      title="Resize top-left"
                    />
                    <div
                      className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize shadow-xl hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 'tr')}
                      onTouchStart={(e) => handleMouseDown(e, 'tr')}
                      title="Resize top-right"
                    />
                    <div
                      className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-xl hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 'br')}
                      onTouchStart={(e) => handleMouseDown(e, 'br')}
                      title="Resize bottom-right"
                    />
                    <div
                      className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nesw-resize shadow-xl hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 'bl')}
                      onTouchStart={(e) => handleMouseDown(e, 'bl')}
                      title="Resize bottom-left"
                    />

                    {/* Edges */}
                    <div
                      className="absolute -top-2 left-1/2 -translate-x-1/2 w-5 h-3.5 bg-white border-2 border-emerald-600 rounded-sm cursor-ns-resize shadow-xl hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 'n')}
                      onTouchStart={(e) => handleMouseDown(e, 'n')}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -right-2 w-3.5 h-5 bg-white border-2 border-emerald-600 rounded-sm cursor-ew-resize shadow-xl hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 'e')}
                      onTouchStart={(e) => handleMouseDown(e, 'e')}
                    />
                    <div
                      className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-5 h-3.5 bg-white border-2 border-emerald-600 rounded-sm cursor-ns-resize shadow-xl hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 's')}
                      onTouchStart={(e) => handleMouseDown(e, 's')}
                    />
                    <div
                      className="absolute top-1/2 -translate-y-1/2 -left-2 w-3.5 h-5 bg-white border-2 border-emerald-600 rounded-sm cursor-ew-resize shadow-xl hover:scale-125 transition-transform"
                      onMouseDown={(e) => handleMouseDown(e, 'w')}
                      onTouchStart={(e) => handleMouseDown(e, 'w')}
                    />
                  </div>
                </div>
              </div>

              {/* Right Side Panel: Fine-Tuning + Step 4 Live Preview */}
              <div className="w-full lg:w-80 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-4 overflow-y-auto">
                {/* Live Preview Card */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-200 uppercase tracking-wider flex items-center gap-1.5">
                      <Eye className="w-3.5 h-3.5 text-blue-400" /> Live Output Preview
                    </span>
                    <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                      CR-80 Format
                    </span>
                  </div>

                  <div className="relative rounded-lg overflow-hidden border border-white/10 bg-slate-900 flex items-center justify-center p-1 shadow-inner">
                    <canvas
                      ref={previewCanvasRef}
                      className="w-full h-auto rounded object-contain shadow-md"
                      style={{ maxHeight: '140px' }}
                    />
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-slate-400 pt-0.5">
                    <span>Target Size:</span>
                    <span className="font-semibold text-slate-200">{targetWidth.toFixed(2)} × {targetHeight.toFixed(2)} mm</span>
                  </div>
                </div>

                {/* Reset to Standard Size Button */}
                <button
                  onClick={handleResetToStandardSize}
                  className="w-full py-2 px-3 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 text-xs font-bold border border-emerald-500/30 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-98 shadow-sm"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Reset to Standard Size ({targetWidth.toFixed(2)} × {targetHeight.toFixed(2)} mm)
                </button>

                {/* Position Nudge Controls */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300 flex items-center gap-1">
                    <Move className="w-3 h-3 text-emerald-400" /> Fine-Tune Position (Nudge)
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <button
                      onClick={() => nudge(0, -1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                      title="Nudge Up"
                    >
                      <ArrowUp className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => nudge(-1, 0)}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                        title="Nudge Left"
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
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                        title="Nudge Right"
                      >
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    </div>
                    <button
                      onClick={() => nudge(0, 1)}
                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200"
                      title="Nudge Down"
                    >
                      <ArrowDown className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Crop Box Zoom / Scale */}
                <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
                  <div className="text-[11px] font-semibold text-slate-300">Crop Box Scale</div>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      onClick={() => zoomCrop(0.94)}
                      className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-emerald-400" /> Zoom In
                    </button>
                    <button
                      onClick={() => zoomCrop(1.06)}
                      className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                    >
                      <ZoomOut className="w-3.5 h-3.5 text-teal-400" /> Zoom Out
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* Footer Confirmation Bar */}
        <div className="px-5 py-3.5 bg-slate-950 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {engineMode === 'quad' ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-purple-400 animate-pulse" />
                <span className="text-purple-300 font-medium">
                  4-Corner Perspective Warp active ({targetWidth.toFixed(2)} × {targetHeight.toFixed(2)} mm output)
                </span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-slate-300">
                  {isFreeform ? 'Freeform Crop Mode' : `Locked to Standard ${targetWidth.toFixed(2)} × ${targetHeight.toFixed(2)} mm`}
                </span>
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
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl shadow-lg shadow-emerald-950/50 transition-all hover:scale-[1.02] active:scale-95 border border-emerald-400/40"
            >
              <Check className="w-4 h-4" />
              Confirm Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
