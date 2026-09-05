import React, { useState, useEffect, useRef } from 'react';
import {
  IDCardPreset,
  IDCardSettings,
  PaperSizeConfig,
  IDCardItem,
} from '../types';
import {
  ID_CARD_PRESETS,
  PAPER_SIZES,
  SAMPLE_ID_FRONT_URL,
  SAMPLE_ID_BACK_URL,
  SAMPLE_AADHAAR_FRONT_URL,
  SAMPLE_AADHAAR_BACK_URL,
  SAMPLE_PAN_CARD_URL,
  SAMPLE_VOTER_ID_FRONT_URL,
  SAMPLE_VOTER_ID_BACK_URL,
} from '../data/presets';
import {
  processIDCardItem,
  renderIDCardSheetCanvas,
  exportToPDF,
  exportDuplexIDCardPDF,
  exportToJPG,
} from '../utils/imageProcessing';
import {
  detectAndExtractCardsFromPdf,
  PdfPasswordRequiredError,
  ExtractedCard,
  RenderedPdfPage,
} from '../utils/pdfProcessor';
import { IDCardCropModal } from './IDCardCropModal';
import { WebcamModal } from './WebcamModal';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';
import { PdfPasswordModal } from './PdfPasswordModal';
import { PdfCardResultModal } from './PdfCardResultModal';
import { IDCardOrientationModal } from './IDCardOrientationModal';
import {
  Upload,
  Camera,
  Crop,
  Printer,
  Download,
  FileImage,
  CreditCard,
  ArrowLeftRight,
  Layers,
  CheckCircle2,
  RefreshCw,
  Sliders,
  Scissors,
  FileCheck,
  ShieldCheck,
  Check,
  X,
  Wand2,
  Plus,
  Minus,
  FileText,
  FileBadge,
  Lock,
} from 'lucide-react';

import confetti from 'canvas-confetti';

