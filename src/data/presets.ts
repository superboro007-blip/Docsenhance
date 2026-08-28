import { PaperSizeConfig, PassportPreset, IDCardPreset } from '../types';

export const PAPER_SIZES: PaperSizeConfig[] = [
  {
    id: 'a4',
    name: 'A4 Paper',
    widthMm: 210,
    heightMm: 297,
    widthInches: 8.27,
    heightInches: 11.69,
    defaultPassportCount: 36, // Requested: 36 passport size photos instead of 30 photos
    maxPassportCount: 42,
    description: 'Standard office & photo paper (210 × 297 mm). Holds up to 36 standard 30×40mm photos (6×6 grid).',
  },
  {
    id: '4x6',
    name: '4 × 6 inch (10×15 cm)',
    widthMm: 101.6,
    heightMm: 152.4,
    widthInches: 4,
    heightInches: 6,
    defaultPassportCount: 8,
    maxPassportCount: 8,
    description: 'Most popular glossy photo print size. Holds 6 to 8 passport photos or 1-2 ID cards.',
  },
  {
    id: '5x7',
    name: '5 × 7 inch (13×18 cm)',
    widthMm: 127,
    heightMm: 177.8,
    widthInches: 5,
    heightInches: 7,
    defaultPassportCount: 12,
    maxPassportCount: 15,
    description: 'Medium portrait photo sheet. Holds 12-15 passport photos.',
  },
  {
    id: 'letter',
    name: 'US Letter',
    widthMm: 215.9,
    heightMm: 279.4,
    widthInches: 8.5,
    heightInches: 11,
    defaultPassportCount: 30,
    maxPassportCount: 36,
    description: 'Standard North American paper size (8.5 × 11 inches).',
  },
  {
    id: '8x10',
    name: '8 × 10 inch',
    widthMm: 203.2,
    heightMm: 254,
    widthInches: 8,
    heightInches: 10,
    defaultPassportCount: 24,
    maxPassportCount: 30,
    description: 'Large studio print format.',
  },
  {
    id: 'single',
    name: 'Single Card / Photo Only',
    widthMm: 85.6,
    heightMm: 53.98,
    widthInches: 3.37,
    heightInches: 2.12,
    defaultPassportCount: 1,
    maxPassportCount: 1,
    description: 'Direct single item print / export.',
  },
];

