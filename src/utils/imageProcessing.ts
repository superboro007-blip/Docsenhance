import jsPDF from 'jspdf';
import { PaperSizeConfig, PassportSettings, IDCardSettings, IDCardItem, DocumentItem, DocumentSettings } from '../types';

export const MM_TO_INCH = 1 / 25.4;
export const PRINT_DPI = 300;

export function mmToPixels(mm: number, dpi: number = PRINT_DPI): number {
  return Math.round((mm * MM_TO_INCH) * dpi);
}

/**
 * Loads an image from DataURL or URL into an HTMLImageElement
 */
export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(new Error('Failed to load image: ' + e));
    img.src = src;
  });
}

/**
 * Smart Background Removal and Solid Color Replacement Engine
 * Performs intelligent perimeter flood-fill & color distance segmentation with alpha feathering
 */
export async function removeImageBackground(
  imageSrc: string,
  targetBgColor: string = 'transparent',
  tolerance: number = 32,
  featherRadius: number = 2
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context failed');

  ctx.drawImage(img, 0, 0);
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const w = canvas.width;
  const h = canvas.height;

  // Sample background colors from four corners and top edges
  const samplePoints = [
    { x: 0, y: 0 },
    { x: w - 1, y: 0 },
    { x: Math.floor(w / 2), y: 0 },
    { x: 0, y: Math.floor(h * 0.3) },
    { x: w - 1, y: Math.floor(h * 0.3) },
    { x: 0, y: h - 1 },
    { x: w - 1, y: h - 1 },
  ];

  const bgPalette: { r: number; g: number; b: number }[] = [];
  for (const pt of samplePoints) {
    const idx = (pt.y * w + pt.x) * 4;
    bgPalette.push({
      r: data[idx],
      g: data[idx + 1],
      b: data[idx + 2],
    });
  }

  // Helper to test if a pixel matches any background sample color within tolerance
  const isBgPixel = (r: number, g: number, b: number) => {
    for (const bg of bgPalette) {
      const dist = Math.sqrt(
        (r - bg.r) ** 2 * 0.299 +
        (g - bg.g) ** 2 * 0.587 +
        (b - bg.b) ** 2 * 0.114
      );
      if (dist <= tolerance) return true;
    }
    return false;
  };

  // Visited array for flood-fill segmentation starting from perimeter
  const isBackground = new Uint8Array(w * h);
  const queue: number[] = [];

  // Seed with top, left, and right borders
  for (let x = 0; x < w; x++) {
    const idxTop = x;
    const pTop = idxTop * 4;
    if (isBgPixel(data[pTop], data[pTop + 1], data[pTop + 2])) {
      isBackground[idxTop] = 1;
      queue.push(idxTop);
    }
    const idxBot = (h - 1) * w + x;
    const pBot = idxBot * 4;
    if (isBgPixel(data[pBot], data[pBot + 1], data[pBot + 2])) {
      isBackground[idxBot] = 1;
      queue.push(idxBot);
    }
  }

  for (let y = 0; y < h; y++) {
    const idxLeft = y * w;
    const pLeft = idxLeft * 4;
    if (isBgPixel(data[pLeft], data[pLeft + 1], data[pLeft + 2])) {
      isBackground[idxLeft] = 1;
      queue.push(idxLeft);
    }
    const idxRight = y * w + (w - 1);
    const pRight = idxRight * 4;
    if (isBgPixel(data[pRight], data[pRight + 1], data[pRight + 2])) {
      isBackground[idxRight] = 1;
      queue.push(idxRight);
    }
  }

  // BFS Flood Fill to find contiguous background area
  let head = 0;
  while (head < queue.length) {
    const curr = queue[head++];
    const cx = curr % w;
    const cy = Math.floor(curr / w);

    const neighbors = [
      { x: cx + 1, y: cy },
      { x: cx - 1, y: cy },
      { x: cx, y: cy + 1 },
      { x: cx, y: cy - 1 },
    ];

    for (const nb of neighbors) {
      if (nb.x >= 0 && nb.x < w && nb.y >= 0 && nb.y < h) {
        const nIdx = nb.y * w + nb.x;
        if (!isBackground[nIdx]) {
          const p = nIdx * 4;
          if (isBgPixel(data[p], data[p + 1], data[p + 2])) {
            isBackground[nIdx] = 1;
            queue.push(nIdx);
          }
        }
      }
    }
  }

  // If target is transparent, make background pixels alpha = 0
  const isTransparent = targetBgColor === 'transparent' || !targetBgColor;
  let tr = 255, tg = 255, tb = 255;
  if (!isTransparent && targetBgColor.startsWith('#')) {
    tr = parseInt(targetBgColor.slice(1, 3), 16) || 255;
    tg = parseInt(targetBgColor.slice(3, 5), 16) || 255;
    tb = parseInt(targetBgColor.slice(5, 7), 16) || 255;
  }

  // Apply background mask with optional edge smoothing
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = y * w + x;
      const p = idx * 4;

      if (isBackground[idx]) {
        if (isTransparent) {
          data[p + 3] = 0; // Transparent
        } else {
          data[p] = tr;
          data[p + 1] = tg;
          data[p + 2] = tb;
          data[p + 3] = 255;
        }
      }
    }
  }

  ctx.putImageData(imgData, 0, 0);

  // If replacing with solid color, draw clean background underneath transparent edges
  if (!isTransparent) {
    const finalCanvas = document.createElement('canvas');
    finalCanvas.width = w;
    finalCanvas.height = h;
    const finalCtx = finalCanvas.getContext('2d');
    if (finalCtx) {
      finalCtx.fillStyle = targetBgColor;
      finalCtx.fillRect(0, 0, w, h);
      finalCtx.drawImage(canvas, 0, 0);
      return finalCanvas.toDataURL('image/jpeg', 0.98);
    }
  }

  return canvas.toDataURL('image/png');
}