export const IDCardStudio: React.FC = () => {
  // Front & Back Card Items
  const [frontCard, setFrontCard] = useState<IDCardItem | null>({
    id: 'front-1',
    side: 'front',
    dataUrl: SAMPLE_AADHAAR_FRONT_URL,
    fileName: 'aadhaar_card_front.jpg',
    rotation: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
    detectedSide: 'front',
    detectedConfidence: 0.98,
    detectedSummary: 'Aadhaar Front (Photo, Name & UID)',
    isAmbiguous: false,
  });

  const [backCard, setBackCard] = useState<IDCardItem | null>({
    id: 'back-1',
    side: 'back',
    dataUrl: SAMPLE_AADHAAR_BACK_URL,
    fileName: 'aadhaar_card_back.jpg',
    rotation: 0,
    brightness: 0,
    contrast: 0,
    saturation: 0,
    sharpness: 0,
    detectedSide: 'back',
    detectedConfidence: 0.97,
    detectedSummary: 'Aadhaar Back (Address & Secure QR)',
    isAmbiguous: false,
  });

  // PDF Processing & Password Modals State
  const [pdfPasswordModalOpen, setPdfPasswordModalOpen] = useState(false);
  const [pdfPendingFile, setPdfPendingFile] = useState<File | null>(null);
  const [pdfPasswordError, setPdfPasswordError] = useState<string | null>(null);
  const [pdfIsProcessing, setPdfIsProcessing] = useState(false);
  const [pdfResultModalOpen, setPdfResultModalOpen] = useState(false);
  const [pdfDetectionResult, setPdfDetectionResult] = useState<{
    documentType: string;
    documentTitle: string;
    frontCard?: ExtractedCard;
    backCard?: ExtractedCard;
    allCards: ExtractedCard[];
    renderedPages: RenderedPdfPage[];
  } | null>(null);

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
  const [isOrientationModalOpen, setIsOrientationModalOpen] = useState(false);

  // Render state
  const [isRendering, setIsRendering] = useState(false);
  const [sheetPreviewUrl, setSheetPreviewUrl] = useState<string | null>(null);
  const [activeSettingsTab, setActiveSettingsTab] = useState<'layout' | 'dimensions' | 'styling'>('layout');
  const [isDraggingGlobal, setIsDraggingGlobal] = useState(false);
  const [isDraggingAuto, setIsDraggingAuto] = useState(false);
  const [isDraggingFront, setIsDraggingFront] = useState(false);
  const [isDraggingBack, setIsDraggingBack] = useState(false);

  const fileInputFrontRef = useRef<HTMLInputElement>(null);
  const fileInputBackRef = useRef<HTMLInputElement>(null);
  const fileInputAutoRef = useRef<HTMLInputElement>(null);
  const lastRenderedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Card dimensions taking orientation (Landscape vs Portrait) into account
  const baseWidth = selectedPreset.id === 'dl_custom' ? settings.customWidthMm : selectedPreset.widthMm;
  const baseHeight = selectedPreset.id === 'dl_custom' ? settings.customHeightMm : selectedPreset.heightMm;

  const cardWidthMm = settings.orientation === 'portrait'
    ? Math.min(baseWidth, baseHeight)
    : Math.max(baseWidth, baseHeight);
  const cardHeightMm = settings.orientation === 'portrait'
    ? Math.max(baseWidth, baseHeight)
    : Math.min(baseWidth, baseHeight);

  // Orientation switch handler
  const handleOrientationChange = (orientation: 'landscape' | 'portrait') => {
    setSettings((prev) => {
      const w = prev.customWidthMm || 85.6;
      const h = prev.customHeightMm || 53.98;
      const newWidth = orientation === 'portrait' ? Math.min(w, h) : Math.max(w, h);
      const newHeight = orientation === 'portrait' ? Math.max(w, h) : Math.min(w, h);

      return {
        ...prev,
        orientation,
        customWidthMm: newWidth,
        customHeightMm: newHeight,
      };
    });
    setAiDetectNotification(
      `✓ ID Card Orientation set to ${
        orientation === 'landscape' ? 'Horizontal (Landscape)' : 'Vertical (Portrait)'
      }`
    );
    setTimeout(() => setAiDetectNotification(null), 3500);
  };

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

  const readFileAsDataUrl = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (ev) => resolve(ev.target?.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  // Helper to load single file directly into front or back
  const handleFrontFile = async (file: File) => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      handlePdfFile(file, undefined, 'front');
      return;
    }
    if (!file.type.startsWith('image/')) return;
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
      detectedSummary: 'Front Side (Direct Upload)',
      isAmbiguous: false,
    });
    if (fileInputFrontRef.current) fileInputFrontRef.current.value = '';
  };

  const handleBackFile = async (file: File) => {
    if (file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      handlePdfFile(file, undefined, 'back');
      return;
    }
    if (!file.type.startsWith('image/')) return;
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
      detectedSummary: 'Back Side (Direct Upload)',
      isAmbiguous: false,
    });
    if (fileInputBackRef.current) fileInputBackRef.current.value = '';
  };

  // Handle PDF file loading and rendering (Aadhaar, PAN, Voter ID, License)
  const handlePdfFile = async (
    file: File,
    password?: string,
    targetSlot: 'auto' | 'front' | 'back' = 'auto'
  ) => {
    setPdfIsProcessing(true);
    setPdfPasswordError(null);
    setAiDetectNotification('Processing PDF: Rendering high-definition pages in 300 DPI...');

    try {
      const result = await detectAndExtractCardsFromPdf(file, {
        password,
        onProgress: (msg) => setAiDetectNotification(msg),
      });

      if (!result.success || (!result.frontCard && !result.backCard && result.renderedPages.length === 0)) {
        setAiDetectNotification('Could not extract pages from PDF. Please check file format.');
        return;
      }

      setPdfDetectionResult(result);

      if (targetSlot === 'front') {
        const cardToUse = result.frontCard || (result.renderedPages[0] ? {
          id: `card-pdf-front-${Date.now()}`,
          side: 'front' as const,
          dataUrl: result.renderedPages[0].dataUrl,
          confidence: 1.0,
          summary: 'PDF Front Page',
          documentType: result.documentType,
          pageNumber: 1,
          boundingBox: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 },
          qualityIssues: { is_blurry: false, has_glare: false, is_partially_cut: false }
        } : null);

        if (cardToUse) {
          setFrontCard({
            id: `card-pdf-front-${Date.now()}`,
            side: 'front',
            dataUrl: cardToUse.dataUrl,
            fileName: `${file.name} (Front)`,
            rotation: 0,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            sharpness: 0,
            detectedSide: 'front',
            detectedConfidence: 1.0,
            detectedSummary: `${result.documentTitle || 'ID'} Front Side`,
            isAmbiguous: false,
          });
        }
      } else if (targetSlot === 'back') {
        const cardToUse = result.backCard || (result.renderedPages[0] ? {
          id: `card-pdf-back-${Date.now()}`,
          side: 'back' as const,
          dataUrl: result.renderedPages[0].dataUrl,
          confidence: 1.0,
          summary: 'PDF Back Page',
          documentType: result.documentType,
          pageNumber: 1,
          boundingBox: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 },
          qualityIssues: { is_blurry: false, has_glare: false, is_partially_cut: false }
        } : null);

        if (cardToUse) {
          setBackCard({
            id: `card-pdf-back-${Date.now()}`,
            side: 'back',
            dataUrl: cardToUse.dataUrl,
            fileName: `${file.name} (Back)`,
            rotation: 0,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            sharpness: 0,
            detectedSide: 'back',
            detectedConfidence: 1.0,
            detectedSummary: `${result.documentTitle || 'ID'} Back Side`,
            isAmbiguous: false,
          });
        }
      } else {
        // Auto slot both
        if (result.frontCard) {
          setFrontCard({
            id: `card-pdf-front-${Date.now()}`,
            side: 'front',
            dataUrl: result.frontCard.dataUrl,
            fileName: `${file.name} (Front)`,
            rotation: 0,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            sharpness: 0,
            detectedSide: 'front',
            detectedConfidence: 1.0,
            detectedSummary: 'PDF Front Page',
            isAmbiguous: false,
          });
        }

        if (result.backCard) {
          setBackCard({
            id: `card-pdf-back-${Date.now()}`,
            side: 'back',
            dataUrl: result.backCard.dataUrl,
            fileName: `${file.name} (Back)`,
            rotation: 0,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            sharpness: 0,
            detectedSide: 'back',
            detectedConfidence: 1.0,
            detectedSummary: 'PDF Back Page',
            isAmbiguous: false,
          });
        }

        // Open result confirmation preview
        setPdfResultModalOpen(true);
      }

      // Close password modal if open
      setPdfPasswordModalOpen(false);
      setPdfPendingFile(null);

      const docName = result.documentTitle || 'PDF Document';
      setAiDetectNotification(
        `✨ Loaded ${docName}: Ready for manual cropping & printing!`
      );
      confetti({ particleCount: 50, spread: 70, origin: { y: 0.6 } });
    } catch (err: any) {
      if (err instanceof PdfPasswordRequiredError || err?.name === 'PdfPasswordRequiredError') {
        setPdfPendingFile(file);
        setPdfPasswordModalOpen(true);
        if (password) {
          setPdfPasswordError('Incorrect password. Please check and try again.');
        }
        setAiDetectNotification('This PDF document is password protected. Enter password to unlock.');
      } else {
        console.error('PDF extraction failed:', err);
        setAiDetectNotification(`PDF processing note: ${err?.message || 'Could not parse PDF'}`);
      }
    } finally {
      setPdfIsProcessing(false);
    }
  };

  const handlePdfPasswordSubmit = (password: string) => {
    if (!pdfPendingFile) return;
    handlePdfFile(pdfPendingFile, password);
  };

  // Process multiple or single files with instant direct assignment
  const processAutoUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    // Check if any PDF is among the uploaded files
    const fileArray = Array.from(files);
    const pdfFile = fileArray.find(
      (f) => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf')
    );

    if (pdfFile) {
      await handlePdfFile(pdfFile);
      return;
    }

    const imageFiles = fileArray.filter((f) => f.type.startsWith('image/'));
    if (imageFiles.length === 0) return;

    try {
      if (imageFiles.length === 1) {
        const file = imageFiles[0];
        const dataUrl = await readFileAsDataUrl(file);
        if (!frontCard) {
          setFrontCard({
            id: `card-front-${Date.now()}`,
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
            detectedSummary: 'Front Side Card',
            isAmbiguous: false,
          });
          setAiDetectNotification(`✓ Loaded "${file.name}" as Front Side. Click Crop to align.`);
        } else {
          setBackCard({
            id: `card-back-${Date.now()}`,
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
            detectedSummary: 'Back Side Card',
            isAmbiguous: false,
          });
          setAiDetectNotification(`✓ Loaded "${file.name}" as Back Side. Click Crop to align.`);
        }
      } else {
        // 2 or more image files
        const frontFile = imageFiles[0];
        const backFile = imageFiles[1];

        const frontDataUrl = await readFileAsDataUrl(frontFile);
        const backDataUrl = await readFileAsDataUrl(backFile);

        setFrontCard({
          id: `card-front-${Date.now()}`,
          side: 'front',
          dataUrl: frontDataUrl,
          fileName: frontFile.name,
          rotation: 0,
          brightness: 0,
          contrast: 0,
          saturation: 0,
          sharpness: 0,
          detectedSide: 'front',
          detectedConfidence: 1.0,
          detectedSummary: 'Front Side Card',
          isAmbiguous: false,
        });

        setBackCard({
          id: `card-back-${Date.now()}`,
          side: 'back',
          dataUrl: backDataUrl,
          fileName: backFile.name,
          rotation: 0,
          brightness: 0,
          contrast: 0,
          saturation: 0,
          sharpness: 0,
          detectedSide: 'back',
          detectedConfidence: 1.0,
          detectedSummary: 'Back Side Card',
          isAmbiguous: false,
        });

        setAiDetectNotification('✓ Front & Back images loaded. Click Crop to adjust boundaries.');
      }
    } catch (err) {
      console.error('File load failed:', err);
      setAiDetectNotification('Could not load image file.');
    } finally {
      setTimeout(() => setAiDetectNotification(null), 5000);
      if (fileInputAutoRef.current) fileInputAutoRef.current.value = '';
    }
  };

  // Handle auto upload with AI detection & Ambiguity handling
  const handleAutoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    processAutoUploadFiles(files);
  };

  // Dedicated Front Side Upload
  const handleFrontUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleFrontFile(file);
  };

  // Dedicated Back Side Upload
  const handleBackUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    handleBackFile(file);
  };

  // Global Drag & Drop handlers
  const handleGlobalDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobal(true);
  };

  const handleGlobalDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobal(false);
  };

  const handleGlobalDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingGlobal(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processAutoUploadFiles(e.dataTransfer.files);
    }
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

  // Export High-Res Sheet as JPG
  const handleExportJPG = () => {
    if (!lastRenderedCanvasRef.current) return;
    exportToJPG(
      lastRenderedCanvasRef.current,
      `id_card_${settings.orientation}_${settings.layoutMode}_${cardWidthMm}x${cardHeightMm}mm_${selectedPaper.id}.jpg`
    );
    confetti({ particleCount: 40, spread: 60, origin: { y: 0.8 } });
  };

  return (
    <div
      onDragOver={handleGlobalDragOver}
      onDragLeave={handleGlobalDragLeave}
      onDrop={handleGlobalDrop}
      className={`max-w-7xl mx-auto px-4 py-6 space-y-6 transition-all ${
        isDraggingGlobal ? 'ring-2 ring-emerald-500 rounded-3xl bg-emerald-500/5' : ''
      }`}
    >
      {/* Drag & Drop Full-screen Indicator overlay when dragging */}
      {isDraggingGlobal && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 border-4 border-dashed border-emerald-500 animate-fade-in pointer-events-none">
          <div className="w-20 h-20 rounded-3xl bg-emerald-600/30 text-emerald-300 border border-emerald-500/50 flex items-center justify-center mb-4 shadow-2xl animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Drop ID Card Photos Here</h2>
          <p className="text-sm text-emerald-300 max-w-md text-center">
            Release your images to automatically analyze card orientation, detect Front vs Back side, and auto-slot them.
          </p>
        </div>
      )}

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
            Upload your ID PDF (Aadhaar, PAN, Voter Card, etc.) or photos. Manually crop and align Front and Back sides, adjust perspective, and prepare 300 DPI ready-to-print sheets.
          </p>
          {/* Active ID Card Orientation Display & Modal Trigger */}
          <div className="flex flex-wrap items-center gap-2 mt-2.5 pt-2.5 border-t border-white/10">
            <div className="flex items-center gap-1.5 text-xs text-slate-300">
              <span className="text-slate-400 font-medium">Format:</span>
              <span className="font-semibold text-white flex items-center gap-1">
                {settings.orientation === 'portrait' ? 'Vertical (Portrait)' : 'Horizontal (Landscape)'}
              </span>
              <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/15 px-1.5 py-0.5 rounded border border-emerald-500/30">
                {cardWidthMm.toFixed(1)} × {cardHeightMm.toFixed(1)} mm
              </span>
            </div>
            <button
              id="header-choose-orientation-btn"
              type="button"
              onClick={() => setIsOrientationModalOpen(true)}
              className="text-xs font-semibold px-2.5 py-1 rounded-lg bg-blue-600/30 hover:bg-blue-600/50 text-blue-300 border border-blue-500/40 transition-colors flex items-center gap-1"
            >
              Choose Orientation ↗
            </button>
          </div>
        </div>

        {/* Quick Sample / Reset buttons */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Sample e-Aadhaar */}
          <button
            onClick={() => {
              setFrontCard({
                id: 'f-aadhaar',
                side: 'front',
                dataUrl: SAMPLE_AADHAAR_FRONT_URL,
                fileName: 'aadhaar_card_front.png',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'front',
                detectedConfidence: 1.0,
                detectedSummary: 'Aadhaar Front (Portrait, Name & UID)',
                isAmbiguous: false,
              });
              setBackCard({
                id: 'b-aadhaar',
                side: 'back',
                dataUrl: SAMPLE_AADHAAR_BACK_URL,
                fileName: 'aadhaar_card_back.png',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'back',
                detectedConfidence: 1.0,
                detectedSummary: 'Aadhaar Back (Address & QR Code)',
                isAmbiguous: false,
              });
              setAiDetectNotification('✓ Loaded Sample e-Aadhaar (Front & Back ready for crop)');
              setTimeout(() => setAiDetectNotification(null), 3500);
              confetti({ particleCount: 35, spread: 60, origin: { y: 0.6 } });
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-300 hover:text-emerald-200 text-xs font-semibold border border-emerald-500/30 transition-all"
            title="Load Sample e-Aadhaar Front & Back Card"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
            e-Aadhaar Card
          </button>

          {/* Sample PAN Card */}
          <button
            onClick={() => {
              setFrontCard({
                id: 'f-pan',
                side: 'front',
                dataUrl: SAMPLE_PAN_CARD_URL,
                fileName: 'pan_card_front.png',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'front',
                detectedConfidence: 1.0,
                detectedSummary: 'PAN Front (Income Tax Dept & PAN)',
                isAmbiguous: false,
              });
              setBackCard(null);
              setAiDetectNotification('✓ Loaded Sample PAN Card (Front side)');
              setTimeout(() => setAiDetectNotification(null), 3500);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-all"
            title="Load Sample PAN Card"
          >
            <FileBadge className="w-3.5 h-3.5 text-blue-400" />
            PAN Card
          </button>

          {/* Sample Voter ID */}
          <button
            onClick={() => {
              setFrontCard({
                id: 'f-voter',
                side: 'front',
                dataUrl: SAMPLE_VOTER_ID_FRONT_URL,
                fileName: 'voter_id_epic_front.png',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'front',
                detectedConfidence: 1.0,
                detectedSummary: 'Voter ID Front (Photo & EPIC No)',
                isAmbiguous: false,
              });
              setBackCard({
                id: 'b-voter',
                side: 'back',
                dataUrl: SAMPLE_VOTER_ID_BACK_URL,
                fileName: 'voter_id_epic_back.png',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                saturation: 0,
                sharpness: 0,
                detectedSide: 'back',
                detectedConfidence: 1.0,
                detectedSummary: 'Voter ID Back (Address & Barcode)',
                isAmbiguous: false,
              });
              setAiDetectNotification('✓ Loaded Sample Voter ID (Front & Back ready for crop)');
              setTimeout(() => setAiDetectNotification(null), 3500);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-all"
            title="Load Sample Voter ID Card (EPIC)"
          >
            <FileCheck className="w-3.5 h-3.5 text-indigo-400" />
            Voter ID (EPIC)
          </button>

          {/* Standard ID */}
          <button
            onClick={() => {
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
                detectedConfidence: 1.0,
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
                detectedConfidence: 1.0,
                detectedSummary: 'Back Side (Address & Barcode)',
                isAmbiguous: false,
              });
              setAiDetectNotification('Loaded standard sample front and back ID cards');
              setTimeout(() => setAiDetectNotification(null), 3000);
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl glass-card hover:bg-white/10 text-slate-300 hover:text-white text-xs font-medium border border-white/10 transition-all"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            Driver's License
          </button>
        </div>
      </div>

      {/* Main Grid: Upload & Side Detector Left, Settings & Sheet Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Col (5 Cols): Upload, Side Switcher, Crop */}
        <div className="lg:col-span-5 space-y-5">
          {/* Card 1: Upload Area */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-400" />
                1. Upload PDF or Images (Front & Back)
              </h2>
              {pdfIsProcessing && (
                <span className="text-xs text-emerald-400 font-medium flex items-center gap-1 animate-pulse">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                  Rendering PDF in 300 DPI...
                </span>
              )}
            </div>

            {/* Smart Dual/Auto Upload Dropzone */}
            <input
              type="file"
              ref={fileInputAutoRef}
              onChange={handleAutoUpload}
              multiple
              accept="image/*,application/pdf,.pdf"
              className="hidden"
            />
            <div
              onClick={() => fileInputAutoRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingAuto(true);
              }}
              onDragLeave={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingAuto(false);
              }}
              onDrop={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setIsDraggingAuto(false);
                if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                  processAutoUploadFiles(e.dataTransfer.files);
                }
              }}
              className={`border-2 border-dashed rounded-2xl p-5 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2.5 group ${
                isDraggingAuto
                  ? 'border-emerald-400 bg-emerald-500/20 scale-[1.01]'
                  : 'border-emerald-500/30 hover:border-emerald-400/60 bg-emerald-500/5 hover:bg-emerald-500/10'
              }`}
            >
              <div className="w-11 h-11 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <span className="text-xs font-bold text-emerald-300 block">
                  Upload ID PDF or Images (Front & Back)
                </span>
                <span className="text-[11px] text-slate-300 block mt-1 max-w-sm mx-auto leading-relaxed">
                  Upload your ID PDF (Aadhaar, PAN, Voter Card, etc.) or photos. Manually crop, adjust, and align your document before printing.
                </span>
              </div>

              {/* Supported Badges */}
              <div className="flex flex-wrap items-center justify-center gap-1.5 mt-1">
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/20 text-emerald-300 text-[10px] font-semibold flex items-center gap-1">
                  <FileText className="w-3 h-3" /> PDF Documents
                </span>
                <span className="px-2 py-0.5 rounded-md bg-blue-500/20 text-blue-300 text-[10px] font-semibold">
                  Aadhaar / e-KYC
                </span>
                <span className="px-2 py-0.5 rounded-md bg-purple-500/20 text-purple-300 text-[10px] font-semibold">
                  PAN Card
                </span>
                <span className="px-2 py-0.5 rounded-md bg-amber-500/20 text-amber-300 text-[10px] font-semibold">
                  Voter ID
                </span>
                <span className="px-2 py-0.5 rounded-md bg-slate-700/60 text-slate-300 text-[10px] font-semibold">
                  JPG / PNG
                </span>
              </div>
            </div>

            {/* Status Notification */}
            {aiDetectNotification && (
              <div className="p-2.5 bg-emerald-500/15 border border-emerald-500/30 rounded-xl text-xs font-semibold text-emerald-300 flex items-center gap-2 animate-fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{aiDetectNotification}</span>
              </div>
            )}

            {/* Side-by-Side Cards Slots with Manual Selectors */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              {/* Front Card Slot */}
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingFront(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingFront(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingFront(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleFrontFile(file);
                }}
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                  isDraggingFront
                    ? 'bg-blue-500/20 border-blue-400 ring-2 ring-blue-500/50 scale-[1.02]'
                    : 'bg-black/30 border-white/10'
                }`}
              >
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
                      <span className="text-[9px] text-slate-600 block mt-0.5">Drop front image here</span>
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
                    accept="image/*,application/pdf,.pdf"
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
                        className="px-2 py-1 rounded-lg bg-blue-500/20 hover:bg-blue-500/30 border border-blue-500/30 text-blue-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
                        title="Manual Crop Front ID Card (Standard 85.60 × 54.00 mm)"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        Crop
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
              <div
                onDragOver={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingBack(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingBack(false);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsDraggingBack(false);
                  const file = e.dataTransfer.files?.[0];
                  if (file) handleBackFile(file);
                }}
                className={`p-3 rounded-xl border flex flex-col justify-between space-y-2 transition-all ${
                  isDraggingBack
                    ? 'bg-amber-500/20 border-amber-400 ring-2 ring-amber-500/50 scale-[1.02]'
                    : 'bg-black/30 border-white/10'
                }`}
              >
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
                      <span className="text-[9px] text-slate-600 block mt-0.5">Drop back image here</span>
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
                    accept="image/*,application/pdf,.pdf"
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
                        className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/30 text-amber-300 text-[11px] font-medium flex items-center gap-1 transition-colors"
                        title="Manual Crop Back ID Card (Standard 85.60 × 54.00 mm)"
                      >
                        <Crop className="w-3.5 h-3.5" />
                        Crop
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
            {/* ID Card Orientation Format Section */}
            <div className="p-3 bg-black/40 border border-white/10 rounded-xl space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-200">ID Card Orientation</span>
                  <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                    {cardWidthMm.toFixed(1)} × {cardHeightMm.toFixed(1)} mm
                  </span>
                </div>
                <button
                  id="open-orientation-modal-card-btn"
                  type="button"
                  onClick={() => setIsOrientationModalOpen(true)}
                  className="text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 hover:underline"
                >
                  Choose Format ↗
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  id="orientation-btn-landscape"
                  onClick={() => handleOrientationChange('landscape')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    settings.orientation === 'landscape'
                      ? 'border-blue-500/80 bg-blue-500/20 text-white font-semibold ring-1 ring-blue-500/40 shadow-xs'
                      : 'border-white/10 hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span className="w-3.5 h-2 rounded-xs border border-current inline-block" />
                      Horizontal
                    </div>
                    <div className="text-[10px] text-slate-400">Landscape (85.6 × 54mm)</div>
                  </div>
                  {settings.orientation === 'landscape' && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] shrink-0 ml-1">
                      ✓
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  id="orientation-btn-portrait"
                  onClick={() => handleOrientationChange('portrait')}
                  className={`p-2.5 rounded-xl border text-left transition-all flex items-center justify-between ${
                    settings.orientation === 'portrait'
                      ? 'border-blue-500/80 bg-blue-500/20 text-white font-semibold ring-1 ring-blue-500/40 shadow-xs'
                      : 'border-white/10 hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="space-y-0.5">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <span className="w-2 h-3.5 rounded-xs border border-current inline-block" />
                      Vertical
                    </div>
                    <div className="text-[10px] text-slate-400">Portrait (54 × 85.6mm)</div>
                  </div>
                  {settings.orientation === 'portrait' && (
                    <span className="w-4 h-4 rounded-full bg-blue-500 text-white flex items-center justify-center text-[10px] shrink-0 ml-1">
                      ✓
                    </span>
                  )}
                </button>
              </div>
            </div>

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

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handlePrintSheet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-card hover:bg-white/10 text-white text-xs font-semibold border border-white/20 transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-300" />
                  Print Direct
                </button>
                <button
                  id="save-as-jpg-idcard-btn"
                  onClick={handleExportJPG}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold shadow-md transition-all"
                  title="Save printable ID card sheet as high-resolution JPG image"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  Save as JPG
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
          customWidthMm={cardWidthMm}
          customHeightMm={cardHeightMm}
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

      {/* PDF Password Prompt Modal (e.g. e-Aadhaar) */}
      <PdfPasswordModal
        isOpen={pdfPasswordModalOpen}
        fileName={pdfPendingFile?.name || 'Document.pdf'}
        isLoading={pdfIsProcessing}
        errorMessage={pdfPasswordError}
        onClose={() => {
          setPdfPasswordModalOpen(false);
          setPdfPendingFile(null);
          setPdfPasswordError(null);
        }}
        onSubmit={handlePdfPasswordSubmit}
      />

      {/* PDF Detection & Extraction Result Confirmation Modal */}
      <PdfCardResultModal
        isOpen={pdfResultModalOpen}
        onClose={() => setPdfResultModalOpen(false)}
        result={pdfDetectionResult}
        onApply={(front, back) => {
          if (front) {
            setFrontCard({
              id: `card-pdf-front-${Date.now()}`,
              side: 'front',
              dataUrl: front.dataUrl,
              fileName: `${pdfPendingFile?.name || 'PDF'} (Front)`,
              rotation: 0,
              brightness: 0,
              contrast: 0,
              saturation: 0,
              sharpness: 0,
              detectedSide: 'front',
              detectedConfidence: front.confidence,
              detectedSummary: front.summary || 'Front Side',
              isAmbiguous: false,
            });
          }
          if (back) {
            setBackCard({
              id: `card-pdf-back-${Date.now()}`,
              side: 'back',
              dataUrl: back.dataUrl,
              fileName: `${pdfPendingFile?.name || 'PDF'} (Back)`,
              rotation: 0,
              brightness: 0,
              contrast: 0,
              saturation: 0,
              sharpness: 0,
              detectedSide: 'back',
              detectedConfidence: back.confidence,
              detectedSummary: back.summary || 'Back Side',
              isAmbiguous: false,
            });
          }
          setAiDetectNotification('✓ Cards applied directly to ID Card Studio canvas');
          setTimeout(() => setAiDetectNotification(null), 3000);
        }}
      />

      {/* ID Card Orientation Selection Modal */}
      <IDCardOrientationModal
        isOpen={isOrientationModalOpen}
        onClose={() => setIsOrientationModalOpen(false)}
        currentOrientation={settings.orientation}
        onSelectOrientation={handleOrientationChange}
      />
    </div>
  );
};