export const PASSPORT_PRESETS: PassportPreset[] = [
  {
    id: 'standard_30x40',
    country: 'Standard / International / ID',
    name: 'Standard Passport Photo (30 × 40 mm)',
    widthMm: 30,
    heightMm: 40,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    recommendedBackground: '#ffffff',
    description: 'Standard 30 × 40 mm portrait size for passport, visa, ID card, and biometric applications.',
  },
  {
    id: 'standard_35x45',
    country: 'International / UK / Schengen',
    name: 'European Passport (35 × 45 mm)',
    widthMm: 35,
    heightMm: 45,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    recommendedBackground: '#ffffff',
    description: 'ICAO size used across Europe, UK, Canada, Australia, Asia.',
  },
  {
    id: 'us_2x2',
    country: 'United States',
    name: 'US Passport / Visa (2 × 2 inch / 51 × 51 mm)',
    widthMm: 50.8,
    heightMm: 50.8,
    headHeightMinPercent: 50,
    headHeightMaxPercent: 69,
    recommendedBackground: '#ffffff',
    description: 'Standard 2x2 inch square format for US Passport, Visa, Green Card, DS-160.',
  },
  {
    id: 'india_35x45',
    country: 'India',
    name: 'India Passport / Visa (35 × 45 mm)',
    widthMm: 35,
    heightMm: 45,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    recommendedBackground: '#ffffff',
    description: 'Standard passport & Indian visa application photo size.',
  },
  {
    id: 'india_35x35',
    country: 'India / OCI',
    name: 'India OCI / Visa (35 × 35 mm)',
    widthMm: 35,
    heightMm: 35,
    headHeightMinPercent: 65,
    headHeightMaxPercent: 75,
    recommendedBackground: '#ffffff',
    description: 'Square 35x35mm size for Overseas Citizen of India (OCI) and specific forms.',
  },
  {
    id: 'canada_50x70',
    country: 'Canada',
    name: 'Canada Passport (50 × 70 mm)',
    widthMm: 50,
    heightMm: 70,
    headHeightMinPercent: 60,
    headHeightMaxPercent: 70,
    recommendedBackground: '#ffffff',
    description: 'Official Passport Canada biometric requirement.',
  },
  {
    id: 'china_33x48',
    country: 'China',
    name: 'China Passport / Visa (33 × 48 mm)',
    widthMm: 33,
    heightMm: 48,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    recommendedBackground: '#ffffff',
    description: 'Standard Chinese Embassy passport and visa format.',
  },
  {
    id: 'japan_35x45',
    country: 'Japan / Korea',
    name: 'Japan / Korea Passport (35 × 45 mm)',
    widthMm: 35,
    heightMm: 45,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    recommendedBackground: '#ffffff',
    description: 'Official Ministry requirements for Japanese and Korean travel docs.',
  },
  {
    id: 'stamp_25x30',
    country: 'General / Stamp',
    name: 'Stamp Size / 1 inch (25 × 30 mm)',
    widthMm: 25,
    heightMm: 30,
    headHeightMinPercent: 60,
    headHeightMaxPercent: 80,
    recommendedBackground: '#ffffff',
    description: 'Small stamp size photo for ID cards, forms, licenses, badges.',
  },
  {
    id: 'custom_photo',
    country: 'Custom',
    name: 'Custom Dimensions...',
    widthMm: 30,
    heightMm: 40,
    headHeightMinPercent: 70,
    headHeightMaxPercent: 80,
    recommendedBackground: '#ffffff',
    description: 'Enter your own exact width and height in millimeters.',
  },
];

export const ID_CARD_PRESETS: IDCardPreset[] = [
  {
    id: 'cr80_standard',
    name: 'Standard ISO ID-1 / CR80 Card (85.6 × 53.98 mm)',
    widthMm: 85.6,
    heightMm: 53.98,
    standard: 'ISO/IEC 7810 ID-1',
    cornerRadiusMm: 3.18,
    description: 'Standard credit card, National ID, Driver License, Employee badge format.',
  },
  {
    id: 'aadhaar_pan',
    name: 'Aadhaar / PAN Card / Voter ID (86 × 54 mm)',
    widthMm: 86.0,
    heightMm: 54.0,
    standard: 'Govt ID Standard',
    cornerRadiusMm: 3.0,
    description: 'Standard government card laminating pouch & PVC card dimensions.',
  },
  {
    id: 'business_card_us',
    name: 'Standard Business Card (89 × 51 mm / 3.5 × 2 in)',
    widthMm: 88.9,
    heightMm: 50.8,
    standard: 'US Business Card',
    cornerRadiusMm: 0,
    description: 'Standard North American business card layout.',
  },
  {
    id: 'badge_id_large',
    name: 'Large Conference / Event Badge (100 × 70 mm)',
    widthMm: 100,
    heightMm: 70,
    standard: 'Event Badge',
    cornerRadiusMm: 4.0,
    description: 'Large lanyard badge or visitor pass format.',
  },
  {
    id: 'dl_custom',
    name: 'Custom ID Card Dimensions',
    widthMm: 85.6,
    heightMm: 53.98,
    standard: 'Custom Format',
    cornerRadiusMm: 3.0,
    description: 'Specify your own custom width, height, and corner radius.',
  },
];