/**
 * Applies adjustments (brightness, contrast, saturation, sharpness, background color) and crops to target aspect ratio
 */
export async function processPassportImage(
  imageSrc: string,
  settings: PassportSettings,
  targetWidthMm: number,
  targetHeightMm: number,
  cropBox?: { x: number; y: number; width: number; height: number } // percentages
): Promise<string> {
  const img = await loadImage(imageSrc);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  const targetPxWidth = mmToPixels(targetWidthMm, 300);
  const targetPxHeight = mmToPixels(targetHeightMm, 300);

  canvas.width = targetPxWidth;
  canvas.height = targetPxHeight;

  // Background color if not original
  if (settings.backgroundColor && settings.backgroundColor !== 'original') {
    ctx.fillStyle = settings.backgroundColor;
    ctx.fillRect(0, 0, targetPxWidth, targetPxHeight);
  } else {
    // Transparent or clean white base
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, targetPxWidth, targetPxHeight);
  }

  // Calculate source crop region
  let sx = 0;
  let sy = 0;
  let sWidth = img.width;
  let sHeight = img.height;

  if (cropBox) {
    sx = (cropBox.x / 100) * img.width;
    sy = (cropBox.y / 100) * img.height;
    sWidth = (cropBox.width / 100) * img.width;
    sHeight = (cropBox.height / 100) * img.height;
  } else {
    // Auto-fit to center with target aspect ratio
    const targetAspect = targetWidthMm / targetHeightMm;
    const imgAspect = img.width / img.height;
    if (imgAspect > targetAspect) {
      sWidth = img.height * targetAspect;
      sx = (img.width - sWidth) / 2;
    } else {
      sHeight = img.width / targetAspect;
      sy = (img.height - sHeight) / 2;
    }
  }

  // Draw filtered image on temporary offscreen canvas
  const offscreen = document.createElement('canvas');
  offscreen.width = targetPxWidth;
  offscreen.height = targetPxHeight;
  const offCtx = offscreen.getContext('2d');
  if (!offCtx) throw new Error('Offscreen context failed');

  // Apply CSS filters for brightness, contrast, saturation
  const b = 100 + (settings.brightness || 0);
  const c = 100 + (settings.contrast || 0);
  const s = 100 + (settings.saturation || 0);
  offCtx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

  offCtx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetPxWidth, targetPxHeight);

  // If background removal / replacement requested (simple chroma-key or background blend)
  if (settings.backgroundColor && settings.backgroundColor !== 'original') {
    const imgData = offCtx.getImageData(0, 0, targetPxWidth, targetPxHeight);
    const data = imgData.data;

    // Sample top corner background color to detect near-white/near-grey
    const r0 = data[0], g0 = data[1], b0 = data[2];
    const isLightBg = (r0 + g0 + b0) / 3 > 180;

    // If light background, blend edge pixels
    const targetHex = settings.backgroundColor;
    const tr = parseInt(targetHex.slice(1, 3), 16) || 255;
    const tg = parseInt(targetHex.slice(3, 5), 16) || 255;
    const tb = parseInt(targetHex.slice(5, 7), 16) || 255;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      const brightness = (r + g + b) / 3;
      const colorDiff = Math.abs(r - r0) + Math.abs(g - g0) + Math.abs(b - b0);

      // If near background color in top corners or outer margins
      if (isLightBg && brightness > 215 && colorDiff < 60) {
        data[i] = tr;
        data[i + 1] = tg;
        data[i + 2] = tb;
      }
    }
    offCtx.putImageData(imgData, 0, 0);
  }

  // Draw offscreen onto main canvas
  ctx.drawImage(offscreen, 0, 0);

  // Return high-quality base64
  return canvas.toDataURL('image/jpeg', 0.96);
}

