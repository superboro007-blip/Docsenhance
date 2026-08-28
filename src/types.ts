export type StudioTab = 'passport' | 'idcard' | 'document' | 'print_preview';

export interface Point2D {
  x: number; // percentage (0 - 100) or pixels
  y: number; // percentage (0 - 100) or pixels
}

export interface QuadCorners {
  tl: Point2D;
  tr: Point2D;
  br: Point2D;
  bl: Point2D;
}

export type PaperSizeId = 'a4' | '4x6' | '5x7' | 'letter' | '8x10' | 'single';

export interface PaperSizeConfig {
  id: PaperSizeId;
  name: string;
  widthMm: number;
  heightMm: number;
  widthInches: number;
  heightInches: number;
  defaultPassportCount: number;
  maxPassportCount: number;
  description: string;
}

export interface PassportPreset {
  id: string;
  country: string;
  name: string;
  widthMm: number;
  heightMm: number;
  headHeightMinPercent: number; // e.g. 70%
  headHeightMaxPercent: number; // e.g. 80%
  recommendedBackground: string;
  description: string;
}

export interface IDCardPreset {
  id: string;
  name: string;
  widthMm: number;
  heightMm: number;
  standard: string;
  cornerRadiusMm: number;
  description: string;
}

export type IDCardSide = 'front' | 'back' | 'auto';

export interface IDCardItem {
  id: string;
  side: 'front' | 'back';
  dataUrl: string;
  fileName: string;
  cropBox?: { x: number; y: number; width: number; height: number }; // percentages
  quadCorners?: QuadCorners; // 4-corner freeform crop
  rotation: number;
  brightness: number;
  contrast: number;
  saturation: number;
  sharpness: number;
  detectedSide?: 'front' | 'back' | 'ambiguous' | 'unknown';
  detectedConfidence?: number;
  detectedSummary?: string;
  isAmbiguous?: boolean;
  ambiguityReason?: string;
}

export interface PendingCardDecision {
  id: string;
  fileName: string;
  dataUrl: string;
  detectedSide: 'front' | 'back' | 'ambiguous' | 'unknown';
  confidence: number;
  isAmbiguous: boolean;
  reason?: string;
  summary: string;
  rotation?: number;
}

export interface IDCardSettings {
  presetId: string;
  customWidthMm: number;
  customHeightMm: number;
  orientation: 'landscape' | 'portrait';
  layoutMode: 'side_by_side' | 'stacked' | 'foldable' | 'grid_multi' | 'duplex_pages';
  cornerRadiusMm: number;
  borderStyle: 'none' | 'thin_black' | 'thin_grey' | 'dashed_cut';
  borderWidthPx: number;
  showCuttingMarks: boolean;
  showFoldingLine: boolean;
  laminateMarginMm: number;
  spacingMm: number;
  cardsCount: number; // For multi-card A4 layout (e.g. 1 pair, 2 pairs, 4 pairs)
  includeDetailsHeader: boolean;
  headerText: string;
}

export interface PassportSettings {
  presetId: string;
  customWidthMm: number;
  customHeightMm: number;
  photoCount: number; // e.g. 36 for A4
  gapMm: number;
  marginTopMm: number;
  marginLeftMm: number;
  backgroundColor: string; // 'original' | '#ffffff' | '#dbeafe' | '#1e3a8a' | '#dc2626' | '#f3f4f6'
  showCutLines: boolean;
  cutLineStyle: 'solid' | 'dashed' | 'cross_corners';
  showFaceGuideOverlay: boolean;
  suitOverlay?: string | null;
  suitPosition?: { x: number; y: number; scale: number };
  brightness: number; // -50 to +50
  contrast: number; // -50 to +50
  saturation: number; // -50 to +50
  sharpness: number; // 0 to 100
  skinSmooth: number; // 0 to 100
}

export interface DocumentItem {
  id: string;
  title: string;
  dataUrl: string;
  filterMode: 'original' | 'magic_color' | 'grayscale' | 'bw_photocopy' | 'invert';
  rotation: number;
  brightness: number;
  contrast: number;
  cropBox?: { x: number; y: number; width: number; height: number };
  quadCorners?: QuadCorners; // 4-corner perspective crop
  scalePercent: number;
}

export interface DocumentSettings {
  paperSizeId: PaperSizeId;
  layout: '1_per_page' | '2_per_page' | '4_per_page' | 'side_by_side_id_with_doc';
  orientation: 'portrait' | 'landscape';
  marginMm: number;
  showPageBorder: boolean;
  enhanceTextClarity: boolean;
}
