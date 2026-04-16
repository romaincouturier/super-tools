import { cn } from "@/lib/utils";

export interface AlertDotProps {
  /** Show the dot. When false, nothing is rendered. */
  active: boolean;
  /**
   * Position preset for placing the dot on top of another element.
   * Default: `top-right` (absolute, top-right corner).
   */
  position?: "top-right" | "top-left" | "inline";
  /** Extra classes (color override, size tweak, etc.). */
  className?: string;
  /** Accessible label read by screen readers. */
  srLabel?: string;
}

const POSITION_CLASSES: Record<NonNullable<AlertDotProps["position"]>, string> = {
  "top-right": "absolute -top-0.5 -right-0.5",
  "top-left": "absolute -top-0.5 -left-0.5",
  inline: "inline-block",
};

/**
 * Tiny red pastille to flag "needs attention". Use inside a
 * `relative`-positioned container for the `top-right` / `top-left`
 * presets; use `inline` when placing next to text.
 *
 * Intended for settings tabs + the header Settings icon, but generic.
 */
export function AlertDot({
  active,
  position = "top-right",
  className,
  srLabel = "Alerte",
}: AlertDotProps) {
  if (!active) return null;
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full bg-destructive ring-2 ring-background",
        POSITION_CLASSES[position],
        className,
      )}
      aria-label={srLabel}
      role="status"
    />
  );
}

export default AlertDot;
