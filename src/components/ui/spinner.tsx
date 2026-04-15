import { Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SpinnerProps {
  /** Preset size: sm = 4 (default), md = 6, lg = 8. */
  size?: "sm" | "md" | "lg";
  /** Extra classes merged in (color, spacing, etc.). */
  className?: string;
}

/**
 * Spinner — single source of truth for "loading" indicators.
 *
 * Why: the `<Loader2 className="h-4 w-4 animate-spin" />` pattern is
 * repeated 350+ times across the codebase. Using `<Spinner />` keeps
 * sizing/animation consistent and lets us tweak the look in one place.
 */
export function Spinner({ size = "sm", className }: SpinnerProps) {
  const sizeClass = { sm: "h-4 w-4", md: "h-6 w-6", lg: "h-8 w-8" }[size];
  return <Loader2 className={cn(sizeClass, "animate-spin", className)} />;
}

export default Spinner;
