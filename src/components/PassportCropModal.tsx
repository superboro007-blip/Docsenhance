import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PassportPreset } from '../types';
import { Crop, ZoomIn, ZoomOut, RotateCcw, RotateCw, Sparkles, Check, X, User } from 'lucide-react';

interface PassportCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageSrc: string;
  preset: PassportPreset;
  customWidthMm: number;
  customHeightMm: number;
  initialCropBox?: { x: number; y: number; width: number; height: number };
  onApplyCrop: (cropBox: { x: number; y: number; width: number; height: number }) => void;
}

export const PassportCropModal: React.FC<PassportCropModalProps> = ({
  isOpen,
  onClose,
  imageSrc,
  preset,
  customWidthMm,
  customHeightMm,
  initialCropBox,
  onApplyCrop,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  const targetWidth = preset.id === 'custom_photo' ? customWidthMm : preset.widthMm;
  const targetHeight = preset.id === 'custom_photo' ? customHeightMm : preset.heightMm;
  const targetAspectRatio = targetWidth / targetHeight;

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 10,
    y: 5,
    width: 80,
    height: 80 / targetAspectRatio,
  });

  const [isDragging, setIsDragging] = useState(false);
  const [dragHandle, setDragHandle] = useState<string | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [cropStart, setCropStart] = useState<{ x: number; y: number; width: number; height: number }>({
    x: 0, y: 0, width: 0, height: 0,
  });

  const [showBiometricGuide, setShowBiometricGuide] = useState(true);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiMessage, setAiMessage] = useState<string | null>(null);

  // Initialize crop box on modal open
  useEffect(() => {
    if (!isOpen) return;

    if (initialCropBox) {
      setCropBox(initialCropBox);
    } else {
      // Calculate centered crop box with target aspect ratio
      const defaultW = 75;
      const defaultH = defaultW / targetAspectRatio;
      setCropBox({
        x: (100 - defaultW) / 2,
        y: Math.max(2, (100 - defaultH) / 2),
        width: defaultW,
        height: defaultH > 96 ? 96 : defaultH,
      });
    }
  }, [isOpen, initialCropBox, targetAspectRatio]);

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
      const data = await res.json();
      if (data.cropBox) {
        // Ensure aspect ratio is strictly maintained
        let w = data.cropBox.width;
        let h = w / targetAspectRatio;
        if (h > 98) {
          h = 98;
          w = h * targetAspectRatio;
        }
        setCropBox({
          x: Math.max(0, Math.min(100 - w, data.cropBox.x)),
          y: Math.max(0, Math.min(100 - h, data.cropBox.y)),
          width: w,
          height: h,
        });
        setAiMessage('Biometric face crop applied (70-80% head height)');
      }
    } catch (err) {
      console.warn('AI assistant failed, using standard center crop:', err);
      const w = 70;
      const h = w / targetAspectRatio;
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

  // Mouse / Touch handlers for resizing and moving crop box
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
      // Bottom-right resize maintaining aspect ratio
      let newWidth = Math.max(20, Math.min(100 - cropStart.x, cropStart.width + deltaXPct));
      let newHeight = newWidth / targetAspectRatio;

      if (cropStart.y + newHeight > 100) {
        newHeight = 100 - cropStart.y;
        newWidth = newHeight * targetAspectRatio;
      }

      setCropBox((prev) => ({ ...prev, width: newWidth, height: newHeight }));
    } else if (dragHandle === 'tl') {
      // Top-left resize
      let newWidth = Math.max(20, cropStart.width - deltaXPct);
      let newHeight = newWidth / targetAspectRatio;
      let newX = cropStart.x + (cropStart.width - newWidth);
      let newY = cropStart.y + (cropStart.height - newHeight);

      if (newX >= 0 && newY >= 0) {
        setCropBox({ x: newX, y: newY, width: newWidth, height: newHeight });
      }
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-gray-50/80">
          <div>
            <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
              <Crop className="w-5 h-5 text-blue-600" />
              Passport Photo Biometric Crop & Selection
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Preset: <strong className="text-gray-700">{preset.name}</strong> ({targetWidth} × {targetHeight} mm, aspect {targetAspectRatio.toFixed(2)})
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-700 rounded-full hover:bg-gray-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="px-6 py-2.5 bg-white border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 text-sm">
          <div className="flex items-center gap-2">
            <button
              onClick={handleAiAutoCrop}
              disabled={isAiLoading}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 font-medium text-xs border border-blue-200 transition-colors shadow-xs"
            >
              <Sparkles className={`w-3.5 h-3.5 ${isAiLoading ? 'animate-spin' : ''}`} />
              {isAiLoading ? 'Analyzing Face...' : 'AI Auto-Center Face'}
            </button>

            <button
              onClick={() => setShowBiometricGuide(!showBiometricGuide)}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                showBiometricGuide
                  ? 'bg-amber-50 border-amber-200 text-amber-800'
                  : 'bg-gray-50 border-gray-200 text-gray-600 hover:bg-gray-100'
              }`}
            >
              <User className="w-3.5 h-3.5" />
              {showBiometricGuide ? 'Hide Face Guide' : 'Show Face Guide'}
            </button>
          </div>

          {aiMessage && (
            <span className="text-xs font-medium text-blue-600 bg-blue-50 px-2.5 py-1 rounded-md animate-fade-in">
              {aiMessage}
            </span>
          )}

          <div className="text-xs text-gray-500">
            Drag the box or corner handles to frame the head
          </div>
        </div>

        {/* Image Canvas Container */}
        <div className="flex-1 bg-gray-950 p-6 flex items-center justify-center overflow-hidden min-h-[380px] max-h-[550px] relative select-none">
          <div
            ref={containerRef}
            className="relative inline-block max-w-full max-h-full"
            style={{ touchAction: 'none' }}
          >
            <img
              ref={imgRef}
              src={imageSrc}
              alt="Crop Source"
              className="max-h-[500px] max-w-full object-contain pointer-events-none rounded-sm"
            />

            {/* Dark Mask around crop box */}
            <div className="absolute inset-0 pointer-events-none">
              {/* Top mask */}
              <div
                className="absolute bg-black/60 top-0 left-0 right-0"
                style={{ height: `${cropBox.y}%` }}
              />
              {/* Bottom mask */}
              <div
                className="absolute bg-black/60 bottom-0 left-0 right-0"
                style={{ height: `${100 - (cropBox.y + cropBox.height)}%` }}
              />
              {/* Left mask */}
              <div
                className="absolute bg-black/60 left-0"
                style={{
                  top: `${cropBox.y}%`,
                  height: `${cropBox.height}%`,
                  width: `${cropBox.x}%`,
                }}
              />
              {/* Right mask */}
              <div
                className="absolute bg-black/60 right-0"
                style={{
                  top: `${cropBox.y}%`,
                  height: `${cropBox.height}%`,
                  width: `${100 - (cropBox.x + cropBox.width)}%`,
                }}
              />
            </div>

            {/* Active Selection Box */}
            <div
              className="absolute border-2 border-blue-400 shadow-xl cursor-move transition-shadow"
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
                  {/* Top hair crown guide line (approx 8-10% from top) */}
                  <div className="absolute top-[10%] left-0 right-0 border-b border-dashed border-yellow-300/80 flex justify-between px-2">
                    <span className="text-[9px] text-yellow-300 font-mono tracking-tight bg-black/40 px-1 rounded">
                      ▲ Hair Crown Max
                    </span>
                  </div>

                  {/* Eye Level Guide (approx 50-55% from top) */}
                  <div className="absolute top-[52%] left-0 right-0 border-b border-yellow-400/90 flex justify-between px-2">
                    <span className="text-[9px] text-yellow-300 font-mono tracking-tight bg-black/40 px-1 rounded">
                      👁 Eye Level
                    </span>
                  </div>

                  {/* Chin Level Guide (approx 80-85% from top) */}
                  <div className="absolute top-[82%] left-0 right-0 border-b border-dashed border-yellow-300/80 flex justify-between px-2">
                    <span className="text-[9px] text-yellow-300 font-mono tracking-tight bg-black/40 px-1 rounded">
                      ▼ Chin Base (70-80% Head)
                    </span>
                  </div>

                  {/* Head Oval Silhouette */}
                  <div
                    className="absolute left-1/2 -translate-x-1/2 border border-yellow-300/50 rounded-[50%]"
                    style={{
                      top: '10%',
                      width: '64%',
                      height: '72%',
                    }}
                  />
                  {/* Center vertical axis line */}
                  <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 border-r border-dotted border-white/40" />
                </div>
              )}

              {/* Corner Handles */}
              <div
                className="absolute -top-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'tl')}
                onTouchStart={(e) => handleMouseDown(e, 'tl')}
              />
              <div
                className="absolute -top-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'tr')}
                onTouchStart={(e) => handleMouseDown(e, 'tr')}
              />
              <div
                className="absolute -bottom-2 -left-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nesw-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'bl')}
                onTouchStart={(e) => handleMouseDown(e, 'bl')}
              />
              <div
                className="absolute -bottom-2 -right-2 w-4 h-4 bg-white border-2 border-blue-600 rounded-full cursor-nwse-resize shadow-md"
                onMouseDown={(e) => handleMouseDown(e, 'br')}
                onTouchStart={(e) => handleMouseDown(e, 'br')}
              />

              {/* Dimension Tag */}
              <div className="absolute bottom-1 right-1 bg-black/70 text-white text-[10px] px-1.5 py-0.5 rounded font-mono pointer-events-none">
                {targetWidth} × {targetHeight} mm
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500" />
            Aspect ratio locked to {targetWidth} × {targetHeight} mm
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-gray-700 bg-white hover:bg-gray-100 border border-gray-300 rounded-xl transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                onApplyCrop(cropBox);
                onClose();
              }}
              className="inline-flex items-center gap-2 px-5 py-2 text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-md transition-colors"
            >
              <Check className="w-4 h-4" />
              Apply Crop & Frame
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
