import type { CalloutColor, CalloutLevel } from "@/types/lms-blocks";

export interface CalloutPaletteEntry {
  label: string;
  bg: string;
  text: string;
  border: string;
  swatch: string;
}

export const CALLOUT_PALETTE: Record<CalloutColor, CalloutPaletteEntry> = {
  // Classic semantic colours (kept for backward compat)
  blue:             { label: "Bleu",            bg: "#eff6ff", text: "#1e3a5f", border: "#60a5fa", swatch: "#60a5fa" },
  amber:            { label: "Orange",           bg: "#fffbeb", text: "#101820", border: "#fbbf24", swatch: "#fbbf24" },
  green:            { label: "Vert",             bg: "#f0fdf4", text: "#14532d", border: "#22c55e", swatch: "#22c55e" },
  red:              { label: "Rouge",            bg: "#fef2f2", text: "#7f1d1d", border: "#f87171", swatch: "#f87171" },
  gray:             { label: "Gris",             bg: "#f3f4f6", text: "#111827", border: "#9ca3af", swatch: "#9ca3af" },
  // SuperTilt brand colours
  supertilt_yellow: { label: "Jaune SuperTilt",  bg: "#FFD100", text: "#101820", border: "#c7a200", swatch: "#FFD100" },
  supertilt_black:  { label: "Noir SuperTilt",   bg: "#101820", text: "#ffffff", border: "#101820", swatch: "#101820" },
  gray_light:       { label: "Gris clair",        bg: "#EDEDED", text: "#111827", border: "#d1d5db", swatch: "#EDEDED" },
  gray_very_light:  { label: "Gris très clair",   bg: "#F2F4F4", text: "#111827", border: "#d1d5db", swatch: "#F2F4F4" },
  white:            { label: "Blanc",              bg: "#FFFFFF", text: "#111827", border: "#e5e7eb", swatch: "#FFFFFF" },
  teal:             { label: "Turquoise",          bg: "#69c3c4", text: "#0f3434", border: "#45a3a4", swatch: "#69c3c4" },
  coral:            { label: "Corail",             bg: "#f08275", text: "#3d1108", border: "#d95f4e", swatch: "#f08275" },
};

export const CALLOUT_COLORS = Object.keys(CALLOUT_PALETTE) as CalloutColor[];

export const CALLOUT_COLOR_GROUPS: { label: string; colors: CalloutColor[] }[] = [
  { label: "Charte SuperTilt", colors: ["supertilt_yellow", "supertilt_black", "gray_light", "gray_very_light", "white", "teal", "coral"] },
  { label: "Sémantique", colors: ["blue", "amber", "green", "red", "gray"] },
];

export interface CalloutLevelEntry {
  label: string;
  defaultTitle: string;
  icon: string;
}

export const CALLOUT_LEVELS: Record<CalloutLevel, CalloutLevelEntry> = {
  info:     { label: "Information", defaultTitle: "À savoir",  icon: "ℹ️" },
  warning:  { label: "Attention",   defaultTitle: "Attention", icon: "⚠️" },
  tip:      { label: "Conseil",     defaultTitle: "Conseil",   icon: "💡" },
  example:  { label: "Exemple",     defaultTitle: "Exemple",   icon: "📌" },
  resource: { label: "Ressource",   defaultTitle: "Ressource", icon: "📚" },
};

export const CALLOUT_LEVEL_LIST = Object.keys(CALLOUT_LEVELS) as CalloutLevel[];

// Legacy aliases kept for any code that hasn't migrated yet
export const CALLOUT_CLASSES: Partial<Record<string, string>> = {};
export const CALLOUT_LABELS: Record<CalloutColor, string> = Object.fromEntries(
  CALLOUT_COLORS.map((c) => [c, CALLOUT_PALETTE[c].label])
) as Record<CalloutColor, string>;
export const CALLOUT_SWATCHES: Record<CalloutColor, string> = Object.fromEntries(
  CALLOUT_COLORS.map((c) => [c, ""])
) as Record<CalloutColor, string>;
