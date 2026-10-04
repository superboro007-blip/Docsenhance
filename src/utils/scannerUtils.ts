/**
 * Scanner Utility functions for Printer / All-in-One Scanner Integration
 * Supports:
 * - Network Scanner (eSCL / AirScan / Mopria / WebScan)
 * - WebUSB Direct Scanner Detection
 * - Web Audio API Synthesized Mechanical Scanner Stepper Sounds
 * - Authentic Document Test Templates & High-Resolution Scan Simulation
 */

export interface ScannerDeviceInfo {
  id: string;
  name: string;
  manufacturer: string;
  type: 'network_escl' | 'network_webscan' | 'usb' | 'system_bridge' | 'virtual';
  hostOrIp?: string;
  port?: number;
  status: 'online' | 'ready' | 'busy' | 'offline';
  capabilities?: {
    flatbed: boolean;
    adf: boolean;
    duplex: boolean;
    colorModes: ('color' | 'grayscale' | 'bw')[];
    maxDpi: number;
    supportedSizes: string[];
  };
}

export interface ScanJobConfig {
  source: 'flatbed' | 'adf';
  resolutionDpi: 100 | 200 | 300 | 600;
  colorMode: 'color' | 'grayscale' | 'bw';
  paperSize: 'a4' | 'letter' | 'idcard' | 'custom';
  autoDeskew: boolean;
  removeShadows: boolean;
  autoLightText: boolean;
  soundEnabled: boolean;
}

// Built-in presets for popular network printer brands
export const POPULAR_PRINTER_MODELS: {
  brand: string;
  defaultHost: string;
  defaultPort: number;
  protocol: string;
  description: string;
}[] = [
  {
    brand: 'HP OfficeJet / LaserJet / Smart Tank',
    defaultHost: '192.168.1.120',
    defaultPort: 80,
    protocol: 'eSCL 2.0 / HP Webscan',
    description: 'Embedded Webscan (HTTP 80) & AirScan eSCL Protocol',
  },
  {
    brand: 'Epson EcoTank / WorkForce Series',
    defaultHost: 'EPSON-PRINTER.local',
    defaultPort: 80,
    protocol: 'eSCL / AirScan Mopria',
    description: 'Epson Web Control & eSCL Scanner Service',
  },
  {
    brand: 'Canon PIXMA / imageCLASS Series',
    defaultHost: '192.168.1.150',
    defaultPort: 80,
    protocol: 'Canon WebScan / eSCL',
    description: 'Canon Remote UI & eSCL AirScan',
  },
  {
    brand: 'Brother DCP / MFC Multi-Function',
    defaultHost: 'brother.local',
    defaultPort: 80,
    protocol: 'Brother Web Based Management',
    description: 'Brother Scanner Web Management & WSD/eSCL',
  },
  {
    brand: 'Generic / Mopria eSCL Scanner',
    defaultHost: '192.168.1.1',
    defaultPort: 8080,
    protocol: 'eSCL AirScan (Mopria)',
    description: 'Standard Mopria / AirScan eSCL 2.0 Scanner Port 8080',
  },
];

// Audio synthesizer for realistic scanner stepper motor hum & sweep
export function playScannerMotorSound(durationMs: number = 3200): () => void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return () => {};
    const ctx = new AudioContextClass();

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    // Stepper motor tone: rhythmic slight pulse
    osc1.type = 'sawtooth';
    osc1.frequency.setValueAtTime(140, ctx.currentTime);
    osc1.frequency.linearRampToValueAtTime(190, ctx.currentTime + durationMs / 2000);
    osc1.frequency.linearRampToValueAtTime(130, ctx.currentTime + durationMs / 1000);

    osc2.type = 'square';
    osc2.frequency.setValueAtTime(70, ctx.currentTime);
    osc2.frequency.linearRampToValueAtTime(95, ctx.currentTime + durationMs / 2000);
    osc2.frequency.linearRampToValueAtTime(65, ctx.currentTime + durationMs / 1000);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(450, ctx.currentTime);

    gain.gain.setValueAtTime(0.001, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, ctx.currentTime + 0.12);
    gain.gain.setValueAtTime(0.12, ctx.currentTime + (durationMs - 350) / 1000);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + durationMs / 1000);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);

    osc1.start();
    osc2.start();
    osc1.stop(ctx.currentTime + durationMs / 1000);
    osc2.stop(ctx.currentTime + durationMs / 1000);

    return () => {
      try {
        osc1.stop();
        osc2.stop();
        ctx.close();
      } catch {
        // cleanup ignore
      }
    };
  } catch {
    return () => {};
  }
}

