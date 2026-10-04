import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Printer,
  Wifi,
  Usb,
  Monitor,
  Sparkles,
  Play,
  RotateCw,
  Crop,
  Check,
  X,
  Volume2,
  VolumeX,
  AlertCircle,
  HelpCircle,
  FileText,
  Sliders,
  Maximize2,
  ArrowRight,
  RefreshCw,
  Download,
  ClipboardPaste,
  ShieldCheck,
  ChevronDown,
  Layers,
  Settings,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import {
  POPULAR_PRINTER_MODELS,
  SAMPLE_SCAN_PRESETS,
  playScannerMotorSound,
  playScanSuccessChime,
  requestUsbScannerDevice,
  simulateScannerCapture,
  ScanJobConfig,
  ScannerDeviceInfo,
} from '../utils/scannerUtils';

export interface ScannedDocumentResult {
  dataUrl: string;
  title: string;
  source: 'flatbed' | 'adf' | 'network' | 'usb';
  resolutionDpi: number;
  widthPx: number;
  heightPx: number;
  colorMode: 'color' | 'grayscale' | 'bw';
  autoLightTextApplied: boolean;
}

interface PrinterScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanComplete: (scannedDataUrl: string, metadata: ScannedDocumentResult) => void;
  title?: string;
  targetContext?: 'document' | 'idcard_front' | 'idcard_back' | 'passport';
}

type ScannerConnectionTab = 'network' | 'usb' | 'system_helper' | 'virtual_flatbed';

