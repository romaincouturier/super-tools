// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  computeCanvasDimensions,
  applyCanvasDimensions,
  waitForCanvasReady,
} from "./signatureUtils";

// ── Helpers ──────────────────────────────────────────────────────────────────

const makeCanvas = (width: number, height: number): HTMLCanvasElement => {
  const canvas = document.createElement("canvas");
  // happy-dom doesn't set offsetWidth/offsetHeight from CSS, so we stub them
  Object.defineProperty(canvas, "offsetWidth", { value: width, configurable: true });
  Object.defineProperty(canvas, "offsetHeight", { value: height, configurable: true });
  return canvas;
};

// ── computeCanvasDimensions ──────────────────────────────────────────────────

describe("computeCanvasDimensions", () => {
  beforeEach(() => {
    // Default DPR = 1
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  });

  it("returns null when canvas has zero width", () => {
    const canvas = makeCanvas(0, 180);
    expect(computeCanvasDimensions(canvas)).toBeNull();
  });

  it("returns null when canvas has zero height", () => {
    const canvas = makeCanvas(400, 0);
    expect(computeCanvasDimensions(canvas)).toBeNull();
  });

  it("returns null when both dimensions are zero", () => {
    const canvas = makeCanvas(0, 0);
    expect(computeCanvasDimensions(canvas)).toBeNull();
  });

  it("returns dimensions with ratio 1 for standard DPR", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 1 });
    const canvas = makeCanvas(400, 180);
    const result = computeCanvasDimensions(canvas);
    expect(result).toEqual({ ratio: 1, width: 400, height: 180 });
  });

  it("returns scaled dimensions for HiDPI (2x)", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 2 });
    const canvas = makeCanvas(400, 180);
    const result = computeCanvasDimensions(canvas);
    expect(result).toEqual({ ratio: 2, width: 800, height: 360 });
  });

  it("clamps ratio to minimum of 1 when devicePixelRatio is 0", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 0 });
    const canvas = makeCanvas(400, 180);
    const result = computeCanvasDimensions(canvas);
    expect(result).toEqual({ ratio: 1, width: 400, height: 180 });
  });

  it("handles fractional DPR (1.5x)", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 1.5 });
    const canvas = makeCanvas(400, 180);
    const result = computeCanvasDimensions(canvas);
    expect(result).toEqual({ ratio: 1.5, width: 600, height: 270 });
  });
});

// ── applyCanvasDimensions ────────────────────────────────────────────────────

describe("applyCanvasDimensions", () => {
  beforeEach(() => {
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  });

  it("returns false for zero-dimension canvas", () => {
    const canvas = makeCanvas(0, 0);
    expect(applyCanvasDimensions(canvas)).toBe(false);
    expect(canvas.width).toBe(300); // unchanged from HTML spec default
  });

  it("sets canvas.width and canvas.height for valid dimensions", () => {
    const canvas = makeCanvas(400, 180);
    const result = applyCanvasDimensions(canvas);
    expect(result).toBe(true);
    expect(canvas.width).toBe(400);
    expect(canvas.height).toBe(180);
  });

  it("scales canvas with HiDPI ratio", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 2 });
    const canvas = makeCanvas(400, 180);
    applyCanvasDimensions(canvas);
    expect(canvas.width).toBe(800);
    expect(canvas.height).toBe(360);
  });

  it("calls ctx.scale with the correct ratio", () => {
    Object.defineProperty(window, "devicePixelRatio", { value: 2 });
    const canvas = makeCanvas(400, 180);
    const mockScale = vi.fn();
    vi.spyOn(canvas, "getContext").mockReturnValue({
      scale: mockScale,
    } as unknown as CanvasRenderingContext2D);

    applyCanvasDimensions(canvas);
    expect(mockScale).toHaveBeenCalledWith(2, 2);
  });
});

// ── waitForCanvasReady ───────────────────────────────────────────────────────

describe("waitForCanvasReady", () => {
  beforeEach(() => {
    Object.defineProperty(window, "devicePixelRatio", { value: 1, configurable: true });
  });

  it("resolves true immediately when canvas has dimensions", async () => {
    const canvas = makeCanvas(400, 180);

    // Mock requestAnimationFrame to run synchronously
    let rafCallback: FrameRequestCallback | null = null;
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      rafCallback = cb;
      cb(0);
      return 0;
    });

    const result = await waitForCanvasReady(canvas);
    expect(result).toBe(true);
    expect(canvas.width).toBe(400);
  });

  it("resolves false after maxAttempts when canvas stays zero", async () => {
    const canvas = makeCanvas(0, 0);

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      cb(0);
      return 0;
    });

    const result = await waitForCanvasReady(canvas, 3);
    expect(result).toBe(false);
  });

  it("retries until canvas gets dimensions", async () => {
    const canvas = makeCanvas(0, 0);
    let callCount = 0;

    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      callCount++;
      // Simulate dialog appearing on 3rd frame
      if (callCount >= 3) {
        Object.defineProperty(canvas, "offsetWidth", { value: 400, configurable: true });
        Object.defineProperty(canvas, "offsetHeight", { value: 180, configurable: true });
      }
      cb(0);
      return 0;
    });

    const result = await waitForCanvasReady(canvas, 10);
    expect(result).toBe(true);
    expect(canvas.width).toBe(400);
    expect(callCount).toBe(3);
  });
});