// Scanner complete success chime
export function playScanSuccessChime(): void {
  try {
    const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const now = ctx.currentTime;

    const playTone = (freq: number, start: number, duration: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + duration);
    };

    playTone(523.25, now, 0.12); // C5
    playTone(659.25, now + 0.09, 0.12); // E5
    playTone(783.99, now + 0.18, 0.28); // G5
  } catch {
    // ignore
  }
}

// Check USB Scanners via WebUSB API if supported in browser
export async function requestUsbScannerDevice(): Promise<ScannerDeviceInfo | null> {
  const nav = navigator as unknown as {
    usb?: {
      requestDevice: (options: { filters: { classCode?: number; vendorId?: number }[] }) => Promise<{
        productName?: string;
        manufacturerName?: string;
        vendorId?: number;
        productId?: number;
        serialNumber?: string;
      }>;
    };
  };

  if (!nav.usb) {
    throw new Error('WebUSB is not supported in this browser. Please use Chrome, Edge, or Network Scanner mode.');
  }

  // Common scanner vendor IDs: HP (0x03f0), Epson (0x04b8), Canon (0x04a9), Brother (0x04f9), Fujitsu (0x04c5)
  const device = await nav.usb.requestDevice({
    filters: [
      { classCode: 6 }, // USB Still Image Device Class (Scanners / Cameras)
      { vendorId: 0x03f0 }, // HP
      { vendorId: 0x04b8 }, // Epson
      { vendorId: 0x04a9 }, // Canon
      { vendorId: 0x04f9 }, // Brother
      { vendorId: 0x04c5 }, // Fujitsu
      { vendorId: 0x07b3 }, // Plustek
    ],
  });

  return {
    id: `usb-${device.vendorId}-${device.productId}`,
    name: device.productName || 'USB Optical Document Scanner',
    manufacturer: device.manufacturerName || 'All-in-One USB Hardware',
    type: 'usb',
    status: 'ready',
    capabilities: {
      flatbed: true,
      adf: true,
      duplex: false,
      colorModes: ['color', 'grayscale', 'bw'],
      maxDpi: 1200,
      supportedSizes: ['A4', 'Letter', 'Legal', 'ID Card'],
    },
  };
}

