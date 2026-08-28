import React, { useState, useEffect, useRef } from 'react';
import {
  PassportPreset,
  PassportSettings,
  PaperSizeConfig,
} from '../types';
import {
  PASSPORT_PRESETS,
  PAPER_SIZES,
  BACKGROUND_COLORS,
  SAMPLE_PORTRAIT_URL,
} from '../data/presets';
import {
  processPassportImage,
  renderPassportSheetCanvas,
  exportToPDF,
} from '../utils/imageProcessing';
import { PassportCropModal } from './PassportCropModal';
import { WebcamModal } from './WebcamModal';
import {
  Upload,
  Camera,
  Crop,
  Sliders,
  Printer,
  Download,
  FileText,
  Sparkles,
  Grid,
  RefreshCw,
  Eye,
  CheckCircle2,
  Info,
  Maximize2,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PassportStudioProps {
  onNavigateToPreview?: () => void;
}

export const PassportStudio: React.FC<PassportStudioProps> = () => {
  // Main State
  const [rawImage, setRawImage] = useState<string | null>(null);
  const [processedPhotoUrl, setProcessedPhotoUrl] = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<PassportPreset>(PASSPORT_PRESETS[0]);
  const [selectedPaper, setSelectedPaper] = useState<PaperSizeConfig>(PAPER_SIZES[0]); // A4 default

  const [settings, setSettings] = useState<PassportSettings>({
    presetId: PASSPORT_PRESETS[0].id,
    customWidthMm: 35,
    customHeightMm: 45,
    photoCount: 36, // 36 photos requested on A4!
    gapMm: 2,
    marginTopMm: 6,
    marginLeftMm: 6,
    backgroundColor: '#ffffff',
    showCutLines: true,
    cutLineStyle: 'solid',
    showFaceGuideOverlay: false,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
    skinSmooth: 0,
  });

  const [cropBox, setCropBox] = useState<{ x: number; y: number; width: number; height: number } | undefined>(undefined);
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sheetPreviewUrl, setSheetPreviewUrl] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'presets' | 'adjustments' | 'layout'>('presets');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastRenderedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Load default sample photo if none uploaded
  useEffect(() => {
    if (!rawImage) {
      setRawImage(SAMPLE_PORTRAIT_URL);
    }
  }, [rawImage]);

  // When preset changes, sync dimensions
  const handlePresetChange = (preset: PassportPreset) => {
    setSelectedPreset(preset);
    setSettings((prev) => ({
      ...prev,
      presetId: preset.id,
      customWidthMm: preset.widthMm,
      customHeightMm: preset.heightMm,
    }));
  };

  // When paper changes, set default photo count (36 on A4, 8 on 4x6, etc.)
  const handlePaperChange = (paper: PaperSizeConfig) => {
    setSelectedPaper(paper);
    setSettings((prev) => ({
      ...prev,
      photoCount: paper.defaultPassportCount,
    }));
  };

  // Re-process passport photo when image or settings change
  useEffect(() => {
    if (!rawImage) return;

    let isMounted = true;
    const updatePhoto = async () => {
      setIsProcessing(true);
      try {
        const widthMm = selectedPreset.id === 'custom_photo' ? settings.customWidthMm : selectedPreset.widthMm;
        const heightMm = selectedPreset.id === 'custom_photo' ? settings.customHeightMm : selectedPreset.heightMm;

        const processedUrl = await processPassportImage(rawImage, settings, widthMm, heightMm, cropBox);
        if (isMounted) {
          setProcessedPhotoUrl(processedUrl);

          // Generate full sheet canvas
          const sheetCanvas = await renderPassportSheetCanvas(
            processedUrl,
            selectedPaper,
            settings,
            widthMm,
            heightMm
          );
          lastRenderedCanvasRef.current = sheetCanvas;
          setSheetPreviewUrl(sheetCanvas.toDataURL('image/jpeg', 0.92));
        }
      } catch (err) {
        console.error('Passport generation error:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    updatePhoto();

    return () => {
      isMounted = false;
    };
  }, [rawImage, selectedPreset, selectedPaper, settings, cropBox]);

  // File Upload Handler
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string;
      setRawImage(dataUrl);
      setCropBox(undefined); // Reset crop for new image
      setIsCropModalOpen(true); // Open easy selection box right away
    };
    reader.readAsDataURL(file);
  };

  // Direct Print Sheet
  const handlePrintSheet = () => {
    if (!lastRenderedCanvasRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dataUrl = lastRenderedCanvasRef.current.toDataURL('image/jpeg', 0.98);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Passport Photo Sheet - ${settings.photoCount} Photos</title>
          <style>
            @page {
              size: ${selectedPaper.widthMm}mm ${selectedPaper.heightMm}mm;
              margin: 0;
            }
            body {
              margin: 0;
              padding: 0;
              display: flex;
              justify-content: center;
              align-items: center;
              background: white;
            }
            img {
              width: ${selectedPaper.widthMm}mm;
              height: ${selectedPaper.heightMm}mm;
              display: block;
            }
          </style>
        </head>
        <body>
          <img src="${dataUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Download High-Res PDF
  const handleDownloadPDF = () => {
    if (!lastRenderedCanvasRef.current) return;
    const widthMm = selectedPreset.id === 'custom_photo' ? settings.customWidthMm : selectedPreset.widthMm;
    const heightMm = selectedPreset.id === 'custom_photo' ? settings.customHeightMm : selectedPreset.heightMm;
    exportToPDF(
      lastRenderedCanvasRef.current,
      selectedPaper,
      `passport_${widthMm}x${heightMm}mm_${settings.photoCount}_photos_${selectedPaper.id}.pdf`
    );
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
  };

  // Download Single Cropped Photo
  const handleDownloadSinglePhoto = () => {
    if (!processedPhotoUrl) return;
    const link = document.createElement('a');
    link.download = `passport_single_photo_${selectedPreset.widthMm}x${selectedPreset.heightMm}mm.jpg`;
    link.href = processedPhotoUrl;
    link.click();
  };

  const currentWidthMm = selectedPreset.id === 'custom_photo' ? settings.customWidthMm : selectedPreset.widthMm;
  const currentHeightMm = selectedPreset.id === 'custom_photo' ? settings.customHeightMm : selectedPreset.heightMm;

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Page Title & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-5 rounded-2xl border border-white/10 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-500/30">
              Dedicated Studio
            </span>
            <h1 className="text-xl font-bold text-white">
              Passport & Visa Photo Studio
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Biometric crop selector, background color replacement, and high-density{' '}
            <strong className="text-blue-400 font-semibold">36-photo A4 sheet grid</strong>.
          </p>
        </div>

        {/* Quick Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            accept="image/*"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold accent-glow transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Portrait
          </button>
          <button
            onClick={() => setIsWebcamOpen(true)}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl glass-card hover:bg-white/10 text-slate-200 text-sm font-medium border border-white/15 transition-all"
          >
            <Camera className="w-4 h-4 text-blue-400" />
            Webcam
          </button>
          <button
            onClick={() => {
              setRawImage(SAMPLE_PORTRAIT_URL);
              setCropBox(undefined);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl glass-card hover:bg-white/10 text-slate-400 hover:text-slate-200 text-xs font-medium border border-white/10 transition-all"
            title="Load standard sample portrait"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Sample Photo
          </button>
        </div>
      </div>

      {/* Main Grid: Left Controls, Right Live Sheet Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Controls & Adjustments (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Portrait Quick View & Crop Action */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
                1. Portrait Photo & Crop Box
              </h2>
              <span className="text-xs text-blue-400 font-medium">
                {currentWidthMm} × {currentHeightMm} mm
              </span>
            </div>

            <div className="flex items-center gap-4 bg-black/30 p-3.5 rounded-xl border border-white/10">
              {/* Single Cropped Preview Thumbnail */}
              <div className="relative w-24 h-32 bg-slate-900 rounded-lg shadow-sm border border-white/15 flex items-center justify-center overflow-hidden shrink-0">
                {processedPhotoUrl ? (
                  <img
                    src={processedPhotoUrl}
                    alt="Passport Thumbnail"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-xs text-slate-500">No Photo</span>
                )}

                {/* Biometric overlay badge */}
                <span className="absolute bottom-1 right-1 bg-black/80 text-white text-[9px] px-1 rounded font-mono border border-white/10">
                  ICAO
                </span>
              </div>

              {/* Crop & Reframe Trigger */}
              <div className="flex-1 space-y-2">
                <p className="text-xs text-slate-400">
                  Select and position the face inside the biometric guidelines.
                </p>
                <div className="flex flex-col gap-1.5">
                  <button
                    onClick={() => setIsCropModalOpen(true)}
                    className="inline-flex items-center justify-center gap-2 px-3.5 py-2 rounded-xl bg-blue-500/15 hover:bg-blue-500/25 text-blue-300 text-xs font-semibold border border-blue-500/30 transition-colors"
                  >
                    <Crop className="w-4 h-4" />
                    Open Passport Crop Box
                  </button>
                  <button
                    onClick={handleDownloadSinglePhoto}
                    className="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-lg glass-card hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-colors"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Download Single {currentWidthMm}×{currentHeightMm}mm JPG
                  </button>
                </div>
              </div>
            </div>

            {/* Background Color Picker */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                Background Color Replacement
              </label>
              <div className="grid grid-cols-4 gap-2">
                {BACKGROUND_COLORS.slice(0, 4).map((bg) => (
                  <button
                    key={bg.value}
                    onClick={() => setSettings((prev) => ({ ...prev, backgroundColor: bg.value }))}
                    className={`flex flex-col items-center p-2 rounded-xl border text-xs font-medium transition-all ${
                      settings.backgroundColor === bg.value
                        ? 'border-blue-400 bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/40'
                        : 'border-white/10 hover:bg-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`w-6 h-6 rounded-full border border-white/20 mb-1 shadow-sm ${bg.class}`}
                    />
                    <span className="text-[11px] truncate w-full text-center">{bg.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
              <div className="grid grid-cols-3 gap-2 mt-2">
                {BACKGROUND_COLORS.slice(4).map((bg) => (
                  <button
                    key={bg.value}
                    onClick={() => setSettings((prev) => ({ ...prev, backgroundColor: bg.value }))}
                    className={`flex flex-col items-center p-1.5 rounded-xl border text-xs font-medium transition-all ${
                      settings.backgroundColor === bg.value
                        ? 'border-blue-400 bg-blue-500/20 text-blue-300 ring-1 ring-blue-400/40'
                        : 'border-white/10 hover:bg-white/5 text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <span
                      className={`w-5 h-5 rounded-full border border-white/20 mb-1 shadow-sm ${bg.class}`}
                    />
                    <span className="text-[10px] truncate w-full text-center">{bg.name.split(' ')[0]}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Card 2: Preset & Size Selection */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
            <div className="flex bg-black/30 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setActiveTab('presets')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'presets'
                    ? 'bg-white/15 text-white shadow-sm border border-white/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Country Sizes
              </button>
              <button
                onClick={() => setActiveTab('layout')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'layout'
                    ? 'bg-white/15 text-white shadow-sm border border-white/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Grid & 36 Count
              </button>
              <button
                onClick={() => setActiveTab('adjustments')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeTab === 'adjustments'
                    ? 'bg-white/15 text-white shadow-sm border border-white/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Enhance
              </button>
            </div>

            {/* Tab: Country Presets */}
            {activeTab === 'presets' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Passport / Visa Requirement
                </label>
                <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
                  {PASSPORT_PRESETS.map((preset) => {
                    const isSelected = selectedPreset.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetChange(preset)}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                          isSelected
                            ? 'border-blue-500/60 bg-blue-500/15 text-white font-medium ring-1 ring-blue-500/30'
                            : 'border-white/10 hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-medium text-slate-200">{preset.name}</div>
                          <div className="text-[11px] text-slate-400">{preset.country}</div>
                        </div>
                        <span className="text-[11px] font-mono bg-black/40 text-slate-300 px-2 py-0.5 rounded border border-white/10 shrink-0">
                          {preset.widthMm} × {preset.heightMm} mm
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/* Custom dimensions if custom selected */}
                {selectedPreset.id === 'custom_photo' && (
                  <div className="p-3 bg-black/30 rounded-xl border border-white/10 grid grid-cols-2 gap-3 mt-2">
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Width (mm)
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="100"
                        value={settings.customWidthMm}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            customWidthMm: Number(e.target.value) || 35,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-medium text-slate-400 mb-1">
                        Height (mm)
                      </label>
                      <input
                        type="number"
                        min="15"
                        max="100"
                        value={settings.customHeightMm}
                        onChange={(e) =>
                          setSettings((prev) => ({
                            ...prev,
                            customHeightMm: Number(e.target.value) || 45,
                          }))
                        }
                        className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: Print Grid & 36-Photo A4 Settings */}
            {activeTab === 'layout' && (
              <div className="space-y-4">
                {/* Paper Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Print Paper Size
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAPER_SIZES.slice(0, 4).map((paper) => (
                      <button
                        key={paper.id}
                        onClick={() => handlePaperChange(paper)}
                        className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                          selectedPaper.id === paper.id
                            ? 'border-blue-400 bg-blue-500/20 text-white font-medium ring-1 ring-blue-400/40'
                            : 'border-white/10 hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <div className="font-semibold text-slate-200">{paper.name}</div>
                        <div className="text-[10px] text-slate-400">
                          {paper.widthMm} × {paper.heightMm} mm
                        </div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 36-Photo Grid Selector */}
                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-300 flex items-center gap-1.5">
                      <Grid className="w-3.5 h-3.5 text-blue-400" />
                      Number of Photos on Sheet
                    </label>
                    <span className="text-xs font-bold text-blue-300 bg-blue-500/20 px-2 py-0.5 rounded-full border border-blue-500/30">
                      {settings.photoCount} Photos
                    </span>
                  </div>

                  {/* Preset Count Buttons with 36 Photos emphasized */}
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {[6, 8, 12, 16, 24, 30, 36, 42].map((cnt) => (
                      <button
                        key={cnt}
                        onClick={() => setSettings((prev) => ({ ...prev, photoCount: cnt }))}
                        className={`py-1.5 px-2 rounded-lg text-xs font-medium border transition-all ${
                          settings.photoCount === cnt
                            ? cnt === 36
                              ? 'bg-emerald-600 border-emerald-500 text-white font-bold accent-glow-emerald'
                              : 'bg-blue-600 border-blue-500 text-white font-bold accent-glow'
                            : cnt === 36
                            ? 'bg-emerald-500/15 border-emerald-500/40 text-emerald-300 font-semibold hover:bg-emerald-500/25'
                            : 'border-white/10 hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        {cnt} {cnt === 36 ? '★ 36 (A4)' : ''}
                      </button>
                    ))}
                  </div>

                  {selectedPaper.id === 'a4' && (
                    <p className="text-[11px] text-emerald-300 bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20">
                      ✓ <strong>36 Passport Photos</strong> generated as 6 columns × 6 rows on standard A4 paper with precision border cut marks.
                    </p>
                  )}
                </div>

                {/* Spacing & Cutting Marks */}
                <div className="space-y-3 pt-2 border-t border-white/10">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">
                      Show Cutting Lines
                    </label>
                    <input
                      type="checkbox"
                      checked={settings.showCutLines}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, showCutLines: e.target.checked }))
                      }
                      className="w-4 h-4 text-blue-600 rounded bg-black/40 border-white/20"
                    />
                  </div>

                  {settings.showCutLines && (
                    <div className="grid grid-cols-3 gap-1.5">
                      {[
                        { id: 'solid', label: 'Solid Hairline' },
                        { id: 'dashed', label: 'Dashed Lines' },
                        { id: 'cross_corners', label: 'Cross Corners' },
                      ].map((st) => (
                        <button
                          key={st.id}
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              cutLineStyle: st.id as any,
                            }))
                          }
                          className={`py-1 text-[11px] rounded-lg border transition-all ${
                            settings.cutLineStyle === st.id
                              ? 'border-blue-400 bg-blue-500/20 text-blue-300 font-semibold'
                              : 'border-white/10 text-slate-400 hover:bg-white/5 hover:text-slate-200'
                          }`}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  )}

                  <div>
                    <div className="flex justify-between text-xs text-slate-400 mb-1">
                      <span>Gap between photos</span>
                      <span className="text-slate-300 font-mono">{settings.gapMm} mm</span>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="6"
                      step="0.5"
                      value={settings.gapMm}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, gapMm: Number(e.target.value) }))
                      }
                      className="w-full accent-blue-500"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Image Enhancements */}
            {activeTab === 'adjustments' && (
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Brightness</span>
                    <span className="text-slate-300 font-mono">{settings.brightness > 0 ? `+${settings.brightness}` : settings.brightness}</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={settings.brightness}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, brightness: Number(e.target.value) }))
                    }
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Contrast</span>
                    <span className="text-slate-300 font-mono">{settings.contrast > 0 ? `+${settings.contrast}` : settings.contrast}</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={settings.contrast}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, contrast: Number(e.target.value) }))
                    }
                    className="w-full accent-blue-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Color Saturation</span>
                    <span className="text-slate-300 font-mono">{settings.saturation > 0 ? `+${settings.saturation}` : settings.saturation}</span>
                  </div>
                  <input
                    type="range"
                    min="-40"
                    max="40"
                    value={settings.saturation}
                    onChange={(e) =>
                      setSettings((prev) => ({ ...prev, saturation: Number(e.target.value) }))
                    }
                    className="w-full accent-blue-500"
                  />
                </div>

                <button
                  onClick={() =>
                    setSettings((prev) => ({
                      ...prev,
                      brightness: 0,
                      contrast: 0,
                      saturation: 0,
                    }))
                  }
                  className="text-xs text-slate-400 hover:text-slate-200 underline"
                >
                  Reset all adjustments
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Live High-Resolution Sheet Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg flex flex-col items-center">
            {/* Sheet Header Banner */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Live Print Sheet Preview
                </span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold px-2.5 py-0.5 rounded-full">
                  {settings.photoCount} Photos Grid
                </span>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrintSheet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-card hover:bg-white/10 text-white text-xs font-semibold border border-white/20 transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-300" />
                  Print Direct
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold accent-glow transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download 300 DPI PDF
                </button>
              </div>
            </div>

            {/* High Res Canvas Visualizer */}
            <div className="w-full my-4 p-4 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 overflow-auto min-h-[440px]">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="text-xs font-medium">Rendering 300 DPI sheet layout...</span>
                </div>
              ) : sheetPreviewUrl ? (
                <div className="shadow-2xl border border-white/20 bg-white rounded-xs p-1 max-w-[480px]">
                  <img
                    src={sheetPreviewUrl}
                    alt="A4 Passport Sheet"
                    className="w-full h-auto object-contain block"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-500">Loading preview...</span>
              )}
            </div>

            {/* Sheet Footer Details */}
            <div className="w-full flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
              <div className="flex items-center gap-4">
                <span>
                  Paper: <strong className="text-slate-200">{selectedPaper.name}</strong> ({selectedPaper.widthMm} × {selectedPaper.heightMm} mm)
                </span>
                <span>
                  Photo: <strong className="text-slate-200">{currentWidthMm} × {currentHeightMm} mm</strong>
                </span>
              </div>
              <span className="text-emerald-400 font-medium">
                ✓ Ready for 100% borderless or standard scale print
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Passport Crop Modal */}
      {rawImage && (
        <PassportCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          imageSrc={rawImage}
          preset={selectedPreset}
          customWidthMm={settings.customWidthMm}
          customHeightMm={settings.customHeightMm}
          initialCropBox={cropBox}
          onApplyCrop={(newBox) => setCropBox(newBox)}
        />
      )}

      {/* Webcam Modal */}
      <WebcamModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={(dataUrl) => {
          setRawImage(dataUrl);
          setCropBox(undefined);
          setIsCropModalOpen(true);
        }}
        mode="passport"
      />
    </div>
  );
};