export const BACKGROUND_COLORS = [
  { name: 'Original Background', value: 'original', class: 'bg-transparent border-dashed border-gray-400' },
  { name: 'Pure White (Official)', value: '#ffffff', class: 'bg-white border-gray-300' },
  { name: 'Light Baby Blue', value: '#dbeafe', class: 'bg-blue-100 border-blue-300' },
  { name: 'Royal / Passport Blue', value: '#1d4ed8', class: 'bg-blue-700 border-blue-800 text-white' },
  { name: 'Standard Red (Asia/ID)', value: '#dc2626', class: 'bg-red-600 border-red-700 text-white' },
  { name: 'Light Neutral Grey', value: '#f3f4f6', class: 'bg-gray-100 border-gray-300' },
  { name: 'Off-White / Cream', value: '#fefce8', class: 'bg-amber-50 border-amber-200' },
];

// Built-in Self-Contained Vector Data URLs for instant 100% reliable offline loading
export const SAMPLE_PORTRAIT_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 750" width="600" height="750">
  <defs>
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#eff6ff" />
      <stop offset="100%" stop-color="#dbeafe" />
    </linearGradient>
    <radialGradient id="faceGrad" cx="50%" cy="45%" r="50%">
      <stop offset="0%" stop-color="#fed7aa" />
      <stop offset="100%" stop-color="#fba471" />
    </radialGradient>
    <linearGradient id="suitGrad" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" stop-color="#1e293b" />
      <stop offset="100%" stop-color="#0f172a" />
    </linearGradient>
  </defs>
  <rect width="600" height="750" fill="url(#bgGrad)" />
  <circle cx="300" cy="320" r="280" fill="#ffffff" opacity="0.35" />
  <path d="M100 750 L120 540 Q200 490 300 490 Q400 490 480 540 L500 750 Z" fill="url(#suitGrad)" />
  <polygon points="260,490 340,490 300,560" fill="#ffffff" />
  <polygon points="240,490 270,540 285,490" fill="#e2e8f0" />
  <polygon points="360,490 330,540 315,490" fill="#e2e8f0" />
  <rect x="260" y="400" width="80" height="110" rx="10" fill="#fba471" />
  <ellipse cx="300" cy="320" rx="110" ry="145" fill="url(#faceGrad)" />
  <path d="M185 300 C180 180, 240 140, 300 140 C360 140, 420 180, 415 300 C395 240, 360 210, 300 210 C240 210, 205 240, 185 300 Z" fill="#18181b" />
  <ellipse cx="255" cy="310" rx="12" ry="7" fill="#ffffff" />
  <circle cx="255" cy="310" r="5" fill="#27272a" />
  <ellipse cx="345" cy="310" rx="12" ry="7" fill="#ffffff" />
  <circle cx="345" cy="310" r="5" fill="#27272a" />
  <path d="M235 292 Q255 285 275 292" stroke="#27272a" stroke-width="4" fill="none" stroke-linecap="round" />
  <path d="M325 292 Q345 285 365 292" stroke="#27272a" stroke-width="4" fill="none" stroke-linecap="round" />
  <path d="M300 310 L295 350 L308 350" stroke="#ea580c" stroke-width="2.5" fill="none" stroke-linecap="round" stroke-linejoin="round" opacity="0.6" />
  <path d="M275 390 Q300 395 325 390" stroke="#be123c" stroke-width="3.5" fill="none" stroke-linecap="round" />
  <ellipse cx="188" cy="325" rx="12" ry="24" fill="#fba471" />
  <ellipse cx="412" cy="325" rx="12" ry="24" fill="#fba471" />
</svg>`)}`;