// Built-in realistic sample scan documents
export const SAMPLE_SCAN_PRESETS: {
  id: string;
  name: string;
  category: 'faded_text' | 'certificate' | 'id_card' | 'invoice';
  description: string;
  svgDataUrl: string;
}[] = [
  {
    id: 'faded_certificate',
    name: 'Faded Document (Light & Blurry Text)',
    category: 'faded_text',
    description: 'Low-contrast certificate with faded grey text — perfect for testing "Light Text" filter!',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 1754" width="1240" height="1754">
  <defs>
    <!-- Scanner glass textured shadow gradient -->
    <linearGradient id="scanGlassGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fcfbfa"/>
      <stop offset="100%" stop-color="#f5f4f0"/>
    </linearGradient>
    <filter id="lightBlur">
      <feGaussianBlur stdDeviation="0.9" />
    </filter>
  </defs>
  <!-- Background Paper -->
  <rect width="1240" height="1754" fill="url(#scanGlassGrad)" />
  <!-- Scanner Bed Shadow Vignette -->
  <rect x="0" y="0" width="1240" height="18" fill="#1e293b" opacity="0.12" />
  <rect x="0" y="0" width="18" height="1754" fill="#1e293b" opacity="0.10" />
  <!-- Ornamental Border -->
  <rect x="55" y="55" width="1130" height="1644" fill="none" stroke="#64748b" stroke-width="3" stroke-opacity="0.5" />
  <rect x="70" y="70" width="1100" height="1614" fill="none" stroke="#94a3b8" stroke-width="1.5" stroke-opacity="0.4" />
  <!-- Watermark Seal -->
  <circle cx="620" cy="877" r="280" fill="none" stroke="#e2e8f0" stroke-width="6" stroke-opacity="0.4" stroke-dasharray="12,8" />
  <text x="620" y="885" fill="#cbd5e1" font-family="serif" font-size="44" font-weight="bold" text-anchor="middle" letter-spacing="8" opacity="0.4">OFFICIAL RECORD ARCHIVE</text>
  <!-- Top Emblem -->
  <circle cx="620" cy="220" r="55" fill="#fef9c3" stroke="#ca8a04" stroke-width="2.5" opacity="0.8" />
  <polygon points="620,185 632,215 665,215 638,235 648,265 620,248 592,265 602,235 575,215 608,215" fill="#eab308" opacity="0.85" />
  <!-- Certificate Heading -->
  <text x="620" y="340" fill="#334155" font-family="serif" font-size="36" font-weight="bold" text-anchor="middle" letter-spacing="3" opacity="0.75">DEPARTMENT OF RECORDS &amp; ARCHIVES</text>
  <text x="620" y="380" fill="#64748b" font-family="sans-serif" font-size="18" text-anchor="middle" letter-spacing="4" opacity="0.7">CERTIFICATE OF REGISTRATION &amp; IDENTITY</text>
  <line x1="250" y1="410" x2="990" y2="410" stroke="#cbd5e1" stroke-width="2" />
  <!-- Deliberately Faded / Blurry Text Lines (to demonstrate Light Text Recovery) -->
  <g filter="url(#lightBlur)">
    <text x="140" y="500" fill="#64748b" font-family="serif" font-size="22" font-style="italic" opacity="0.7">This is to certify that pursuant to Section 48 of the Universal Registration Act:</text>
    <text x="140" y="555" fill="#475569" font-family="sans-serif" font-size="20" opacity="0.65">The subject document and identity credentials specified below have been examined,</text>
    <text x="140" y="595" fill="#475569" font-family="sans-serif" font-size="20" opacity="0.65">verified against physical archive serial records, and attested as authentic:</text>
    <!-- Highlighted Box with Faint Ink -->
    <rect x="140" y="650" width="960" height="150" rx="10" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5" />
    <text x="180" y="700" fill="#64748b" font-family="sans-serif" font-size="15" font-weight="bold" opacity="0.7">BENEFICIARY / APPLICANT FULL NAME:</text>
    <text x="180" y="745" fill="#334155" font-family="serif" font-size="30" font-weight="bold" opacity="0.7">ALEXANDER D. WINCHESTER</text>
    <text x="680" y="700" fill="#64748b" font-family="sans-serif" font-size="15" font-weight="bold" opacity="0.7">REGISTRATION REF-CODE:</text>
    <text x="680" y="745" fill="#475569" font-family="monospace" font-size="28" font-weight="bold" opacity="0.65">REG-2026-X89104-ARCH</text>
    <text x="180" y="775" fill="#64748b" font-family="sans-serif" font-size="14" opacity="0.6">ISSUANCE DATE: OCTOBER 2026 • REGION: CENTRAL METROPOLITAN ARCHIVE</text>
    <!-- Low-contrast body paragraphs -->
    <text x="140" y="870" fill="#64748b" font-family="sans-serif" font-size="18" opacity="0.6">1. The credential holder is entitled to all official statutory recognition and archiving rights.</text>
    <text x="140" y="915" fill="#64748b" font-family="sans-serif" font-size="18" opacity="0.6">2. Verification signatures below confirm biometric validation, barcode matching, and ledger entry.</text>
    <text x="140" y="960" fill="#64748b" font-family="sans-serif" font-size="18" opacity="0.6">3. Any unauthorized alteration, erasure or reproduction of this record renders it null and void.</text>
    <text x="140" y="1005" fill="#64748b" font-family="sans-serif" font-size="18" opacity="0.6">4. Digital hash signature: 8f9b2c34a71d0e914589df632014bca88921ec5671</text>
    <!-- Faint Mock Paragraph Lines -->
    <rect x="140" y="1060" width="960" height="9" rx="4" fill="#94a3b8" opacity="0.45" />
    <rect x="140" y="1090" width="880" height="9" rx="4" fill="#94a3b8" opacity="0.45" />
    <rect x="140" y="1120" width="920" height="9" rx="4" fill="#94a3b8" opacity="0.45" />
    <rect x="140" y="1150" width="760" height="9" rx="4" fill="#94a3b8" opacity="0.45" />
  </g>
  <!-- Official Red Seal -->
  <circle cx="320" cy="1420" r="85" fill="#fee2e2" stroke="#dc2626" stroke-width="3" stroke-dasharray="8,5" opacity="0.85" />
  <text x="320" y="1415" fill="#b91c1c" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" opacity="0.85">AUTHENTIC SEAL</text>
  <text x="320" y="1445" fill="#b91c1c" font-family="sans-serif" font-size="13" font-weight="bold" text-anchor="middle" opacity="0.8">REGISTRAR GENERAL</text>
  <!-- Signature Lines -->
  <line x1="680" y1="1450" x2="1040" y2="1450" stroke="#475569" stroke-width="2" opacity="0.7" />
  <text x="730" y="1430" fill="#1e3a8a" font-family="cursive" font-size="38" font-style="italic" opacity="0.75">Jonathan Vance</text>
  <text x="860" y="1480" fill="#64748b" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle" opacity="0.75">CHIEF EXAMINING OFFICER</text>
</svg>
`)}`,
  },
  {
    id: 'government_id_card',
    name: 'Government ID / Driver License Platen Scan',
    category: 'id_card',
    description: 'Front identity card placed on scanner glass with photoid, barcode & hologram',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1012 638" width="1012" height="638">
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#eff6ff"/>
      <stop offset="50%" stop-color="#ffffff"/>
      <stop offset="100%" stop-color="#dbeafe"/>
    </linearGradient>
  </defs>
  <!-- Card Base with Rounded Corners -->
  <rect width="1012" height="638" rx="36" fill="url(#cardBg)" stroke="#94a3b8" stroke-width="3"/>
  <!-- Top Banner -->
  <rect x="0" y="0" width="1012" height="110" rx="36" fill="#1e3a8a"/>
  <rect x="0" y="70" width="1012" height="40" fill="#1e3a8a"/>
  <!-- Header Text -->
  <text x="45" y="55" fill="#f8fafc" font-family="sans-serif" font-size="26" font-weight="900" letter-spacing="2">NATIONAL IDENTIFICATION CARD</text>
  <text x="45" y="88" fill="#93c5fd" font-family="sans-serif" font-size="14" font-weight="bold" letter-spacing="3">REPUBLIC IDENTITY &amp; CITIZEN REGISTRY</text>
  <!-- Photo Frame -->
  <rect x="45" y="145" width="220" height="280" rx="16" fill="#cbd5e1" stroke="#3b82f6" stroke-width="3"/>
  <circle cx="155" cy="235" r="50" fill="#94a3b8"/>
  <path d="M 90 380 Q 155 295 220 380 Z" fill="#64748b"/>
  <rect x="55" y="440" width="200" height="45" rx="8" fill="#f1f5f9" stroke="#cbd5e1"/>
  <text x="155" y="468" fill="#1e293b" font-family="monospace" font-size="16" font-weight="bold" text-anchor="middle">ID: 891-042-761</text>
  <!-- Details Column -->
  <text x="300" y="175" fill="#64748b" font-family="sans-serif" font-size="13" font-weight="bold">NAME / NOM</text>
  <text x="300" y="210" fill="#0f172a" font-family="sans-serif" font-size="28" font-weight="bold">ELENA R. VASQUEZ</text>
  <text x="300" y="260" fill="#64748b" font-family="sans-serif" font-size="13" font-weight="bold">DATE OF BIRTH / DOB</text>
  <text x="300" y="290" fill="#0f172a" font-family="sans-serif" font-size="20" font-weight="bold">14 AUG 1994</text>
  <text x="560" y="260" fill="#64748b" font-family="sans-serif" font-size="13" font-weight="bold">NATIONALITY</text>
  <text x="560" y="290" fill="#0f172a" font-family="sans-serif" font-size="20" font-weight="bold">CITIZEN (DOM)</text>
  <text x="300" y="340" fill="#64748b" font-family="sans-serif" font-size="13" font-weight="bold">RESIDENCE ADDRESS</text>
  <text x="300" y="370" fill="#1e293b" font-family="sans-serif" font-size="17">742 EVERGREEN CRESCENT, SUITE 402</text>
  <text x="300" y="395" fill="#1e293b" font-family="sans-serif" font-size="17">METROPOLIS DISTRICT 10842</text>
  <!-- Hologram Emblem -->
  <circle cx="880" cy="240" r="50" fill="#fef08a" stroke="#ca8a04" stroke-width="3" opacity="0.85"/>
  <polygon points="880,210 890,235 915,235 895,250 902,275 880,260 858,275 865,250 845,235 870,235" fill="#eab308"/>
  <text x="880" y="310" fill="#ca8a04" font-family="sans-serif" font-size="11" font-weight="bold" text-anchor="middle">SECURE CHIP</text>
  <!-- Machine Readable Zone (MRZ) -->
  <rect x="40" y="520" width="932" height="90" rx="10" fill="#0f172a"/>
  <text x="60" y="555" fill="#f8fafc" font-family="monospace" font-size="21" letter-spacing="6">IDDOMVASQUEZ&lt;&lt;ELENA&lt;R&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
  <text x="60" y="590" fill="#f8fafc" font-family="monospace" font-size="21" letter-spacing="6">8910427618DOM9408144F3210041&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;9</text>
</svg>
`)}`,
  },
  {
    id: 'legal_contract',
    name: 'Signed Legal Deed & Notary Stamp',
    category: 'certificate',
    description: 'Standard A4 legal agreement scanned at 300 DPI with signatures and stamp',
    svgDataUrl: `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1240 1754" width="1240" height="1754">
  <rect width="1240" height="1754" fill="#ffffff" />
  <rect x="0" y="0" width="1240" height="12" fill="#334155" opacity="0.08" />
  <!-- Title -->
  <text x="620" y="160" fill="#0f172a" font-family="serif" font-size="34" font-weight="bold" text-anchor="middle" letter-spacing="3">AFFIDAVIT &amp; CONTRACT OF SERVICE</text>
  <line x1="220" y1="185" x2="1020" y2="185" stroke="#0f172a" stroke-width="2.5" />
  <text x="620" y="225" fill="#475569" font-family="sans-serif" font-size="16" text-anchor="middle" letter-spacing="2">DULY EXECUTED UNDER NOTARIAL CODE § 12-409</text>
  <!-- Body Paragraphs -->
  <g fill="#1e293b" font-family="serif" font-size="19">
    <text x="120" y="320">BE IT KNOWN, that on this day, the undersigned parties mutually covenant and affirm:</text>
    <text x="120" y="380">1. PARTY OF THE FIRST PART hereby declares that all representations made in the attached</text>
    <text x="120" y="415">schedules and identity documents are true, complete, and legally binding.</text>
    <text x="120" y="475">2. THE COVENANT SHALL REMAIN in full effect for thirty-six (36) consecutive calendar months,</text>
    <text x="120" y="510">subject to annual audit and compliance verification by the appointed registrar.</text>
    <text x="120" y="570">3. GOVERNING LAW &amp; JURISDICTION: This instrument shall be governed in all respects</text>
    <text x="120" y="605">by the statutory provisions and evidentiary standards of the state jurisdiction.</text>
  </g>
  <!-- Mock Fill Lines -->
  <g fill="#64748b">
    <rect x="120" y="680" width="1000" height="7" rx="3.5" opacity="0.6" />
    <rect x="120" y="715" width="940" height="7" rx="3.5" opacity="0.6" />
    <rect x="120" y="750" width="970" height="7" rx="3.5" opacity="0.6" />
    <rect x="120" y="785" width="820" height="7" rx="3.5" opacity="0.6" />
  </g>
  <!-- Notary Embossed Gold & Blue Stamp -->
  <circle cx="280" cy="1300" r="90" fill="#eff6ff" stroke="#1d4ed8" stroke-width="4" stroke-dasharray="10,6" />
  <text x="280" y="1295" fill="#1e40af" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">OFFICIAL NOTARY PUBLIC</text>
  <text x="280" y="1325" fill="#1e40af" font-family="sans-serif" font-size="13" text-anchor="middle">COMMISSION EXPIRES 2029</text>
  <!-- Signatures -->
  <line x1="650" y1="1330" x2="1050" y2="1330" stroke="#0f172a" stroke-width="2" />
  <text x="700" y="1310" fill="#1e3a8a" font-family="cursive" font-size="44">Marcus Hawthorne</text>
  <text x="850" y="1360" fill="#64748b" font-family="sans-serif" font-size="15" font-weight="bold" text-anchor="middle">PRINCIPAL SUBSCRIBER</text>
</svg>
`)}`,
  },
];

/**
 * Simulates optical scanning from flatbed or feeder
 * Produces crisp high-res raster dataUrl taking into account DPI, color mode, and deskew.
 */
export async function simulateScannerCapture(
  sourceImageUrl: string,
  config: ScanJobConfig
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        // Calculate canvas dimensions based on paper size and DPI
        let targetW: number;
        let targetH: number;

        if (config.paperSize === 'idcard') {
          targetW = Math.round((85.6 / 25.4) * config.resolutionDpi);
          targetH = Math.round((53.98 / 25.4) * config.resolutionDpi);
        } else if (config.paperSize === 'letter') {
          targetW = Math.round(8.5 * config.resolutionDpi);
          targetH = Math.round(11 * config.resolutionDpi);
        } else {
          // A4 default (210 x 297 mm)
          targetW = Math.round((210 / 25.4) * config.resolutionDpi);
          targetH = Math.round((297 / 25.4) * config.resolutionDpi);
        }

        canvas.width = targetW;
        canvas.height = targetH;
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Could not get canvas context');

        // Fill scanner platen / glass background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, targetW, targetH);

        ctx.save();

        // If auto-deskew is enabled, apply slight leveling correction
        if (!config.autoDeskew) {
          // Add slight realistic 0.8deg flatbed skew
          ctx.translate(targetW / 2, targetH / 2);
          ctx.rotate((0.7 * Math.PI) / 180);
          ctx.translate(-targetW / 2, -targetH / 2);
        }

        // Draw image contained or centered on the scan bed
        const imgAspect = img.width / img.height;
        const bedAspect = targetW / targetH;
        let drawW = targetW;
        let drawH = targetH;
        let drawX = 0;
        let drawY = 0;

        if (imgAspect > bedAspect) {
          drawH = targetW / imgAspect;
          drawY = (targetH - drawH) / 2;
        } else {
          drawW = targetH * imgAspect;
          drawX = (targetW - drawW) / 2;
        }

        ctx.drawImage(img, drawX, drawY, drawW, drawH);
        ctx.restore();

        // Apply Color Mode conversions
        if (config.colorMode === 'grayscale' || config.colorMode === 'bw') {
          const imgData = ctx.getImageData(0, 0, targetW, targetH);
          const d = imgData.data;
          for (let i = 0; i < d.length; i += 4) {
            const gray = 0.299 * d[i] + 0.587 * d[i + 1] + 0.114 * d[i + 2];
            if (config.colorMode === 'bw') {
              // 1-bit high-contrast line art threshold
              const val = gray < 145 ? 0 : 255;
              d[i] = val;
              d[i + 1] = val;
              d[i + 2] = val;
            } else {
              // 8-bit grayscale with gentle contrast
              const enhancedGray = Math.min(255, Math.max(0, (gray - 128) * 1.15 + 132));
              d[i] = enhancedGray;
              d[i + 1] = enhancedGray;
              d[i + 2] = enhancedGray;
            }
          }
          ctx.putImageData(imgData, 0, 0);
        }

        resolve(canvas.toDataURL('image/png', 0.96));
      } catch (err) {
        reject(err);
      }
    };
    img.onerror = (e) => reject(new Error(`Failed to load scanner image: ${e}`));
    img.src = sourceImageUrl;
  });
}