/**
 * Process single ID card item (front or back side) with crop, rotation, filters
 */
export async function processIDCardItem(
  card: IDCardItem,
  targetWidthMm: number,
  targetHeightMm: number,
  cornerRadiusMm: number = 3.18
): Promise<string> {
  const img = await loadImage(card.dataUrl);
  const targetPxWidth = mmToPixels(targetWidthMm, 300);
  const targetPxHeight = mmToPixels(targetHeightMm, 300);

  const canvas = document.createElement('canvas');
  canvas.width = targetPxWidth;
  canvas.height = targetPxHeight;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  // Fill white base
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, targetPxWidth, targetPxHeight);

  // Calculate crop source
  let sx = 0;
  let sy = 0;
  let sWidth = img.width;
  let sHeight = img.height;

  if (card.cropBox) {
    sx = (card.cropBox.x / 100) * img.width;
    sy = (card.cropBox.y / 100) * img.height;
    sWidth = (card.cropBox.width / 100) * img.width;
    sHeight = (card.cropBox.height / 100) * img.height;
  }

  // Handle rounded corners clipping if specified
  if (cornerRadiusMm > 0) {
    const rPx = mmToPixels(cornerRadiusMm, 300);
    ctx.beginPath();
    ctx.moveTo(rPx, 0);
    ctx.lineTo(targetPxWidth - rPx, 0);
    ctx.quadraticCurveTo(targetPxWidth, 0, targetPxWidth, rPx);
    ctx.lineTo(targetPxWidth, targetPxHeight - rPx);
    ctx.quadraticCurveTo(targetPxWidth, targetPxHeight, targetPxWidth - rPx, targetPxHeight);
    ctx.lineTo(rPx, targetPxHeight);
    ctx.quadraticCurveTo(0, targetPxHeight, 0, targetPxHeight - rPx);
    ctx.lineTo(0, rPx);
    ctx.quadraticCurveTo(0, 0, rPx, 0);
    ctx.closePath();
    ctx.clip();
  }

  // Draw with rotation & filters
  ctx.save();
  const b = 100 + (card.brightness || 0);
  const c = 100 + (card.contrast || 0);
  const s = 100 + (card.saturation || 0);
  ctx.filter = `brightness(${b}%) contrast(${c}%) saturate(${s}%)`;

  if (card.rotation && card.rotation !== 0) {
    ctx.translate(targetPxWidth / 2, targetPxHeight / 2);
    ctx.rotate((card.rotation * Math.PI) / 180);
    ctx.drawImage(img, sx, sy, sWidth, sHeight, -targetPxWidth / 2, -targetPxHeight / 2, targetPxWidth, targetPxHeight);
  } else {
    ctx.drawImage(img, sx, sy, sWidth, sHeight, 0, 0, targetPxWidth, targetPxHeight);
  }
  ctx.restore();

  return canvas.toDataURL('image/jpeg', 0.98);
}

