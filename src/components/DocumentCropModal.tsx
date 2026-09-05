import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QuadCorners } from '../types';
import { FourCornerFreeCrop } from './FourCornerFreeCrop';
import {
  Crop,
  Sparkles,
  Check,
  X,
  FileText,
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
  RotateCw,
  RotateCcw,
  Sun,
  Contrast,
  RefreshCw,
  Crosshair,
} from 'lucide-react';

interface DocumentCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  initialCropBox?: { x: number; y: number; width: number; height: number };
  initialCorners?: QuadCorners;
  initialRotation?: number;
  onApplyCrop: (
    cropBox: { x: number; y: number; width: number; height: number },
    quadCorners?: QuadCorners,
    rotation?: number
  ) => void;
}

type CropEngineMode = 'box' | 'quad';

const DOCUMENT_RATIO_PRESETS = [
  { id: 'freeform', name: 'Freeform / Auto', ratio: null, desc: 'Any bounding box' },
  { id: 'a4_portrait', name: 'A4 Portrait', ratio: 210 / 297, desc: '210 × 297 mm (1:1.414)' },
  { id: 'a4_landscape', name: 'A4 Landscape', ratio: 297 / 210, desc: '297 × 210 mm' },
  { id: 'letter_portrait', name: 'Letter Portrait', ratio: 8.5 / 11, desc: '8.5 × 11 in' },
  { id: 'letter_landscape', name: 'Letter Landscape', ratio: 11 / 8.5, desc: '11 × 8.5 in' },
  { id: 'legal', name: 'US Legal', ratio: 8.5 / 14, desc: '8.5 × 14 in' },
  { id: 'square', name: 'Square (1:1)', ratio: 1.0, desc: 'Receipts / Square' },
  { id: 'certificate_4_3', name: 'Certificate (4:3)', ratio: 4 / 3, desc: 'Horizontal Award' },
];

