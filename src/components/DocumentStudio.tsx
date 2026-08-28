import React, { useState, useRef, useEffect } from 'react';
import { DocumentItem, DocumentSettings, PaperSizeConfig } from '../types';
import { PAPER_SIZES } from '../data/presets';
import { processDocumentItem, exportToPDF } from '../utils/imageProcessing';
import { DocumentCropModal } from './DocumentCropModal';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';
import {
  FileText,
  Upload,
  Camera,
  Printer,
  Download,
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

const SAMPLE_DOC_URL = 'https://images.unsplash.com/photo-1586281380349-632531db7ed4?auto=format&fit=crop&w=1000&q=80';

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
    currentDoc?.rotation,
    currentDoc?.filterMode,
    currentDoc?.brightness,
    currentDoc?.contrast,
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

  return (
    <div className="max-w-7xl mx-auto px-4 py-6 space-y-6">
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
            Precision edge crop, clean scanner shadows, enhance high-contrast text, and arrange documents for 300 DPI print.
          </p>
        </div>

        <div className="flex items-center gap-2">
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
                    className={`p-2.5 rounded-xl border text-left text-xs transition-all ${
                      currentDoc.filterMode === flt.id
                        ? 'border-purple-500/60 bg-purple-500/15 text-white font-semibold ring-1 ring-purple-500/30'
                        : 'border-white/10 hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    <div className="font-semibold text-slate-200">{flt.title}</div>
                    <div className="text-[10px] text-slate-400">{flt.desc}</div>
                  </button>
                ))}
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
                  <span className="text-xs bg-purple-500/20 text-purple-300 border border-purple-500/30 font-medium px-2.5 py-0.5 rounded-full">
                    {currentDoc.filterMode.replace('_', ' ').toUpperCase()}
                  </span>
                )}
                {currentDoc?.cropBox && (
                  <span className="text-xs bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium px-2 py-0.5 rounded-full">
                    CROP APPLIED
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
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
          initialRotation={currentDoc.rotation}
          onApplyCrop={(cropBox, rot) => {
            updateCurrentDoc({
              cropBox,
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