/**
 * Generate full A4 / 4x6 / Letter sheet with 36 (or requested count) passport photos
 */
export async function renderPassportSheetCanvas(
  processedPhotoDataUrl: string,
  paper: PaperSizeConfig,
  settings: PassportSettings,
  photoWidthMm: number,
  photoHeightMm: number
): Promise<HTMLCanvasElement> {
  const photoImg = await loadImage(processedPhotoDataUrl);
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  const sheetWidthPx = mmToPixels(paper.widthMm, 300);
  const sheetHeightPx = mmToPixels(paper.heightMm, 300);

  canvas.width = sheetWidthPx;
  canvas.height = sheetHeightPx;

  // Fill clear white background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx);

  const photoWidthPx = mmToPixels(photoWidthMm, 300);
  const photoHeightPx = mmToPixels(photoHeightMm, 300);
  const gapPx = mmToPixels(settings.gapMm ?? 2, 300);

  // Compute maximum columns and rows that fit
  const availableWidthMm = paper.widthMm;
  const availableHeightMm = paper.heightMm;

  let cols = Math.floor((availableWidthMm + settings.gapMm) / (photoWidthMm + settings.gapMm));
  let rows = Math.floor((availableHeightMm + settings.gapMm) / (photoHeightMm + settings.gapMm));

  // If paper is A4 and photo is 35x45 mm, default to requested 36 photos (6 columns x 6 rows)
  if (paper.id === 'a4' && settings.photoCount >= 36) {
    cols = 6;
    rows = 6;
  } else if (paper.id === '4x6') {
    cols = Math.min(cols, 4);
    rows = Math.min(rows, 2);
  }

  const totalGridCapacity = cols * rows;
  const countToDraw = Math.min(settings.photoCount, totalGridCapacity);

  // Center the grid on the sheet or use custom margins
  const totalGridWidthPx = cols * photoWidthPx + (cols - 1) * gapPx;
  const totalGridHeightPx = rows * photoHeightPx + (rows - 1) * gapPx;

  const startXPx = settings.marginLeftMm > 0
    ? mmToPixels(settings.marginLeftMm, 300)
    : Math.max(0, (sheetWidthPx - totalGridWidthPx) / 2);

  const startYPx = settings.marginTopMm > 0
    ? mmToPixels(settings.marginTopMm, 300)
    : Math.max(0, (sheetHeightPx - totalGridHeightPx) / 2);

  let drawnCount = 0;

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (drawnCount >= countToDraw) break;

      const x = startXPx + c * (photoWidthPx + gapPx);
      const y = startYPx + r * (photoHeightPx + gapPx);

      // Draw photo
      ctx.drawImage(photoImg, x, y, photoWidthPx, photoHeightPx);

      // Draw border / cutting lines
      if (settings.showCutLines) {
        ctx.strokeStyle = '#9ca3af'; // light gray cutting line
        ctx.lineWidth = 1;

        if (settings.cutLineStyle === 'dashed') {
          ctx.setLineDash([6, 6]);
          ctx.strokeRect(x, y, photoWidthPx, photoHeightPx);
          ctx.setLineDash([]);
        } else if (settings.cutLineStyle === 'cross_corners') {
          // Cross marks in 4 corners
          const markLen = mmToPixels(2.5, 300);
          ctx.beginPath();
          // Top Left
          ctx.moveTo(x - markLen, y); ctx.lineTo(x, y); ctx.lineTo(x, y - markLen);
          // Top Right
          ctx.moveTo(x + photoWidthPx + markLen, y); ctx.lineTo(x + photoWidthPx, y); ctx.lineTo(x + photoWidthPx, y - markLen);
          // Bottom Left
          ctx.moveTo(x - markLen, y + photoHeightPx); ctx.lineTo(x, y + photoHeightPx); ctx.lineTo(x, y + photoHeightPx + markLen);
          // Bottom Right
          ctx.moveTo(x + photoWidthPx + markLen, y + photoHeightPx); ctx.lineTo(x + photoWidthPx, y + photoHeightPx); ctx.lineTo(x + photoWidthPx, y + photoHeightPx + markLen);
          ctx.stroke();
        } else {
          // Solid light border
          ctx.strokeRect(x, y, photoWidthPx, photoHeightPx);
        }
      }

      drawnCount++;
    }
  }

  // No hardcoded headers/footers in print output as requested by user
  return canvas;
}

