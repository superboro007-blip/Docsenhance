import React, { useState, useEffect, useRef } from 'react';
import {
  PassportPreset,
  PassportSettings,
  PaperSizeConfig,
  PersonPhotoItem,
  PrintSizeCategory,
} from '../types';
import {
  PASSPORT_PRESETS,
  PAPER_SIZES,
  SAMPLE_PORTRAIT_URL,
} from '../data/presets';
import {
  processPassportImage,
  renderPassportSheetCanvas,
  renderMultiPersonSheetCanvas,
  exportToPDF,
  RenderPersonItem,
} from '../utils/imageProcessing';
import { PassportCropModal } from './PassportCropModal';
import { WebcamModal } from './WebcamModal';
import { BackgroundRemovalModal } from './BackgroundRemovalModal';
import { removeAiBackground } from '../utils/aiBackgroundRemoval';
import {
  Upload,
  Camera,
  Crop,
  Printer,
  Download,
  Sparkles,
  RefreshCw,
  Plus,
  Minus,
  Copy,
  Hash,
  ShieldCheck,
  Users,
  UserPlus,
  Trash2,
  Edit3,
  Check,
  Split,
  Layers,
  Grid,
} from 'lucide-react';
import confetti from 'canvas-confetti';

interface PassportStudioProps {
  onNavigateToPreview?: () => void;
}

