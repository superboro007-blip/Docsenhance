import React, { useState, useRef, useEffect } from 'react';
import { DocumentItem, DocumentSettings, PaperSizeConfig } from '../types';
import { PAPER_SIZES } from '../data/presets';
import { processDocumentItem, exportToPDF, exportToJPG } from '../utils/imageProcessing';
import { DocumentCropModal } from './DocumentCropModal';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';
import {
  FileText,
  Upload,
  Camera,
  Printer,
  Download,
  FileImage,
  RotateCw,
  RotateCcw,
  Sparkles,
  Layers,
  CheckCircle2,
  Trash2,
  Plus,
  Sliders,
  Crop,
  Wand2,
  Maximize2,
  RefreshCw,
  Sun,
  Contrast,
} from 'lucide-react';
import confetti from 'canvas-confetti';

const SAMPLE_DOC_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 1100" width="800" height="1100">
  <defs>
    <linearGradient id="docGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#ffffff" />
      <stop offset="100%" stop-color="#f8fafc" />
    </linearGradient>
  </defs>
  <!-- Paper Base -->
  <rect width="800" height="1100" fill="url(#docGrad)" stroke="#cbd5e1" stroke-width="2" />
  <!-- Border Frame -->
  <rect x="35" y="35" width="730" height="1030" fill="none" stroke="#1e3a8a" stroke-width="4" />
  <rect x="45" y="45" width="710" height="1010" fill="none" stroke="#93c5fd" stroke-width="1.5" />
  <!-- Header Emblem / Seal -->
  <circle cx="400" cy="120" r="45" fill="#fef08a" stroke="#ca8a04" stroke-width="2.5" />
  <polygon points="400,90 410,115 435,115 415,130 422,155 400,140 378,155 385,130 365,115 390,115" fill="#ca8a04" />
  <!-- Title -->
  <text x="400" y="210" fill="#0f172a" font-family="serif" font-size="28" font-weight="bold" text-anchor="middle" letter-spacing="2">CERTIFICATE OF VERIFICATION</text>
  <text x="400" y="240" fill="#64748b" font-family="sans-serif" font-size="14" text-anchor="middle" letter-spacing="4">OFFICIAL RECORD &amp; IDENTIFICATION ARCHIVE</text>
  <line x1="150" y1="260" x2="650" y2="260" stroke="#cbd5e1" stroke-width="1.5" />
  <!-- Body Paragraph Mock Text Lines -->
  <text x="80" y="320" fill="#334155" font-family="serif" font-size="16" font-style="italic">To Whom It May Concern,</text>
  <text x="80" y="360" fill="#1e293b" font-family="sans-serif" font-size="15">This document officially certifies and confirms the registration and authentication</text>
  <text x="80" y="390" fill="#1e293b" font-family="sans-serif" font-size="15">of the individual credentials referenced herein under Document Reference Series:</text>
  <!-- Highlighting Box -->
  <rect x="80" y="420" width="640" height="70" rx="8" fill="#f1f5f9" stroke="#94a3b8" stroke-width="1" />
  <text x="110" y="450" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">IDENTIFICATION IDENTIFIER</text>
  <text x="110" y="475" fill="#0f172a" font-family="monospace" font-size="20" font-weight="bold">REF-ID-2026-9812-7041</text>
  <text x="450" y="450" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">STATUS</text>
  <text x="450" y="475" fill="#15803d" font-family="sans-serif" font-size="18" font-weight="bold">✓ VERIFIED &amp; ACTIVE</text>
  <!-- Text Lines -->
  <g fill="#475569">
    <rect x="80" y="530" width="640" height="8" rx="4" />
    <rect x="80" y="555" width="600" height="8" rx="4" />
    <rect x="80" y="580" width="620" height="8" rx="4" />
    <rect x="80" y="605" width="540" height="8" rx="4" />
    <rect x="80" y="650" width="640" height="8" rx="4" />
    <rect x="80" y="675" width="580" height="8" rx="4" />
    <rect x="80" y="700" width="610" height="8" rx="4" />
  </g>
  <!-- Official Red Seal -->
  <circle cx="200" cy="880" r="60" fill="#fee2e2" stroke="#dc2626" stroke-width="3" stroke-dasharray="6,4" />
  <text x="200" y="875" fill="#b91c1c" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">OFFICIAL SEAL</text>
  <text x="200" y="895" fill="#b91c1c" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">AUTHORIZED</text>
  <!-- Signatures -->
  <line x1="450" y1="910" x2="680" y2="910" stroke="#334155" stroke-width="1.5" />
  <text x="470" y="895" fill="#1e3a8a" font-family="cursive" font-size="28" font-style="italic">J. R. Vance</text>
  <text x="565" y="930" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold" text-anchor="middle">CHIEF REGISTRAR GENERAL</text>