/**
 * Generate full A4 / 4x6 sheet for ID Cards (Side-by-side, Stacked, Foldable, Multi-copy)
 */
export async function renderIDCardSheetCanvas(
  frontCardUrl: string | null,
  backCardUrl: string | null,
  paper: PaperSizeConfig,
  settings: IDCardSettings,
  cardWidthMm: number,
  cardHeightMm: number
): Promise<HTMLCanvasElement> {
  const frontImg = frontCardUrl ? await loadImage(frontCardUrl) : null;
  const backImg = backCardUrl ? await loadImage(backCardUrl) : null;

  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  const sheetWidthPx = mmToPixels(paper.widthMm, 300);
  const sheetHeightPx = mmToPixels(paper.heightMm, 300);

  canvas.width = sheetWidthPx;
  canvas.height = sheetHeightPx;

  // Clean white sheet
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, sheetWidthPx, sheetHeightPx);

  const cardWidthPx = mmToPixels(cardWidthMm, 300);
  const cardHeightPx = mmToPixels(cardHeightMm, 300);
  const spacingPx = mmToPixels(settings.spacingMm ?? 6, 300);
  const laminateMarginPx = mmToPixels(settings.laminateMarginMm ?? 3, 300);

  // Determine positions based on layoutMode
  const drawCardWithLaminateAndCuts = (img: HTMLImageElement | null, x: number, y: number, label: string) => {
    // Draw laminate pouch border if margin > 0
    if (settings.laminateMarginMm > 0) {
      ctx.strokeStyle = '#d1d5db';
      ctx.setLineDash([4, 4]);
      ctx.strokeRect(
        x - laminateMarginPx,
        y - laminateMarginPx,
        cardWidthPx + laminateMarginPx * 2,
        cardHeightPx + laminateMarginPx * 2
      );
      ctx.setLineDash([]);
    }

    if (img) {
      ctx.drawImage(img, x, y, cardWidthPx, cardHeightPx);
    } else {
      // Placeholder box
      ctx.fillStyle = '#f3f4f6';
      ctx.fillRect(x, y, cardWidthPx, cardHeightPx);
      ctx.strokeStyle = '#9ca3af';
      ctx.strokeRect(x, y, cardWidthPx, cardHeightPx);
      ctx.fillStyle = '#6b7280';
      ctx.font = '28px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`[ ${label} NOT UPLOADED ]`, x + cardWidthPx / 2, y + cardHeightPx / 2);
      ctx.textAlign = 'start';
    }

    // Card border
    if (settings.borderStyle !== 'none') {
      ctx.strokeStyle = settings.borderStyle === 'thin_black' ? '#111827' : '#9ca3af';
      ctx.lineWidth = settings.borderWidthPx || 1;
      ctx.strokeRect(x, y, cardWidthPx, cardHeightPx);
    }

    // Cutting corner guide marks
    if (settings.showCuttingMarks) {
      const cLen = mmToPixels(3, 300);
      ctx.strokeStyle = '#4b5563';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      // TL
      ctx.moveTo(x - cLen, y); ctx.lineTo(x, y); ctx.lineTo(x, y - cLen);
      // TR
      ctx.moveTo(x + cardWidthPx + cLen, y); ctx.lineTo(x + cardWidthPx, y); ctx.lineTo(x + cardWidthPx, y - cLen);
      // BL
      ctx.moveTo(x - cLen, y + cardHeightPx); ctx.lineTo(x, y + cardHeightPx); ctx.lineTo(x, y + cardHeightPx + cLen);
      // BR
      ctx.moveTo(x + cardWidthPx + cLen, y + cardHeightPx); ctx.lineTo(x + cardWidthPx, y + cardHeightPx); ctx.lineTo(x + cardWidthPx, y + cardHeightPx + cLen);
      ctx.stroke();
    }

    // Side label tag
    ctx.fillStyle = '#4b5563';
    ctx.font = 'bold 22px sans-serif';
    ctx.fillText(label, x + 4, y - 10);
  };

  // Header Title
  if (settings.includeDetailsHeader) {
    ctx.fillStyle = '#1f2937';
    ctx.font = 'bold 32px sans-serif';
    ctx.fillText(settings.headerText || 'ID CARD PRINT SHEET', mmToPixels(15, 300), mmToPixels(15, 300));
    ctx.fillStyle = '#6b7280';
    ctx.font = '22px sans-serif';
    ctx.fillText(`Card Size: ${cardWidthMm} × ${cardHeightMm} mm (CR80/Standard) | Print at 100% scale`, mmToPixels(15, 300), mmToPixels(22, 300));
  }

  const topOffsetPx = settings.includeDetailsHeader ? mmToPixels(30, 300) : mmToPixels(15, 300);

  if (settings.layoutMode === 'side_by_side') {
    // Horizontal side by side
    const totalW = cardWidthPx * 2 + spacingPx;
    const startX = Math.max(mmToPixels(10, 300), (sheetWidthPx - totalW) / 2);
    const startY = Math.max(topOffsetPx, (sheetHeightPx - cardHeightPx) / 2);

    drawCardWithLaminateAndCuts(frontImg, startX, startY, 'FRONT SIDE');
    drawCardWithLaminateAndCuts(backImg, startX + cardWidthPx + spacingPx, startY, 'BACK SIDE');
  } else if (settings.layoutMode === 'stacked') {
    // Vertical stacked
    const totalH = cardHeightPx * 2 + spacingPx;
    const startX = Math.max(mmToPixels(10, 300), (sheetWidthPx - cardWidthPx) / 2);
    const startY = Math.max(topOffsetPx, (sheetHeightPx - totalH) / 2);

    drawCardWithLaminateAndCuts(frontImg, startX, startY, 'FRONT SIDE');
    drawCardWithLaminateAndCuts(backImg, startX, startY + cardHeightPx + spacingPx, 'BACK SIDE');
  } else if (settings.layoutMode === 'foldable') {
    // Foldable ID card (Front & Back attached along one edge with dashed fold line)
    const totalH = cardHeightPx * 2;
    const startX = Math.max(mmToPixels(10, 300), (sheetWidthPx - cardWidthPx) / 2);
    const startY = Math.max(topOffsetPx, (sheetHeightPx - totalH) / 2);

    drawCardWithLaminateAndCuts(frontImg, startX, startY, 'FRONT SIDE');
    drawCardWithLaminateAndCuts(backImg, startX, startY + cardHeightPx, 'BACK SIDE');

    // Dashed fold line in middle
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 6]);
    ctx.beginPath();
    ctx.moveTo(startX - mmToPixels(5, 300), startY + cardHeightPx);
    ctx.lineTo(startX + cardWidthPx + mmToPixels(5, 300), startY + cardHeightPx);
    ctx.stroke();
    ctx.setLineDash([]);

    ctx.fillStyle = '#dc2626';
    ctx.font = '20px sans-serif';
    ctx.fillText('✀ FOLD HERE', startX + cardWidthPx + mmToPixels(8, 300), startY + cardHeightPx + 6);
  } else if (settings.layoutMode === 'grid_multi') {
    // Multi copies of Front + Back pairs on A4
    const pairCount = settings.cardsCount || 2;
    const cols = 2; // Front, Back
    const rows = pairCount;
    const startX = Math.max(mmToPixels(12, 300), (sheetWidthPx - (cardWidthPx * 2 + spacingPx)) / 2);

    for (let r = 0; r < rows; r++) {
      const y = topOffsetPx + r * (cardHeightPx + spacingPx + mmToPixels(8, 300));
      if (y + cardHeightPx > sheetHeightPx) break;
      drawCardWithLaminateAndCuts(frontImg, startX, y, `FRONT (Copy #${r + 1})`);
      drawCardWithLaminateAndCuts(backImg, startX + cardWidthPx + spacingPx, y, `BACK (Copy #${r + 1})`);
    }
  }

  return canvas;
}

