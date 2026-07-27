import { createContext } from "react";
import type {
  RowBlockContent,
  RowImageFit,
  RowImageFrame,
  RowImageSizing,
  RowVerticalAlign,
} from "@/types/lms-blocks";

/**
 * Réglages d'harmonisation des images d'un bloc colonnes (ST-2026-0250),
 * fournis par RowBlockViewer et consommés par ImageBlockViewer.
 */
export interface RowMediaSettings {
  verticalAlign: RowVerticalAlign;
  fit: RowImageFit;
  sizing: RowImageSizing;
  frame: RowImageFrame;
}

/** Réglages recommandés par défaut (champs absents sur les rows existants). */
export function resolveRowMediaSettings(content: RowBlockContent): RowMediaSettings {
  return {
    verticalAlign: content.vertical_align ?? "top",
    fit: content.image_fit ?? "contain",
    sizing: content.image_sizing ?? "max_height",
    frame: content.image_frame ?? "rounded",
  };
}

/** Non-null uniquement à l'intérieur d'un bloc colonnes multi-colonnes. */
export const RowMediaContext = createContext<RowMediaSettings | null>(null);
