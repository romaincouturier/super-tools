import confetti from "canvas-confetti";

const WIN_COLORS = ["#FFD700", "#FFA500", "#FF6347", "#32CD32", "#1E90FF", "#9370DB"];
const WIN_DURATION_MS = 3000;

/**
 * Fire a confetti celebration animation for won deals.
 * Optionally accepts a ref to track the animation frame for cleanup.
 */
export const celebrateWin = (
  frameRef?: React.MutableRefObject<number | null>,
): void => {
  if (frameRef?.current) cancelAnimationFrame(frameRef.current);

  const end = Date.now() + WIN_DURATION_MS;

  const frame = () => {
    confetti({ particleCount: 3, angle: 60, spread: 55, origin: { x: 0, y: 0.8 }, colors: WIN_COLORS });
    confetti({ particleCount: 3, angle: 120, spread: 55, origin: { x: 1, y: 0.8 }, colors: WIN_COLORS });
    if (Date.now() < end) {
      const id = requestAnimationFrame(frame);
      if (frameRef) frameRef.current = id;
    } else if (frameRef) {
      frameRef.current = null;
    }
  };

  // Initial burst
  confetti({ particleCount: 100, spread: 70, origin: { x: 0.5, y: 0.5 }, colors: WIN_COLORS });
  frame();
};
