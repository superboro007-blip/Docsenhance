import React, { useState, useRef, useEffect, useCallback } from 'react';
import { QuadCorners, Point2D } from '../types';
import {
  Maximize2,
  RotateCcw,
  Sparkles,
  Move,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  Crosshair,
  Sliders,
  Check,
  Grid,
} from 'lucide-react';

interface FourCornerFreeCropProps {
  imageSrc: string;
  targetWidthMm: number;
  targetHeightMm: number;
  corners: QuadCorners;
  onChangeCorners: (corners: QuadCorners) => void;
  onResetCorners?: () => void;
  onAutoDetectCorners?: () => void;
  isAiLoading?: boolean;
  defaultShowGrid?: boolean;
}

type CornerKey = 'tl' | 'tr' | 'br' | 'bl';

export const FourCornerFreeCrop: React.FC<FourCornerFreeCropProps> = ({
  imageSrc,
  targetWidthMm,
  targetHeightMm,
  corners,
  onChangeCorners,
  onResetCorners,
  onAutoDetectCorners,
  isAiLoading = false,
  defaultShowGrid = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [activeCorner, setActiveCorner] = useState<CornerKey>('tl');
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState<CornerKey | 'center' | 'top' | 'right' | 'bottom' | 'left' | null>(null);
  const [dragStartPos, setDragStartPos] = useState<Point2D>({ x: 0, y: 0 });
  const [startCorners, setStartCorners] = useState<QuadCorners>(corners);
  const [showMagnifier, setShowMagnifier] = useState(true);
  const [showPerspectiveGrid, setShowPerspectiveGrid] = useState(defaultShowGrid);

  // Corner style configs
  const cornerConfigs: Record<
    CornerKey,
    { label: string; name: string; color: string; border: string; bg: string; text: string }
  > = {
    tl: {
      label: 'TL',
      name: 'Top-Left',
      color: '#38bdf8', // sky-400
      border: 'border-sky-400',
      bg: 'bg-sky-500',
      text: 'text-sky-400',
    },
    tr: {
      label: 'TR',
      name: 'Top-Right',
      color: '#a855f7', // purple-500
      border: 'border-purple-400',
      bg: 'bg-purple-500',
      text: 'text-purple-400',
    },
    br: {
      label: 'BR',
      name: 'Bottom-Right',
      color: '#10b981', // emerald-500
      border: 'border-emerald-400',
      bg: 'bg-emerald-500',
      text: 'text-emerald-400',
    },
    bl: {
      label: 'BL',
      name: 'Bottom-Left',
      color: '#f59e0b', // amber-500
      border: 'border-amber-400',
      bg: 'bg-amber-500',
      text: 'text-amber-400',
    },
  };

  // Convert client pointer coordinates to percentage (0 - 100) inside container
  const getContainerPercent = useCallback((clientX: number, clientY: number): Point2D => {
    if (!containerRef.current) return { x: 50, y: 50 };
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((clientY - rect.top) / rect.height) * 100));
    return { x, y };
  }, []);

  // Handle pointer down on corner pin
  const handlePointerDownCorner = (e: React.PointerEvent, corner: CornerKey) => {
    e.stopPropagation();
    e.preventDefault();
    setActiveCorner(corner);
    setDragTarget(corner);
    setIsDragging(true);
    const pt = getContainerPercent(e.clientX, e.clientY);
    setDragStartPos(pt);
    setStartCorners(corners);
  };

  // Handle pointer down on center move area
  const handlePointerDownCenter = (e: React.PointerEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setDragTarget('center');
    setIsDragging(true);
    const pt = getContainerPercent(e.clientX, e.clientY);
    setDragStartPos(pt);
    setStartCorners(corners);
  };

  // Drag movement listener
  useEffect(() => {
    if (!isDragging || !dragTarget) return;

    const handlePointerMove = (e: PointerEvent) => {
      const currentPt = getContainerPercent(e.clientX, e.clientY);
      const dx = currentPt.x - dragStartPos.x;
      const dy = currentPt.y - dragStartPos.y;

      if (dragTarget === 'tl' || dragTarget === 'tr' || dragTarget === 'br' || dragTarget === 'bl') {
        const key = dragTarget as CornerKey;
        const newX = Math.max(0, Math.min(100, startCorners[key].x + dx));
        const newY = Math.max(0, Math.min(100, startCorners[key].y + dy));
        onChangeCorners({
          ...startCorners,
          [key]: { x: newX, y: newY },
        });
      } else if (dragTarget === 'center') {
        // Move all 4 corners keeping relative distances
        const minX = Math.min(startCorners.tl.x, startCorners.bl.x);
        const maxX = Math.max(startCorners.tr.x, startCorners.br.x);
        const minY = Math.min(startCorners.tl.y, startCorners.tr.y);
        const maxY = Math.max(startCorners.bl.y, startCorners.br.y);

        const clampedDx = Math.max(-minX, Math.min(100 - maxX, dx));
        const clampedDy = Math.max(-minY, Math.min(100 - maxY, dy));

        onChangeCorners({
          tl: { x: startCorners.tl.x + clampedDx, y: startCorners.tl.y + clampedDy },
          tr: { x: startCorners.tr.x + clampedDx, y: startCorners.tr.y + clampedDy },
          br: { x: startCorners.br.x + clampedDx, y: startCorners.br.y + clampedDy },
          bl: { x: startCorners.bl.x + clampedDx, y: startCorners.bl.y + clampedDy },
        });
      }
    };

    const handlePointerUp = () => {
      setIsDragging(false);
      setDragTarget(null);
    };

    window.addEventListener('pointermove', handlePointerMove);
    window.addEventListener('pointerup', handlePointerUp);

    return () => {
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
    };
  }, [isDragging, dragTarget, dragStartPos, startCorners, getContainerPercent, onChangeCorners]);

  // Nudge active corner by delta percent
  const nudgeActiveCorner = (dx: number, dy: number) => {
    const current = corners[activeCorner];
    const newX = Math.max(0, Math.min(100, current.x + dx));
    const newY = Math.max(0, Math.min(100, current.y + dy));
    onChangeCorners({
      ...corners,
      [activeCorner]: { x: newX, y: newY },
    });
  };

  // Keyboard arrow shortcuts for nudging
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const step = e.shiftKey ? 2.0 : 0.5;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nudgeActiveCorner(-step, 0);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        nudgeActiveCorner(step, 0);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        nudgeActiveCorner(0, -step);
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        nudgeActiveCorner(0, step);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeCorner, corners]);

  // Calculate center of polygon for move handle
  const centerX = (corners.tl.x + corners.tr.x + corners.br.x + corners.bl.x) / 4;
  const centerY = (corners.tl.y + corners.tr.y + corners.br.y + corners.bl.y) / 4;

  // Bilinear helper for 3x3 internal perspective grid
  const getQuadPoint = (u: number, v: number): Point2D => {
    const topX = corners.tl.x + (corners.tr.x - corners.tl.x) * u;
    const topY = corners.tl.y + (corners.tr.y - corners.tl.y) * u;
    const botX = corners.bl.x + (corners.br.x - corners.bl.x) * u;
    const botY = corners.bl.y + (corners.br.y - corners.bl.y) * u;
    return {
      x: topX + (botX - topX) * v,
      y: topY + (botY - topY) * v,
    };
  };

  // SVG Mask Path: Darkened exterior polygon mask
  const svgMaskPath = `
    M 0 0 L 100 0 L 100 100 L 0 100 Z
    M ${corners.tl.x} ${corners.tl.y}
    L ${corners.tr.x} ${corners.tr.y}
    L ${corners.br.x} ${corners.br.y}
    L ${corners.bl.x} ${corners.bl.y} Z
  `;

  return (
    <div className="flex flex-col lg:flex-row gap-4 h-full items-stretch">
      {/* Visual Canvas Stage */}
      <div className="flex-1 flex flex-col items-center justify-center p-3 bg-slate-950/80 rounded-2xl border border-slate-800/80 min-h-[380px] select-none relative overflow-hidden">
        {/* Helper Top Bar inside canvas */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between z-30 pointer-events-none">
          <div className="flex items-center gap-2 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-lg text-xs pointer-events-auto">
            <Crosshair className="w-3.5 h-3.5 text-blue-400" />
            <span className="text-slate-300 font-medium">4-Corner Freecrop Mode:</span>
            <span className="text-blue-400 font-bold">
              {cornerConfigs[activeCorner].name} Selected
            </span>
          </div>

          <div className="flex items-center gap-2 pointer-events-auto">
            <button
              onClick={() => setShowPerspectiveGrid(!showPerspectiveGrid)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 ${
                showPerspectiveGrid
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border-slate-700 hover:text-slate-200'
              }`}
              title="Toggle alignment grid lines"
            >
              <Grid className="w-3.5 h-3.5" />
              Grid: {showPerspectiveGrid ? 'ON' : 'OFF'}
            </button>

            <button
              onClick={() => setShowMagnifier(!showMagnifier)}
              className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all ${
                showMagnifier
                  ? 'bg-blue-600/30 text-blue-300 border-blue-500/40 shadow-sm'
                  : 'bg-slate-900/80 text-slate-400 border-slate-700'
              }`}
            >
              Loupe: {showMagnifier ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>

        {/* Main Image Container */}
        <div
          ref={containerRef}
          className="relative max-w-full max-h-[460px] flex items-center justify-center cursor-crosshair touch-none shadow-2xl rounded-lg overflow-hidden border border-white/10"
        >
          <img
            src={imageSrc}
            alt="Crop target"
            className="max-h-[440px] max-w-full w-auto h-auto object-contain block pointer-events-none"
            draggable={false}
          />

          {/* SVG Geometric Overlay */}
          <svg
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
            className="absolute inset-0 w-full h-full pointer-events-none z-10"
          >
            {/* Dark outer perimeter mask */}
            <path d={svgMaskPath} fill="rgba(2, 6, 23, 0.72)" fillRule="evenodd" />

            {/* Perspective 3x3 internal grid lines (only when Grid is ON) */}
            {showPerspectiveGrid && (
              <>
                {/* Vertical grid lines */}
                <line
                  x1={getQuadPoint(0.333, 0).x}
                  y1={getQuadPoint(0.333, 0).y}
                  x2={getQuadPoint(0.333, 1).x}
                  y2={getQuadPoint(0.333, 1).y}
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1.5"
                />
                <line
                  x1={getQuadPoint(0.666, 0).x}
                  y1={getQuadPoint(0.666, 0).y}
                  x2={getQuadPoint(0.666, 1).x}
                  y2={getQuadPoint(0.666, 1).y}
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1.5"
                />
                {/* Horizontal grid lines */}
                <line
                  x1={getQuadPoint(0, 0.333).x}
                  y1={getQuadPoint(0, 0.333).y}
                  x2={getQuadPoint(1, 0.333).x}
                  y2={getQuadPoint(1, 0.333).y}
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1.5"
                />
                <line
                  x1={getQuadPoint(0, 0.666).x}
                  y1={getQuadPoint(0, 0.666).y}
                  x2={getQuadPoint(1, 0.666).x}
                  y2={getQuadPoint(1, 0.666).y}
                  stroke="rgba(255, 255, 255, 0.35)"
                  strokeWidth="0.5"
                  strokeDasharray="1.5 1.5"
                />
              </>
            )}

            {/* Main Quadrilateral Boundary */}
            <polygon
              points={`
                ${corners.tl.x},${corners.tl.y}
                ${corners.tr.x},${corners.tr.y}
                ${corners.br.x},${corners.br.y}
                ${corners.bl.x},${corners.bl.y}
              `}
              fill="rgba(56, 189, 248, 0.08)"
              stroke="#38bdf8"
              strokeWidth="1.2"
              strokeDasharray="3 1.5"
            />
          </svg>

          {/* Center Move Handle */}
          <div
            onPointerDown={handlePointerDownCenter}
            style={{
              left: `${centerX}%`,
              top: `${centerY}%`,
              transform: 'translate(-50%, -50%)',
            }}
            className="absolute z-20 cursor-move p-2 rounded-full bg-slate-900/90 text-slate-200 border border-white/20 hover:border-blue-400 hover:bg-blue-600/30 transition-colors shadow-lg group"
            title="Drag to reposition entire 4-corner crop"
          >
            <Move className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>

          {/* 4 Interactive Corner Pins */}
          {(['tl', 'tr', 'br', 'bl'] as CornerKey[]).map((key) => {
            const pt = corners[key];
            const cfg = cornerConfigs[key];
            const isSelected = activeCorner === key;

            return (
              <div
                key={key}
                onPointerDown={(e) => handlePointerDownCorner(e, key)}
                style={{
                  left: `${pt.x}%`,
                  top: `${pt.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                className={`absolute z-30 cursor-grab active:cursor-grabbing flex items-center justify-center p-1 select-none transition-transform ${
                  isSelected ? 'scale-125 z-40' : 'hover:scale-110'
                }`}
              >
                {/* Pin Circle */}
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-black text-white shadow-xl border-2 transition-all ${
                    cfg.bg
                  } ${cfg.border} ${
                    isSelected ? 'ring-4 ring-white/60 shadow-blue-500/50' : 'ring-1 ring-black/40'
                  }`}
                >
                  {cfg.label}
                </div>

                {/* Coordinate Bubble if Selected */}
                {isSelected && (
                  <div
                    className="absolute -top-7 whitespace-nowrap px-2 py-0.5 rounded-md bg-black/90 text-white font-mono text-[10px] border border-white/20 shadow-lg pointer-events-none"
                  >
                    {Math.round(pt.x)}%, {Math.round(pt.y)}%
                  </div>
                )}
              </div>
            );
          })}

          {/* Corner Magnifier Loupe when Dragging */}
          {showMagnifier && isDragging && dragTarget && dragTarget !== 'center' && (
            <div
              className="absolute top-4 right-4 z-50 w-28 h-28 rounded-full border-2 border-blue-400 shadow-2xl overflow-hidden pointer-events-none bg-slate-900"
              style={{
                boxShadow: '0 0 25px rgba(56, 189, 248, 0.4)',
              }}
            >
              <div
                className="w-full h-full relative"
                style={{
                  backgroundImage: `url(${imageSrc})`,
                  backgroundSize: `${containerRef.current ? containerRef.current.clientWidth * 2.8 : 800}px auto`,
                  backgroundPosition: `${
                    50 - (corners[dragTarget as CornerKey].x - 50) * 2.8
                  }% ${50 - (corners[dragTarget as CornerKey].y - 50) * 2.8}%`,
                  backgroundRepeat: 'no-repeat',
                }}
              >
                {/* Crosshair inside loupe */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-6 h-6 border border-blue-400 rounded-full flex items-center justify-center">
                    <div className="w-1 h-1 bg-red-500 rounded-full" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Right Control Column */}
      <div className="w-full lg:w-72 flex flex-col gap-3 bg-slate-900/90 p-4 rounded-2xl border border-white/10">
        <div className="flex items-center justify-between">
          <h4 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
            <Sliders className="w-3.5 h-3.5 text-blue-400" /> 4-Corner Calibration
          </h4>
          <span className="text-[10px] text-slate-400 font-mono">
            {targetWidthMm}×{targetHeightMm} mm
          </span>
        </div>

        {/* 4 Corner Selector Pills */}
        <div className="grid grid-cols-2 gap-2">
          {(['tl', 'tr', 'bl', 'br'] as CornerKey[]).map((key) => {
            const cfg = cornerConfigs[key];
            const pt = corners[key];
            const isSelected = activeCorner === key;

            return (
              <button
                key={key}
                onClick={() => setActiveCorner(key)}
                className={`p-2.5 rounded-xl border flex flex-col items-start gap-1 text-left transition-all ${
                  isSelected
                    ? `${cfg.border} bg-white/10 shadow-md ring-1 ring-white/20`
                    : 'border-slate-800 bg-slate-950/60 hover:bg-slate-800/60'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className={`text-xs font-bold ${cfg.text}`}>{cfg.name}</span>
                  <span
                    className={`w-2 h-2 rounded-full ${isSelected ? cfg.bg : 'bg-slate-700'}`}
                  />
                </div>
                <div className="text-[11px] font-mono text-slate-400">
                  X: {Math.round(pt.x)}% • Y: {Math.round(pt.y)}%
                </div>
              </button>
            );
          })}
        </div>

        {/* Precision Nudge Keypad */}
        <div className="bg-slate-950/80 p-3 rounded-xl border border-slate-800 space-y-2">
          <div className="flex items-center justify-between text-[11px] text-slate-300 font-semibold">
            <span>Precision Nudge ({cornerConfigs[activeCorner].label})</span>
            <span className="text-[10px] text-slate-500 font-normal">Use Keyboard Arrows</span>
          </div>

          <div className="flex flex-col items-center gap-1.5">
            <button
              onClick={() => nudgeActiveCorner(0, -1)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-slate-200 transition-colors shadow"
              title="Nudge Up"
            >
              <ArrowUp className="w-4 h-4" />
            </button>
            <div className="flex items-center gap-2">
              <button
                onClick={() => nudgeActiveCorner(-1, 0)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-slate-200 transition-colors shadow"
                title="Nudge Left"
              >
                <ArrowLeft className="w-4 h-4" />
              </button>
              <div className="w-8 h-8 rounded-lg bg-slate-900 border border-slate-700 flex items-center justify-center text-xs font-bold text-blue-400 font-mono">
                {cornerConfigs[activeCorner].label}
              </div>
              <button
                onClick={() => nudgeActiveCorner(1, 0)}
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-slate-200 transition-colors shadow"
                title="Nudge Right"
              >
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={() => nudgeActiveCorner(0, 1)}
              className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 active:bg-blue-600 text-slate-200 transition-colors shadow"
              title="Nudge Down"
            >
              <ArrowDown className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Quick Corner Preset Actions */}
        <div className="space-y-2 mt-auto">
          <div className="grid grid-cols-2 gap-2">
            <button
              onClick={() => {
                // Expand to full outer margins
                onChangeCorners({
                  tl: { x: 4, y: 4 },
                  tr: { x: 96, y: 4 },
                  br: { x: 96, y: 96 },
                  bl: { x: 4, y: 96 },
                });
              }}
              className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1 transition-colors"
            >
              <Maximize2 className="w-3 h-3 text-blue-400" /> Full Margin
            </button>

            {onResetCorners && (
              <button
                onClick={onResetCorners}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-[11px] font-semibold text-slate-300 flex items-center justify-center gap-1 transition-colors"
              >
                <RotateCcw className="w-3 h-3 text-amber-400" /> Reset Points
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
