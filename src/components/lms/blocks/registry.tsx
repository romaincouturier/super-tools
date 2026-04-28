import {
  FileText,
  Video,
  Image as ImageIcon,
  Paperclip,
  HelpCircle,
  ClipboardCheck,
  type LucideIcon,
} from "lucide-react";
import type { LessonBlockType } from "@/types/lms-blocks";

export interface BlockTypeMeta {
  type: LessonBlockType;
  label: string;
  icon: LucideIcon;
  /** Whether the back-office editor for this type is implemented in this stage. */
  editable: boolean;
}

/** All block types known by Stage 1. The list order drives the type picker UI. */
export const BLOCK_TYPES: BlockTypeMeta[] = [
  { type: "text", label: "Texte riche", icon: FileText, editable: true },
  { type: "video", label: "Vidéo", icon: Video, editable: true },
  { type: "image", label: "Image", icon: ImageIcon, editable: true },
  { type: "file", label: "Fichier / ressource", icon: Paperclip, editable: false },
  { type: "quiz", label: "Quiz", icon: HelpCircle, editable: false },
  { type: "assignment", label: "Devoir", icon: ClipboardCheck, editable: false },
];

export const BLOCK_META: Record<LessonBlockType, BlockTypeMeta> = BLOCK_TYPES.reduce(
  (acc, m) => {
    acc[m.type] = m;
    return acc;
  },
  {} as Record<LessonBlockType, BlockTypeMeta>,
);