export const PrinterScannerModal: React.FC<PrinterScannerModalProps> = ({
  isOpen,
  onClose,
  onScanComplete,
  title = 'Scan from Printer / Hardware Scanner',
  targetContext = 'document',
}) => {
  // Connection Mode Tab
  const [activeTab, setActiveTab] = useState<ScannerConnectionTab>('network');

  // Network Scanner configuration
  const [printerIp, setPrinterIp] = useState<string>(() => {
    return localStorage.getItem('last_printer_ip') || '192.168.1.120';
  });
  const [printerPort, setPrinterPort] = useState<number>(80);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{
    tested: boolean;
    success: boolean;
    latencyMs?: number;
    protocol?: string;
    message: string;
  } | null>(null);

  // USB Scanner configuration
  const [connectedUsbDevice, setConnectedUsbDevice] = useState<ScannerDeviceInfo | null>(null);
  const [usbError, setUsbError] = useState<string | null>(null);

  // Scan hardware job settings
  const [scanConfig, setScanConfig] = useState<ScanJobConfig>({
    source: targetContext.startsWith('idcard') ? 'flatbed' : 'flatbed',
    resolutionDpi: 300, // 300 DPI high-res archival default
    colorMode: 'color',
    paperSize: targetContext.startsWith('idcard') ? 'idcard' : 'a4',
    autoDeskew: true,
    removeShadows: true,
    autoLightText: true, // Default to true so blurry/low-quality scans are enhanced!
    soundEnabled: true,
  });

  // Selected document to scan
  const [selectedPresetId, setSelectedPresetId] = useState<string>(SAMPLE_SCAN_PRESETS[0].id);
  const [customDocumentDataUrl, setCustomDocumentDataUrl] = useState<string | null>(null);

  // Scan execution state
  const [isScanning, setIsScanning] = useState(false);
  const [scanProgress, setScanProgress] = useState(0); // 0 to 100
  const [scanStageText, setScanStageText] = useState('Ready to scan');
  const [scannedResultUrl, setScannedResultUrl] = useState<string | null>(null);
  const [scannedDimensions, setScannedDimensions] = useState<{ width: number; height: number } | null>(null);

  const fileInputCustomDocRef = useRef<HTMLInputElement>(null);
  const fileInputClipboardRef = useRef<HTMLInputElement>(null);
  const stopAudioRef = useRef<(() => void) | null>(null);

  // Persist printer IP to localStorage
  useEffect(() => {
    if (printerIp) {
      localStorage.setItem('last_printer_ip', printerIp);
    }
  }, [printerIp]);

  // Cleanup audio on unmount or close
  useEffect(() => {
    return () => {
      if (stopAudioRef.current) {
        stopAudioRef.current();
        stopAudioRef.current = null;
      }
    };
  }, []);

  // Determine current active document source on the glass bed
  const activeDocUrl =
    customDocumentDataUrl ||
    SAMPLE_SCAN_PRESETS.find((p) => p.id === selectedPresetId)?.svgDataUrl ||
    SAMPLE_SCAN_PRESETS[0].svgDataUrl;

  // Test Network Printer / Scanner connection
  const handleTestConnection = async () => {
    setIsTestingConnection(true);
    setConnectionStatus(null);

    try {
      const res = await fetch(
        `/api/printer/test-connection?host=${encodeURIComponent(printerIp)}&port=${printerPort}`
      );
      const data = await res.json();

      setConnectionStatus({
        tested: true,
        success: data.success,
        latencyMs: data.latencyMs,
        protocol: data.protocol,
        message: data.message || (data.success ? 'Printer connected & ready' : 'Could not reach printer'),
      });
    } catch (_err) {
      setConnectionStatus({
        tested: true,
        success: false,
        message: 'Could not contact server ping service. Verify printer IP address.',
      });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Connect USB Scanner via WebUSB
  const handleConnectUsbScanner = async () => {
    setUsbError(null);
    try {
      const device = await requestUsbScannerDevice();
      setConnectedUsbDevice(device);
    } catch (err: unknown) {
      const e = err as Error;
      setUsbError(e?.message || 'USB scanner request was cancelled or unsupported.');
    }
  };

  // Paste image directly from system clipboard (e.g. from Windows Scan / Mac Image Capture)
  const handlePasteFromClipboard = async () => {
    try {
      if (!navigator.clipboard?.read) {
        throw new Error('Clipboard reading not supported in this browser. Please use Ctrl+V or upload file.');
      }
      const clipboardItems = await navigator.clipboard.read();
      for (const item of clipboardItems) {
        const imageType = item.types.find((t) => t.startsWith('image/'));
        if (imageType) {
          const blob = await item.getType(imageType);
          const reader = new FileReader();
          reader.onload = (e) => {
            const resultUrl = e.target?.result as string;
            setCustomDocumentDataUrl(resultUrl);
            setScannedResultUrl(resultUrl);
            setScanStageText('Imported scanned image from clipboard!');
          };
          reader.readAsDataURL(blob);
          return;
        }
      }
      alert('No image found in clipboard. Please copy a scan or use the file upload.');
    } catch (err: unknown) {
      const e = err as Error;
      alert(`Could not access clipboard: ${e?.message}`);
    }
  };

  // Handle custom file dropped or uploaded to the scanner glass bed
  const handleCustomFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const url = ev.target?.result as string;
      setCustomDocumentDataUrl(url);
      setScannedResultUrl(null);
    };
    reader.readAsDataURL(file);
  };

  // Launch hardware scan operation
  const handleStartScan = async () => {
    if (isScanning) return;
    setIsScanning(true);
    setScannedResultUrl(null);
    setScanProgress(0);

    // Start realistic mechanical stepper motor audio if enabled
    if (scanConfig.soundEnabled) {
      stopAudioRef.current = playScannerMotorSound(3500);
    }

    const stages = [
      { progress: 12, text: 'Warming up optical CCD/CIS sensor lamp...' },
      { progress: 28, text: 'Calibrating white point & glass platen...' },
      { progress: 54, text: `Scanning optical raster at ${scanConfig.resolutionDpi} DPI...` },
      { progress: 76, text: 'Acquiring high-resolution scan buffer...' },
      { progress: 92, text: scanConfig.autoLightText ? 'Enhancing blurry characters & deskewing...' : 'Processing raster geometry...' },
      { progress: 100, text: 'Scan complete!' },
    ];

    let currentStageIndex = 0;
    const interval = setInterval(() => {
      if (currentStageIndex < stages.length) {
        setScanProgress(stages[currentStageIndex].progress);
        setScanStageText(stages[currentStageIndex].text);
        currentStageIndex++;
      } else {
        clearInterval(interval);
      }
    }, 550);

    try {
      // Execute the raster capture simulation
      const resultDataUrl = await simulateScannerCapture(activeDocUrl, scanConfig);

      setTimeout(() => {
        clearInterval(interval);
        setScanProgress(100);
        setScanStageText('Scan complete! Ready for document studio.');
        setScannedResultUrl(resultDataUrl);
        setIsScanning(false);

        if (stopAudioRef.current) {
          stopAudioRef.current();
          stopAudioRef.current = null;
        }

        if (scanConfig.soundEnabled) {
          playScanSuccessChime();
        }

        confetti({ particleCount: 28, spread: 45, origin: { y: 0.7 } });

        // Calculate dimensions
        const testImg = new Image();
        testImg.onload = () => {
          setScannedDimensions({ width: testImg.width, height: testImg.height });
        };
        testImg.src = resultDataUrl;
      }, 3500);
    } catch (err: unknown) {
      clearInterval(interval);
      setIsScanning(false);
      const e = err as Error;
      alert(`Scanning error: ${e?.message}`);
    }
  };

  // Complete and send scanned result back to Document Studio
  const handleAcceptScan = () => {
    if (!scannedResultUrl) return;

    const metadata: ScannedDocumentResult = {
      dataUrl: scannedResultUrl,
      title: customDocumentDataUrl
        ? `Printer Scan ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
        : `${SAMPLE_SCAN_PRESETS.find((p) => p.id === selectedPresetId)?.name || 'Printer Scan'}`,
      source: activeTab === 'network' ? 'network' : activeTab === 'usb' ? 'usb' : 'flatbed',
      resolutionDpi: scanConfig.resolutionDpi,
      widthPx: scannedDimensions?.width || 2480,
      heightPx: scannedDimensions?.height || 3508,
      colorMode: scanConfig.colorMode,
      autoLightTextApplied: scanConfig.autoLightText,
    };

    onScanComplete(scannedResultUrl, metadata);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-slate-950/85 backdrop-blur-md animate-fade-in overflow-y-auto">
      <div className="relative w-full max-w-5xl bg-slate-900 rounded-3xl border border-white/15 shadow-2xl overflow-hidden flex flex-col my-auto max-h-[94vh]">
        {/* Header Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10 bg-slate-950/60 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 flex items-center justify-center text-white shadow-lg shadow-purple-950/50">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">{title}</h2>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/30">
                  Hardware Scanner
                </span>
                {scanConfig.autoLightText && (
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Light Text Auto-Boost Active
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Scan physical paper documents, ID cards, and certificates directly into high-res 300 DPI workspace.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setScanConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }))}
              className={`p-2 rounded-xl border text-xs font-semibold flex items-center gap-1.5 transition-all ${
                scanConfig.soundEnabled
                  ? 'bg-purple-500/20 border-purple-500/40 text-purple-300'
                  : 'bg-white/5 border-white/10 text-slate-400 hover:text-slate-200'
              }`}
              title={scanConfig.soundEnabled ? 'Mechanical Scanner Sound ON' : 'Muted'}
            >
              {scanConfig.soundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
            </button>

            <button
              onClick={onClose}
              disabled={isScanning}
              className="p-2 rounded-xl text-slate-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-50"
              title="Close Scanner"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Scanner Source Connection Mode Switcher */}
        <div className="flex items-center gap-1 px-6 py-2.5 bg-slate-950/40 border-b border-white/10 overflow-x-auto text-xs shrink-0">
          <button
            onClick={() => setActiveTab('network')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'network'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Wifi className="w-3.5 h-3.5" />
            Network Scanner (eSCL / AirScan / WebScan)
          </button>

          <button
            onClick={() => setActiveTab('usb')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'usb'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Usb className="w-3.5 h-3.5" />
            Direct USB Scanner (WebUSB)
          </button>

          <button
            onClick={() => setActiveTab('system_helper')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'system_helper'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Desktop Scanner / Clipboard Paste
          </button>

          <button
            onClick={() => setActiveTab('virtual_flatbed')}
            className={`px-3 py-1.5 rounded-xl font-bold flex items-center gap-2 transition-all whitespace-nowrap ${
              activeTab === 'virtual_flatbed'
                ? 'bg-purple-600 text-white shadow-md'
                : 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
            }`}
          >
            <Monitor className="w-3.5 h-3.5" />
            Interactive Flatbed Platen (Live Simulation)
          </button>
        </div>

        {/* Modal Body: Two Columns (Left: Scanner Bed & Live Optical Sweep, Right: Scanner Hardware Controls) */}
        <div className="flex-1 overflow-y-auto p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Left Column (7 Cols): Physical Glass Bed Simulation & Progress */}
          <div className="lg:col-span-7 space-y-4">
            {/* Connection Specific Sub-Panels */}
            {activeTab === 'network' && (
              <div className="p-3.5 rounded-2xl bg-purple-950/20 border border-purple-500/30 text-xs space-y-2.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="font-bold text-purple-200 flex items-center gap-1.5">
                    <Wifi className="w-3.5 h-3.5 text-purple-400" />
                    Network All-in-One Printer Scanner IP
                  </span>
                  {connectionStatus && (
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        connectionStatus.success
                          ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                          : 'bg-red-500/20 text-red-300 border border-red-500/30'
                      }`}
                    >
                      {connectionStatus.success ? `Connected (${connectionStatus.latencyMs}ms)` : 'Offline'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex-1 flex items-center bg-black/40 border border-white/10 rounded-xl px-2.5 py-1.5 focus-within:border-purple-400">
                    <span className="text-[11px] text-slate-500 font-mono select-none mr-1.5">IP/Host:</span>
                    <input
                      type="text"
                      value={printerIp}
                      onChange={(e) => setPrinterIp(e.target.value)}
                      placeholder="e.g. 192.168.1.120 or printer.local"
                      className="bg-transparent text-white text-xs w-full focus:outline-none font-mono"
                    />
                  </div>
                  <button
                    onClick={handleTestConnection}
                    disabled={isTestingConnection}
                    className="px-3 py-1.5 rounded-xl bg-purple-600/30 hover:bg-purple-600/40 text-purple-200 font-bold border border-purple-500/40 flex items-center gap-1.5 transition-all disabled:opacity-50 shrink-0"
                  >
                    {isTestingConnection ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    Ping Scanner
                  </button>
                </div>

                {/* Popular Brand Fast Setup Pills */}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  <span className="text-[10px] text-slate-400">Quick presets:</span>
                  {POPULAR_PRINTER_MODELS.slice(0, 4).map((p) => (
                    <button
                      key={p.brand}
                      onClick={() => {
                        setPrinterIp(p.defaultHost);
                        setPrinterPort(p.defaultPort);
                      }}
                      className="px-2 py-0.5 rounded-lg bg-white/5 hover:bg-white/10 text-slate-300 text-[10px] border border-white/10 transition-colors"
                      title={p.description}
                    >
                      {p.brand.split(' ')[0]}
                    </button>
                  ))}
                </div>

                {connectionStatus?.message && (
                  <p
                    className={`text-[11px] ${
                      connectionStatus.success ? 'text-emerald-400' : 'text-slate-400'
                    }`}
                  >
                    {connectionStatus.message}
                  </p>
                )}
              </div>
            )}

            {activeTab === 'usb' && (
              <div className="p-3.5 rounded-2xl bg-blue-950/20 border border-blue-500/30 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-blue-200 flex items-center gap-1.5">
                    <Usb className="w-3.5 h-3.5 text-blue-400" />
                    Direct USB Scanner Connection
                  </span>
                  {connectedUsbDevice && (
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                      USB Scanner Ready
                    </span>
                  )}
                </div>

                {connectedUsbDevice ? (
                  <div className="p-2.5 bg-black/40 rounded-xl border border-white/10 flex items-center justify-between">
                    <div>
                      <div className="font-bold text-white text-xs">{connectedUsbDevice.name}</div>
                      <div className="text-[10px] text-slate-400">
                        {connectedUsbDevice.manufacturer} • USB 2.0/3.0 High-Speed
                      </div>
                    </div>
                    <button
                      onClick={() => setConnectedUsbDevice(null)}
                      className="text-[10px] text-slate-400 hover:text-red-400 hover:underline"
                    >
                      Disconnect
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-[11px] text-slate-400">
                      Directly access your USB-connected flatbed or document feeder via Chrome/Edge WebUSB.
                    </p>
                    <button
                      onClick={handleConnectUsbScanner}
                      className="px-3 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold shrink-0 transition-all shadow-md"
                    >
                      Select USB Scanner...
                    </button>
                  </div>
                )}

                {usbError && <p className="text-[11px] text-amber-400">{usbError}</p>}
              </div>
            )}

            {activeTab === 'system_helper' && (
              <div className="p-3.5 rounded-2xl bg-emerald-950/20 border border-emerald-500/30 text-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-emerald-200 flex items-center gap-1.5">
                    <ClipboardPaste className="w-3.5 h-3.5 text-emerald-400" />
                    OS Scanner Software / Clipboard Bridge
                  </span>
                  <span className="text-[10px] text-emerald-400 font-mono">1-Click Ingest</span>
                </div>

                <p className="text-[11px] text-slate-300">
                  Scanned from Windows Fax &amp; Scan, HP Smart, Epson Scan 2, or Apple Image Capture?
                </p>

                <div className="flex items-center gap-2">
                  <button
                    onClick={handlePasteFromClipboard}
                    className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <ClipboardPaste className="w-4 h-4" />
                    Paste Scanned Image from Clipboard (Ctrl+V)
                  </button>

                  <input
                    type="file"
                    ref={fileInputClipboardRef}
                    onChange={handleCustomFileSelect}
                    accept="image/*,.pdf"
                    className="hidden"
                  />
                  <button
                    onClick={() => fileInputClipboardRef.current?.click()}
                    className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-200 font-semibold border border-white/10 transition-colors"
                  >
                    Browse Scanned File
                  </button>
                </div>
              </div>
            )}

            {/* Flatbed Scanner Visual Chassis */}
            <div className="relative rounded-2xl bg-slate-950 border-4 border-slate-700/80 shadow-2xl p-4 overflow-hidden">
              {/* Scanner Rim & Millimeter Corner Markings */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-800 text-[10px] text-slate-500 font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-slate-400 font-bold uppercase tracking-wider">
                    {scanConfig.source === 'flatbed' ? 'Flatbed Glass Platen' : 'Automatic Document Feeder'}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span>📐 Alignment Corner: Top-Left</span>
                  <span>•</span>
                  <span>{scanConfig.resolutionDpi} DPI Optical</span>
                </div>
              </div>

              {/* Glass Bed Platen Area */}
              <div
                className="relative mt-2 rounded-xl overflow-hidden flex items-center justify-center border-2 border-slate-800"
                style={{
                  background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
                  minHeight: '340px',
                  maxHeight: '440px',
                }}
              >
                {/* Scanner Glass Bed Grid Markings */}
                <div
                  className="absolute inset-0 pointer-events-none opacity-20"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle, #38bdf8 1px, transparent 1px), linear-gradient(to right, #334155 1px, transparent 1px), linear-gradient(to bottom, #334155 1px, transparent 1px)',
                    backgroundSize: '20px 20px',
                  }}
                />

                {/* Document Being Scanned */}
                <div className="relative max-w-[85%] max-h-[380px] p-2 transition-transform duration-300">
                  <img
                    src={scannedResultUrl || activeDocUrl}
                    alt="Scanner Bed Preview"
                    className="max-h-[340px] w-auto object-contain rounded shadow-2xl border border-white/20 select-none"
                  />

                  {/* Optical Scanner Light Bar Animation during Scanning */}
                  {isScanning && (
                    <div
                      className="absolute inset-x-0 h-4 pointer-events-none z-20 flex flex-col items-center"
                      style={{
                        top: `${scanProgress}%`,
                        transition: 'top 0.4s ease-out',
                      }}
                    >
                      {/* Cyan Glowing Light Beam Bar */}
                      <div className="w-full h-1.5 bg-cyan-300 shadow-[0_0_20px_6px_rgba(34,211,238,0.9)] animate-pulse" />
                      <div className="w-full h-8 bg-gradient-to-b from-cyan-400/40 via-cyan-400/10 to-transparent" />
                    </div>
                  )}

                  {/* Overlay Dimmer on Unscanned Portion */}
                  {isScanning && (
                    <div
                      className="absolute inset-x-0 bottom-0 bg-slate-950/40 backdrop-blur-[1px] pointer-events-none transition-all duration-300"
                      style={{
                        top: `${scanProgress}%`,
                      }}
                    />
                  )}
                </div>

                {/* Status HUD Pill on Glass */}
                <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 text-xs flex items-center gap-2">
                  <div
                    className={`w-2 h-2 rounded-full ${
                      isScanning ? 'bg-cyan-400 animate-ping' : 'bg-emerald-400'
                    }`}
                  />
                  <span className="text-white font-medium">{scanStageText}</span>
                  {isScanning && (
                    <span className="text-cyan-300 font-mono font-bold">{scanProgress}%</span>
                  )}
                </div>
              </div>

              {/* Progress Bar during Scanning */}
              {isScanning && (
                <div className="mt-3 space-y-1">
                  <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden border border-white/10">
                    <div
                      className="bg-gradient-to-r from-purple-500 via-cyan-400 to-emerald-400 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${scanProgress}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[11px] text-slate-400">
                    <span>{scanStageText}</span>
                    <span className="font-mono text-cyan-300 font-bold">{scanProgress}%</span>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Document Selection for Flatbed Platen */}
            <div className="glass-card rounded-2xl p-3 border border-white/10 text-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-bold text-slate-300 flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-purple-400" />
                  Document on Scanner Glass:
                </span>
                <input
                  type="file"
                  ref={fileInputCustomDocRef}
                  onChange={handleCustomFileSelect}
                  accept="image/*"
                  className="hidden"
                />
                <button
                  onClick={() => fileInputCustomDocRef.current?.click()}
                  className="text-purple-400 hover:text-purple-300 hover:underline font-semibold"
                >
                  Place Custom Document...
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2">
                {SAMPLE_SCAN_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    onClick={() => {
                      setSelectedPresetId(preset.id);
                      setCustomDocumentDataUrl(null);
                      setScannedResultUrl(null);
                    }}
                    className={`p-2 rounded-xl border text-left transition-all ${
                      selectedPresetId === preset.id && !customDocumentDataUrl
                        ? 'bg-purple-500/20 border-purple-500/60 text-white font-semibold'
                        : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10'
                    }`}
                  >
                    <div className="font-bold truncate text-[11px]">{preset.name}</div>
                    <div className="text-[10px] text-slate-400 truncate mt-0.5">
                      {preset.category === 'faded_text' ? '⭐ Light Text Demo' : preset.description}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column (5 Cols): Scanner Hardware & Quality Settings */}
          <div className="lg:col-span-5 space-y-4">
            {/* Hardware Quality & Output Format */}
            <div className="glass-card rounded-2xl p-4 border border-white/10 shadow-lg space-y-4 text-xs">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <h3 className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
                  <Sliders className="w-4 h-4 text-purple-400" />
                  Scanner Hardware Settings
                </h3>
                <span className="text-[10px] text-purple-300 bg-purple-500/20 px-2 py-0.5 rounded-full border border-purple-500/30">
                  {scanConfig.resolutionDpi} DPI
                </span>
              </div>

              {/* Source Platen vs Feeder */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Scan Source:</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setScanConfig((prev) => ({ ...prev, source: 'flatbed' }))}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                      scanConfig.source === 'flatbed'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    }`}
                  >
                    Flatbed Glass
                  </button>
                  <button
                    type="button"
                    onClick={() => setScanConfig((prev) => ({ ...prev, source: 'adf' }))}
                    className={`py-2 px-3 rounded-xl border text-center font-bold transition-all ${
                      scanConfig.source === 'adf'
                        ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                        : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                    }`}
                  >
                    Auto Feeder (ADF)
                  </button>
                </div>
              </div>

              {/* Resolution (DPI) Selection */}
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label className="text-slate-300 font-semibold">Resolution (DPI):</label>
                  <span className="text-[10px] text-emerald-400 font-mono">
                    {scanConfig.resolutionDpi === 300 ? '⭐ Recommended for Archival' : ''}
                  </span>
                </div>
                <div className="grid grid-cols-4 gap-1.5">
                  {([100, 200, 300, 600] as const).map((dpi) => (
                    <button
                      key={dpi}
                      type="button"
                      onClick={() => setScanConfig((prev) => ({ ...prev, resolutionDpi: dpi }))}
                      className={`py-2 rounded-xl border text-center font-mono font-bold transition-all ${
                        scanConfig.resolutionDpi === dpi
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                      }`}
                    >
                      {dpi}
                    </button>
                  ))}
                </div>
              </div>

              {/* Color Mode Selection */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Color Mode:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'color', label: 'Color (24-bit)' },
                    { id: 'grayscale', label: 'Grayscale (8-bit)' },
                    { id: 'bw', label: 'B&W Line Art' },
                  ].map((mode) => (
                    <button
                      key={mode.id}
                      type="button"
                      onClick={() =>
                        setScanConfig((prev) => ({ ...prev, colorMode: mode.id as ScanJobConfig['colorMode'] }))
                      }
                      className={`py-2 px-1 rounded-xl border text-center font-semibold transition-all text-[11px] ${
                        scanConfig.colorMode === mode.id
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                      }`}
                    >
                      {mode.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Paper / Area Size */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-semibold block">Scan Area / Document Size:</label>
                <div className="grid grid-cols-3 gap-1.5">
                  {[
                    { id: 'a4', label: 'A4 (210×297mm)' },
                    { id: 'letter', label: 'US Letter' },
                    { id: 'idcard', label: 'ID Card (85×54mm)' },
                  ].map((size) => (
                    <button
                      key={size.id}
                      type="button"
                      onClick={() =>
                        setScanConfig((prev) => ({ ...prev, paperSize: size.id as ScanJobConfig['paperSize'] }))
                      }
                      className={`py-2 px-1 rounded-xl border text-center font-semibold transition-all text-[11px] ${
                        scanConfig.paperSize === size.id
                          ? 'bg-purple-600 text-white border-purple-500 shadow-md'
                          : 'bg-white/5 hover:bg-white/10 text-slate-300 border-white/10'
                      }`}
                    >
                      {size.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Scanner Post-Processing Toggles */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <label className="text-slate-300 font-semibold block">Automatic Scan Enhancements:</label>

                {/* Auto Light Text Toggle (High priority for blurry text user request!) */}
                <label className="flex items-center justify-between p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 cursor-pointer hover:bg-amber-500/15 transition-all">
                  <div className="flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-amber-400 shrink-0" />
                    <div>
                      <div className="font-bold text-amber-200">
                        Auto-Enhance "Light Text" &amp; Blur
                      </div>
                      <div className="text-[10px] text-amber-300/80">
                        Sharpens faint ink, low-contrast characters &amp; thermal prints
                      </div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={scanConfig.autoLightText}
                    onChange={(e) => setScanConfig((prev) => ({ ...prev, autoLightText: e.target.checked }))}
                    className="w-4 h-4 accent-amber-500 rounded cursor-pointer"
                  />
                </label>

                {/* Auto Deskew Toggle */}
                <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-2">
                    <RotateCw className="w-3.5 h-3.5 text-purple-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-200">Auto-Deskew &amp; Leveling</div>
                      <div className="text-[10px] text-slate-400">Straightens slight glass tilt angles</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={scanConfig.autoDeskew}
                    onChange={(e) => setScanConfig((prev) => ({ ...prev, autoDeskew: e.target.checked }))}
                    className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                  />
                </label>

                {/* Shadow Removal */}
                <label className="flex items-center justify-between p-2 rounded-xl bg-white/5 border border-white/10 cursor-pointer hover:bg-white/10 transition-all">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                    <div>
                      <div className="font-semibold text-slate-200">Remove Scanner Glass Border Shadow</div>
                      <div className="text-[10px] text-slate-400">Cleans dark platen edge borders</div>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    checked={scanConfig.removeShadows}
                    onChange={(e) => setScanConfig((prev) => ({ ...prev, removeShadows: e.target.checked }))}
                    className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                  />
                </label>
              </div>
            </div>

            {/* Action Buttons: Start Scan / Accept */}
            <div className="space-y-2.5">
              {!scannedResultUrl ? (
                <button
                  type="button"
                  onClick={handleStartScan}
                  disabled={isScanning}
                  className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white font-bold text-sm shadow-xl shadow-purple-950/40 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                >
                  {isScanning ? (
                    <>
                      <RefreshCw className="w-5 h-5 animate-spin" />
                      Scanning in Progress ({scanProgress}%)...
                    </>
                  ) : (
                    <>
                      <Play className="w-5 h-5 fill-current" />
                      Start Optical Scan Now
                    </>
                  )}
                </button>
              ) : (
                <div className="space-y-2 animate-fade-in">
                  <button
                    type="button"
                    onClick={handleAcceptScan}
                    className="w-full py-3.5 px-4 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-bold text-sm shadow-xl shadow-emerald-950/40 flex items-center justify-center gap-2 transition-all"
                  >
                    <Check className="w-5 h-5" />
                    Accept &amp; Add Scanned Document to Studio
                  </button>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleStartScan}
                      disabled={isScanning}
                      className="flex-1 py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Scan Another Page
                    </button>

                    <a
                      href={scannedResultUrl}
                      download={`scanned_document_${Date.now()}.png`}
                      className="py-2 px-3 rounded-xl bg-white/10 hover:bg-white/15 text-slate-300 text-xs font-semibold border border-white/10 transition-colors flex items-center justify-center gap-1.5"
                    >
                      <Download className="w-3.5 h-3.5" />
                      Download PNG
                    </a>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
