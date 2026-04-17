export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

export function drawLine(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  width = 1,
): void {
  ctx.beginPath();
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
}

export function drawGlowCircle(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  radius: number,
  color: string,
  glowIntensity = 0.3,
): void {
  // Glow
  const gradient = ctx.createRadialGradient(x, y, radius * 0.5, x, y, radius * 2.5);
  gradient.addColorStop(0, hexToRgba(color, glowIntensity));
  gradient.addColorStop(1, hexToRgba(color, 0));
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(x, y, radius * 2.5, 0, Math.PI * 2);
  ctx.fill();

  // Circle
  ctx.fillStyle = hexToRgba(color, 0.15);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.stroke();
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: {
    color?: string;
    size?: number;
    align?: CanvasTextAlign;
    baseline?: CanvasTextBaseline;
    maxWidth?: number;
  } = {},
): void {
  const { color = '#e2e8f0', size = 12, align = 'center', baseline = 'middle', maxWidth } = options;
  ctx.fillStyle = color;
  ctx.font = `${size}px 'JetBrains Mono', monospace`;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if (maxWidth) {
    ctx.fillText(text, x, y, maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
}

export function drawGrid(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  spacing: number,
  color: string,
): void {
  ctx.strokeStyle = color;
  ctx.lineWidth = 0.5;
  for (let x = 0; x <= width; x += spacing) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, height);
    ctx.stroke();
  }
  for (let y = 0; y <= height; y += spacing) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(width, y);
    ctx.stroke();
  }
}

export const LANDSCAPE_EXPORT_WIDTH = 800;
export const LANDSCAPE_EXPORT_HEIGHT = 450;

interface ExportSurface {
  width: number;
  height: number;
  restore: () => void;
}

/**
 * Temporarily forces the live canvas onto a stable 16:9 landscape surface so
 * export flows can fit content against the exported frame rather than the
 * current in-app panel layout.
 */
export function prepareLandscapeExportCanvas(
  canvas: HTMLCanvasElement,
  width = LANDSCAPE_EXPORT_WIDTH,
  height = LANDSCAPE_EXPORT_HEIGHT,
): ExportSurface {
  const dpr = window.devicePixelRatio || 1;
  const previousWidth = canvas.width;
  const previousHeight = canvas.height;
  const previousStyleWidth = canvas.style.width;
  const previousStyleHeight = canvas.style.height;

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  return {
    width,
    height,
    restore() {
      canvas.width = previousWidth;
      canvas.height = previousHeight;
      canvas.style.width = previousStyleWidth;
      canvas.style.height = previousStyleHeight;
    },
  };
}

/**
 * Export a canvas as a PNG with fit-to-view before capture.
 * Saves camera state, fits instantly for capture, waits one frame, captures, then restores.
 */
export function exportCanvasPng(
  canvas: HTMLCanvasElement,
  camera: { panX: number; panY: number; zoom: number; setPanZoom: (x: number, y: number, z: number) => void },
  fitToView: (options?: { instant?: boolean }) => void,
  filename: string,
  toast: (filename: string) => void,
): void {
  const prevPanX = camera.panX;
  const prevPanY = camera.panY;
  const prevZoom = camera.zoom;
  const exportSurface = prepareLandscapeExportCanvas(canvas);

  fitToView({ instant: true });

  requestAnimationFrame(() => {
    try {
      const data = canvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = data;
      a.download = filename;
      a.click();
      toast(filename);
    } finally {
      exportSurface.restore();
      camera.setPanZoom(prevPanX, prevPanY, prevZoom);
    }
  });
}

export function drawArrow(
  ctx: CanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  color: string,
  headSize = 8,
): void {
  const angle = Math.atan2(y2 - y1, x2 - x1);
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineWidth = 2;

  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - headSize * Math.cos(angle - Math.PI / 6), y2 - headSize * Math.sin(angle - Math.PI / 6));
  ctx.lineTo(x2 - headSize * Math.cos(angle + Math.PI / 6), y2 - headSize * Math.sin(angle + Math.PI / 6));
  ctx.closePath();
  ctx.fill();
}
