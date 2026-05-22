import {
  FileText,
  Video,
  Image as ImageIcon,
  Images,
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
  LayoutPanelTop,
  Columns3,
  Square,
  Minus,
  MoveVertical,
  Table as TableIcon,
  Code2,
  Braces,
  GitCommitHorizontal,
  FlipHorizontal,
  ChevronDownSquare,
  Target,
  Layers,
  PenLine,
  GripHorizontal,
  ClipboardList,
  type LucideIcon,
} from "lucide-react";
import type { LessonBlockType, LessonBlockKind } from "@/types/lms-blocks";

export interface BlockTypeMeta {
  type: LessonBlockType;
  label: string;
  icon: LucideIcon;
  /** Layout containers (section/row/…) vs content leaves (text/video/…). */
  kind: LessonBlockKind;
  /** Whether the back-office editor for this type is implemented. */
  editable: boolean;
}

/**
 * Layout block types — structural containers that can host children.
 * Order drives the type picker UI of the "Ajouter une section" menu.
 */
export const LAYOUT_BLOCKS: BlockTypeMeta[] = [
  { type: "section", label: "Section pleine largeur", icon: LayoutPanelTop, kind: "layout", editable: true },
  { type: "row", label: "Ligne / colonnes", icon: Columns3, kind: "layout", editable: true },
  { type: "container", label: "Conteneur", icon: Square, kind: "layout", editable: true },
  { type: "divider", label: "Séparateur", icon: Minus, kind: "layout", editable: true },
  { type: "spacer", label: "Espace vertical", icon: MoveVertical, kind: "layout", editable: true },
];

/**
 * Content block types — leaves placed inside layout blocks (or at the
 * top level, in the absence of a layout). Order drives the type picker
 * UI of the "Ajouter un contenu" menu.
 */
export const CONTENT_BLOCKS: BlockTypeMeta[] = [
  { type: "text", label: "Texte riche", icon: FileText, kind: "content", editable: true },
  { type: "table", label: "Tableau", icon: TableIcon, kind: "content", editable: true },
  { type: "video", label: "Vidéo", icon: Video, kind: "content", editable: true },
  { type: "image", label: "Image", icon: ImageIcon, kind: "content", editable: true },
  { type: "gallery", label: "Galerie d'images", icon: Images, kind: "content", editable: true },
  { type: "file", label: "Fichier / ressource", icon: Paperclip, kind: "content", editable: true },
  { type: "callout", label: "Encadré pédagogique", icon: Info, kind: "content", editable: true },
  { type: "key_points", label: "Points clés à retenir", icon: Lightbulb, kind: "content", editable: true },
  { type: "checklist", label: "Liste à cocher", icon: ListChecks, kind: "content", editable: true },
  { type: "bullet_list", label: "Liste à puces", icon: ListChecks, kind: "content", editable: true },
  { type: "button", label: "Bouton / lien", icon: MousePointerClick, kind: "content", editable: true },
  { type: "exercise", label: "Exercice", icon: Pencil, kind: "content", editable: true },
  { type: "self_assessment", label: "Auto-évaluation", icon: Gauge, kind: "content", editable: true },
  { type: "work_deposit", label: "Dépôt de travail", icon: Upload, kind: "content", editable: true },
  { type: "quiz", label: "Quiz", icon: HelpCircle, kind: "content", editable: true },
  { type: "assignment", label: "Devoir", icon: ClipboardCheck, kind: "content", editable: true },
  { type: "shortcode", label: "Code court (formulaire)", icon: Code2, kind: "content", editable: true },
  { type: "html_embed", label: "HTML / Embed", icon: Braces, kind: "content", editable: true },
  { type: "timeline", label: "Frise chronologique", icon: GitCommitHorizontal, kind: "content", editable: true },
  { type: "flip_cards", label: "Cartes à retourner", icon: FlipHorizontal, kind: "content", editable: true },
  { type: "accordion", label: "Accordéon FAQ", icon: ChevronDownSquare, kind: "content", editable: true },
  { type: "image_hotspot", label: "Image annotée", icon: Target, kind: "content", editable: true },
  { type: "before_after", label: "Avant / Après", icon: Layers, kind: "content", editable: true },
  { type: "fill_blanks", label: "Texte à trous", icon: PenLine, kind: "content", editable: true },
  { type: "drag_words", label: "Glisser les mots", icon: GripHorizontal, kind: "content", editable: true },
  { type: "summary", label: "Résumé interactif", icon: ClipboardList, kind: "content", editable: true },
];

/** Combined registry; previously exported as BLOCK_TYPES. */
export const BLOCK_TYPES: BlockTypeMeta[] = [...LAYOUT_BLOCKS, ...CONTENT_BLOCKS];

export const BLOCK_META: Record<LessonBlockType, BlockTypeMeta> = BLOCK_TYPES.reduce(
  (acc, m) => {
    acc[m.type] = m;
    return acc;
  },
  {} as Record<LessonBlockType, BlockTypeMeta>,
);
