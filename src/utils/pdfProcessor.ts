import * as pdfjsLib from 'pdfjs-dist';
// @ts-ignore - Vite asset import for pdf.worker
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { DetectedIdCard, PdfIdDetectionResult } from '../types';
import { loadImage } from './imageProcessing';

// Set up pdf.js worker using bundled worker url with unpkg fallback
if (typeof window !== 'undefined') {
  try {
    if (pdfjsWorker) {
      pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    } else {
      const version = pdfjsLib.version || '6.3.289';
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;
    }
  } catch (err) {
    console.warn('pdf.js worker setup note:', err);
  }
}

export interface RenderedPdfPage {
  pageNumber: number;
  dataUrl: string;
  width: number;
  height: number;
}

export interface ExtractedCard {
  id: string;
  side: 'front' | 'back';
  dataUrl: string;
  confidence: number;
  summary: string;
  documentType: string;
  documentTitle?: string;
  pageNumber: number;
  boundingBox: { ymin: number; xmin: number; ymax: number; xmax: number };
  detectedElements?: DetectedIdCard['detected_elements'];
  qualityIssues: DetectedIdCard['quality_issues'];
}

export class PdfPasswordRequiredError extends Error {
  constructor(message = 'Password required to open this PDF document') {
    super(message);
    this.name = 'PdfPasswordRequiredError';
  }
}

/**
 * Reads a File as an ArrayBuffer
 */
export function readFileAsArrayBuffer(file: File | Blob): Promise<ArrayBuffer> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as ArrayBuffer);
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/**
 * Renders all or selected pages of a PDF into high-resolution images
 */
export async function renderPdfPages(
  fileOrBuffer: File | Blob | ArrayBuffer,
  options: { scale?: number; maxPages?: number; password?: string } = {}
): Promise<RenderedPdfPage[]> {
  const { scale = 2.5, maxPages = 4, password } = options;

  let data: ArrayBuffer;
  if (fileOrBuffer instanceof ArrayBuffer) {
    data = fileOrBuffer;
  } else {
    data = await readFileAsArrayBuffer(fileOrBuffer);
  }

  let pdfDoc: pdfjsLib.PDFDocumentProxy;
  try {
    const cMapUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.3.289'}/cmaps/`;
    const standardFontDataUrl = `https://unpkg.com/pdfjs-dist@${pdfjsLib.version || '6.3.289'}/standard_fonts/`;

    const loadingTask = pdfjsLib.getDocument({
      data: new Uint8Array(data),
      password: password || undefined,
      cMapUrl,
      cMapPacked: true,
      standardFontDataUrl,
    });
    pdfDoc = await loadingTask.promise;
  } catch (err: any) {
    if (
      err?.name === 'PasswordException' ||
      err?.message?.includes('Password') ||
      err?.message?.includes('password') ||
      err?.code === 1
    ) {
      throw new PdfPasswordRequiredError('This PDF document (e.g. e-Aadhaar) is password protected.');
    }
    throw err;
  }

  const pagesToRender = Math.min(pdfDoc.numPages, maxPages);
  const renderedPages: RenderedPdfPage[] = [];

  for (let pageNum = 1; pageNum <= pagesToRender; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) continue;

    canvas.width = viewport.width;
    canvas.height = viewport.height;

    // Fill white background for crisp rendering
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const renderContext = {
      canvasContext: ctx,
      viewport: viewport,
    };

    // @ts-ignore - render parameter type compatibility
    await page.render(renderContext).promise;

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    renderedPages.push({
      pageNumber: pageNum,
      dataUrl,
      width: canvas.width,
      height: canvas.height,
    });
  }

  return renderedPages;
}

/**
 * Crop a specific bounding box (0-1000 scale) from an image dataUrl with optional rotation
 */