</svg>`)}`;

export const DocumentStudio: React.FC = () => {
  const [documents, setDocuments] = useState<DocumentItem[]>([
    {
      id: 'doc-1',
      title: 'Certificate / Document Scan 1',
      dataUrl: SAMPLE_DOC_URL,
      filterMode: 'magic_color',
      rotation: 0,
      brightness: 0,
      contrast: 0,
      scalePercent: 100,
    },
  ]);

  const [selectedDocIndex, setSelectedDocIndex] = useState(0);
  const [selectedPaper, setSelectedPaper] = useState<PaperSizeConfig>(PAPER_SIZES[0]); // A4
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isBgRemovalOpen, setIsBgRemovalOpen] = useState(false);
  const [processedDocUrl, setProcessedDocUrl] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDraggingOver, setIsDraggingOver] = useState(false);

  const [settings, setSettings] = useState<DocumentSettings>({
    paperSizeId: 'a4',
    layout: '1_per_page',
    orientation: 'portrait',
    marginMm: 10,
    showPageBorder: false,
    enhanceTextClarity: true,
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const currentDoc = documents[selectedDocIndex] || documents[0];

  // Helper to load multiple files
  const processFiles = (files: FileList | File[]) => {
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File, idx) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const newDoc: DocumentItem = {
          id: `doc-${Date.now()}-${idx}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          dataUrl,
          filterMode: 'magic_color',
          rotation: 0,
          brightness: 0,
          contrast: 0,
          scalePercent: 100,
        };
        setDocuments((prev) => [...prev, newDoc]);
        setSelectedDocIndex((prev) => prev); // keep selection or select latest
      };
      reader.readAsDataURL(file);
    });
  };

  // Drag & Drop handlers
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDraggingOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processFiles(e.dataTransfer.files);
    }
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
              const newDoc: DocumentItem = {
                id: `doc-paste-${Date.now()}`,
                title: `Pasted Document ${documents.length + 1}`,
                dataUrl,
                filterMode: 'magic_color',
                rotation: 0,
                brightness: 0,
                contrast: 0,
                scalePercent: 100,
              };
              setDocuments((prev) => [...prev, newDoc]);
              setSelectedDocIndex(documents.length);
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [documents.length]);

  // Update processed document preview reactively whenever document properties change
  useEffect(() => {
    if (!currentDoc) {
      setProcessedDocUrl(null);
      return;
    }
    let isCancelled = false;
    setIsProcessing(true);

    processDocumentItem(currentDoc)
      .then((url) => {
        if (!isCancelled) {
          setProcessedDocUrl(url);
          setIsProcessing(false);
        }
      })
      .catch((err) => {
        console.warn('Error processing document item:', err);
        if (!isCancelled) {
          setProcessedDocUrl(currentDoc.dataUrl);
          setIsProcessing(false);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, [
    currentDoc?.dataUrl,
    currentDoc?.cropBox,
    currentDoc?.quadCorners,
    currentDoc?.rotation,
    currentDoc?.filterMode,
    currentDoc?.brightness,
    currentDoc?.contrast,
    currentDoc?.textDarkness,
  ]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    Array.from(files).forEach((file: File, idx) => {
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        const newDoc: DocumentItem = {
          id: `doc-${Date.now()}-${idx}`,
          title: file.name.replace(/\.[^/.]+$/, ''),
          dataUrl,
          filterMode: 'magic_color',
          rotation: 0,
          brightness: 0,
          contrast: 0,
          scalePercent: 100,
        };
        setDocuments((prev) => [...prev, newDoc]);
      };
      reader.readAsDataURL(file);
    });
  };

  const updateCurrentDoc = (updates: Partial<DocumentItem>) => {
    setDocuments((prev) =>
      prev.map((doc, idx) => (idx === selectedDocIndex ? { ...doc, ...updates } : doc))
    );
  };

  const handleRotate = () => {
    if (!currentDoc) return;
    const nextRot = (currentDoc.rotation + 90) % 360;
    updateCurrentDoc({ rotation: nextRot });
  };

  const handleResetCrop = () => {
    if (!currentDoc) return;
    updateCurrentDoc({ cropBox: undefined });
  };

  const handleDeleteDoc = (index: number) => {
    if (documents.length <= 1) return;
    setDocuments((prev) => prev.filter((_, i) => i !== index));
    setSelectedDocIndex(0);
  };

  // Generate & Print Document Canvas
  const handlePrintDocument = async () => {
    if (!currentDoc) return;
    const processedUrl = await processDocumentItem(currentDoc);
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Print Document - ${currentDoc.title}</title>
          <style>
            @page { size: ${selectedPaper.widthMm}mm ${selectedPaper.heightMm}mm; margin: 0; }
            body { margin: 0; padding: 0; display: flex; justify-content: center; align-items: center; background: white; }
            img { width: ${selectedPaper.widthMm}mm; height: ${selectedPaper.heightMm}mm; object-fit: contain; }
          </style>
        </head>
        <body>
          <img src="${processedUrl}" onload="window.print(); window.close();" />
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  // Download PDF
  const handleDownloadPDF = async () => {
    if (!currentDoc) return;
    const processedUrl = await processDocumentItem(currentDoc);
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = processedUrl;
    img.onload = () => {
      canvas.width = (selectedPaper.widthMm / 25.4) * 300;
      canvas.height = (selectedPaper.heightMm / 25.4) * 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        // Draw centered and contained on the paper
        const imgAspect = img.width / img.height;
        const paperAspect = canvas.width / canvas.height;
        let drawW = canvas.width;
        let drawH = canvas.height;
        let drawX = 0;
        let drawY = 0;

        if (imgAspect > paperAspect) {
          drawH = canvas.width / imgAspect;
          drawY = (canvas.height - drawH) / 2;
        } else {
          drawW = canvas.height * imgAspect;
          drawX = (canvas.width - drawW) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        exportToPDF(canvas, selectedPaper, `${currentDoc.title}_print_${selectedPaper.id}.pdf`);
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      }
    };
  };

  // Save Document Sheet as High-Res JPG
  const handleDownloadJPG = async () => {
    if (!currentDoc) return;
    const processedUrl = await processDocumentItem(currentDoc);
    const canvas = document.createElement('canvas');
    const img = new Image();
    img.src = processedUrl;
    img.onload = () => {
      canvas.width = (selectedPaper.widthMm / 25.4) * 300;
      canvas.height = (selectedPaper.heightMm / 25.4) * 300;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        const imgAspect = img.width / img.height;
        const paperAspect = canvas.width / canvas.height;
        let drawW = canvas.width;
        let drawH = canvas.height;
        let drawX = 0;
        let drawY = 0;

        if (imgAspect > paperAspect) {
          drawH = canvas.width / imgAspect;
          drawY = (canvas.height - drawH) / 2;
        } else {
          drawW = canvas.height * imgAspect;
          drawX = (canvas.width - drawW) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        exportToJPG(canvas, `${currentDoc.title}_${selectedPaper.id}.jpg`);
        confetti({ particleCount: 30, spread: 50, origin: { y: 0.8 } });
      }
    };
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`max-w-7xl mx-auto px-4 py-6 space-y-6 transition-all ${
        isDraggingOver ? 'ring-2 ring-purple-500 rounded-3xl bg-purple-500/5' : ''
      }`}
    >
      {/* Drag & Drop Full-screen Indicator overlay when dragging */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 border-4 border-dashed border-purple-500 animate-fade-in pointer-events-none">
          <div className="w-20 h-20 rounded-3xl bg-purple-600/30 text-purple-300 border border-purple-500/50 flex items-center justify-center mb-4 shadow-2xl animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Drop Document Scans Here</h2>
          <p className="text-sm text-purple-300 max-w-md text-center">
            Release your files to automatically add them to your multi-page scan queue for 4-corner perspective warping and 300 DPI print layout.
          </p>
        </div>
      )}

      {/* Title */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 glass-card p-5 rounded-2xl border border-white/10 shadow-lg">
        <div>
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
              Dedicated Page
            </span>
            <h1 className="text-xl font-bold text-white">
              Document & Certificate Studio
            </h1>
          </div>
          <p className="text-sm text-slate-400 mt-1">
            Precision 4-corner freecrop, clean scanner shadows, enhance high-contrast text, and arrange documents for 300 DPI print.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileUpload}
            multiple
            accept="image/*,.pdf"
            className="hidden"
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-sm font-semibold shadow-lg transition-all"
          >
            <Upload className="w-4 h-4" />
            Upload Document Scan
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Controls (5 Cols) */}
        <div className="lg:col-span-5 space-y-5">
          {/* Dedicated Drag & Drop Dropzone */}
          <div
            onClick={() => fileInputRef.current?.click()}
            className="border-2 border-dashed border-purple-500/30 hover:border-purple-400/60 bg-purple-500/5 hover:bg-purple-500/10 rounded-2xl p-4 text-center cursor-pointer transition-all flex flex-col items-center justify-center gap-2 group"
          >
            <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center text-purple-400 group-hover:scale-110 transition-transform">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <span className="text-xs font-bold text-purple-300 block">
                Drag & Drop Document Images Here
              </span>
              <span className="text-[11px] text-purple-400/80 block mt-0.5">
                Supports single or multiple files, phone camera scans, and certificates (or click to browse)
              </span>
            </div>
          </div>

          {/* Document Queue List */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-3">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-purple-400" />
                Uploaded Documents ({documents.length})
              </h2>
              <button
                onClick={() => fileInputRef.current?.click()}
                className="text-xs text-purple-400 font-semibold hover:underline flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" /> Add More
              </button>
            </div>

            <div className="space-y-1.5 max-h-44 overflow-y-auto pr-1">
              {documents.map((doc, idx) => (
                <div
                  key={doc.id}
                  onClick={() => setSelectedDocIndex(idx)}
                  className={`p-2.5 rounded-xl border text-xs flex items-center justify-between cursor-pointer transition-all ${
                    idx === selectedDocIndex
                      ? 'border-purple-500/60 bg-purple-500/15 text-white font-semibold ring-1 ring-purple-500/30'
                      : 'border-white/10 hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-5 h-5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center justify-center text-[10px] shrink-0 font-bold">
                      {idx + 1}
                    </span>
                    <span className="truncate text-slate-200">{doc.title}</span>
                    {doc.cropBox && (
                      <span className="px-1.5 py-0.5 rounded bg-purple-500/20 text-purple-300 text-[10px] font-mono border border-purple-500/30">
                        Cropped
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedDocIndex(idx);
                        setIsCropModalOpen(true);
                      }}
                      className="p-1 text-purple-400 hover:text-purple-300 hover:bg-purple-500/20 rounded-lg transition-colors"
                      title="Crop Document"
                    >
                      <Crop className="w-3.5 h-3.5" />
                    </button>
                    {documents.length > 1 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(idx);
                        }}
                        className="p-1 text-slate-500 hover:text-red-400 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Precision Crop & Edit Tools */}
          {currentDoc && (
            <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                  <Crop className="w-4 h-4 text-purple-400" />
                  Document Crop & Tools
                </h2>
                {currentDoc.cropBox && (
                  <button
                    onClick={handleResetCrop}
                    className="text-[11px] text-pink-400 hover:underline flex items-center gap-1"
                  >
                    <RefreshCw className="w-3 h-3" /> Reset Crop
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsCropModalOpen(true)}
                  className="p-3 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 border border-purple-500/40 text-purple-200 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Crop className="w-4 h-4 text-purple-300" />
                  Crop Document Scan
                </button>

                <button
                  onClick={() => setIsBgRemovalOpen(true)}
                  className="p-3 rounded-xl bg-blue-600/20 hover:bg-blue-600/30 border border-blue-500/40 text-blue-200 text-xs font-bold flex items-center justify-center gap-2 transition-all shadow-sm"
                >
                  <Wand2 className="w-4 h-4 text-blue-300" />
                  Clean Background
                </button>
              </div>

              {/* Quick Action: Light Text / Blurry Document Enhancer */}
              <button
                id="doc-quick-light-text-btn"
                type="button"
                onClick={() =>
                  updateCurrentDoc({
                    filterMode: 'light_text',
                    textDarkness: currentDoc.textDarkness ?? 65,
                  })
                }
                className={`w-full p-3 rounded-xl border text-xs font-bold flex items-center justify-between transition-all cursor-pointer ${
                  currentDoc.filterMode === 'light_text'
                    ? 'bg-amber-500/20 border-amber-400 text-amber-100 ring-2 ring-amber-400/40 shadow-lg shadow-amber-950/20'
                    : 'bg-slate-800/80 hover:bg-slate-800 border-amber-500/30 hover:border-amber-400/60 text-slate-200'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div
                    className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                      currentDoc.filterMode === 'light_text'
                        ? 'bg-amber-500 text-slate-950 font-black shadow'
                        : 'bg-amber-500/20 text-amber-300'
                    }`}
                  >
                    <Sparkles className="w-4 h-4" />
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-1.5 font-bold">
                      Light Text Recovery
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/30 text-amber-200 uppercase font-mono tracking-wide border border-amber-400/40">
                        Blurry Text
                      </span>
                    </div>
                    <div className="text-[11px] font-normal text-slate-400 mt-0.5">
                      Sharpens blurry text &amp; restores faint ink for low-quality docs
                    </div>
                  </div>
                </div>
                <span
                  className={`text-[10px] px-2.5 py-1 rounded-lg font-bold shrink-0 ${
                    currentDoc.filterMode === 'light_text'
                      ? 'bg-amber-500 text-slate-950'
                      : 'bg-white/10 text-slate-300'
                  }`}
                >
                  {currentDoc.filterMode === 'light_text' ? 'Active' : 'Apply'}
                </span>
              </button>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={handleRotate}
                  className="flex-1 py-2 px-3 rounded-xl glass-card hover:bg-white/10 text-slate-300 text-xs font-semibold flex items-center justify-center gap-2 border border-white/10 transition-all"
                >
                  <RotateCw className="w-4 h-4 text-purple-400" />
                  Rotate 90° ({currentDoc.rotation}°)
                </button>
              </div>
            </div>
          )}

          {/* Enhancement & Filters */}
          {currentDoc && (
            <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
              <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-purple-400" />
                Document Enhancement Filters
              </h2>

              <div className="grid grid-cols-2 gap-2">
                {[
                  {
                    id: 'light_text',
                    title: 'Light Text',
                    desc: 'Enhances blurry, faint & low-quality text',
                    badge: 'Blurry Scans',
                    highlight: true,
                  },
                  {
                    id: 'magic_color',
                    title: 'Magic Color Boost',
                    desc: 'Enhances text & color sharpness',
                  },
                  {
                    id: 'bw_photocopy',
                    title: 'B&W Photocopy',
                    desc: 'High contrast, removes shadows',
                  },
                  {
                    id: 'grayscale',
                    title: 'Grayscale',
                    desc: 'Clean uniform monochrome',
                  },
                  {
                    id: 'original',
                    title: 'Original Scan',
                    desc: 'No filter applied',
                  },
                ].map((flt) => (
                  <button
                    key={flt.id}
                    onClick={() => updateCurrentDoc({ filterMode: flt.id as any })}
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all relative ${
                      currentDoc.filterMode === flt.id
                        ? flt.id === 'light_text'
                          ? 'border-amber-400 bg-amber-500/15 text-white font-semibold ring-2 ring-amber-400/40 shadow-sm'
                          : 'border-purple-500/60 bg-purple-500/15 text-white font-semibold ring-1 ring-purple-500/30'
                        : flt.id === 'light_text'
                        ? 'border-amber-500/30 bg-amber-500/5 hover:bg-amber-500/10 text-slate-200'
                        : 'border-white/10 hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-semibold text-slate-200 flex items-center gap-1.5">
                        {flt.title}
                      </div>
                      {flt.badge && (
                        <span className="text-[9px] font-mono px-1 py-0.2 rounded bg-amber-500/30 text-amber-200 border border-amber-400/40 uppercase">
                          {flt.badge}
                        </span>
                      )}
                    </div>
                    <div className="text-[10px] text-slate-400 mt-0.5">{flt.desc}</div>
                  </button>
                ))}
              </div>

              {/* Light Text Fine-Tuning Controls */}
              {currentDoc.filterMode === 'light_text' && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 space-y-3 animate-fade-in">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-amber-200">
                      <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                      Text Darkening &amp; Sharpness Boost
                    </div>
                    <span className="text-xs font-mono font-bold text-amber-300 bg-amber-500/20 px-2 py-0.5 rounded border border-amber-500/30">
                      {currentDoc.textDarkness ?? 65}%
                    </span>
                  </div>

                  <input
                    type="range"
                    min={20}
                    max={100}
                    step={5}
                    value={currentDoc.textDarkness ?? 65}
                    onChange={(e) => updateCurrentDoc({ textDarkness: Number(e.target.value) })}
                    className="w-full accent-amber-400 cursor-pointer"
                  />

                  {/* Presets */}
                  <div className="grid grid-cols-3 gap-1.5">
                    {[
                      { label: 'Subtle', val: 40, desc: 'Mild blur' },
                      { label: 'Balanced', val: 65, desc: 'Standard' },
                      { label: 'Deep Ink', val: 90, desc: 'Very faint' },
                    ].map((pst) => (
                      <button
                        key={pst.val}
                        type="button"
                        onClick={() => updateCurrentDoc({ textDarkness: pst.val })}
                        className={`px-2 py-1.5 rounded-lg text-[11px] font-semibold border transition-all text-center ${
                          (currentDoc.textDarkness ?? 65) === pst.val
                            ? 'bg-amber-500 text-slate-950 font-bold border-amber-400 shadow-sm'
                            : 'bg-slate-900/80 hover:bg-slate-800 text-slate-300 border-white/10'
                        }`}
                      >
                        <div>{pst.label} ({pst.val}%)</div>
                        <div className="text-[9px] opacity-75 font-normal">{pst.desc}</div>
                      </button>
                    ))}
                  </div>

                  <div className="text-[11px] text-amber-300/80 flex items-start gap-1.5 bg-amber-950/40 p-2 rounded-lg border border-amber-500/20">
                    <CheckCircle2 className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
                    <span>
                      High-frequency unsharp mask sharpens blurry character contours, wipes scanner fog to crisp white, and deepens washed-out text.
                    </span>
                  </div>
                </div>
              )}

              {/* Optional Fine Exposure / Brightness / Contrast */}
              <div className="pt-2 border-t border-white/10 space-y-2">
                <div className="flex items-center justify-between text-[11px] text-slate-400">
                  <span className="flex items-center gap-1 font-semibold text-slate-300">
                    <Sliders className="w-3 h-3 text-purple-400" /> Manual Brightness &amp; Contrast
                  </span>
                  {(currentDoc.brightness !== 0 || currentDoc.contrast !== 0) && (
                    <button
                      type="button"
                      onClick={() => updateCurrentDoc({ brightness: 0, contrast: 0 })}
                      className="text-pink-400 hover:underline cursor-pointer"
                    >
                      Reset
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-3 text-[11px]">
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Brightness</span>
                      <span className="font-mono text-slate-200">
                        {currentDoc.brightness > 0 ? `+${currentDoc.brightness}` : currentDoc.brightness}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={currentDoc.brightness}
                      onChange={(e) => updateCurrentDoc({ brightness: Number(e.target.value) })}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                  <div>
                    <div className="flex justify-between text-slate-400 mb-1">
                      <span>Contrast</span>
                      <span className="font-mono text-slate-200">
                        {currentDoc.contrast > 0 ? `+${currentDoc.contrast}` : currentDoc.contrast}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={-50}
                      max={50}
                      value={currentDoc.contrast}
                      onChange={(e) => updateCurrentDoc({ contrast: Number(e.target.value) })}
                      className="w-full accent-purple-400 cursor-pointer"
                    />
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Paper Size */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-3">
            <h2 className="text-xs font-bold text-slate-300 uppercase tracking-wider">
              Print Sheet Paper
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {PAPER_SIZES.slice(0, 4).map((paper) => (
                <button
                  key={paper.id}
                  onClick={() => setSelectedPaper(paper)}
                  className={`p-2 rounded-xl border text-left text-xs transition-all ${
                    selectedPaper.id === paper.id
                      ? 'border-purple-500/60 bg-purple-500/15 text-white font-semibold ring-1 ring-purple-500/30'
                      : 'border-white/10 hover:bg-white/5 text-slate-300'
                  }`}
                >
                  <div className="font-medium text-slate-200">{paper.name}</div>
                  <div className="text-[10px] text-slate-400">{paper.widthMm} × {paper.heightMm} mm</div>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Right Preview (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg flex flex-col items-center">
            {/* Action Header */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Document Preview ({selectedPaper.name})
                </span>
                {currentDoc && (
                  <span
                    className={`text-xs border font-medium px-2.5 py-0.5 rounded-full flex items-center gap-1.5 ${
                      currentDoc.filterMode === 'light_text'
                        ? 'bg-amber-500/20 text-amber-300 border-amber-400/40 font-bold'
                        : 'bg-purple-500/20 text-purple-300 border-purple-500/30'
                    }`}
                  >
                    {currentDoc.filterMode === 'light_text' && <Sparkles className="w-3 h-3 text-amber-400" />}
                    {currentDoc.filterMode === 'light_text'
                      ? 'LIGHT TEXT (ENHANCED)'
                      : currentDoc.filterMode.replace('_', ' ').toUpperCase()}
                  </span>
                )}
                {currentDoc?.cropBox && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium px-2 py-0.5 rounded-full">
                    CROP APPLIED
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => setIsCropModalOpen(true)}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-purple-600/20 hover:bg-purple-600/30 text-purple-300 border border-purple-500/30 text-xs font-semibold transition-all"
                >
                  <Crop className="w-3.5 h-3.5" />
                  Crop
                </button>
                <button
                  onClick={handlePrintDocument}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl glass-card hover:bg-white/10 text-white text-xs font-semibold border border-white/20 transition-all"
                >
                  <Printer className="w-3.5 h-3.5 text-slate-300" />
                  Print Direct
                </button>
                <button
                  id="save-as-jpg-document-btn"
                  onClick={handleDownloadJPG}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold shadow-md transition-all"
                  title="Save document as high-resolution JPG image"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  Save as JPG
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-semibold shadow-lg transition-all"
                >
                  <Download className="w-3.5 h-3.5" />
                  Download 300 DPI PDF
                </button>
              </div>
            </div>

            {/* Document Canvas Viewer */}
            <div className="w-full my-4 p-4 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 overflow-auto min-h-[440px]">
              {processedDocUrl ? (
                <div className="shadow-2xl border border-white/20 bg-white rounded-xs p-2 max-w-[480px] transition-all">
                  <img
                    src={processedDocUrl}
                    alt={currentDoc?.title || 'Document'}
                    className="w-full h-auto object-contain block"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-500">Upload a document scan to preview</span>
              )}
            </div>

            {/* Footer */}
            <div className="w-full flex items-center justify-between text-xs text-slate-400 pt-2 border-t border-white/10">
              <span className="text-slate-300">{currentDoc?.title || 'Document'}</span>
              <span className="text-purple-400 font-medium">✓ Ready for A4 / Letter Print (300 DPI)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Document Crop Modal */}
      {currentDoc && (
        <DocumentCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          imageSrc={currentDoc.dataUrl}
          initialCropBox={currentDoc.cropBox}
          initialCorners={currentDoc.quadCorners}
          initialRotation={currentDoc.rotation}
          onApplyCrop={(cropBox, quadCorners, rot) => {
            updateCurrentDoc({
              cropBox,
              quadCorners,
              rotation: rot !== undefined ? rot : currentDoc.rotation,
            });
          }}
        />
      )}

      {/* Background Removal / Clean Modal */}
      {currentDoc && (
        <BackgroundRemovalModal
          isOpen={isBgRemovalOpen}
          onClose={() => setIsBgRemovalOpen(false)}
          imageSrc={currentDoc.dataUrl}
          onApply={(newImage) => {
            updateCurrentDoc({
              dataUrl: newImage,
              cropBox: undefined,
            });
          }}
        />
      )}
    </div>
  );
};

