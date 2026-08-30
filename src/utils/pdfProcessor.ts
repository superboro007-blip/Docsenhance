import * as pdfjsLib from 'pdfjs-dist';
import { DetectedIdCard, PdfIdDetectionResult } from '../types';
import { loadImage } from './imageProcessing';

// Set up pdf.js worker using matching CDN to ensure universal browser support in Vite/iFrames
if (typeof window !== 'undefined') {
  try {
    const version = pdfjsLib.version || '4.10.38';
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${version}/pdf.worker.min.mjs`;
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

  const loadingTask = pdfjsLib.getDocument({
    data: new Uint8Array(data),
    password: password || undefined,
  });

  let pdfDoc: pdfjsLib.PDFDocumentProxy;
  try {
    pdfDoc = await loadingTask.promise;
  } catch (err: any) {
    if (
      err?.name === 'PasswordException' ||
      err?.message?.includes('Password') ||
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
 * Auto-detect and isolate Front and Back ID cards from an uploaded PDF or Multi-Card image
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
    onProgress?.('Rendering PDF pages into ultra-high-definition canvas...');
    pages = await renderPdfPages(fileOrPages, { scale: 2.5, maxPages: 3, password });
  }

  if (pages.length === 0) {
    throw new Error('Could not render any pages from the PDF document.');
  }

  const allCards: ExtractedCard[] = [];
  let detectedDocType = 'id_card';
  let detectedDocTitle = 'Identity Document';

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    onProgress?.(`AI scanning Page ${page.pageNumber} for ID cards (Aadhaar, PAN, Voter ID, License)...`);

    try {
      const response = await fetch('/api/ai/detect-pdf-id-cards', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: page.dataUrl,
          pageNumber: page.pageNumber,
        }),
      });

      if (!response.ok) {
        throw new Error(`Detection API error: HTTP ${response.status}`);
      }

      const result: PdfIdDetectionResult = await response.json();

      if (result.document_type && result.document_type !== 'unknown') {
        detectedDocType = result.document_type;
      }
      if (result.document_title) {
        detectedDocTitle = result.document_title;
      }

      if (result.id_detected && result.cards_found && result.cards_found.length > 0) {
        for (const card of result.cards_found) {
          const croppedDataUrl = await cropCardFromImage(
            page.dataUrl,
            card.bounding_box_1000,
            card.rotation_needed_degrees
          );

          const side: 'front' | 'back' = card.side.toUpperCase() === 'BACK' ? 'back' : 'front';

          allCards.push({
            id: `extracted-${Date.now()}-${allCards.length}`,
            side,
            dataUrl: croppedDataUrl,
            confidence: card.confidence_score,
            summary: card.summary,
            documentType: result.document_type || 'id_card',
            documentTitle: result.document_title,
            pageNumber: page.pageNumber,
            boundingBox: card.bounding_box_1000,
            detectedElements: card.detected_elements,
            qualityIssues: card.quality_issues,
          });
        }
      }
    } catch (err) {
      console.warn(`Error detecting cards on page ${page.pageNumber}:`, err);
    }
  }

  // Assign Front and Back cards intelligently
  let frontCard = allCards.find((c) => c.side === 'front');
  let backCard = allCards.find((c) => c.side === 'back');

  // If we have 2 cards and both are marked same side or ambiguous, assign first as front, second as back
  if (allCards.length >= 2) {
    if (!frontCard && !backCard) {
      frontCard = { ...allCards[0], side: 'front' };
      backCard = { ...allCards[1], side: 'back' };
    } else if (frontCard && !backCard) {
      const other = allCards.find((c) => c.id !== frontCard?.id);
      if (other) backCard = { ...other, side: 'back' };
    } else if (!frontCard && backCard) {
      const other = allCards.find((c) => c.id !== backCard?.id);
      if (other) frontCard = { ...other, side: 'front' };
    }
  } else if (allCards.length === 1 && !frontCard && !backCard) {
    frontCard = { ...allCards[0], side: 'front' };
  }

  return {
    success: allCards.length > 0,
    documentType: detectedDocType,
    documentTitle: detectedDocTitle,
    frontCard,
    backCard,
    allCards,
    renderedPages: pages,
  };
}
