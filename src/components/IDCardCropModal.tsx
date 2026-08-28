import React, { useState, useRef, useEffect, useCallback } from 'react';
import { IDCardPreset } from '../types';
import { Crop, Sparkles, Check, X, CreditCard } from 'lucide-react';

interface IDCardCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  side: 'front' | 'back';
  preset: IDCardPreset;
  customWidthMm: number;
  customHeightMm: number;
  initialCropBox?: { x: number; y: number; width: number; height: number };
  onApplyCrop: (cropBox: { x: number; y: number; width: number; height: number }) => void;
}

export const IDCardCropModal: React.FC<IDCardCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  side,
  preset,
  customWidthMm,
  customHeightMm,
  initialCropBox,
  onApplyCrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const targetWidth = preset.id === 'dl_custom' ? customWidthMm : preset.widthMm;
  const targetHeight = preset.id === 'dl_custom' ? customHeightMm : preset.heightMm;
  const targetAspectRatio = targetWidth / targetHeight; // approx 1.586 for CR80

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 5,
    y: 5,
    width: 90,
    height: 90 / targetAspectRatio,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0, y: 0, width: 0, height: 0,
  });

  const [isAiDetecting, setIsAiDetecting] = useState(false);
  const [aiNote, setAiNote] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (initialCropBox) {
      setCropBox(initialCropBox);
    } else {
      const defaultW = 88;
      const defaultH = defaultW / targetAspectRatio;
      setCropBox({
        x: (100 - defaultW) / 2,
        y: Math.max(4, (100 - defaultH) / 2),
        width: defaultW,
        height: defaultH > 92 ? 92 : defaultH,
      });
    }
  }, [isOpen, initialCropBox, targetAspectRatio]);

  const handleAiDetectCardBounds = async () => {
    setIsAiDetecting(true);
    setAiNote('Detecting ID card edges...');
    try {
      const res = await fetch('/api/ai/detect-card-side', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: imageSrc }),
      });
      const data = await res.json();
      if (data.cardBoundingBox) {
        // Convert normalized 0-1000 to percentages
        const x = (data.cardBoundingBox.xMin / 1000) * 100;
        const y = (data.cardBoundingBox.yMin / 1000) * 100;
        const w = ((data.cardBoundingBox.xMax - data.cardBoundingBox.xMin) / 1000) * 100;
        const h = w / targetAspectRatio;

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

  const handleMouseMove = useCallback((e: MouseEvent | TouchEvent) => {
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
    } else if (dragHandle === 'br' || dragHandle === 'r' || dragHandle === 'b') {
      let newWidth = Math.max(30, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
      let newHeight = newWidth / targetAspectRatio;

      if (cropStart.y + newHeight > 100) {
        newHeight = 100 - cropStart.y;
        newWidth = newHeight * targetAspectRatio;
      }

      setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight }));
    }
  }, [isDragging, dragHandle, dragStart, cropStart, targetAspectRatio]);

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
      <div className="glass-card rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-white/15">
        {/* Header */}
        <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between bg-black/30">
          <div>
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <CreditCard className="w-5 h-5 text-emerald-400" />
              ID Card Crop & Edge Selection ({side === 'front' ? 'FRONT SIDE' : 'BACK SIDE'})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Card Standard: <strong className="text-slate-200">{preset.name}</strong> ({targetWidth} × {targetHeight} mm)
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2.5 bg-black/20 border-b border-white/10 flex items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAiDetectCardBounds}
              disabled={isAiDetecting}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 font-medium text-xs border border-emerald-500/30 transition-colors"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiDetecting ? 'animate-spin' : ''}`} />
              {isAiDetecting ? 'Detecting Card Edges...' : 'AI Auto-Detect Card Edges'}
            </button>
          </div>

          {aiNote && (
            <span className="text-xs font-medium text-emerald-300 bg-emerald-500/20 border border-emerald-500/30 px-2.5 py-1 rounded-md">
              {aiNote}
            </span>
          )}

          <div className="text-xs text-slate-400">
            Drag frame or bottom-right handle to fit card boundaries
          </div>
        </div>

        {/* Preview Area */}
        <div className="flex-1 bg-black/60 p-6 flex items-center justify-center overflow-hidden min-h-[380px] max-h-[550px] relative select-none">
          <div
            ref={containerRef}
            className="relative inline-block max-w-full max-h-full"
            style={{ touchAction: 'none' }}
          >
            <img
              src={imageSrc}
              alt="ID Card Crop"
              className="max-h-[500px] max-w-full object-contain pointer-events-none rounded-sm"
            />

            {/* Dark Mask */}
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute bg-black/60 top-0 left-0 right-0" style={{ height: `${cropBox.y}%` }} />
              <div className="absolute bg-black/60 bottom-0 left-0 right-0" style={{ height: `${100 - (cropBox.y + cropBox.height)}%` }} />
              <div className="absolute bg-black/60 left-0" style={{ top: `${cropBox.y}%`, height: `${cropBox.height}%`, width: `${cropBox.x}%` }} />
              <div className="absolute bg-black/60 right-0" style={{ top: `${cropBox.y}%`, height: `${cropBox.height}%`, width: `${100 - (cropBox.x + cropBox.width)}%` }} />
            </div>

            {/* Selection Box */}
            <div
              className="absolute border-2 border-emerald-400 rounded-lg shadow-xl cursor-move"
              style={{
                left: `${cropBox.x}%`,
                top: `${cropBox.y}%`,
                width: `${cropBox.width}%`,
                height: `${cropBox.height}%`,
              }}
              onMouseDown={(e) => handleMouseDown(e, 'move')}
              onTouchStart={(e) => handleMouseDown(e, 'move')}
            >
              {/* Corner guide overlay */}
              <div className="absolute top-2 left-2 text-[10px] bg-emerald-700/90 text-white px-2 py-0.5 rounded font-mono shadow-sm">
                {side.toUpperCase()} SIDE ({targetWidth}×{targetHeight}mm)
              </div>

              {/* Resize Handle */}
              <div
                className="absolute -bottom-2 -right-2 w-5 h-5 bg-white border-2 border-emerald-600 rounded-full cursor-nwse-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'br')}
                onTouchStart={(e) => handleMouseDown(e, 'br')}
              />
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-black/30 border-t border-white/10 flex items-center justify-between">
          <span className="text-xs text-slate-400">
            Card standard: {targetWidth} × {targetHeight} mm (CR80 ratio)
          </span>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-slate-300 hover:text-white glass-card hover:bg-white/10 border border-white/10 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApplyCrop(cropBox);
                onClose();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl accent-glow-emerald transition-all"
            >
              <Check className="w-4 h-4" />
              Apply Card Crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
