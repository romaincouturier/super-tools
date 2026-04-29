import {
  FileText,
  Video,
  Image as ImageIcon,
  Paperclip,
  HelpCircle,
  ClipboardCheck,
  Info,
  Lightbulb,
  ListChecks,
  MousePointerClick,
  Pencil,
  Gauge,
  Upload,
  type LucideIcon,
} from "lucide-react";
import type { LessonBlockType } from "@/types/lms-blocks";

export interface BlockTypeMeta {
  type: LessonBlockType;
  label: string;
  icon: LucideIcon;
  /** Whether the back-office editor for this type is implemented. */
  editable: boolean;
}

/** All block types known by the editor. List order drives the type picker UI. */
export const BLOCK_TYPES: BlockTypeMeta[] = [
  { type: "text", label: "Texte riche", icon: FileText, editable: true },
  { type: "video", label: "Vidéo", icon: Video, editable: true },
  { type: "image", label: "Image", icon: ImageIcon, editable: true },
  { type: "file", label: "Fichier / ressource", icon: Paperclip, editable: true },
  { type: "callout", label: "Encadré pédagogique", icon: Info, editable: true },
  { type: "key_points", label: "Points clés à retenir", icon: Lightbulb, editable: true },
  { type: "checklist", label: "Liste à cocher", icon: ListChecks, editable: true },
  { type: "button", label: "Bouton / lien", icon: MousePointerClick, editable: true },
  { type: "exercise", label: "Exercice", icon: Pencil, editable: true },
  { type: "self_assessment", label: "Auto-évaluation", icon: Gauge, editable: true },
  { type: "work_deposit", label: "Dépôt de travail", icon: Upload, editable: true },
  { type: "quiz", label: "Quiz", icon: HelpCircle, editable: true },
  { type: "assignment", label: "Devoir", icon: ClipboardCheck, editable: true },
];

export const BLOCK_META: Record<LessonBlockType, BlockTypeMeta> = BLOCK_TYPES.reduce(
  (acc, m) => {
    acc[m.type] = m;
    return acc;
  },
  {} as Record<LessonBlockType, BlockTypeMeta>,
);