export const SAMPLE_ID_FRONT_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540">
  <defs>
    <linearGradient id="cardBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#1e3a8a" />
      <stop offset="100%" stop-color="#3b82f6" />
    </linearGradient>
    <linearGradient id="chipGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#fbbf24" />
      <stop offset="100%" stop-color="#d97706" />
    </linearGradient>
  </defs>
  <!-- Card Base -->
  <rect width="856" height="540" rx="30" fill="url(#cardBg)" stroke="#cbd5e1" stroke-width="2" />
  <!-- Header Bar -->
  <rect x="0" y="0" width="856" height="85" rx="30" fill="url(#headerGrad)" />
  <rect x="0" y="55" width="856" height="30" fill="url(#headerGrad)" />
  <!-- Title -->
  <text x="35" y="42" fill="#ffffff" font-family="sans-serif" font-size="22" font-weight="bold" letter-spacing="2">NATIONAL IDENTITY / DRIVER LICENSE</text>
  <text x="35" y="68" fill="#93c5fd" font-family="sans-serif" font-size="13" letter-spacing="1">REPUBLIC IDENTIFICATION AUTHORITY</text>
  <!-- Photo Box -->
  <rect x="45" y="115" width="220" height="280" rx="12" fill="#e0f2fe" stroke="#3b82f6" stroke-width="2" />
  <!-- Photo Silhouette -->
  <circle cx="155" cy="210" r="55" fill="#94a3b8" />
  <path d="M85 360 C85 290, 225 290, 225 360 Z" fill="#64748b" />
  <text x="155" y="380" fill="#475569" font-family="sans-serif" font-size="12" text-anchor="middle" font-weight="bold">OFFICIAL PHOTO</text>
  <!-- Smart Chip -->
  <rect x="300" y="115" width="90" height="70" rx="10" fill="url(#chipGrad)" stroke="#b45309" stroke-width="1.5" />
  <line x1="300" y1="150" x2="390" y2="150" stroke="#b45309" stroke-width="1" />
  <line x1="345" y1="115" x2="345" y2="185" stroke="#b45309" stroke-width="1" />
  <circle cx="345" cy="150" r="14" fill="none" stroke="#b45309" stroke-width="1" />
  <!-- Details -->
  <text x="420" y="130" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">DOCUMENT NO / ID</text>
  <text x="420" y="155" fill="#0f172a" font-family="monospace" font-size="22" font-weight="bold">DL-9842-7710-X</text>
  <text x="300" y="225" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">FULL NAME</text>
  <text x="300" y="252" fill="#0f172a" font-family="sans-serif" font-size="20" font-weight="bold">ALEXANDER MORGAN</text>
  <text x="300" y="295" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">DATE OF BIRTH</text>
  <text x="300" y="318" fill="#0f172a" font-family="sans-serif" font-size="16" font-weight="bold">14 MAY 1992</text>
  <text x="500" y="295" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">GENDER / BLOOD</text>
  <text x="500" y="318" fill="#0f172a" font-family="sans-serif" font-size="16" font-weight="bold">M / O+ POS</text>
  <text x="300" y="365" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">ISSUE DATE</text>
  <text x="300" y="388" fill="#0f172a" font-family="sans-serif" font-size="15">01/01/2024</text>
  <text x="500" y="365" fill="#64748b" font-family="sans-serif" font-size="12" font-weight="bold">EXPIRY DATE</text>
  <text x="500" y="388" fill="#dc2626" font-family="sans-serif" font-size="15" font-weight="bold">01/01/2034</text>
  <!-- Security Hologram Seal -->
  <circle cx="760" cy="260" r="50" fill="#fef08a" stroke="#eab308" stroke-width="2" opacity="0.8" />
  <text x="760" y="255" fill="#854d0e" font-family="sans-serif" font-size="11" text-anchor="middle" font-weight="bold">OFFICIAL</text>
  <text x="760" y="272" fill="#854d0e" font-family="sans-serif" font-size="11" text-anchor="middle" font-weight="bold">SECURITY</text>
  <!-- Ghost Portrait Base -->
  <rect x="715" y="340" width="90" height="110" rx="8" fill="#f1f5f9" stroke="#cbd5e1" />
  <circle cx="760" cy="380" r="22" fill="#cbd5e1" />
  <path d="M730 440 C730 410, 790 410, 790 440 Z" fill="#94a3b8" />
  <!-- Bottom Barcode -->
  <line x1="45" y1="480" x2="810" y2="480" stroke="#0f172a" stroke-width="1" />
  <text x="45" y="510" fill="#334155" font-family="monospace" font-size="16" letter-spacing="6">I&lt;UTOMORGAN&lt;&lt;ALEXANDER&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