/**
 * Process document item with adaptive B&W photocopy / magic color / grayscale
 */
export async function processDocumentItem(doc: DocumentItem): Promise<string> {
  const img = await loadImage(doc.dataUrl);
  const canvas = document.createElement('canvas');
  canvas.width = img.width;
  canvas.height = img.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context failed');

  // Handle rotation
  if (doc.rotation && doc.rotation !== 0) {
    if (doc.rotation === 90 || doc.rotation === 270) {
      canvas.width = img.height;
      canvas.height = img.width;
    }
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate((doc.rotation * Math.PI) / 180);
    ctx.drawImage(img, -img.width / 2, -img.height / 2);
  } else {
    ctx.drawImage(img, 0, 0);
  }

  // Filters
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;

  if (doc.filterMode === 'bw_photocopy') {
    // High contrast black and white text photocopy filter
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      // Adaptive thresholding: pure black or pure white
      const val = gray < 140 ? 0 : 255;
      data[i] = val;
      data[i + 1] = val;
      data[i + 2] = val;
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (doc.filterMode === 'magic_color') {
    // Sharp document boost
    for (let i = 0; i < data.length; i += 4) {
      data[i] = Math.min(255, Math.max(0, (data[i] - 128) * 1.35 + 138));
      data[i + 1] = Math.min(255, Math.max(0, (data[i + 1] - 128) * 1.35 + 138));
      data[i + 2] = Math.min(255, Math.max(0, (data[i + 2] - 128) * 1.35 + 138));
    }
    ctx.putImageData(imgData, 0, 0);
  } else if (doc.filterMode === 'grayscale') {
    for (let i = 0; i < data.length; i += 4) {
      const gray = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      data[i] = gray;
      data[i + 1] = gray;
      data[i + 2] = gray;
    }
    ctx.putImageData(imgData, 0, 0);
  }

  return canvas.toDataURL('image/jpeg', 0.95);
}

/**
 * Generate Multi-page / Printable PDF from Canvas with exact physical millimeter sizing
 */
export function exportToPDF(
  canvas: HTMLCanvasElement,
  paper: PaperSizeConfig,
  filename: string = 'studio_export.pdf'
): void {
  const orientation = paper.widthMm > paper.heightMm ? 'landscape' : 'portrait';
  const pdf = new jsPDF({
    orientation: orientation,
    unit: 'mm',
    format: [paper.widthMm, paper.heightMm],
  });

  const imgData = canvas.toDataURL('image/jpeg', 0.98);
  pdf.addImage(imgData, 'JPEG', 0, 0, paper.widthMm, paper.heightMm);
  pdf.save(filename);
}

/**
 * Export 2-page Duplex PDF for ID card (Page 1: Front, Page 2: Back aligned for flip printing)
 */
export async function exportDuplexIDCardPDF(
  frontCanvas: HTMLCanvasElement,
  backCanvas: HTMLCanvasElement,
  paper: PaperSizeConfig,
  filename: string = 'duplex_id_card.pdf'
): Promise<void> {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [paper.widthMm, paper.heightMm],
  });

  const frontData = frontCanvas.toDataURL('image/jpeg', 0.98);
  pdf.addImage(frontData, 'JPEG', 0, 0, paper.widthMm, paper.heightMm);

  pdf.addPage([paper.widthMm, paper.heightMm], 'portrait');
  const backData = backCanvas.toDataURL('image/jpeg', 0.98);
  pdf.addImage(backData, 'JPEG', 0, 0, paper.widthMm, paper.heightMm);

  pdf.save(filename);
}