export const PassportStudio: React.FC<PassportStudioProps> = () => {
  // Multiple Persons Management State
  const [persons, setPersons] = useState<PersonPhotoItem[]>([
    {
      id: 'person-1',
      name: 'Person 1',
      rawImage: SAMPLE_PORTRAIT_URL,
      copies: 6,
      rotation: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      backgroundColor: '#ffffff',
    },
  ]);
  const [activePersonId, setActivePersonId] = useState<string>('person-1');

  // Print Mode: Combined Sheet (all persons) or Single Person Sheet
  const [printMode, setPrintMode] = useState<'combined' | 'single'>('combined');

  // Print Size Category
  const [sizeCategory, setSizeCategory] = useState<PrintSizeCategory>('passport');
  const [customUnit, setCustomUnit] = useState<'mm' | 'inch'>('mm');

  // Selected Presets & Paper
  const [selectedPreset, setSelectedPreset] = useState<PassportPreset>(PASSPORT_PRESETS[0]);
  const [selectedPaper, setSelectedPaper] = useState<PaperSizeConfig>(PAPER_SIZES[0]); // A4 default

  // Sheet & Print Settings
  const [settings, setSettings] = useState<PassportSettings>({
    presetId: PASSPORT_PRESETS[0].id,
    customWidthMm: 30,
    customHeightMm: 40,
    photoCount: 6, // default 6 photos (clean 1-row or mini batch)
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

  // Modal states
  const [isCropModalOpen, setIsCropModalOpen] = useState(false);
  const [isBgRemovalOpen, setIsBgRemovalOpen] = useState(false);
  const [isWebcamOpen, setIsWebcamOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isAiBgRemoving, setIsAiBgRemoving] = useState(false);
  const [aiBgStatus, setAiBgStatus] = useState<string | null>(null);
  const [sheetPreviewUrl, setSheetPreviewUrl] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState(false);
  const [editingPersonNameId, setEditingPersonNameId] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const multiFileInputRef = useRef<HTMLInputElement>(null);
  const lastRenderedCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Active Person helper
  const activePerson = persons.find((p) => p.id === activePersonId) || persons[0];

  // Helper to update active person
  const updateActivePerson = (updates: Partial<PersonPhotoItem>) => {
    setPersons((prev) =>
      prev.map((p) => (p.id === activePersonId ? { ...p, ...updates } : p))
    );
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
              if (persons.length === 1 && persons[0].rawImage === SAMPLE_PORTRAIT_URL) {
                updateActivePerson({ rawImage: dataUrl, cropBox: undefined, quadCorners: undefined });
              } else {
                const newId = `person-${Date.now()}`;
                const newPerson: PersonPhotoItem = {
                  id: newId,
                  name: `Person ${persons.length + 1}`,
                  rawImage: dataUrl,
                  copies: 6,
                  rotation: 0,
                  brightness: 0,
                  contrast: 0,
                  saturation: 0,
                  sharpness: 0,
                  backgroundColor: '#ffffff',
                };
                setPersons((prev) => [...prev, newPerson]);
                setActivePersonId(newId);
              }
              setIsCropModalOpen(true);
            };
            reader.readAsDataURL(file);
            break;
          }
        }
      }
    };

    window.addEventListener('paste', handlePaste);
    return () => window.removeEventListener('paste', handlePaste);
  }, [persons, activePersonId]);

  // Load single or multiple files
  const loadFiles = (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter((f) => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    if (validFiles.length === 1) {
      const file = validFiles[0];
      const reader = new FileReader();
      reader.onload = (ev) => {
        const dataUrl = ev.target?.result as string;
        if (persons.length === 1 && persons[0].rawImage === SAMPLE_PORTRAIT_URL) {
          updateActivePerson({
            rawImage: dataUrl,
            cropBox: undefined,
            quadCorners: undefined,
            name: file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || 'Person 1',
          });
        } else {
          updateActivePerson({
            rawImage: dataUrl,
            cropBox: undefined,
            quadCorners: undefined,
          });
        }
        setIsCropModalOpen(true);
      };
      reader.readAsDataURL(file);
    } else {
      // Multiple files uploaded at once! Auto-create multiple persons
      validFiles.forEach((file, idx) => {
        const reader = new FileReader();
        reader.onload = (ev) => {
          const dataUrl = ev.target?.result as string;
          const newId = `person-${Date.now()}-${idx}`;
          const newPerson: PersonPhotoItem = {
            id: newId,
            name: file.name.replace(/\.[^/.]+$/, '').slice(0, 20) || `Person ${persons.length + idx + 1}`,
            rawImage: dataUrl,
            copies: 6,
            rotation: 0,
            brightness: 0,
            contrast: 0,
            saturation: 0,
            sharpness: 0,
            backgroundColor: '#ffffff',
          };

          setPersons((prev) => {
            if (prev.length === 1 && prev[0].rawImage === SAMPLE_PORTRAIT_URL && idx === 0) {
              return [newPerson];
            }
            return [...prev, newPerson];
          });

          if (idx === 0) {
            setActivePersonId(newId);
          }
        };
        reader.readAsDataURL(file);
      });
      confetti({ particleCount: 30, spread: 50, origin: { y: 0.7 } });
    }
  };

  // Add a new empty person or clone
  const handleAddNewPerson = () => {
    const newId = `person-${Date.now()}`;
    const newPerson: PersonPhotoItem = {
      id: newId,
      name: `Person ${persons.length + 1}`,
      rawImage: SAMPLE_PORTRAIT_URL,
      copies: 6,
      rotation: 0,
      brightness: 0,
      contrast: 0,
      saturation: 0,
      sharpness: 0,
      backgroundColor: '#ffffff',
    };
    setPersons((prev) => [...prev, newPerson]);
    setActivePersonId(newId);
  };

  // Remove person
  const handleRemovePerson = (idToRemove: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (persons.length <= 1) return;

    const remaining = persons.filter((p) => p.id !== idToRemove);
    setPersons(remaining);
    if (activePersonId === idToRemove) {
      setActivePersonId(remaining[0].id);
    }
  };

  // Duplicate person
  const handleDuplicatePerson = (personToDup: PersonPhotoItem, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const newId = `person-${Date.now()}`;
    const newPerson: PersonPhotoItem = {
      ...personToDup,
      id: newId,
      name: `${personToDup.name} (Copy)`,
    };
    setPersons((prev) => [...prev, newPerson]);
    setActivePersonId(newId);
  };

  // Calculate current dimensions in mm
  const currentWidthMm =
    selectedPreset.id === 'custom_photo' || sizeCategory !== 'passport'
      ? settings.customWidthMm
      : selectedPreset.widthMm;
  const currentHeightMm =
    selectedPreset.id === 'custom_photo' || sizeCategory !== 'passport'
      ? settings.customHeightMm
      : selectedPreset.heightMm;

  const maxColsFit = Math.max(1, Math.floor((selectedPaper.widthMm - 6 + settings.gapMm) / (currentWidthMm + settings.gapMm)));
  const maxRowsFit = Math.max(1, Math.floor((selectedPaper.heightMm - 6 + settings.gapMm) / (currentHeightMm + settings.gapMm)));
  const maxPossiblePhotos = maxColsFit * maxRowsFit;

  // Set photo quantity easily (1-click helper)
  const setPhotoQuantity = (count: number) => {
    const clamped = Math.max(1, Math.min(maxPossiblePhotos, count));
    setSettings((prev) => ({ ...prev, photoCount: clamped }));
    if (printMode === 'single') {
      updateActivePerson({ copies: clamped });
    }
  };

  // Set all persons' copies at once
  const setAllPersonsCopies = (copiesEach: number) => {
    setPersons((prev) =>
      prev.map((p) => ({
        ...p,
        copies: copiesEach,
      }))
    );
  };

  // Distribute copies equally on paper
  const handleEqualDistribute = () => {
    const perPerson = Math.max(1, Math.floor(maxPossiblePhotos / persons.length));
    setPersons((prev) =>
      prev.map((p) => ({
        ...p,
        copies: perPerson,
      }))
    );
  };

  // Change Print Size Preset
  const handlePresetChange = (preset: PassportPreset) => {
    setSelectedPreset(preset);
    setSettings((prev) => ({
      ...prev,
      presetId: preset.id,
      customWidthMm: preset.widthMm,
      customHeightMm: preset.heightMm,
    }));
  };

  // Change Paper Size
  const handlePaperChange = (paper: PaperSizeConfig) => {
    setSelectedPaper(paper);
  };

  // Set Size Category and adjust dimensions accordingly
  const handleSizeCategorySelect = (category: PrintSizeCategory) => {
    setSizeCategory(category);
    if (category === 'passport') {
      handlePresetChange(PASSPORT_PRESETS[0]);
    } else if (category === 'full_a4') {
      setSelectedPaper(PAPER_SIZES[0]); // A4
      setSettings((prev) => ({
        ...prev,
        presetId: 'custom_photo',
        customWidthMm: 198,
        customHeightMm: 285,
        photoCount: 1,
      }));
    } else if (category === '4x6') {
      setSelectedPaper(PAPER_SIZES[1]); // 4x6
      setSettings((prev) => ({
        ...prev,
        presetId: 'custom_photo',
        customWidthMm: 101.6,
        customHeightMm: 152.4,
        photoCount: 1,
      }));
    } else if (category === 'custom') {
      setSettings((prev) => ({
        ...prev,
        presetId: 'custom_photo',
      }));
    }
  };

  // Total copies calculation across all persons
  const totalCombinedCopies = persons.reduce((sum, p) => sum + (p.copies || 1), 0);

  // Active photo count depending on mode
  const currentDisplayCount =
    printMode === 'combined' && persons.length > 1
      ? totalCombinedCopies
      : (activePerson.copies || settings.photoCount || 6);

  // Process all persons & generate live sheet preview
  useEffect(() => {
    let isMounted = true;
    const renderAll = async () => {
      setIsProcessing(true);
      try {
        const processedItems: RenderPersonItem[] = [];

        for (const person of persons) {
          const personSettings: PassportSettings = {
            ...settings,
            brightness: person.brightness,
            contrast: person.contrast,
            saturation: person.saturation,
            sharpness: person.sharpness,
            backgroundColor: person.backgroundColor || settings.backgroundColor,
          };

          const pUrl = await processPassportImage(
            person.rawImage,
            personSettings,
            currentWidthMm,
            currentHeightMm,
            person.cropBox,
            person.quadCorners
          );

          person.processedPhotoUrl = pUrl;
          processedItems.push({
            id: person.id,
            name: person.name,
            photoUrl: pUrl,
            copies: person.copies,
          });
        }

        if (!isMounted) return;

        let sheetCanvas: HTMLCanvasElement;
        if (printMode === 'combined' && persons.length > 1) {
          sheetCanvas = await renderMultiPersonSheetCanvas(
            processedItems,
            selectedPaper,
            settings,
            currentWidthMm,
            currentHeightMm
          );
        } else {
          const activeItem = processedItems.find((p) => p.id === activePersonId) || processedItems[0];
          const singlePersonSettings: PassportSettings = {
            ...settings,
            photoCount: activePerson.copies || settings.photoCount || 6,
          };
          sheetCanvas = await renderPassportSheetCanvas(
            activeItem.photoUrl,
            selectedPaper,
            singlePersonSettings,
            currentWidthMm,
            currentHeightMm
          );
        }

        lastRenderedCanvasRef.current = sheetCanvas;
        setSheetPreviewUrl(sheetCanvas.toDataURL('image/jpeg', 0.92));
      } catch (err) {
        console.error('Error rendering sheet layout:', err);
      } finally {
        if (isMounted) setIsProcessing(false);
      }
    };

    renderAll();

    return () => {
      isMounted = false;
    };
  }, [
    persons,
    activePersonId,
    printMode,
    selectedPreset,
    selectedPaper,
    settings,
    sizeCategory,
    currentWidthMm,
    currentHeightMm,
  ]);

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
          <title>Print Photo Sheet - ${selectedPaper.name}</title>
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
    exportToPDF(
      lastRenderedCanvasRef.current,
      selectedPaper,
      `photo_sheet_${currentWidthMm}x${currentHeightMm}mm_${selectedPaper.id}.pdf`
    );
    confetti({ particleCount: 45, spread: 65, origin: { y: 0.8 } });
  };

  // Download Single Cropped Photo of Active Person
  const handleDownloadSinglePhoto = () => {
    if (!activePerson.processedPhotoUrl) return;
    const link = document.createElement('a');
    link.download = `${activePerson.name.toLowerCase().replace(/\s+/g, '_')}_${currentWidthMm}x${currentHeightMm}mm.jpg`;
    link.href = activePerson.processedPhotoUrl;
    link.click();
  };

  // 1-Click Fast AI Background Removal for Active Person
  const handleQuickAiBgRemove = async (targetColor: string = '#ffffff') => {
    if (!activePerson.rawImage || isAiBgRemoving) return;
    setIsAiBgRemoving(true);
    setAiBgStatus(
      targetColor === '#ffffff'
        ? `Isolating ${activePerson.name} & applying ICAO Pure White...`
        : 'AI neural background subtraction in progress...'
    );

    try {
      const result = await removeAiBackground(activePerson.rawImage, {
        targetBgColor: targetColor,
        featherRadius: 1,
        edgeSmoothing: true,
      });

      if (result.dataUrl) {
        updateActivePerson({
          rawImage: result.dataUrl,
          backgroundColor: targetColor,
        });
        setAiBgStatus('Background successfully replaced!');
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.7 } });
      }
    } catch (err) {
      console.warn('Quick AI background subtraction error:', err);
      setAiBgStatus('Background adjustment applied');
    } finally {
      setIsAiBgRemoving(false);
      setTimeout(() => setAiBgStatus(null), 3500);
    }
  };

  // Drag & drop handlers
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
      loadFiles(e.dataTransfer.files);
    }
  };

  // Preset quantities array for simple 1-click selection
  const quickQuantities = [1, 2, 4, 6, 8, 12, 18, 24, 30, 36].filter(
    (q) => q <= maxPossiblePhotos || q === 1
  );

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={`max-w-7xl mx-auto px-4 py-6 space-y-6 transition-all ${
        isDraggingOver ? 'ring-2 ring-blue-500 rounded-3xl bg-blue-500/5' : ''
      }`}
    >
      {/* Drag & Drop Full-screen Overlay */}
      {isDraggingOver && (
        <div className="fixed inset-0 z-50 bg-slate-950/85 backdrop-blur-md flex flex-col items-center justify-center p-6 border-4 border-dashed border-blue-500 animate-fade-in pointer-events-none">
          <div className="w-20 h-20 rounded-3xl bg-blue-600/30 text-blue-300 border border-blue-500/50 flex items-center justify-center mb-4 shadow-2xl animate-bounce">
            <Upload className="w-10 h-10" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-2">Drop Photo(s) Here</h2>
          <p className="text-sm text-blue-300 max-w-md text-center">
            Upload single or multiple portrait photos to automatically create individual cards for printing.
          </p>
        </div>
      )}

      {/* Prominent Header Guide */}
      <div className="glass-card p-6 rounded-2xl border border-white/10 shadow-xl bg-gradient-to-r from-slate-900/90 via-slate-900/70 to-blue-950/40">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-3 py-1 rounded-full text-xs font-bold bg-blue-500/20 text-blue-300 border border-blue-500/30 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-blue-400" />
                Photo Printing Studio
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                <Users className="w-3 h-3" />
                {persons.length} {persons.length === 1 ? 'Person' : 'People'}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                300 DPI High-Res Print
              </span>
            </div>
            
            <p className="text-sm md:text-base font-medium text-slate-100 leading-relaxed max-w-3xl">
              &ldquo;Upload photos, select size and how many copies to print, frame easily with Freeform or 4-Corner crop, and generate clean print-ready sheets instantly.&rdquo;
            </p>
          </div>

          {/* Quick Upload Actions */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => e.target.files && loadFiles(e.target.files)}
              accept="image/*"
              className="hidden"
            />
            <input
              type="file"
              ref={multiFileInputRef}
              onChange={(e) => e.target.files && loadFiles(e.target.files)}
              accept="image/*"
              multiple
              className="hidden"
            />

            <button
              onClick={() => multiFileInputRef.current?.click()}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold accent-glow transition-all shadow-lg"
              title="Upload one or multiple photos at once"
            >
              <Upload className="w-4 h-4" />
              Upload Photo(s)
            </button>

            <button
              onClick={() => setIsWebcamOpen(true)}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 rounded-xl glass-card hover:bg-white/10 text-slate-200 text-xs sm:text-sm font-medium border border-white/15 transition-all"
            >
              <Camera className="w-4 h-4 text-blue-400" />
              Webcam
            </button>

            <button
              onClick={handleAddNewPerson}
              className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs sm:text-sm font-semibold border border-emerald-500/30 transition-all"
              title="Add another person to the print sheet"
            >
              <UserPlus className="w-4 h-4" />
              + Add Person
            </button>
          </div>
        </div>

        {/* 4-Step Visual Flow Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5 pt-4 border-t border-white/10">
          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              1
            </span>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-200 truncate">Upload & Manage</div>
              <div className="text-[10px] text-slate-400">Add people & crop</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-white/5 border border-white/10">
            <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              2
            </span>
            <div className="truncate">
              <div className="text-xs font-semibold text-slate-200 truncate">Print Size & Paper</div>
              <div className="text-[10px] text-slate-400">Passport / A4 / 4x6 / Custom</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-blue-600/15 border border-blue-500/30">
            <span className="w-6 h-6 rounded-full bg-blue-500 text-white text-xs font-bold flex items-center justify-center shrink-0">
              3
            </span>
            <div className="truncate">
              <div className="text-xs font-bold text-blue-300 truncate">How Many Photos</div>
              <div className="text-[10px] text-blue-200/80">1, 4, 6, 8, 12, Max</div>
            </div>
          </div>

          <div className="flex items-center gap-2 p-2 rounded-xl bg-emerald-600/15 border border-emerald-500/30">
            <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center shrink-0">
              4
            </span>
            <div className="truncate">
              <div className="text-xs font-bold text-emerald-300 truncate">Preview & Print</div>
              <div className="text-[10px] text-emerald-200/80">Print / 300 DPI PDF</div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Grid: Left Controls (5 Cols), Right Live Layout Preview (7 Cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side Controls */}
        <div className="lg:col-span-5 space-y-5">
          {/* Section 1: Manage Persons & Crop */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                  1
                </span>
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  People & Cropping ({persons.length})
                </h2>
              </div>

              {/* Mode Toggle: Combined vs Single */}
              <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10 text-xs">
                <button
                  onClick={() => setPrintMode('combined')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    printMode === 'combined'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Print all persons together on the sheet"
                >
                  Group Sheet
                </button>
                <button
                  onClick={() => setPrintMode('single')}
                  className={`px-2.5 py-1 rounded-md transition-all font-medium ${
                    printMode === 'single'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                  title="Print only the selected person"
                >
                  Single Person
                </button>
              </div>
            </div>

            {/* List of Person Cards */}
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {persons.map((person, index) => {
                const isActive = person.id === activePersonId;
                return (
                  <div
                    key={person.id}
                    onClick={() => setActivePersonId(person.id)}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isActive
                        ? 'bg-blue-500/15 border-blue-500/60 ring-1 ring-blue-500/40 text-white'
                        : 'bg-black/20 border-white/10 hover:bg-white/5 text-slate-300'
                    }`}
                  >
                    {/* Thumbnail & Name */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-12 h-14 bg-slate-900 rounded-lg overflow-hidden border border-white/20 shrink-0 relative flex items-center justify-center">
                        <img
                          src={person.processedPhotoUrl || person.rawImage}
                          alt={person.name}
                          className="w-full h-full object-cover"
                        />
                        {isActive && (
                          <span className="absolute top-0.5 right-0.5 w-2 h-2 rounded-full bg-blue-400 ring-2 ring-black" />
                        )}
                      </div>

                      <div className="min-w-0">
                        {editingPersonNameId === person.id ? (
                          <input
                            type="text"
                            value={person.name}
                            autoFocus
                            onBlur={() => setEditingPersonNameId(null)}
                            onKeyDown={(e) => e.key === 'Enter' && setEditingPersonNameId(null)}
                            onChange={(e) =>
                              setPersons((prev) =>
                                prev.map((p) => (p.id === person.id ? { ...p, name: e.target.value } : p))
                              )
                            }
                            onClick={(e) => e.stopPropagation()}
                            className="bg-black/60 border border-blue-400 rounded px-1.5 py-0.5 text-xs text-white focus:outline-none"
                          />
                        ) : (
                          <div className="flex items-center gap-1.5 group">
                            <span className="text-xs font-bold text-slate-100 truncate">{person.name}</span>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditingPersonNameId(person.id);
                              }}
                              className="opacity-60 hover:opacity-100 text-slate-400 hover:text-blue-300"
                              title="Rename"
                            >
                              <Edit3 className="w-3 h-3" />
                            </button>
                          </div>
                        )}
                        <span className="text-[11px] text-slate-400 block">
                          Person #{index + 1} • <strong className="text-emerald-300">{person.copies || 1} copies</strong>
                        </span>
                      </div>
                    </div>

                    {/* Copies Stepper on Card */}
                    <div className="flex items-center gap-2 shrink-0">
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 bg-black/40 px-2 py-1 rounded-lg border border-white/10"
                      >
                        <button
                          onClick={() => {
                            const newCount = Math.max(1, (person.copies || 1) - 1);
                            setPersons((prev) =>
                              prev.map((p) => (p.id === person.id ? { ...p, copies: newCount } : p))
                            );
                            if (person.id === activePersonId) {
                              setSettings((prev) => ({ ...prev, photoCount: newCount }));
                            }
                          }}
                          disabled={(person.copies || 1) <= 1}
                          className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white flex items-center justify-center text-[10px]"
                          title="Fewer copies"
                        >
                          <Minus className="w-2.5 h-2.5" />
                        </button>
                        <span className="w-6 text-center text-xs font-bold text-emerald-300 font-mono">
                          {person.copies || 1}
                        </span>
                        <button
                          onClick={() => {
                            const newCount = Math.min(maxPossiblePhotos, (person.copies || 1) + 1);
                            setPersons((prev) =>
                              prev.map((p) => (p.id === person.id ? { ...p, copies: newCount } : p))
                            );
                            if (person.id === activePersonId) {
                              setSettings((prev) => ({ ...prev, photoCount: newCount }));
                            }
                          }}
                          className="w-5 h-5 rounded bg-white/10 hover:bg-white/20 text-white flex items-center justify-center text-[10px]"
                          title="More copies"
                        >
                          <Plus className="w-2.5 h-2.5" />
                        </button>
                      </div>

                      {/* Duplicate button */}
                      <button
                        onClick={(e) => handleDuplicatePerson(person, e)}
                        className="p-1.5 rounded-lg glass-card hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
                        title="Duplicate person"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>

                      {/* Delete button (if > 1 person) */}
                      {persons.length > 1 && (
                        <button
                          onClick={(e) => handleRemovePerson(person.id, e)}
                          className="p-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 transition-colors border border-red-500/20"
                          title="Remove person"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Active Person Editing Actions */}
            <div className="p-3.5 bg-black/30 rounded-xl border border-white/10 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                  <Crop className="w-3.5 h-3.5 text-blue-400" />
                  Crop & Edit Photo: <strong className="text-blue-300">{activePerson.name}</strong>
                </span>
                <span className="text-[11px] text-slate-400 font-mono">
                  {currentWidthMm} × {currentHeightMm} mm
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => setIsCropModalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold shadow-md transition-all"
                  title="Open Freeform Box or 4-Corner Perspective Warp Crop"
                >
                  <Crop className="w-4 h-4" />
                  Crop Photo
                </button>

                <button
                  onClick={() => setIsBgRemovalOpen(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 text-xs font-bold border border-purple-500/30 transition-colors"
                >
                  <Sparkles className="w-4 h-4 text-purple-400" />
                  AI BG Studio
                </button>
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => handleQuickAiBgRemove('#ffffff')}
                  disabled={isAiBgRemoving}
                  className="flex-1 inline-flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-slate-200 text-xs font-semibold border border-white/15 transition-all disabled:opacity-50"
                >
                  {isAiBgRemoving ? (
                    <RefreshCw className="w-3 h-3 animate-spin text-purple-400" />
                  ) : (
                    <ShieldCheck className="w-3 h-3 text-emerald-400" />
                  )}
                  1-Click Pure White BG
                </button>

                <button
                  onClick={handleDownloadSinglePhoto}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-lg glass-card hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10"
                  title="Download single cropped photo of active person"
                >
                  <Download className="w-3 h-3" />
                  Single JPG
                </button>
              </div>

              {aiBgStatus && (
                <div className="p-2 bg-purple-950/70 border border-purple-500/30 rounded-lg text-[11px] font-semibold text-purple-200 flex items-center gap-1.5 animate-fade-in">
                  <Sparkles className="w-3 h-3 text-purple-400 shrink-0" />
                  {aiBgStatus}
                </div>
              )}
            </div>
          </div>

          {/* Section 2: Choose Print Size & Target Paper */}
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-lg space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-[11px] font-bold flex items-center justify-center">
                  2
                </span>
                <h2 className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Print Size & Paper
                </h2>
              </div>
              <span className="text-xs font-mono text-blue-400 font-bold bg-blue-500/10 px-2 py-0.5 rounded border border-blue-500/20">
                {currentWidthMm} × {currentHeightMm} mm
              </span>
            </div>

            {/* 4 Category Pill Buttons */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-black/40 p-1.5 rounded-xl border border-white/10">
              <button
                onClick={() => handleSizeCategorySelect('passport')}
                className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                  sizeCategory === 'passport'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>Passport Size</span>
                <span className="text-[9px] opacity-80">30×40 / 35×45</span>
              </button>

              <button
                onClick={() => handleSizeCategorySelect('full_a4')}
                className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                  sizeCategory === 'full_a4'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>Full A4 Size</span>
                <span className="text-[9px] opacity-80">210 × 297 mm</span>
              </button>

              <button
                onClick={() => handleSizeCategorySelect('4x6')}
                className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                  sizeCategory === '4x6'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>4 × 6 Inch</span>
                <span className="text-[9px] opacity-80">10 × 15 cm</span>
              </button>

              <button
                onClick={() => handleSizeCategorySelect('custom')}
                className={`py-2 px-2 text-xs font-bold rounded-lg transition-all flex flex-col items-center gap-0.5 ${
                  sizeCategory === 'custom'
                    ? 'bg-blue-600 text-white shadow-md'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                }`}
              >
                <span>Custom Size</span>
                <span className="text-[9px] opacity-80">User Input</span>
              </button>
            </div>

            {/* Sub-options for Passport Size */}
            {sizeCategory === 'passport' && (
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-300">
                  Passport & Visa Dimension Presets:
                </label>
                <div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {PASSPORT_PRESETS.map((preset) => {
                    const isSelected = selectedPreset.id === preset.id;
                    return (
                      <button
                        key={preset.id}
                        onClick={() => handlePresetChange(preset)}
                        className={`p-2 rounded-xl border text-left text-xs transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-500/20 text-white font-semibold ring-1 ring-blue-500/40'
                            : 'border-white/10 hover:bg-white/5 text-slate-300'
                        }`}
                      >
                        <div className="truncate font-medium">{preset.name.split('(')[0]}</div>
                        <div className="text-[10px] text-blue-300 font-mono mt-0.5">
                          {preset.widthMm} × {preset.heightMm} mm
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Custom Dimensions Input Option */}
            {sizeCategory === 'custom' && (
              <div className="space-y-3 bg-black/30 p-3.5 rounded-xl border border-white/10">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-slate-200">
                    Custom Dimensions:
                  </label>
                  <div className="flex items-center gap-1 bg-black/50 p-0.5 rounded-lg border border-white/10 text-[10px]">
                    <button
                      onClick={() => setCustomUnit('mm')}
                      className={`px-2 py-0.5 rounded ${customUnit === 'mm' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      mm
                    </button>
                    <button
                      onClick={() => setCustomUnit('inch')}
                      className={`px-2 py-0.5 rounded ${customUnit === 'inch' ? 'bg-blue-600 text-white font-bold' : 'text-slate-400'}`}
                    >
                      inch
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Width ({customUnit})
                    </label>
                    <input
                      type="number"
                      step={customUnit === 'inch' ? '0.1' : '1'}
                      min={customUnit === 'inch' ? '0.5' : '10'}
                      max={customUnit === 'inch' ? '12' : '300'}
                      value={
                        customUnit === 'inch'
                          ? Number((settings.customWidthMm / 25.4).toFixed(2))
                          : settings.customWidthMm
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          const mm = customUnit === 'inch' ? Math.round(val * 25.4 * 10) / 10 : val;
                          setSettings((prev) => ({ ...prev, customWidthMm: mm }));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs font-mono font-bold text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-[11px] font-medium text-slate-400 mb-1">
                      Height ({customUnit})
                    </label>
                    <input
                      type="number"
                      step={customUnit === 'inch' ? '0.1' : '1'}
                      min={customUnit === 'inch' ? '0.5' : '10'}
                      max={customUnit === 'inch' ? '12' : '300'}
                      value={
                        customUnit === 'inch'
                          ? Number((settings.customHeightMm / 25.4).toFixed(2))
                          : settings.customHeightMm
                      }
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        if (!isNaN(val)) {
                          const mm = customUnit === 'inch' ? Math.round(val * 25.4 * 10) / 10 : val;
                          setSettings((prev) => ({ ...prev, customHeightMm: mm }));
                        }
                      }}
                      className="w-full px-2.5 py-1.5 glass-input rounded-lg text-xs font-mono font-bold text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Target Paper Selection */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-1.5">
                Target Print Paper:
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
          </div>

          {/* Section 3: Simple & Obvious "How Many Photos to Print?" Card */}
          <div className="glass-card rounded-2xl p-5 border border-blue-500/30 shadow-xl bg-gradient-to-b from-slate-900/90 to-blue-950/30 space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center">
                  3
                </span>
                <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Hash className="w-4 h-4 text-blue-400" />
                  How Many Photos to Print?
                </h2>
              </div>
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {currentDisplayCount} {currentDisplayCount === 1 ? 'Photo' : 'Photos'} Selected
              </span>
            </div>

            {/* Quick 1-Click Quantity Buttons */}
            <div>
              <label className="block text-xs font-semibold text-slate-300 mb-2">
                1-Click Quick Select:
              </label>
              <div className="grid grid-cols-4 sm:grid-cols-5 gap-1.5">
                {quickQuantities.map((num) => {
                  const isSelected = currentDisplayCount === num;
                  return (
                    <button
                      key={num}
                      onClick={() => setPhotoQuantity(num)}
                      className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all border ${
                        isSelected
                          ? 'bg-blue-600 border-blue-400 text-white shadow-lg ring-2 ring-blue-400/40 scale-102'
                          : 'bg-black/30 border-white/10 hover:bg-white/10 text-slate-300 hover:text-white'
                      }`}
                    >
                      <div className="text-sm font-black">{num}</div>
                      <div className="text-[9px] opacity-75 font-normal">
                        {num === 1
                          ? 'photo'
                          : num === 6
                          ? '1 row'
                          : num === 12
                          ? '2 rows'
                          : num === 18
                          ? '3 rows'
                          : num === 24
                          ? '4 rows'
                          : num === 30
                          ? '5 rows'
                          : num === 36
                          ? '6 rows'
                          : 'photos'}
                      </div>
                    </button>
                  );
                })}

                {/* Max / Fill Sheet Button */}
                <button
                  onClick={() => setPhotoQuantity(maxPossiblePhotos)}
                  className={`py-2 px-1 text-center rounded-xl text-xs font-bold transition-all border ${
                    currentDisplayCount === maxPossiblePhotos
                      ? 'bg-emerald-600 border-emerald-400 text-white shadow-lg ring-2 ring-emerald-400/40 scale-102'
                      : 'bg-emerald-950/40 border-emerald-500/30 hover:bg-emerald-900/50 text-emerald-300'
                  }`}
                  title="Fill entire paper sheet with maximum photos"
                >
                  <div className="text-sm font-black">{maxPossiblePhotos}</div>
                  <div className="text-[9px] opacity-90 font-medium">Fill Max</div>
                </button>
              </div>
            </div>

            {/* Big Tactile Stepper & Custom Number Input */}
            <div className="p-3 bg-black/40 rounded-xl border border-white/10 flex items-center justify-between gap-4">
              <span className="text-xs font-semibold text-slate-300">
                Custom Quantity:
              </span>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => setPhotoQuantity(currentDisplayCount - 1)}
                  disabled={currentDisplayCount <= 1}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white flex items-center justify-center transition-colors font-bold text-base"
                  title="Subtract 1 photo"
                >
                  <Minus className="w-4 h-4" />
                </button>

                <input
                  type="number"
                  min="1"
                  max={maxPossiblePhotos}
                  value={currentDisplayCount}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    if (!isNaN(val)) {
                      setPhotoQuantity(val);
                    }
                  }}
                  className="w-16 text-center py-1 bg-black/60 border border-blue-500/50 rounded-lg text-sm font-bold text-white font-mono focus:outline-none focus:ring-2 focus:ring-blue-400"
                />

                <button
                  onClick={() => setPhotoQuantity(currentDisplayCount + 1)}
                  disabled={currentDisplayCount >= maxPossiblePhotos}
                  className="w-8 h-8 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-20 text-white flex items-center justify-center transition-colors font-bold text-base"
                  title="Add 1 photo"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Sheet Capacity Progress Bar */}
            <div className="space-y-1.5 text-xs text-slate-400">
              <div className="flex justify-between items-center text-[11px]">
                <span>
                  Paper Capacity: <strong className="text-slate-200">{selectedPaper.name}</strong>
                </span>
                <span className="text-blue-300 font-mono font-semibold">
                  {currentDisplayCount} / {maxPossiblePhotos} slots ({Math.round((currentDisplayCount / maxPossiblePhotos) * 100)}%)
                </span>
              </div>
              <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-blue-500 to-emerald-500 transition-all duration-300 rounded-full"
                  style={{ width: `${Math.min(100, (currentDisplayCount / maxPossiblePhotos) * 100)}%` }}
                />
              </div>
            </div>

            {/* If Multiple Persons: Quick Global Distribution Helpers */}
            {persons.length > 1 && (
              <div className="pt-2 border-t border-white/10 space-y-2">
                <span className="text-[11px] font-semibold text-slate-300 block">
                  Quick Multi-Person Presets:
                </span>
                <div className="grid grid-cols-3 gap-1.5">
                  <button
                    onClick={() => setAllPersonsCopies(2)}
                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10"
                  >
                    2 Copies Each
                  </button>
                  <button
                    onClick={() => setAllPersonsCopies(4)}
                    className="px-2 py-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-medium border border-white/10"
                  >
                    4 Copies Each
                  </button>
                  <button
                    onClick={handleEqualDistribute}
                    className="px-2 py-1.5 rounded-lg bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 text-xs font-semibold border border-emerald-500/30 flex items-center justify-center gap-1"
                  >
                    <Split className="w-3 h-3" />
                    Fill Sheet Evenly
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Side: Step 4 (Layout Preview & Confirm Print) (7 Cols) */}
        <div className="lg:col-span-7 space-y-4">
          <div className="glass-card rounded-2xl p-5 border border-white/10 shadow-xl flex flex-col items-center">
            {/* Step 4 Header & Print Actions */}
            <div className="w-full flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center">
                  4
                </span>
                <span className="text-xs font-bold text-slate-200 uppercase tracking-wider">
                  Layout Preview ({currentDisplayCount} Photos on {selectedPaper.name})
                </span>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={handlePrintSheet}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl glass-card hover:bg-white/15 text-white text-xs font-semibold border border-white/20 transition-all shadow-md"
                >
                  <Printer className="w-4 h-4 text-blue-400" />
                  Print Direct
                </button>
                <button
                  onClick={handleDownloadPDF}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold accent-glow transition-all shadow-lg"
                >
                  <Download className="w-4 h-4" />
                  Download 300 DPI PDF
                </button>
              </div>
            </div>

            {/* Live Interactive Canvas Visualizer */}
            <div className="w-full my-4 p-4 bg-black/40 rounded-xl flex items-center justify-center border border-white/10 overflow-auto min-h-[460px]">
              {isProcessing ? (
                <div className="flex flex-col items-center gap-2 text-slate-400 py-16">
                  <RefreshCw className="w-7 h-7 animate-spin text-blue-400" />
                  <span className="text-xs font-medium">Generating {currentDisplayCount} photos layout...</span>
                </div>
              ) : sheetPreviewUrl ? (
                <div className="shadow-2xl border border-white/20 bg-white rounded-xs p-1 max-w-[480px]">
                  <img
                    src={sheetPreviewUrl}
                    alt="Print Sheet Preview"
                    className="w-full h-auto object-contain block"
                  />
                </div>
              ) : (
                <span className="text-xs text-slate-500">Loading layout preview...</span>
              )}
            </div>

            {/* Sheet Footer Details */}
            <div className="w-full space-y-3 pt-3 border-t border-white/10">
              <div className="flex flex-wrap items-center justify-between text-xs text-slate-400 gap-2">
                <div className="flex items-center gap-4 flex-wrap">
                  <span>
                    Paper: <strong className="text-slate-200">{selectedPaper.name}</strong> ({selectedPaper.widthMm} × {selectedPaper.heightMm} mm)
                  </span>
                  <span>
                    Photo: <strong className="text-slate-200">{currentWidthMm} × {currentHeightMm} mm</strong>
                  </span>
                  <span>
                    Printing: <strong className="text-emerald-400 font-bold">{currentDisplayCount} Photos</strong>
                  </span>
                </div>

                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5 text-xs text-slate-300 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={settings.showCutLines}
                      onChange={(e) =>
                        setSettings((prev) => ({ ...prev, showCutLines: e.target.checked }))
                      }
                      className="w-3.5 h-3.5 rounded text-blue-600 bg-black/40 border-white/20"
                    />
                    <span>Cut Lines</span>
                  </label>

                  <span className="text-emerald-400 font-medium">
                    ✓ 300 DPI High-Res
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Passport Crop Modal (Only Freeform Box Crop and 4-Corner Freecrop) */}
      {activePerson.rawImage && (
        <PassportCropModal
          isOpen={isCropModalOpen}
          onClose={() => setIsCropModalOpen(false)}
          imageSrc={activePerson.rawImage}
          preset={selectedPreset}
          customWidthMm={currentWidthMm}
          customHeightMm={currentHeightMm}
          initialCropBox={activePerson.cropBox}
          initialCorners={activePerson.quadCorners}
          onApplyCrop={(newBox, newCorners) => {
            updateActivePerson({
              cropBox: newBox,
              quadCorners: newCorners,
            });
          }}
        />
      )}

      {/* Background Removal Modal */}
      {activePerson.rawImage && (
        <BackgroundRemovalModal
          isOpen={isBgRemovalOpen}
          onClose={() => setIsBgRemovalOpen(false)}
          imageSrc={activePerson.rawImage}
          onApply={(newImage) => {
            updateActivePerson({
              rawImage: newImage,
              cropBox: undefined,
            });
          }}
        />
      )}

      {/* Webcam Modal */}
      <WebcamModal
        isOpen={isWebcamOpen}
        onClose={() => setIsWebcamOpen(false)}
        onCapture={(dataUrl) => {
          updateActivePerson({
            rawImage: dataUrl,
            cropBox: undefined,
          });
          setIsCropModalOpen(true);
        }}
        mode="passport"
      />
    </div>
  );
};
