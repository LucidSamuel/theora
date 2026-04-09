import GIF from 'gif.js';
import { trackGifCompleted } from '@/lib/analytics';

const FPS = 15;
const FRAME_INTERVAL = 1000 / FPS;
const MAX_WIDTH = 800;
const MAX_DURATION_MS = 30_000; // safety cap

export interface GifRecorder {
  /** Call when the animation finishes to stop recording and begin encoding. */
  stop: () => void;
}

interface GifRecordingOptions {
  canvas: HTMLCanvasElement;
  camera: { panX: number; panY: number; zoom: number; setPanZoom: (x: number, y: number, z: number) => void };
  fitToView: (options?: { instant?: boolean }) => void;
  filename: string;
  onDone?: () => void;
}

function captureFrame(source: HTMLCanvasElement, outWidth: number, outHeight: number): HTMLCanvasElement {
  const frame = document.createElement('canvas');
  frame.width = outWidth;
  frame.height = outHeight;
  const ctx = frame.getContext('2d')!;
  ctx.drawImage(source, 0, 0, source.width, source.height, 0, 0, outWidth, outHeight);
  return frame;
}

function createOverlay(): {
  el: HTMLDivElement;
  setPhase: (phase: 'recording' | 'encoding') => void;
  setTimer: (elapsedMs: number) => void;
  setFrameCount: (n: number) => void;
  setProgress: (pct: number) => void;
  destroy: () => void;
} {
  const el = document.createElement('div');
  Object.assign(el.style, {
    position: 'fixed',
    inset: '0',
    zIndex: '99999',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '10px',
    background: 'rgba(0,0,0,0.45)',
    backdropFilter: 'blur(2px)',
    fontFamily: 'var(--font-display, system-ui)',
    color: '#fff',
    pointerEvents: 'none',
  });

  const label = document.createElement('div');
  Object.assign(label.style, {
    fontSize: '13px',
    fontWeight: '500',
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  });

  const dot = document.createElement('span');
  Object.assign(dot.style, {
    width: '8px',
    height: '8px',
    borderRadius: '50%',
    background: '#ef4444',
    display: 'inline-block',
    animation: 'gif-rec-pulse 1s ease-in-out infinite',
  });
  const style = document.createElement('style');
  style.textContent = '@keyframes gif-rec-pulse{0%,100%{opacity:1}50%{opacity:.3}}';
  el.appendChild(style);

  const labelText = document.createElement('span');
  labelText.textContent = 'Recording 0:00';
  label.appendChild(dot);
  label.appendChild(labelText);
  el.appendChild(label);

  const info = document.createElement('div');
  Object.assign(info.style, { fontSize: '11px', color: 'rgba(255,255,255,0.5)' });
  info.textContent = '0 frames';
  el.appendChild(info);

  const barOuter = document.createElement('div');
  Object.assign(barOuter.style, {
    width: '200px',
    height: '4px',
    borderRadius: '2px',
    background: 'rgba(255,255,255,0.2)',
    overflow: 'hidden',
    display: 'none',
  });
  el.appendChild(barOuter);

  const barInner = document.createElement('div');
  Object.assign(barInner.style, {
    width: '0%',
    height: '100%',
    borderRadius: '2px',
    background: '#a78bfa',
    transition: 'width 80ms linear',
  });
  barOuter.appendChild(barInner);

  document.body.appendChild(el);

  return {
    el,
    setTimer(elapsedMs) {
      const s = Math.floor(elapsedMs / 1000);
      const m = Math.floor(s / 60);
      const ss = String(s % 60).padStart(2, '0');
      labelText.textContent = `Recording ${m}:${ss}`;
    },
    setFrameCount(n) {
      info.textContent = `${n} frames`;
    },
    setPhase(phase) {
      if (phase === 'encoding') {
        dot.style.display = 'none';
        labelText.textContent = 'Encoding GIF...';
        info.style.display = 'none';
        barOuter.style.display = 'block';
        barInner.style.width = '0%';
      }
    },
    setProgress(pct) {
      barInner.style.width = `${Math.round(pct * 100)}%`;
    },
    destroy() {
      el.remove();
    },
  };
}

/**
 * Begin recording canvas frames. The caller is responsible for starting
 * the demo animation and calling `stop()` when the animation completes.
 *
 * Flow:
 *  1. Camera fits to view
 *  2. Frames captured at 15 fps
 *  3. Caller's animation runs normally (not blocked)
 *  4. Caller calls recorder.stop() → encoding → download
 */
export function startGifRecording({
  canvas,
  camera,
  fitToView,
  filename,
  onDone,
}: GifRecordingOptions): GifRecorder {
  const prevPanX = camera.panX;
  const prevPanY = camera.panY;
  const prevZoom = camera.zoom;

  fitToView({ instant: true });

  const dpr = window.devicePixelRatio || 1;
  const cssW = canvas.width / dpr;
  const cssH = canvas.height / dpr;
  const scale = Math.min(1, MAX_WIDTH / cssW);
  const outW = Math.round(cssW * scale);
  const outH = Math.round(cssH * scale);

  const gif = new GIF({
    workers: 2,
    quality: 10,
    width: outW,
    height: outH,
    workerScript: `${import.meta.env.BASE_URL}gif.worker.js`,
  });

  const overlay = createOverlay();
  overlay.setPhase('recording');

  let timer: ReturnType<typeof setInterval> | null = null;
  let framesCaptured = 0;
  let stopped = false;
  const startTime = performance.now();

  function finalize() {
    if (stopped) return;
    stopped = true;
    if (timer) clearInterval(timer);

    if (framesCaptured === 0) {
      overlay.destroy();
      camera.setPanZoom(prevPanX, prevPanY, prevZoom);
      return;
    }

    overlay.setPhase('encoding');
    overlay.setProgress(0);

    gif.on('progress', (p) => overlay.setProgress(p));

    gif.on('finished', (blob) => {
      overlay.destroy();
      camera.setPanZoom(prevPanX, prevPanY, prevZoom);
      trackGifCompleted(filename.replace(/\.gif$/i, ''), framesCaptured);

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);

      onDone?.();
    });

    gif.render();
  }

  // Wait one frame for fit-to-view to settle, then start capturing
  requestAnimationFrame(() => {
    timer = setInterval(() => {
      if (stopped) return;
      const elapsed = performance.now() - startTime;
      if (elapsed >= MAX_DURATION_MS) {
        finalize();
        return;
      }

      const frame = captureFrame(canvas, outW, outH);
      gif.addFrame(frame, { delay: FRAME_INTERVAL, copy: false });
      framesCaptured++;
      overlay.setTimer(elapsed);
      overlay.setFrameCount(framesCaptured);
    }, FRAME_INTERVAL);
  });

  return { stop: finalize };
}
