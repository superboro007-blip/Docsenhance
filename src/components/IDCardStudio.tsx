import React, { useState, useEffect, useRef } from 'react';
import {
  IDCardPreset,
  IDCardSettings,
  PaperSizeConfig,
  IDCardItem,
  PendingCardDecision,
} from '../types';
import {
  ID_CARD_PRESETS,
  PAPER_SIZES,
  SAMPLE_ID_FRONT_URL,
  SAMPLE_ID_BACK_URL,
  SAMPLE_AMBIGUOUS_ID_URL,
} from '../data/presets';
import {
  processIDCardItem,
  renderIDCardSheetCanvas,
  exportToPDF,
  exportDuplexIDCardPDF,
} from '../utils/imageProcessing';
import { IDCardCropModal } from './IDCardCropModal';
import { WebcamModal } from './WebcamModal';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';
import {
  Upload,
  Camera,
  Crop,
  Printer,
  Download,
  CreditCard,
  Sparkles,
  ArrowLeftRight,
  Layers,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Scissors,
  FileCheck,
  ShieldCheck,
  HelpCircle,
  AlertTriangle,
  Check,
  X,
  Wand2,
  Plus,
  Minus,
} from 'lucide-react';

import confetti from 'canvas-confetti';

export const IDCardStudio: React.FC = () => {
  // Front & Back Card Items
  const [frontCard, setFrontCard] = useState<IDCardItem | null>({
    id: 'front-1',
    side: 'front',
    dataUrl: SAMPLE_ID_FRONT_URL,
    fileName: 'sample_id_front.jpg',
    rotation: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
    detectedSide: 'front',
    detectedConfidence: 0.96,
    detectedSummary: 'Sample Front (Portrait & ID)',
    isAmbiguous: false,
  });

  const [backCard, setBackCard] = useState<IDCardItem | null>({
    id: 'back-1',
    side: 'back',
    dataUrl: SAMPLE_ID_BACK_URL,
    fileName: 'sample_id_back.jpg',
    rotation: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
    detectedSide: 'back',
    detectedConfidence: 0.94,
    detectedSummary: 'Sample Back (Details & Barcode)',
    isAmbiguous: false,
  });

  // Ambiguity Resolution State
  const [pendingDecision, setPendingDecision] = useState<PendingCardDecision | null>(null);

  // Settings
  const [selectedPreset, setSelectedPreset] = useState<IDCardPreset>(ID_CARD_PRESETS[0]); // CR80 Standard
  const [selectedPaper, setSelectedPaper] = useState<PaperSizeConfig>(PAPER_SIZES[0]); // A4

  const [settings, setSettings] = useState<IDCardSettings>({
    presetId: ID_CARD_PRESETS[0].id,
    customWidthMm: 85.6,
    customHeightMm: 53.98,
    orientation: 'landscape',
    layoutMode: 'side_by_side', // 'side_by_side' | 'stacked' | 'foldable' | 'grid_multi' | 'duplex_pages'
    cornerRadiusMm: 3.18,
    borderStyle: 'thin_black',
    borderWidthPx: 1,
    showCuttingMarks: true,
    showFoldingLine: true,
    laminateMarginMm: 3,
    spacingMm: 8,
    cardsCount: 2,
    includeDetailsHeader: false,
    headerText: 'NATIONAL ID CARD / DRIVING LICENSE PRINT SHEET',
  });

  // Crop & Modal state
  const [activeCropSide, setActiveCropSide] = useState<'front' | 'back' | null>(null);
  const [bgRemovalSide, setBgRemovalSide] = useState<'front' | 'back' | null>(null);
  const [webcamMode, setWebcamMode] = useState<'idcard_front' | 'idcard_back' | null>(null);
  const [isAiDetecting, setIsAiDetecting] = useState(false);
  const [aiDetectNotification, setAiDetectNotification] = useState<string | null>(null);

  // Render state
  const [isRendering, setIsRendering] = useState(false);
  const [sheetPreviewUrl, setSheetPreviewUrl] = useState<string | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'layout' | 'dimensions' | 'styling'>('layout');

  const fileInputFrontRef = useRef<HTMLInputElement>(null);
  const fileInputBackRef = useRef<HTMLInputElement>(null);
  const fileInputAutoRef = useRef<HTMLInputElement>(null);
  const lastRenderedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Card dimensions
  const cardWidthMm = selectedPreset.id === 'dl_custom' ? settings.customWidthMm : selectedPreset.widthMm;
  const cardHeightMm = selectedPreset.id === 'dl_custom' ? settings.customHeightMm : selectedPreset.heightMm;

  // Global Clipboard Paste (Ctrl+V / Cmd+V)
  useEffect(() => {
    const handlePaste = (e: ClipboardEvent) => {
      const items = e.clipboardData?.items;
      if (!items) return;

      for (let i = 0; i < items.length; i++) {
        if (items[i].type.indexOf('image') !== -1) {
          const file = items[i].getAsFile();
          if (file) {
            const reader = new FileReader();
            reader.onload = (ev) => {
              const dataUrl = ev.target?.result as string;
              const newItem: IDCardItem = {
                id: `card-paste-${Date.now()}`,
                side: !frontCard ? 'front' : 'back',
                dataUrl,
                fileName: 'Pasted Image.jpg',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: !frontCard ? 'front' : 'back',
                detectedConfidence: 0.9,
                detectedSummary: !frontCard ? 'Pasted Front Side' : 'Pasted Back Side',
                isAmbiguous: false,
              };

              if (!frontCard) {
                setFrontCard(newItem);
                setActiveCropSide('front');
              } else {
                setBackCard(newItem);
                setActiveCropSide('back');
              }
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [frontCard]);

  // Handle auto upload with AI detection & Ambiguity handling
  const handleAutoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setIsAiDetecting(true);
    setAiDetectNotification('AI Analyzing card orientation & side features...');

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const dataUrl = await readFileAsDataUrl(file);

        // Call backend AI side detector with safe fallback
        let detectRes: any = null;
        try {
          const res = await fetch('/api/ai/detect-card-side', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ imageBase64: dataUrl }),
          });
          if (res.ok) {
            detectRes = await res.json();
          }
        } catch (fetchErr) {
          console.warn('Backend detection unavailable, using auto-slotting:', fetchErr);
        }

        if (!detectRes) {
          detectRes = {
            side: i === 0 && !frontCard ? 'front' : 'back',
            confidence: 0.9,
            summary: i === 0 && !frontCard ? 'Assigned as Front Side' : 'Assigned as Back Side',
            isAmbiguous: false,
          };
        }

        // Check if detection is ambiguous
        const isAmbiguous =
          detectRes.isAmbiguous === true ||
          detectRes.side === 'ambiguous' ||
          detectRes.side === 'unknown' ||
          (typeof detectRes.confidence === 'number' && detectRes.confidence < 0.70);

        if (isAmbiguous) {
          // Detection is ambiguous -> prompt user with manual selection UI
          setPendingDecision({
            id: `pending-${Date.now()}-${i}`,
            fileName: file.name,
            dataUrl: dataUrl,
            detectedSide: detectRes.side || 'ambiguous',
            confidence: detectRes.confidence ?? 0.5,
            isAmbiguous: true,
            reason: detectRes.ambiguityReason || 'AI could not detect a distinct portrait photograph or barcode/address with high certainty.',
            summary: detectRes.summary || 'Ambiguous card orientation',
            rotation: detectRes.suggestedRotation || 0,
          });
          setAiDetectNotification(`Detection ambiguous for "${file.name}" — Please choose Front or Back manually`);
        } else {
          // Clear high-confidence detection
          const detectedSide: 'front' | 'back' = detectRes.side === 'back' ? 'back' : 'front';
          const confidencePct = Math.round((detectRes.confidence || 0.95) * 100);

          const newItem: IDCardItem = {
            id: `card-${Date.now()}-${i}`,
            side: detectedSide,
            dataUrl: dataUrl,
            fileName: file.name,
            rotation: detectRes.suggestedRotation || 0,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            sharpness: 0,
            detectedSide: detectedSide,
            detectedConfidence: detectRes.confidence || 0.95,
            detectedSummary: detectRes.summary || `${detectedSide === 'front' ? 'Front Side (Photo)' : 'Back Side (Details)'}`,
            isAmbiguous: false,
          };

          if (detectedSide === 'front' || (i === 0 && !frontCard)) {
            setFrontCard(newItem);
          } else {
            setBackCard(newItem);
          }

          setAiDetectNotification(
            `AI Auto-Detected: ${detectedSide.toUpperCase()} SIDE (${confidencePct}% confidence)`
          );
        }
      }
    } catch (err) {
      console.error('AI Card Detect failed:', err);
      setAiDetectNotification('Auto-assigned to available card slot');
    } finally {
      setIsAiDetecting(false);
      setTimeout(() => setAiDetectNotification(null), 5000);
      if (fileInputAutoRef.current) fileInputAutoRef.current.value = '';
    }
  };

  // Manual resolution of ambiguous card
  const handleResolvePendingSide = (chosenSide: 'front' | 'back') => {
    if (!pendingDecision) return;
    const newItem: IDCardItem = {
      id: `card-${Date.now()}`,
      side: chosenSide,
      dataUrl: pendingDecision.dataUrl,
      fileName: pendingDecision.fileName,
      rotation: pendingDecision.rotation || 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      detectedSide: chosenSide,
      detectedConfidence: pendingDecision.confidence,
      detectedSummary: `Manually Selected as ${chosenSide.toUpperCase()} Side`,
      isAmbiguous: false,
    };

    if (chosenSide === 'front') {
      setFrontCard(newItem);
      setAiDetectNotification(`Manually Assigned "${pendingDecision.fileName}" as FRONT Side`);
    } else {
      setBackCard(newItem);
      setAiDetectNotification(`Manually Assigned "${pendingDecision.fileName}" as BACK Side`);
    }

    setPendingDecision(null);
    setTimeout(() => setAiDetectNotification(null), 4000);
  };

  // Test ambiguous sample button
  const handleTestAmbiguousSample = () => {
    setPendingDecision({
      id: `pending-test-${Date.now()}`,
      fileName: 'unclear_id_sample.jpg',
      dataUrl: SAMPLE_AMBIGUOUS_ID_URL,
      detectedSide: 'ambiguous',
      confidence: 0.54,
      isAmbiguous: true,
      reason: 'Low confidence (54%): Card features text only without distinct portrait photograph or barcode/magnetic stripe.',
      summary: 'Ambiguous card orientation',
      rotation: 0,
    });
    setAiDetectNotification('Ambiguity Detected: Please select Front or Back');
  };

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Dedicated Front Side Upload
  const handleFrontUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setFrontCard({
      id: `front-${Date.now()}`,
      side: 'front',
      dataUrl,
      fileName: file.name,
      rotation: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      detectedSide: 'front',
      detectedConfidence: 1.0,
      detectedSummary: 'Front Side (Manual Upload)',
      isAmbiguous: false,
    });
    if (fileInputFrontRef.current) fileInputFrontRef.current.value = '';
  };

  // Dedicated Back Side Upload
  const handleBackUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await readFileAsDataUrl(file);
    setBackCard({
      id: `back-${Date.now()}`,
      side: 'back',
      dataUrl,
      fileName: file.name,
      rotation: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      detectedSide: 'back',
      detectedConfidence: 1.0,
      detectedSummary: 'Back Side (Manual Upload)',
      isAmbiguous: false,
    });
    if (fileInputBackRef.current) fileInputBackRef.current.value = '';
  };

  // Swap Front and Back Cards
  const handleSwapSides = () => {
    const tempFront = frontCard ? { ...frontCard, side: 'back' as const } : null;
    const tempBack = backCard ? { ...backCard, side: 'front' as const } : null;
    setFrontCard(tempBack);
    setBackCard(tempFront);
    setAiDetectNotification('Swapped Front & Back sides');
    setTimeout(() => setAiDetectNotification(null), 2500);
  };

  // Switch a single card's side manually ("Choose Me")
  const handleManualSideToggle = (which: 'front' | 'back') => {
    if (which === 'front' && frontCard) {
      // Move current front to back
      setBackCard({ ...frontCard, side: 'back' });
      setFrontCard(backCard ? { ...backCard, side: 'front' } : null);
      setAiDetectNotification('Moved card to BACK slot');
    } else if (which === 'back' && backCard) {
      // Move current back to front
      setFrontCard({ ...backCard, side: 'front' });
      setBackCard(frontCard ? { ...frontCard, side: 'back' } : null);
      setAiDetectNotification('Moved card to FRONT slot');
    }
    setTimeout(() => setAiDetectNotification(null), 2500);
  };

  // Re-render sheet when cards, presets, or settings change
  useEffect(() => {
    let isMounted = true;
    const renderCanvas = async () => {
      setIsRendering(true);
      try {
        const processedFrontUrl = frontCard
          ? await processIDCardItem(frontCard, cardWidthMm, cardHeightMm, settings.cornerRadiusMm)
          : null;

        const processedBackUrl = backCard
          ? await processIDCardItem(backCard, cardWidthMm, cardHeightMm, settings.cornerRadiusMm)
          : null;

        if (isMounted) {
          const sheetCanvas = await renderIDCardSheetCanvas(
            processedFrontUrl,
            processedBackUrl,
            selectedPaper,
            settings,
            cardWidthMm,
            cardHeightMm
          );
          lastRenderedCanvasRef.current = sheetCanvas;
          setSheetPreviewUrl(sheetCanvas.toDataURL('image/jpeg', 0.92));
        }
      } catch (err) {
        console.error('ID Card render error:', err);
      } finally {
        if (isMounted) setIsRendering(false);
      }
    };

    renderCanvas();

    return () => {
      isMounted = false;
    };
  }, [frontCard, backCard, selectedPreset, selectedPaper, settings, cardWidthMm, cardHeightMm]);

  // Direct Print
  const handlePrintSheet = () => {
    if (!lastRenderedCanvasRef.current) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const dataUrl = lastRenderedCanvasRef.current.toDataURL('image/jpeg', 0.98);
    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print ID Card Sheet</title>
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

  // PDF Export (Standard Sheet or 2-Page Duplex)
  const handleExportPDF = async () => {
    if (!lastRenderedCanvasRef.current) return;

    if (settings.layoutMode === 'duplex_pages' && frontCard && backCard) {
      // Generate 2-page duplex PDF
      const frontOnlyCanvas = await renderIDCardSheetCanvas(
        await processIDCardItem(frontCard, cardWidthMm, cardHeightMm, settings.cornerRadiusMm),
        null,
        selectedPaper,
        { ...settings, layoutMode: 'side_by_side' },
        cardWidthMm,
        cardHeightMm
      );
      const backOnlyCanvas = await renderIDCardSheetCanvas(
        null,
        await processIDCardItem(backCard, cardWidthMm, cardHeightMm, settings.cornerRadiusMm),
        selectedPaper,
        { ...settings, layoutMode: 'side_by_side' },
        cardWidthMm,
        cardHeightMm
      );

      await exportDuplexIDCardPDF(
        frontOnlyCanvas,
        backOnlyCanvas,
        selectedPaper,
        `duplex_id_card_${cardWidthMm}x${cardHeightMm}mm.pdf`
      );
    } else {
      exportToPDF(
        lastRenderedCanvasRef.current,
        selectedPaper,
        `id_card_${settings.layoutMode}_${cardWidthMm}x${cardHeightMm}mm_${selectedPaper.id}.pdf`
      );
    }
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
      {/* Title & Intro */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-5 rounded-2xl border border-white/10 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
              Dedicated Page
            </span>
            <h1 className="text-xl font-bold text-white">
              ID Card & Badge Studio
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Auto front & back side AI detection, CR-80 sizing, foldable laminating layouts, and multi-card A4 printing.
          </p>
        </div>

        {/* Quick Sample / Reset buttons */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setPendingDecision(null);
              setFrontCard({
                id: 'f-sample',
                side: 'front',
                dataUrl: SAMPLE_ID_FRONT_URL,
                fileName: 'sample_id_front.jpg',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'front',
                detectedConfidence: 0.98,
                detectedSummary: 'Front Side (Portrait & ID)',
                isAmbiguous: false,
              });
              setBackCard({
                id: 'b-sample',
                side: 'back',
                dataUrl: SAMPLE_ID_BACK_URL,
                fileName: 'sample_id_back.jpg',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'back',
                detectedConfidence: 0.95,
                detectedSummary: 'Back Side (Address & Barcode)',
                isAmbiguous: false,
              });
              setAiDetectNotification('Loaded standard sample front and back ID cards');
              setTimeout(() => setAiDetectNotification(null), 3000);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Load Sample ID
          </button>

          <button
            onClick={handleTestAmbiguousSample}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 hover:text-amber-200 text-xs font-medium border border-amber-500/30 transition-all"
            title="Simulate an upload with ambiguous features to test the manual selection interface"
          >
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            Simulate Ambiguous Upload
          </button>
        </div>
      </div>

      {/* Main Grid: Upload & Side Detector Left, Settings & Sheet Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col (5 Cols): Upload, Side Switcher, Crop */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Smart Upload Area with AI Side Detection */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                1. Upload ID Card (Front & Back)
              </h2>
              {isAiDetecting && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-pulse">
                  <Sparkles className="w-3.5 h-3.5 animate-spin" />
                  AI Detecting Sides...
                </span>
              )}
            </div>

            {/* Smart Dual/Auto Upload Dropzone */}
            <input
              type="file"
              ref={fileInputAutoRef}
              onChange={handleAutoUpload}
              multiple
              accept="image/*"
              className="hidden"
            />
            <div
              onClick={() => fileInputAutoRef.current?.click()}
              className="border-2 border-dashed border-emerald-500/30 hover:border-emerald-400/60 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
            >
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-300 block">
                  Drop ID Card Images Here (Auto-Detects Front & Back)
                </span>
                <span className="text-[11px] text-emerald-400/80 block mt-0.5">
                  AI automatically classifies Front vs Back. If detection is ambiguous, manual selection options appear immediately.
                </span>
              </div>
            </div>

            {/* AI Status Notification */}
            {aiDetectNotification && (
              <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{aiDetectNotification}</span>
              </div>
            )}

            {/* Ambiguity Resolution Banner / Manual Option */}
            {pendingDecision && (
              <div className="p-4 rounded-2xl bg-amber-500/15 border-2 border-amber-500/40 space-y-3 animate-fade-in shadow-xl">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-xl bg-amber-500/25 text-amber-300 flex items-center justify-center shrink-0 border border-amber-400/30">
                      <HelpCircle className="w-5 h-5" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-xs font-bold text-amber-200 uppercase tracking-wide">
                          Ambiguous Card Side Detected
                        </h3>
                        <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-400/20 text-amber-300 font-mono">
                          {Math.round(pendingDecision.confidence * 100)}% Confidence
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-300 mt-0.5 leading-relaxed">
                        {pendingDecision.reason || 'Could not verify whether this image is the Front or Back side.'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={() => setPendingDecision(null)}
                    className="text-slate-400 hover:text-white p-1 rounded-lg hover:bg-white/10 transition-colors"
                    title="Dismiss"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                {/* Ambiguous Image Preview & Manual Select Buttons */}
                <div className="flex flex-col sm:flex-row items-center gap-3 pt-1">
                  <div className="relative w-24 h-16 rounded-xl bg-slate-900 border border-white/15 overflow-hidden shrink-0 shadow-inner">
                    <img
                      src={pendingDecision.dataUrl}
                      alt="Ambiguous Card"
                      className="w-full h-full object-cover"
                    />
                    <span className="absolute bottom-0.5 left-0.5 right-0.5 bg-black/80 text-amber-300 text-[8px] font-mono px-1 py-0.5 rounded truncate text-center">
                      {pendingDecision.fileName}
                    </span>
                  </div>

                  <div className="flex-1 w-full flex flex-col gap-1.5">
                    <span className="text-[11px] font-medium text-slate-300">
                      Please choose which side this card represents:
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        onClick={() => handleResolvePendingSide('front')}
                        className="py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-blue-900/40 border border-blue-400/40 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        Set as FRONT Side
                      </button>
                      <button
                        onClick={() => handleResolvePendingSide('back')}
                        className="py-2 px-3 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-lg shadow-amber-900/40 border border-amber-400/40 transition-all hover:scale-[1.02] active:scale-95"
                      >
                        <Layers className="w-3.5 h-3.5" />
                        Set as BACK Side
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Side-by-Side Cards Slots with Manual Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Front Card Slot */}
              <div className="bg-black/30 p-3 rounded-xl border border-white/10 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1">
                    <CreditCard className="w-3 h-3 text-blue-400" />
                    FRONT SIDE
                  </span>
                  {frontCard && (
                    <button
                      onClick={() => setFrontCard(null)}
                      className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                      title="Clear front card"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Manual Side Segmented Switcher for Front Slot */}
                {frontCard && (
                  <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 text-[10px]">
                    <span className="flex-1 py-1 px-1.5 rounded text-center font-bold bg-blue-500/30 text-blue-300 border border-blue-500/40 flex items-center justify-center gap-1">
                      <Check className="w-3 h-3 text-blue-300" /> Front Side
                    </span>
                    <button
                      onClick={() => handleManualSideToggle('front')}
                      className="flex-1 py-1 px-1.5 rounded text-center text-slate-400 hover:text-amber-300 hover:bg-white/5 transition-all"
                      title="Switch this card to Back slot"
                    >
                      Move to Back ➔
                    </button>
                  </div>
                )}

                <div className="relative w-full h-24 bg-slate-900 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center">
                  {frontCard ? (
                    <img
                      src={frontCard.dataUrl}
                      alt="Front Card"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <span className="text-[11px] text-slate-500 block">No Front Image</span>
                      <span className="text-[9px] text-slate-600 block mt-0.5">Upload or auto-assign</span>
                    </div>
                  )}
                  {frontCard?.detectedSide && (
                    <span className="absolute bottom-1 left-1 right-1 bg-black/85 text-slate-200 text-[9px] px-1.5 py-0.5 rounded font-mono border border-white/10 truncate">
                      {frontCard.isAmbiguous ? '⚠️ Manual Front' : frontCard.detectedSummary || 'Front'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={fileInputFrontRef}
                    onChange={handleFrontUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputFrontRef.current?.click()}
                    className="flex-1 py-1 px-2 rounded-lg glass-card hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-medium transition-colors"
                  >
                    Upload Front
                  </button>
                  <button
                    onClick={() => setWebcamMode('idcard_front')}
                    className="p-1 rounded-lg glass-card hover:bg-white/10 border border-white/10 text-slate-300 text-[11px]"
                    title="Camera capture"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  {frontCard && (
                    <>
                      <button
                        onClick={() => setActiveCropSide('front')}
                        className="p-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-[11px]"
                        title="Crop Front"
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setBgRemovalSide('front')}
                        className="p-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-[11px]"
                        title="Remove / Replace Background"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Back Card Slot */}
              <div className="bg-black/30 p-3 rounded-xl border border-white/10 flex flex-col justify-between space-y-2">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30 flex items-center gap-1">
                    <Layers className="w-3 h-3 text-amber-400" />
                    BACK SIDE
                  </span>
                  {backCard && (
                    <button
                      onClick={() => setBackCard(null)}
                      className="text-[10px] text-slate-500 hover:text-red-400 transition-colors"
                      title="Clear back card"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* Manual Side Segmented Switcher for Back Slot */}
                {backCard && (
                  <div className="flex items-center bg-black/50 p-0.5 rounded-lg border border-white/10 text-[10px]">
                    <button
                      onClick={() => handleManualSideToggle('back')}
                      className="flex-1 py-1 px-1.5 rounded text-center text-slate-400 hover:text-blue-300 hover:bg-white/5 transition-all"
                      title="Switch this card to Front slot"
                    >
                      ➔ Move to Front
                    </button>
                    <span className="flex-1 py-1 px-1.5 rounded text-center font-bold bg-amber-500/30 text-amber-300 border border-amber-500/40 flex items-center justify-center gap-1">
                      <Check className="w-3 h-3 text-amber-300" /> Back Side
                    </span>
                  </div>
                )}

                <div className="relative w-full h-24 bg-slate-900 rounded-lg border border-white/10 overflow-hidden flex items-center justify-center">
                  {backCard ? (
                    <img
                      src={backCard.dataUrl}
                      alt="Back Card"
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="text-center p-2">
                      <span className="text-[11px] text-slate-500 block">No Back Image</span>
                      <span className="text-[9px] text-slate-600 block mt-0.5">Upload or auto-assign</span>
                    </div>
                  )}
                  {backCard?.detectedSide && (
                    <span className="absolute bottom-1 left-1 right-1 bg-black/85 text-slate-200 text-[9px] px-1.5 py-0.5 rounded font-mono border border-white/10 truncate">
                      {backCard.isAmbiguous ? '⚠️ Manual Back' : backCard.detectedSummary || 'Back'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-1.5">
                  <input
                    type="file"
                    ref={fileInputBackRef}
                    onChange={handleBackUpload}
                    accept="image/*"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputBackRef.current?.click()}
                    className="flex-1 py-1 px-2 rounded-lg glass-card hover:bg-white/10 border border-white/10 text-slate-300 text-[11px] font-medium transition-colors"
                  >
                    Upload Back
                  </button>
                  <button
                    onClick={() => setWebcamMode('idcard_back')}
                    className="p-1 rounded-lg glass-card hover:bg-white/10 border border-white/10 text-slate-300 text-[11px]"
                    title="Camera capture"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                  {backCard && (
                    <>
                      <button
                        onClick={() => setActiveCropSide('back')}
                        className="p-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[11px]"
                        title="Crop Back"
                      >
                        <Crop className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => setBgRemovalSide('back')}
                        className="p-1 rounded-lg bg-purple-500/20 hover:bg-purple-500/30 border border-purple-500/30 text-purple-300 text-[11px]"
                        title="Remove / Replace Background"
                      >
                        <Wand2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* 1-Click Swap Button */}
            <button
              onClick={handleSwapSides}
              className="w-full py-2 px-3 rounded-xl glass-card hover:bg-white/10 text-slate-300 hover:text-white text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 transition-colors"
            >
              <ArrowLeftRight className="w-3.5 h-3.5 text-blue-400" />
              Swap Front & Back Sides
            </button>
          </div>

          {/* Card 2: Output Settings for ID Card */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
            <div className="flex bg-black/30 p-1 rounded-xl border border-white/10">
              <button
                onClick={() => setActiveSettingsTab('layout')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeSettingsTab === 'layout'
                    ? 'bg-white/15 text-white shadow-sm border border-white/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Card Layout Mode
              </button>
              <button
                onClick={() => setActiveSettingsTab('dimensions')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeSettingsTab === 'dimensions'
                    ? 'bg-white/15 text-white shadow-sm border border-white/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                ID Standard & Paper
              </button>
              <button
                onClick={() => setActiveSettingsTab('styling')}
                className={`flex-1 py-1.5 text-xs font-semibold rounded-lg transition-colors ${
                  activeSettingsTab === 'styling'
                    ? 'bg-white/15 text-white shadow-sm border border-white/15'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Lamination & Cuts
              </button>
            </div>

            {/* Tab: Layout Modes */}
            {activeSettingsTab === 'layout' && (
              <div className="space-y-3">
                <label className="block text-xs font-semibold text-slate-300">
                  Select Output Print Arrangement
                </label>
                <div className="space-y-2">
                  {[
                    {
                      id: 'side_by_side',
                      title: 'Side-by-Side (Horizontal)',
                      desc: 'Front and Back side placed side-by-side with cut guidelines.',
                    },
                    {
                      id: 'stacked',
                      title: 'Vertical Stacked',
                      desc: 'Front on top, Back on bottom.',
                    },
                    {
                      id: 'foldable',
                      title: 'Foldable Card (With Fold Mark ✀)',
                      desc: 'Joined along edge to fold into a double-sided card for laminating.',
                    },
                    {
                      id: 'grid_multi',
                      title: 'Multi-Copy A4 Sheet (2 or 4 pairs)',
                      desc: 'Multiple copies of Front + Back pairs filling the A4 page.',
                    },
                    {
                      id: 'duplex_pages',
                      title: 'Duplex Double-Sided PDF (2 Pages)',
                      desc: 'Page 1 Front, Page 2 Back with matching flip registration marks.',
                    },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      onClick={() =>
                        setSettings((prev) => ({
                          ...prev,
                          layoutMode: mode.id as any,
                        }))
                      }
                      className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all ${
                        settings.layoutMode === mode.id
                          ? 'border-emerald-500/60 bg-emerald-500/15 text-white font-semibold ring-1 ring-emerald-500/30'
                          : 'border-white/10 hover:bg-white/5 text-slate-300'
                      }`}
                    >
                      <div className="font-semibold text-slate-200">{mode.title}</div>
                      <div className="text-[11px] text-slate-400">{mode.desc}</div>
                    </button>
                  ))}
                </div>

                {settings.layoutMode === 'grid_multi' && (
                  <div className="pt-2 space-y-2 border-t border-white/10">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-medium text-slate-300">
                        Manual ID Card Pairs on Sheet
                      </label>
                      <span className="text-xs font-mono font-bold text-emerald-300 bg-emerald-500/20 px-2 py-0.5 rounded-full border border-emerald-500/30">
                        {settings.cardsCount} Pair{settings.cardsCount > 1 ? 's' : ''} ({(settings.cardsCount || 1) * 2} Cards)
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            cardsCount: Math.max(1, (prev.cardsCount || 1) - 1),
                          }))
                        }
                        disabled={(settings.cardsCount || 1) <= 1}
                        className="p-1.5 rounded-lg glass-card hover:bg-white/10 disabled:opacity-25 text-white border border-white/10"
                      >
                        <Minus className="w-3.5 h-3.5" />
                      </button>

                      <input
                        type="number"
                        min={1}
                        max={6}
                        value={settings.cardsCount || 1}
                        onChange={(e) => {
                          const val = parseInt(e.target.value, 10);
                          if (!isNaN(val)) {
                            setSettings((prev) => ({
                              ...prev,
                              cardsCount: Math.max(1, Math.min(val, 6)),
                            }));
                          }
                        }}
                        className="w-16 text-center py-1 bg-black/60 border border-emerald-500/40 rounded-lg text-xs font-bold text-white focus:outline-none focus:ring-1 focus:ring-emerald-400"
                      />

                      <button
                        type="button"
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            cardsCount: Math.min(6, (prev.cardsCount || 1) + 1),
                          }))
                        }
                        disabled={(settings.cardsCount || 1) >= 6}
                        className="p-1.5 rounded-lg glass-card hover:bg-white/10 disabled:opacity-25 text-white border border-white/10"
                      >
                        <Plus className="w-3.5 h-3.5" />
                      </button>

                      <div className="flex gap-1 ml-auto">
                        {[1, 2, 4].map((cnt) => (
                          <button
                            key={cnt}
                            type="button"
                            onClick={() => setSettings((prev) => ({ ...prev, cardsCount: cnt }))}
                            className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                              settings.cardsCount === cnt
                                ? 'bg-emerald-600 text-white border-emerald-500 accent-glow-emerald font-bold'
                                : 'glass-card text-slate-300 border-white/10 hover:bg-white/5'
                            }`}
                          >
                            {cnt}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab: ID Standard & Paper */}
            {activeSettingsTab === 'dimensions' && (
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    ID Card Standard Dimension
                  </label>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {ID_CARD_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => {
                          setSelectedPreset(preset);
                          setSettings((prev) => ({
                            ...prev,
                            presetId: preset.id,
                            customWidthMm: preset.widthMm,
                            customHeightMm: preset.heightMm,
                            cornerRadiusMm: preset.cornerRadiusMm,
                          }));
                        }}
                        className={`w-full text-left p-2.5 rounded-xl border text-xs transition-all flex items-center justify-between ${
                          selectedPreset.id === preset.id
                            ? 'border-emerald-500/60 bg-emerald-500/15 text-white font-semibold ring-1 ring-emerald-500/30'
                            : 'border-white/10 hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <div>
                          <div className="font-semibold text-slate-200">{preset.name}</div>
                          <div className="text-[10px] text-slate-400">{preset.standard}</div>
                        </div>
                        <span className="text-[11px] font-mono bg-black/40 text-slate-300 px-2 py-0.5 rounded border border-white/10 shrink-0">
                          {preset.widthMm} × {preset.heightMm} mm
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                    Output Sheet Paper Size
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {PAPER_SIZES.slice(0, 4).map((paper) => (
                      <button
                        key={paper.id}
                        onClick={() => setSelectedPaper(paper)}
                        className={`p-2 rounded-xl border text-left text-xs transition-all ${
                          selectedPaper.id === paper.id
                            ? 'border-emerald-500/60 bg-emerald-500/15 text-white font-semibold ring-1 ring-emerald-500/30'
                            : 'border-white/10 hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <div className="font-medium text-slate-200">{paper.name}</div>
                        <div className="text-[10px] text-slate-400">{paper.widthMm}×{paper.heightMm}mm</div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Tab: Lamination & Cuts */}
            {activeSettingsTab === 'styling' && (
              <div className="space-y-3.5">
                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Laminating Pouch Margin</span>
                    <span className="text-slate-300 font-mono">{settings.laminateMarginMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="8"
                    step="1"
                    value={settings.laminateMarginMm}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        laminateMarginMm: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div>
                  <div className="flex justify-between text-xs text-slate-400 mb-1">
                    <span>Corner Radius (CR-80 standard = 3.18mm)</span>
                    <span className="text-slate-300 font-mono">{settings.cornerRadiusMm} mm</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="6"
                    step="0.5"
                    value={settings.cornerRadiusMm}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        cornerRadiusMm: Number(e.target.value),
                      }))
                    }
                    className="w-full accent-emerald-500"
                  />
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-white/10">
                  <label className="text-xs font-medium text-slate-300">
                    Show Corner Cutting Marks
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.showCuttingMarks}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        showCuttingMarks: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-emerald-600 rounded bg-black/40 border-white/20"
                  />
                </div>

                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium text-slate-300">
                    Include Print Header Banner
                  </label>
                  <input
                    type="checkbox"
                    checked={settings.includeDetailsHeader}
                    onChange={(e) =>
                      setSettings((prev) => ({
                        ...prev,
                        includeDetailsHeader: e.target.checked,
                      }))
                    }
                    className="w-4 h-4 text-emerald-600 rounded bg-black/40 border-white/20"
                  />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Col (7 Cols): Live Canvas Preview & Print/Export */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg flex flex-col items-center">
            {/* Sheet Actions Header */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  ID Card Print Sheet Preview
                </span>
                <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-semibold px-2.5 py-0.5 rounded-full">
                  {settings.layoutMode.replace('_', ' ').toUpperCase()}
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
                  onClick={handleExportPDF}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold accent-glow-emerald transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  {settings.layoutMode === 'duplex_pages' ? 'Download Duplex PDF' : 'Download 300 DPI PDF'}
                </button>
              </div>
            </div>

            {/* High Res Canvas Visualizer */}
            <div className="w-full my-4 p-4 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 overflow-auto min-h-[440px]">
              {isRendering ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-emerald-400" />
                  <span className="text-xs font-medium">Rendering ID Card Sheet...</span>
                </div>
              ) : sheetPreviewUrl ? (
                <div className="shadow-2xl border border-white/20 bg-white rounded-xs p-1 max-w-[500px]">
                  <img
                    src={sheetPreviewUrl}
                    alt="ID Card Print Sheet"
                    className="w-full h-auto object-contain block"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-500">Upload Front and Back side to preview</span>
              )}
            </div>

            {/* Footer Summary */}
            <div className="w-full flex flex-wrap items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
              <div className="flex items-center gap-4">
                <span>
                  Paper: <strong className="text-slate-200">{selectedPaper.name}</strong> ({selectedPaper.widthMm} × {selectedPaper.heightMm} mm)
                </span>
                <span>
                  Card: <strong className="text-slate-200">{cardWidthMm} × {cardHeightMm} mm</strong>
                </span>
              </div>
              <span className="text-emerald-400 font-medium">
                ✓ Ready for 100% scale PVC laminating & cutting
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ID Card Crop Modal */}
      {activeCropSide && (
        <IDCardCropModal
          isOpen={!!activeCropSide}
          onClose={() => setActiveCropSide(null)}
          imageSrc={activeCropSide === 'front' ? frontCard?.dataUrl || '' : backCard?.dataUrl || ''}
          side={activeCropSide}
          preset={selectedPreset}
          customWidthMm={settings.customWidthMm}
          customHeightMm={settings.customHeightMm}
          initialCropBox={activeCropSide === 'front' ? frontCard?.cropBox : backCard?.cropBox}
          initialCorners={activeCropSide === 'front' ? frontCard?.quadCorners : backCard?.quadCorners}
          onApplyCrop={(newBox, newCorners) => {
            if (activeCropSide === 'front' && frontCard) {
              setFrontCard({ ...frontCard, cropBox: newBox, quadCorners: newCorners });
            } else if (activeCropSide === 'back' && backCard) {
              setBackCard({ ...backCard, cropBox: newBox, quadCorners: newCorners });
            }
          }}
        />
      )}

      {/* Background Removal Modal */}
      {bgRemovalSide && (
        <BackgroundRemovalModal
          isOpen={!!bgRemovalSide}
          onClose={() => setBgRemovalSide(null)}
          imageSrc={bgRemovalSide === 'front' ? frontCard?.dataUrl || '' : backCard?.dataUrl || ''}
          onApply={(newImage) => {
            if (bgRemovalSide === 'front' && frontCard) {
              setFrontCard({ ...frontCard, dataUrl: newImage, cropBox: undefined });
            } else if (bgRemovalSide === 'back' && backCard) {
              setBackCard({ ...backCard, dataUrl: newImage, cropBox: undefined });
            }
          }}
        />
      )}

      {/* Webcam Modal */}
      {webcamMode && (
        <WebcamModal
          isOpen={!!webcamMode}
          onClose={() => setWebcamMode(null)}
          onCapture={(dataUrl) => {
            if (webcamMode === 'idcard_front') {
              setFrontCard({
                id: `front-${Date.now()}`,
                side: 'front',
                dataUrl,
                fileName: 'webcam_front.jpg',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'front',
                detectedSummary: 'Front Side (Camera)',
              });
            } else {
              setBackCard({
                id: `back-${Date.now()}`,
                side: 'back',
                dataUrl,
                fileName: 'webcam_back.jpg',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'back',
                detectedSummary: 'Back Side (Camera)',
              });
            }
            setWebcamMode(null);
          }}
          mode={webcamMode}
        />
      )}
    </div>
  );
};