export async function cropCardFromImage(
  imageSource: string,
  box: { ymin: number; xmin: number; ymax: number; xmax: number },
  rotationDegrees: number = 0
): Promise<string> {
  const img = await loadImage(imageSource);
  const imgW = img.naturalWidth || img.width;
  const imgH = img.naturalHeight || img.height;

  // Add small margin (0.5%) to ensure border lines are not clipped, clamped to [0, 1000]
  const padY = (box.ymax - box.ymin) * 0.008;
  const padX = (box.xmax - box.xmin) * 0.008;

  const yminNorm = Math.max(0, (box.ymin - padY) / 1000);
  const xminNorm = Math.max(0, (box.xmin - padX) / 1000);
  const ymaxNorm = Math.min(1, (box.ymax + padY) / 1000);
  const xmaxNorm = Math.min(1, (box.xmax + padX) / 1000);

  const sx = Math.round(xminNorm * imgW);
  const sy = Math.round(yminNorm * imgH);
  const sWidth = Math.max(10, Math.round((xmaxNorm - xminNorm) * imgW));
  const sHeight = Math.max(10, Math.round((ymaxNorm - yminNorm) * imgH));

  const canvas = document.createElement('canvas');
  const rot = (rotationDegrees % 360 + 360) % 360;

  if (rot === 90 || rot === 270) {
    canvas.width = sHeight;
    canvas.height = sWidth;
  } else {
    canvas.width = sWidth;
    canvas.height = sHeight;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) return imageSource;

  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';

  if (rot !== 0) {
    ctx.save();
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((rot * Math.PI) / 180);
    ctx.drawImage(img, sx, sy, sWidth, sHeight, -sWidth / 2, -sHeight / 2, sWidth, sHeight);
    ctx.restore();
  } else {
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, sWidth, sHeight);
  }

  return canvas.toDataURL('image/jpeg', 0.98);
}

/**
 * Render and load pages from an uploaded PDF document for manual ID card cropping
 */
export async function detectAndExtractCardsFromPdf(
  fileOrPages: File | RenderedPdfPage[],
  options: {
    password?: string;
    onProgress?: (step: string) => void;
  } = {}
): Promise<{
  success: boolean;
  documentType: string;
  documentTitle: string;
  frontCard?: ExtractedCard;
  backCard?: ExtractedCard;
  allCards: ExtractedCard[];
  renderedPages: RenderedPdfPage[];
  notes?: string;
}> {
  const { password, onProgress } = options;

  let pages: RenderedPdfPage[] = [];
  if (Array.isArray(fileOrPages)) {
    pages = fileOrPages;
  } else {
    onProgress?.('Rendering PDF pages in high-resolution (300 DPI)...');
    pages = await renderPdfPages(fileOrPages, { scale: 2.5, maxPages: 4, password });
  }

  if (pages.length === 0) {
    throw new Error('Could not render any pages from the PDF document.');
  }

  const allCards: ExtractedCard[] = [];
  const detectedDocType = 'id_document';
  const detectedDocTitle = 'PDF Document';

  // Extract Page 1 as Front Card candidate
  const page1 = pages[0];
  const frontCard: ExtractedCard = {
    id: `extracted-page-1-${Date.now()}`,
    side: 'front',
    dataUrl: page1.dataUrl,
    confidence: 1.0,
    summary: 'PDF Page 1',
    documentType: detectedDocType,
    documentTitle: detectedDocTitle,
    pageNumber: 1,
    boundingBox: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 },
    qualityIssues: { is_blurry: false, has_glare: false, is_partially_cut: false },
  };
  allCards.push(frontCard);

  // If multi-page PDF, extract Page 2 as Back Card candidate; otherwise reuse Page 1 for back cropping
  let backCard: ExtractedCard | undefined;
  if (pages.length > 1) {
    const page2 = pages[1];
    backCard = {
      id: `extracted-page-2-${Date.now()}`,
      side: 'back',
      dataUrl: page2.dataUrl,
      confidence: 1.0,
      summary: 'PDF Page 2',
      documentType: detectedDocType,
      documentTitle: detectedDocTitle,
      pageNumber: 2,
      boundingBox: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 },
      qualityIssues: { is_blurry: false, has_glare: false, is_partially_cut: false },
    };
    allCards.push(backCard);
  } else {
    // For single page documents (e.g. e-Aadhaar sheet containing both front & back on page 1),
    // provide the same rendered sheet to both slots so the user can easily crop both
    backCard = {
      id: `extracted-page-1-back-${Date.now()}`,
      side: 'back',
      dataUrl: page1.dataUrl,
      confidence: 1.0,
      summary: 'PDF Page 1 (for Back Crop)',
      documentType: detectedDocType,
      documentTitle: detectedDocTitle,
      pageNumber: 1,
      boundingBox: { ymin: 0, xmin: 0, ymax: 1000, xmax: 1000 },
      qualityIssues: { is_blurry: false, has_glare: false, is_partially_cut: false },
    };
    allCards.push(backCard);
  }

  return {
    success: true,
    documentType: detectedDocType,
    documentTitle: detectedDocTitle,
    frontCard,
    backCard,
    allCards,
    renderedPages: pages,
    notes: 'PDF rendered successfully. Ready for manual cropping.',
  };
}