</svg>`)}`;

export const SAMPLE_ID_BACK_URL = `data:image/svg+xml;utf8,${encodeURIComponent(`
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 856 540" width="856" height="540">
  <defs>
    <linearGradient id="cardBackBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#f8fafc" />
      <stop offset="100%" stop-color="#e2e8f0" />
    </linearGradient>
  </defs>
  <!-- Card Base -->
  <rect width="856" height="540" rx="30" fill="url(#cardBackBg)" stroke="#cbd5e1" stroke-width="2" />
  <!-- Magnetic Stripe -->
  <rect x="0" y="45" width="856" height="75" fill="#1e293b" />
  <!-- Signature & Address Container -->
  <text x="45" y="155" fill="#475569" font-family="sans-serif" font-size="12" font-weight="bold">AUTHORIZED SIGNATURE (NOT VALID UNLESS SIGNED)</text>
  <rect x="45" y="168" width="450" height="55" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="1" />
  <text x="70" y="205" fill="#1e3a8a" font-family="cursive" font-size="26" font-style="italic">Alex Morgan</text>
  <rect x="520" y="168" width="290" height="55" rx="6" fill="#ffffff" stroke="#94a3b8" stroke-width="1" />
  <text x="535" y="192" fill="#64748b" font-family="sans-serif" font-size="10" font-weight="bold">SECURITY PIN CODE</text>
  <text x="535" y="212" fill="#0f172a" font-family="monospace" font-size="16" font-weight="bold">CVV: 9284-881</text>
  <!-- Terms & Address -->
  <text x="45" y="255" fill="#334155" font-family="sans-serif" font-size="12" font-weight="bold">PERMANENT RESIDENCE ADDRESS:</text>
  <text x="45" y="278" fill="#475569" font-family="sans-serif" font-size="13">742 Evergreen Terrace, Sector 4, Metro City, 90210</text>
  <text x="45" y="300" fill="#475569" font-family="sans-serif" font-size="13">Emergency Contact: +1 (555) 019-2834 | Blood Type: O+ POS</text>
  <text x="45" y="335" fill="#64748b" font-family="sans-serif" font-size="11">This card is property of the Issuing Authority. If found, please return to any National Post Box.</text>
  <!-- 2D Barcode Block -->
  <rect x="680" y="245" width="130" height="130" rx="8" fill="#ffffff" stroke="#0f172a" stroke-width="2" />
  <g fill="#0f172a">
    <rect x="695" y="260" width="30" height="30" />
    <rect x="765" y="260" width="30" height="30" />
    <rect x="695" y="330" width="30" height="30" />
    <rect x="735" y="300" width="20" height="20" />
    <rect x="765" y="330" width="15" height="15" />
    <rect x="745" y="340" width="10" height="10" />
  </g>
  <!-- Machine Readable Zone (MRZ) -->
  <rect x="35" y="420" width="786" height="90" rx="8" fill="#ffffff" stroke="#cbd5e1" />
  <text x="50" y="455" fill="#0f172a" font-family="monospace" font-size="19" font-weight="bold" letter-spacing="4">IDUTO98427710X9&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;</text>
  <text x="50" y="490" fill="#0f172a" font-family="monospace" font-size="19" font-weight="bold" letter-spacing="4">9205148M3401014UTO&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;&lt;2</text>
</svg>`)}`;

export const SAMPLE_AMBIGUOUS_ID_URL = SAMPLE_ID_FRONT_URL;