export const DocumentCropModal: React.FC<DocumentCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  initialCropBox,
  initialCorners,
  initialRotation = 0,
  onApplyCrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [engineMode, setEngineMode] = useState<CropEngineMode>('box');
  const [selectedPresetId, setSelectedPresetId] = useState<string>('freeform');
  const [rotation, setRotation] = useState<number>(initialRotation);

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 5,
    y: 5,
    width: 90,
    height: 90,
  });

  const [corners, setCorners] = useState<QuadCorners>({
    tl: { x: 5, y: 5 },
    tr: { x: 95, y: 5 },
    br: { x: 95, y: 95 },
    bl: { x: 5, y: 95 },
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
  const [imageAspect, setImageAspect] = useState<number>(1.0);

  const activePreset = DOCUMENT_RATIO_PRESETS.find((p) => p.id === selectedPresetId) || DOCUMENT_RATIO_PRESETS[0];
  const targetRatio = activePreset.ratio;

  // Calculate default standard size crop box intelligently based on natural image aspect ratio
  const getStandardDocCropBox = useCallback((customImgAspect?: number, customRatio?: number | null) => {
    const imgRatio = customImgAspect || imageAspect || 1.0;
    const rTarget = customRatio !== undefined ? customRatio : (targetRatio || null);

    if (!rTarget) {
      // Freeform standard: 4% margin around document (92% width, 92% height)
      return { x: 4, y: 4, width: 92, height: 92 };
    }

    const rPct = rTarget / imgRatio;
    let width = 88;
    let height = width / rPct;

    if (height > 92) {
      height = 88;
      width = height * rPct;
    }
    if (width > 94) {
      width = 92;
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
  }, [imageAspect, targetRatio]);

  // Load and cache source image aspect ratio
  useEffect(() => {
    if (!imageSrc) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const aspect = img.naturalWidth / img.naturalHeight;
        setImageAspect(aspect);
        if (!initialCropBox) {
          setCropBox(getStandardDocCropBox(aspect));
        }
      }
    };
    img.src = imageSrc;
  }, [imageSrc]);

  // Initialize or reset crop box and corners when modal opens
  useEffect(() => {
    if (!isOpen) return;
    if (initialCropBox) {
      setCropBox(initialCropBox);
    } else {
      setCropBox(getStandardDocCropBox());
    }

    if (initialCorners) {
      setCorners(initialCorners);
    } else {
      setCorners({
        tl: { x: 5, y: 5 },
        tr: { x: 95, y: 5 },
        br: { x: 95, y: 95 },
        bl: { x: 5, y: 95 },
      });
    }

    setRotation(initialRotation || 0);
  }, [isOpen, initialCropBox, initialCorners, initialRotation, getStandardDocCropBox]);

  // Adjust crop box when ratio preset changes
  const handleSelectPreset = (presetId: string) => {
    setSelectedPresetId(presetId);
    const preset = DOCUMENT_RATIO_PRESETS.find((p) => p.id === presetId);
    if (!preset) return;

    if (!preset.ratio) {
      // Freeform standard: 4% margin around document
      setCropBox({ x: 4, y: 4, width: 92, height: 92 });
      return;
    }

    const rPct = preset.ratio / imageAspect;
    setCropBox((prev) => {
      let newW = prev.width;
      let newH = newW / rPct;

      if (newH > 94) {
        newH = 90;
        newW = newH * rPct;
      }
      if (newW > 94) {
        newW = 90;
        newH = newW / rPct;
      }

      newW = Math.max(10, Math.min(96, newW));
      newH = Math.max(10, Math.min(96, newH));

      const centerX = prev.x + prev.width / 2;
      const centerY = prev.y + prev.height / 2;

      let newX = centerX - newW / 2;
      let newY = centerY - newH / 2;

      newX = Math.max(0, Math.min(100 - newW, newX));
      newY = Math.max(0, Math.min(100 - newH, newY));

      return { x: newX, y: newY, width: newW, height: newH };
    });
  };

  // Reset to standard document size
  const handleResetToStandardSize = () => {
    const stdBox = getStandardDocCropBox();
    setCropBox(stdBox);
    setAiNote(`✓ Reset to Standard ${activePreset.name} Box`);
    setTimeout(() => setAiNote(null), 3000);
  };

  // AI Auto-detect Document Boundary & Crop Box
  const handleAiDetectDocumentBounds = async () => {
    setIsAiDetecting(true);
    setAiNote('Analyzing document borders and perspective...');
    try {
      const res = await fetch('/api/ai/detect-document-bounds', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageSrc }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.documentBoundingBox) {
          const x = (data.documentBoundingBox.xMin / 1000) * 100;
          const y = (data.documentBoundingBox.yMin / 1000) * 100;
          const w = ((data.documentBoundingBox.xMax - data.documentBoundingBox.xMin) / 1000) * 100;
          let h = ((data.documentBoundingBox.yMax - data.documentBoundingBox.yMin) / 1000) * 100;

          if (targetRatio) {
            h = w / targetRatio;
          }

          setCropBox({
            x: Math.max(0, Math.min(100 - w, x)),
            y: Math.max(0, Math.min(100 - h, y)),
            width: Math.min(100, Math.max(10, w)),
            height: Math.min(100, Math.max(10, h)),
          });

          if (data.suggestedRotation !== undefined && data.suggestedRotation !== rotation) {
            setRotation(data.suggestedRotation);
          }

          setAiNote(`Auto-fitted: ${data.detectedType || 'Document'} borders detected`);
        } else {
          // Default smart margin framing
          setCropBox({ x: 3, y: 3, width: 94, height: 94 });
          setAiNote('Fitted clean document border margins');
        }
      } else {
        throw new Error('Endpoint returned status ' + res.status);
      }
    } catch (err) {
      console.warn('AI Document edge detection fallback:', err);
      // Smart document scan crop fallback (cuts out outer 4% scanner borders)
      setCropBox({ x: 4, y: 4, width: 92, height: 92 });
      setAiNote('Cleaned scanner edge margins');
    } finally {
      setIsAiDetecting(false);
      setTimeout(() => setAiNote(null), 4000);
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
      const rPct = targetRatio ? targetRatio / imageAspect : null;
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
    if (targetRatio) {
      const rPct = targetRatio / imageAspect;
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

  const handleRotateCW = () => {
    setRotation((prev) => (prev + 90) % 360);
  };

  const handleRotateCCW = () => {
    setRotation((prev) => (prev - 90 + 360) % 360);
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
      } else if (targetRatio) {
        // Locked aspect ratio for document preset
        const rPct = targetRatio / imageAspect;
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

        if (dragHandle?.includes('e')) w = Math.max(5, Math.min(100 - x, cropStart.width + deltaXPct));
        if (dragHandle?.includes('s')) h = Math.max(5, Math.min(100 - y, cropStart.height + deltaYPct));
        if (dragHandle?.includes('w')) {
          const newW = Math.max(5, cropStart.width - deltaXPct);
          const newX = cropStart.x + (cropStart.width - newW);
          if (newX >= 0) {
            x = newX;
            w = newW;
          }
        }
        if (dragHandle?.includes('n')) {
          const newH = Math.max(5, cropStart.height - deltaYPct);
          const newY = cropStart.y + (cropStart.height - newH);
          if (newY >= 0) {
            y = newY;
            h = newH;
          }
        }

        setCropBox({ x, y, width: w, height: h });
      }
    },
    [isDragging, dragHandle, dragStart, cropStart, targetRatio, imageAspect]
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
    } else {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    }
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('touchmove', handleMouseMove);
      window.removeEventListener('touchend', handleMouseUp);
    };
  }, [isDragging, handleMouseMove, handleMouseUp]);

  const handleConfirmCrop = useCallback(() => {
    if (engineMode === 'quad') {
      onApplyCrop(cropBox, corners, rotation);
    } else {
      onApplyCrop(cropBox, undefined, rotation);
    }
    onClose();
  }, [engineMode, cropBox, corners, rotation, onApplyCrop, onClose]);

  // Keyboard shortcuts: Enter to confirm crop, Escape to close
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        handleConfirmCrop();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleConfirmCrop, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-3 sm:p-5 animate-in fade-in duration-200">
      <div className="bg-slate-900 text-slate-100 rounded-2xl shadow-2xl max-w-5xl w-full max-h-[96vh] flex flex-col overflow-hidden border border-slate-700">
        {/* Header */}
        <div className="px-5 py-3.5 border-b border-slate-800 flex items-center justify-between bg-slate-950/80">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-purple-500/20 text-purple-400 border border-purple-500/30">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white flex items-center gap-2">
                Document & Scan Precision Crop Studio
              </h2>
              <p className="text-xs text-slate-400">
                Trim scanner margins, correct skew, and frame certificates or multi-page scans
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              id="doc-header-confirm-crop-btn"
              type="button"
              onClick={handleConfirmCrop}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-950/50 transition-all hover:scale-[1.02] active:scale-95 border border-purple-400/40 cursor-pointer"
              title="Confirm and apply crop (Enter)"
            >
              <Check className="w-4 h-4" />
              Confirm Crop
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-slate-800 transition-colors"
              title="Cancel (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Primary Engine Mode Switcher */}
        <div className="px-5 py-2.5 bg-slate-950 border-b border-slate-800 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-1.5 p-1 rounded-xl bg-slate-900 border border-white/10">
            <button
              onClick={() => setEngineMode('box')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                engineMode === 'box'
                  ? 'bg-purple-600 text-white shadow-md'
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
                  ? 'bg-sky-600 text-white shadow-md'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Crosshair className="w-3.5 h-3.5 text-amber-300" />
              4-Corner Freecrop (Perspective Warp)
            </button>
          </div>

          <div className="text-[11px] text-slate-400 font-medium">
            {engineMode === 'quad' ? (
              <span className="text-sky-300 flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                Drag any of the 4 corner pins individually to fix skewed / angled phone camera scans
              </span>
            ) : (
              <span className="text-purple-300">
                Aspect ratio: {activePreset.name} ({activePreset.desc})
              </span>
            )}
          </div>
        </div>

        {engineMode === 'quad' ? (
          <div className="p-4 flex-1 overflow-y-auto max-h-[620px]">
            <FourCornerFreeCrop
              imageSrc={imageSrc}
              targetWidthMm={210}
              targetHeightMm={297}
              corners={corners}
              onChangeCorners={setCorners}
              onResetCorners={() => {
                setCorners({
                  tl: { x: 5, y: 5 },
                  tr: { x: 95, y: 5 },
                  br: { x: 95, y: 95 },
                  bl: { x: 5, y: 95 },
                });
              }}
              onAutoDetectCorners={handleAiDetectDocumentBounds}
              isAiLoading={isAiDetecting}
            />
          </div>
        ) : (
          <>
            {/* Toolbar */}
        <div className="px-5 py-2.5 bg-slate-950/60 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-slate-400 font-semibold flex items-center gap-1">
              <Sliders className="w-3.5 h-3.5 text-purple-400" /> Ratio:
            </span>
            <div className="flex items-center gap-1.5 flex-wrap">
              {DOCUMENT_RATIO_PRESETS.map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleSelectPreset(p.id)}
                  className={`px-2.5 py-1 rounded-lg font-medium transition-all text-[11px] ${
                    selectedPresetId === p.id
                      ? 'bg-purple-600 text-white font-bold shadow-xs'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                  title={p.desc}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleAiDetectDocumentBounds}
              disabled={isAiDetecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 font-semibold transition-all shadow-sm disabled:opacity-50"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiDetecting ? 'animate-spin' : ''}`} />
              {isAiDetecting ? 'Detecting Edges...' : 'AI Auto-Fit Borders'}
            </button>
          </div>
        </div>

        {/* Workspace */}
        <div className="flex-1 min-h-0 flex flex-col lg:flex-row overflow-y-auto lg:overflow-hidden">
          {/* Visual Canvas */}
          <div className="flex-1 bg-slate-950 p-4 flex items-center justify-center overflow-hidden relative select-none">
            <div
              ref={containerRef}
              className="relative inline-block max-w-full max-h-full shadow-2xl rounded-md overflow-hidden"
              style={{ touchAction: 'none' }}
            >
              <img
                src={imageSrc}
                alt="Document Scan"
                style={{
                  transform: `rotate(${rotation}deg)`,
                }}
                className="max-h-[480px] max-w-full object-contain pointer-events-none rounded-sm transition-transform duration-200"
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
                className="absolute border-2 border-purple-400 ring-2 ring-purple-500/30 rounded-xs shadow-2xl cursor-move"
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
                  className="absolute -top-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-purple-600 rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tl')}
                  onTouchStart={(e) => handleMouseDown(e, 'tl')}
                />
                <div
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-purple-600 rounded-xs cursor-ns-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'n')}
                  onTouchStart={(e) => handleMouseDown(e, 'n')}
                />
                <div
                  className="absolute -top-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-purple-600 rounded-full cursor-nesw-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'tr')}
                  onTouchStart={(e) => handleMouseDown(e, 'tr')}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -right-2.5 w-4 h-4 bg-white border-2 border-purple-600 rounded-xs cursor-ew-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'e')}
                  onTouchStart={(e) => handleMouseDown(e, 'e')}
                />
                <div
                  className="absolute -bottom-2.5 -right-2.5 w-5 h-5 bg-white border-2 border-purple-600 rounded-full cursor-nwse-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'br')}
                  onTouchStart={(e) => handleMouseDown(e, 'br')}
                />
                <div
                  className="absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-4 h-4 bg-white border-2 border-purple-600 rounded-xs cursor-ns-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 's')}
                  onTouchStart={(e) => handleMouseDown(e, 's')}
                />
                <div
                  className="absolute -bottom-2.5 -left-2.5 w-5 h-5 bg-white border-2 border-purple-600 rounded-full cursor-nesw-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'bl')}
                  onTouchStart={(e) => handleMouseDown(e, 'bl')}
                />
                <div
                  className="absolute top-1/2 -translate-y-1/2 -left-2.5 w-4 h-4 bg-white border-2 border-purple-600 rounded-xs cursor-ew-resize shadow-lg hover:scale-125 transition-transform"
                  onMouseDown={(e) => handleMouseDown(e, 'w')}
                  onTouchStart={(e) => handleMouseDown(e, 'w')}
                />

                {/* Subtle Grid Lines inside Crop Area */}
                <div className="absolute inset-0 grid grid-cols-3 grid-rows-3 pointer-events-none opacity-25">
                  <div className="border-r border-b border-purple-200" />
                  <div className="border-r border-b border-purple-200" />
                  <div className="border-b border-purple-200" />
                  <div className="border-r border-b border-purple-200" />
                  <div className="border-r border-b border-purple-200" />
                  <div className="border-b border-purple-200" />
                  <div className="border-r border-purple-200" />
                  <div className="border-r border-purple-200" />
                  <div />
                </div>

                {/* Dimension Tag */}
                <div className="absolute bottom-1 right-1 bg-black/80 text-purple-300 text-[10px] px-1.5 py-0.5 rounded font-mono pointer-events-none border border-purple-500/30">
                  {Math.round(cropBox.width)}% × {Math.round(cropBox.height)}%
                </div>
              </div>
            </div>
          </div>

          {/* Right Fine-Tuning Panel */}
          <div className="w-full lg:w-72 bg-slate-900 border-t lg:border-t-0 lg:border-l border-slate-800 p-4 space-y-4 overflow-y-auto shrink-0">
            {/* Direct Confirm Crop Button in Sidebar */}
            <button
              id="doc-sidebar-confirm-crop-btn"
              type="button"
              onClick={handleConfirmCrop}
              className="w-full py-2.5 px-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs sm:text-sm font-bold shadow-lg shadow-purple-950/50 border border-purple-400/40 flex items-center justify-center gap-2 transition-all hover:scale-[1.01] active:scale-98 cursor-pointer"
              title="Confirm and apply crop (Enter)"
            >
              <Check className="w-4 h-4" />
              Confirm Crop
            </button>

            <h3 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
              <Move className="w-3.5 h-3.5 text-purple-400" /> Crop Fine-Tuning
            </h3>

            {/* Rotation Controls */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400">Orientation & Rotation</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={handleRotateCCW}
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-purple-400" /> -90° CCW
                </button>
                <button
                  onClick={handleRotateCW}
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  <RotateCw className="w-3.5 h-3.5 text-purple-400" /> +90° CW
                </button>
              </div>
              <div className="text-[10px] text-center text-slate-500 font-mono">Current: {rotation}°</div>
            </div>

            {/* Position Nudge */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400 text-center">Nudge Position</div>
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
                    onClick={centerBox}
                    className="px-2 py-1 text-[10px] font-bold rounded-lg bg-purple-600/30 text-purple-300 border border-purple-500/40 hover:bg-purple-600/50"
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

            {/* Zoom / Scale & Full Frame */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-2">
              <div className="text-[11px] font-medium text-slate-400">Scale & Framing</div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => zoomCrop(0.95)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  <ZoomIn className="w-3.5 h-3.5 text-purple-400" /> Zoom In
                </button>
                <button
                  onClick={() => zoomCrop(1.05)}
                  className="inline-flex items-center justify-center gap-1 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200"
                >
                  <ZoomOut className="w-3.5 h-3.5 text-pink-400" /> Zoom Out
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2 mt-1">
                <button
                  onClick={handleResetToStandardSize}
                  className="py-1.5 rounded-lg bg-purple-950/50 hover:bg-purple-900/50 border border-purple-800/40 text-xs font-semibold text-purple-300 flex items-center justify-center gap-1.5"
                  title="Reset to standard document proportions"
                >
                  <Sparkles className="w-3.5 h-3.5 text-purple-400" /> Standard Size
                </button>
                <button
                  onClick={maximizeCrop}
                  className="py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-200 flex items-center justify-center gap-1.5"
                >
                  <Maximize2 className="w-3.5 h-3.5 text-purple-400" /> Fit Full Scan
                </button>
              </div>
            </div>

            {/* Quick Presets Info */}
            <div className="bg-slate-950 p-3 rounded-xl border border-slate-800 space-y-1 text-slate-400 text-[11px]">
              <div className="font-semibold text-slate-300">Active Preset:</div>
              <div className="text-purple-300 font-medium">{activePreset.name}</div>
              <div className="text-[10px] text-slate-500">{activePreset.desc}</div>
            </div>
          </div>
        </div>
      </>
    )}

        {/* Footer (Sticky & Always Visible) */}
        <div className="px-5 py-3 bg-slate-950 border-t border-slate-800 flex items-center justify-between flex-wrap gap-3 sticky bottom-0 z-20 shrink-0">
          <div className="text-xs text-slate-400 flex items-center gap-2">
            {engineMode === 'quad' ? (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
                <span className="text-sky-300 font-medium">4-Corner Perspective Warp active</span>
              </>
            ) : (
              <>
                <span className="inline-block w-2 h-2 rounded-full bg-purple-400" />
                {activePreset.name} • {Math.round(cropBox.width)}% × {Math.round(cropBox.height)}% Selected
              </>
            )}
          </div>

          <div className="flex items-center gap-2.5">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              id="doc-footer-confirm-crop-btn"
              type="button"
              onClick={handleConfirmCrop}
              className="inline-flex items-center gap-2 px-6 py-2.5 text-xs font-bold text-white bg-purple-600 hover:bg-purple-500 rounded-xl shadow-lg shadow-purple-950/50 transition-all hover:scale-[1.02] active:scale-95 border border-purple-400/40 cursor-pointer"
              title="Confirm and apply crop (Enter)"
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
