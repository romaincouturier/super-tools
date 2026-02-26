/**
 * Pure utility functions for signature canvas initialization.
 *
 * Extracted from AttendanceSignatureBlock to make the canvas setup logic
 * testable and to fix the timing bug where canvas.offsetWidth === 0
 * when Radix Dialog hasn't finished rendering.
 */

export interface SignatureCanvasOptions {
  penColor?: string;
  backgroundColor?: string;
}

/**
 * Compute the correct internal canvas dimensions for HiDPI displays.
 *
 * @returns `null` if the canvas has no layout dimensions yet (dialog not rendered),
 *          otherwise the ratio and computed width/height.
 */
export function computeCanvasDimensions(canvas: HTMLCanvasElement): {
  ratio: number;
  width: number;
  height: number;
} | null {
  const cssWidth = canvas.offsetWidth;
  const cssHeight = canvas.offsetHeight;

  if (cssWidth === 0 || cssHeight === 0) {
    return null;
  }

  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  return {
    ratio,
    width: cssWidth * ratio,
    height: cssHeight * ratio,
  };
}

/**
 * Apply computed dimensions to a canvas and scale its 2D context.
 * Returns false if canvas has no layout dimensions yet.
 */
export function applyCanvasDimensions(canvas: HTMLCanvasElement): boolean {
  const dims = computeCanvasDimensions(canvas);
  if (!dims) return false;

  canvas.width = dims.width;
  canvas.height = dims.height;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.scale(dims.ratio, dims.ratio);
  }
  return true;
}

/**
 * Wait for a canvas to have non-zero layout dimensions.
 *
 * Uses `requestAnimationFrame` polling (max `maxAttempts` frames)
 * to handle Radix Dialog animation delays.
 *
 * @returns Promise that resolves to `true` once dimensions are applied,
 *          or `false` if the canvas never got dimensions within the limit.
 */
export function waitForCanvasReady(
  canvas: HTMLCanvasElement,
  maxAttempts = 10,
): Promise<boolean> {
  return new Promise((resolve) => {
    let attempts = 0;
    const check = () => {
      if (applyCanvasDimensions(canvas)) {
        resolve(true);
        return;
      }
      attempts++;
      if (attempts >= maxAttempts) {
        resolve(false);
        return;
      }
      requestAnimationFrame(check);
    };
    requestAnimationFrame(check);
  });
}
