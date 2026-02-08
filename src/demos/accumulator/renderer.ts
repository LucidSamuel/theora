import { drawGrid, drawLine, drawGlowCircle, hexToRgba } from '@/lib/canvas';
import type { AccElement, WitnessInfo } from '@/types/accumulator';
import type { FrameInfo } from '@/components/shared/AnimatedCanvas';

const AMBER_COLOR = '#c88f54';
const ELEMENT_RADIUS = 25;

export function renderAccumulator(
  ctx: CanvasRenderingContext2D,
  frame: FrameInfo,
  elements: AccElement[],
  accValue: bigint,
  selectedIndex: number | null,
  witness: WitnessInfo | null,
  nonMembership: { target: bigint; witness: bigint; b: bigint; verified: boolean | null } | null,
  mouseX: number,
  mouseY: number,
  theme: 'dark' | 'light'
): { hoveredIndex: number | null } {
  const { width, height, time } = frame;
  const centerX = width / 2;
  const centerY = height / 2;

  // 1. Draw subtle gradient + grid background
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  if (theme === 'dark') {
    gradient.addColorStop(0, '#0f0b08');
    gradient.addColorStop(1, '#17110c');
  } else {
    gradient.addColorStop(0, '#fbf6ef');
    gradient.addColorStop(1, '#f2e8dd');
  }
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const gridColor = theme === 'dark' ? 'rgba(240, 231, 222, 0.04)' : 'rgba(111, 75, 50, 0.08)';
  drawGrid(ctx, width, height, 40, gridColor);

  // Vignette
  const vignette = ctx.createRadialGradient(width / 2, height / 2, Math.min(width, height) * 0.2, width / 2, height / 2, Math.max(width, height) * 0.7);
  vignette.addColorStop(0, 'rgba(0,0,0,0)');
  vignette.addColorStop(1, theme === 'dark' ? 'rgba(0,0,0,0.35)' : 'rgba(111,75,50,0.08)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, width, height);

  // 2. Draw orbit paths (dashed circles for each ring)
  const rings = new Set<number>();
  elements.forEach(el => rings.add(el.orbitRadius));

  ctx.strokeStyle = hexToRgba(AMBER_COLOR, 0.15);
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);

  rings.forEach(radius => {
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
    ctx.stroke();
  });

  ctx.setLineDash([]);

  // 3. Draw central accumulator with pulsing glow
  const pulseOpacity = 0.3 + Math.sin(time * 2) * 0.15;
  drawGlowCircle(
    ctx,
    centerX,
    centerY,
    50,
    AMBER_COLOR,
    pulseOpacity
  );

  // Draw accumulator value text
  const accText = truncateHash(accValue.toString(), 12);
  ctx.fillStyle = theme === 'dark' ? '#fff' : '#000';
  ctx.font = 'bold 14px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(accText, centerX, centerY);

  // 4. Draw verification animation if witness is present
  if (witness && witness.verified !== null) {
    if (witness.verified) {
      // Green expanding ring on success
      const ringRadius = 60 + (time % 2) * 30;
      const ringOpacity = Math.max(0, 0.6 - (time % 2) * 0.3);
      ctx.strokeStyle = hexToRgba('#10b981', ringOpacity);
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, ringRadius, 0, Math.PI * 2);
      ctx.stroke();
    } else {
      // Red pulse on failure
      const pulseScale = 1 + Math.sin(time * 4) * 0.1;
      ctx.strokeStyle = hexToRgba('#ef4444', 0.5);
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 55 * pulseScale, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  // 5. Draw orbiting elements
  let hoveredIndex: number | null = null;

  elements.forEach((element, index) => {
    // Calculate position using spring for smooth animation
    const x = element.spring.x.value;
    const y = element.spring.y.value;

    // Check if mouse is hovering over this element
    const dx = mouseX - x;
    const dy = mouseY - y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    const isHovered = distance < ELEMENT_RADIUS;

    if (isHovered) {
      hoveredIndex = index;
    }

    const isSelected = index === selectedIndex;

    // Draw connection line if selected
    if (isSelected) {
      drawLine(ctx, centerX, centerY, x, y, hexToRgba(AMBER_COLOR, 0.6), 2);
    }

    // Draw element circle
    const elementOpacity = element.opacity * (isHovered ? 0.9 : 0.7);
    drawGlowCircle(
      ctx,
      x,
      y,
      ELEMENT_RADIUS,
      AMBER_COLOR,
      elementOpacity
    );

    // Draw border for selected element
    if (isSelected) {
      ctx.strokeStyle = hexToRgba(AMBER_COLOR, 0.9);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(x, y, ELEMENT_RADIUS + 3, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Draw prime value
    ctx.fillStyle = theme === 'dark' ? '#fff' : '#000';
    ctx.font = 'bold 13px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(element.prime.toString(), x, y - 2);

    // Draw label below
    ctx.font = '10px sans-serif';
    ctx.fillStyle = hexToRgba(theme === 'dark' ? '#fff' : '#000', 0.6);
    ctx.fillText(element.label, x, y + 12);
  });

  // 6. Draw witness equation if selected and witness computed
  if (selectedIndex !== null && witness && witness.witness !== 0n) {
    const element = elements[selectedIndex];
    if (element) {
      const x = element.spring.x.value;
      const y = element.spring.y.value;

      // Draw witness info box above the element
      const boxY = y - ELEMENT_RADIUS - 80;
      const witnessText = `w = ${truncateHash(witness.witness.toString(), 10)}`;
      const statusColor =
        witness.verified === null ? AMBER_COLOR : witness.verified ? '#10b981' : '#ef4444';
      const pulse = 0.3 + Math.sin(time * 6) * 0.2;

      ctx.fillStyle = hexToRgba(theme === 'dark' ? '#1f2937' : '#f3f4f6', 0.95);
      ctx.fillRect(x - 100, boxY, 200, 50);

      ctx.strokeStyle = hexToRgba(statusColor, witness.verified === null ? pulse : 0.6);
      ctx.lineWidth = 1.5;
      ctx.strokeRect(x - 100, boxY, 200, 50);

      ctx.fillStyle = theme === 'dark' ? '#fff' : '#000';
      ctx.font = '11px monospace';
      ctx.textAlign = 'center';
      ctx.fillText(witnessText, x, boxY + 18);

      // Equation rendering with simple superscript + highlights
      const baseY = boxY + 35;
      const baseFont = '11px monospace';
      const supFont = '9px monospace';

      ctx.textAlign = 'left';
      let cursorX = x - 80;

      const drawPart = (text: string, color: string, font = baseFont) => {
        ctx.fillStyle = color;
        ctx.font = font;
        ctx.fillText(text, cursorX, baseY);
        cursorX += ctx.measureText(text).width;
      };

      const witnessColor = '#f59e0b';
      const elementColor = '#a855f7';
      const accColor = '#22c55e';

      drawPart('w', witnessColor);
      drawPart('^', theme === 'dark' ? '#e5e7eb' : '#1f2937');
      ctx.font = supFont;
      ctx.fillStyle = elementColor;
      ctx.fillText(witness.element.toString(), cursorX, baseY - 4);
      cursorX += ctx.measureText(witness.element.toString()).width;
      ctx.font = baseFont;
      drawPart(' ≡ ', theme === 'dark' ? '#e5e7eb' : '#1f2937');
      drawPart('acc', accColor);
      drawPart(' (mod n)', theme === 'dark' ? '#9ca3af' : '#6b7280');

      if (witness.verified !== null) {
        ctx.strokeStyle = hexToRgba(statusColor, 0.5);
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.roundRect(x - 92, boxY + 24, 184, 20, 6);
        ctx.stroke();
      }
    }
  }

  // 7. Draw non-membership witness box near center
  if (nonMembership && nonMembership.witness !== 0n) {
    const boxW = 260;
    const boxH = 54;
    const boxX = centerX - boxW / 2;
    const boxY = centerY + 90;
    const statusColor =
      nonMembership.verified === null ? AMBER_COLOR : nonMembership.verified ? '#10b981' : '#ef4444';

    ctx.fillStyle = hexToRgba(theme === 'dark' ? '#1f2937' : '#f3f4f6', 0.95);
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = hexToRgba(statusColor, 0.6);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(boxX, boxY, boxW, boxH);

    ctx.fillStyle = theme === 'dark' ? '#fff' : '#000';
    ctx.font = '11px monospace';
    ctx.textAlign = 'center';
    ctx.fillText(`Non-member x = ${nonMembership.target.toString()}`, centerX, boxY + 18);
    ctx.fillText('w^x · acc^b = g', centerX, boxY + 36);
  }

  return { hoveredIndex };
}

function truncateHash(hash: string, maxLength: number): string {
  if (hash.length <= maxLength) return hash;
  const half = Math.floor((maxLength - 3) / 2);
  return `${hash.slice(0, half)}...${hash.slice(-half)}`;
}
