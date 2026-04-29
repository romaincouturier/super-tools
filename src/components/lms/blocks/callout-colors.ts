import type { CalloutColor } from "@/types/lms-blocks";

/**
 * Static Tailwind class strings so the JIT compiler picks them up
 * (do not build class names from string concatenation).
 */
export const CALLOUT_CLASSES: Record<CalloutColor, string> = {
  blue: "bg-blue-50 border-blue-400 text-blue-950",
  amber: "bg-amber-50 border-amber-400 text-amber-950",
  green: "bg-green-50 border-green-500 text-green-950",
  red: "bg-red-50 border-red-400 text-red-950",
  gray: "bg-gray-100 border-gray-400 text-gray-950",
};

export const CALLOUT_LABELS: Record<CalloutColor, string> = {
  blue: "Bleu",
  amber: "Orange",
  green: "Vert",
  red: "Rouge",
  gray: "Gris",
};

export const CALLOUT_SWATCHES: Record<CalloutColor, string> = {
  blue: "bg-blue-400",
  amber: "bg-amber-400",
  green: "bg-green-500",
  red: "bg-red-400",
  gray: "bg-gray-400",
};

export const CALLOUT_COLORS: CalloutColor[] = ["blue", "amber", "green", "red", "gray"];
