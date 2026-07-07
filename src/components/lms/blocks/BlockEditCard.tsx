import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/useConfirm";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { Copy, Eye, EyeOff, GripVertical, Trash2, Wand2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  LessonBlock,
  LessonBlockContent,
  TextBlockContent,
  TableBlockContent,
  VideoBlockContent,
  ImageBlockContent,
  GalleryBlockContent,
  FileBlockContent,
  QuizBlockContent,
  AssignmentBlockContent,
  CalloutBlockContent,
  KeyPointsBlockContent,
  ChecklistBlockContent,
  BulletListBlockContent,
  ButtonBlockContent,
  ExerciseBlockContent,
  SelfAssessmentBlockContent,
  WorkDepositBlockContent,
  SectionBlockContent,
  RowBlockContent,
  ContainerBlockContent,
  DividerBlockContent,
  SpacerBlockContent,
  ShortcodeBlockContent,
  HtmlEmbedBlockContent,
  TimelineBlockContent,
  FlipCardsBlockContent,
  AccordionBlockContent,
  ImageHotspotBlockContent,
  BeforeAfterBlockContent,
  FillBlanksBlockContent,
  DragWordsBlockContent,
  SummaryBlockContent,
  CtaBlockContent,
} from "@/types/lms-blocks";
import { BLOCK_META } from "./registry";
import { exampleBlockContent } from "@/types/lms-blocks";
import TextBlockEditor from "./editors/TextBlockEditor";
import TableBlockEditor from "./editors/TableBlockEditor";
import VideoBlockEditor from "./editors/VideoBlockEditor";
import ImageBlockEditor from "./editors/ImageBlockEditor";
import GalleryBlockEditor from "./editors/GalleryBlockEditor";
import FileBlockEditor from "./editors/FileBlockEditor";
import QuizBlockEditor from "./editors/QuizBlockEditor";
import AssignmentBlockEditor from "./editors/AssignmentBlockEditor";
import CalloutBlockEditor from "./editors/CalloutBlockEditor";
import KeyPointsBlockEditor from "./editors/KeyPointsBlockEditor";
import ChecklistBlockEditor from "./editors/ChecklistBlockEditor";
import BulletListBlockEditor from "./editors/BulletListBlockEditor";
import ButtonBlockEditor from "./editors/ButtonBlockEditor";
import ExerciseBlockEditor from "./editors/ExerciseBlockEditor";
import SelfAssessmentBlockEditor from "./editors/SelfAssessmentBlockEditor";
import WorkDepositBlockEditor from "./editors/WorkDepositBlockEditor";
import SectionBlockEditor from "./editors/SectionBlockEditor";
import RowBlockEditor from "./editors/RowBlockEditor";
import ContainerBlockEditor from "./editors/ContainerBlockEditor";
import DividerBlockEditor from "./editors/DividerBlockEditor";
import SpacerBlockEditor from "./editors/SpacerBlockEditor";
import ShortcodeBlockEditor from "./editors/ShortcodeBlockEditor";
import HtmlEmbedBlockEditor from "./editors/HtmlEmbedBlockEditor";
import TimelineBlockEditor from "./editors/TimelineBlockEditor";
import FlipCardsBlockEditor from "./editors/FlipCardsBlockEditor";
import AccordionBlockEditor from "./editors/AccordionBlockEditor";
import ImageHotspotBlockEditor from "./editors/ImageHotspotBlockEditor";
import BeforeAfterBlockEditor from "./editors/BeforeAfterBlockEditor";
import FillBlanksBlockEditor from "./editors/FillBlanksBlockEditor";
import DragWordsBlockEditor from "./editors/DragWordsBlockEditor";
import SummaryBlockEditor from "./editors/SummaryBlockEditor";
import CtaBlockEditor from "./editors/CtaBlockEditor";

interface Props {
  block: LessonBlock;
  lessonId: string;
  courseId?: string;
  /** Saves content updates. */
  onUpdateContent: (content: LessonBlockContent) => Promise<void>;
  onToggleHidden: (hidden: boolean) => void;
  onDelete: () => void;
  /** Optional duplicate handler. When omitted, the button is hidden. */
  onDuplicate?: () => void;
  /** Drag-handle attributes from useSortable, applied to the grip icon. */
  dragHandleProps?: Record<string, unknown>;
  /**
   * Slim mode — suppresses the action toolbar (used by the SuperTilt Builder
   * which provides its own hover-reveal chrome via BuilderBlockWrapper).
   */
  slim?: boolean;
}

export default function BlockEditCard({
  block,
  lessonId,
  courseId,
  onUpdateContent,
  onToggleHidden,
  onDelete,
  onDuplicate,
  dragHandleProps,
  slim = false,
}: Props) {
  const meta = BLOCK_META[block.type];
  const Icon = meta.icon;
  const [content, setContent] = useState<LessonBlockContent>(block.content);
  const [isExample, setIsExample] = useState(false);
  const { confirm, ConfirmDialog } = useConfirm();
  const exampleContent = useMemo(() => exampleBlockContent(block.type), [block.type]);

  const formValues = useMemo(() => ({ content }), [content]);

  const { autoSaving } = useAutoSaveForm({
    open: true,
    formValues,
    debounceMs: 600,
    onSave: async (values) => {
      try {
        await onUpdateContent(values.content as LessonBlockContent);
        return true;
      } catch {
        return false;
      }
    },
  });

  const handleInsertExample = () => {
    if (!exampleContent) return;
    setContent(exampleContent);
    setIsExample(true);
  };

  const handleContentChange = (c: LessonBlockContent) => {
    setContent(c);
    setIsExample(false);
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Supprimer ce bloc ?",
      description: "Le contenu de ce bloc sera définitivement perdu.",
      confirmText: "Supprimer",
      variant: "destructive",
    });
    if (ok) onDelete();
  };

  return (
    <div
      className={cn(
        !slim && "border rounded-lg bg-card",
        block.hidden && "opacity-60",
      )}
    >
      {!slim && <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
        <button
          type="button"
          aria-label="Réordonner ce bloc"
          {...dragHandleProps}
          className="h-7 w-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted cursor-grab active:cursor-grabbing touch-none"
        >
          <GripVertical className="h-4 w-4" />
        </button>
        <Icon className="h-4 w-4 text-muted-foreground shrink-0" />
        <span className="text-sm font-medium flex-1 truncate">{meta.label}</span>
        {autoSaving && <Spinner className="text-muted-foreground h-3.5 w-3.5" />}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={() => onToggleHidden(!block.hidden)}
          title={block.hidden ? "Afficher ce bloc" : "Masquer ce bloc"}
          aria-label={block.hidden ? "Afficher le bloc" : "Masquer le bloc"}
          aria-pressed={block.hidden}
        >
          {block.hidden ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </Button>
        {exampleContent && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 gap-1 text-xs text-muted-foreground"
            onClick={handleInsertExample}
            title="Insérer un exemple"
          >
            <Wand2 className="h-3.5 w-3.5 shrink-0" />
            <span className="hidden sm:inline">Exemple</span>
          </Button>
        )}
        {onDuplicate && (
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 text-muted-foreground"
            onClick={onDuplicate}
            title="Dupliquer le bloc"
            aria-label="Dupliquer le bloc"
          >
            <Copy className="h-4 w-4" />
          </Button>
        )}
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={handleDelete}
          title="Supprimer le bloc"
          aria-label="Supprimer le bloc"
        >
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>}

      {!slim && isExample && (
        <div className="flex items-center gap-1.5 px-3 py-1 bg-amber-50 border-b border-amber-200 text-amber-700 text-xs">
          <Wand2 className="h-3 w-3 shrink-0" />
          Contenu d'exemple — pensez à le remplacer par votre contenu réel
        </div>
      )}
      <div className={slim ? "" : "p-3 sm:p-4"}>
        {meta.editable ? (
          <BlockEditorBody
            block={block}
            lessonId={lessonId}
            courseId={courseId}
            content={content}
            onChange={handleContentChange}
            slim={slim}
          />
        ) : (
          <p className="text-sm text-muted-foreground italic">
            L'édition des blocs « {meta.label} » arrive dans une prochaine étape.
            Le bloc reste affiché dans le bon ordre côté apprenant et peut être
            masqué ou réordonné.
          </p>
        )}
      </div>
      <ConfirmDialog />
    </div>
  );
}

function BlockEditorBody({
  block,
  lessonId,
  courseId,
  content,
  onChange,
  slim,
}: {
  block: LessonBlock;
  lessonId: string;
  courseId?: string;
  content: LessonBlockContent;
  onChange: (content: LessonBlockContent) => void;
  slim?: boolean;
}) {
  switch (block.type) {
    case "text":
      return (
        <TextBlockEditor
          content={content as TextBlockContent}
          onChange={(c) => onChange(c)}
          lessonId={lessonId}
        />
      );
    case "table":
      return (
        <TableBlockEditor
          content={content as TableBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "video":
      return (
        <VideoBlockEditor
          lessonId={lessonId}
          content={content as VideoBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "image":
      return (
        <ImageBlockEditor
          lessonId={lessonId}
          content={content as ImageBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "gallery":
      return (
        <GalleryBlockEditor
          lessonId={lessonId}
          content={content as GalleryBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "file":
      return (
        <FileBlockEditor
          lessonId={lessonId}
          content={content as FileBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "quiz":
      return (
        <QuizBlockEditor
          courseId={courseId}
          lessonId={lessonId}
          content={content as QuizBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "assignment":
      return (
        <AssignmentBlockEditor
          content={content as AssignmentBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "callout":
      return (
        <CalloutBlockEditor
          content={content as CalloutBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "key_points":
      return (
        <KeyPointsBlockEditor
          content={content as KeyPointsBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "checklist":
      return (
        <ChecklistBlockEditor
          content={content as ChecklistBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "bullet_list":
      return (
        <BulletListBlockEditor
          content={content as BulletListBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "button":
      return (
        <ButtonBlockEditor
          content={content as ButtonBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "exercise":
      return (
        <ExerciseBlockEditor
          lessonId={lessonId}
          content={content as ExerciseBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "self_assessment":
      return (
        <SelfAssessmentBlockEditor
          content={content as SelfAssessmentBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "work_deposit":
      return (
        <WorkDepositBlockEditor
          content={content as WorkDepositBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "section":
      return (
        <SectionBlockEditor
          content={content as SectionBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "row":
      return (
        <RowBlockEditor
          content={content as RowBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "container":
      return (
        <ContainerBlockEditor
          content={content as ContainerBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "divider":
      return (
        <DividerBlockEditor
          content={content as DividerBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "spacer":
      return (
        <SpacerBlockEditor
          content={content as SpacerBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "shortcode":
      return (
        <ShortcodeBlockEditor
          content={content as ShortcodeBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "html_embed":
      return (
        <HtmlEmbedBlockEditor
          content={content as HtmlEmbedBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "timeline":
      return (
        <TimelineBlockEditor
          lessonId={lessonId}
          content={content as TimelineBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "flip_cards":
      return (
        <FlipCardsBlockEditor
          lessonId={lessonId}
          content={content as FlipCardsBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "accordion":
      return (
        <AccordionBlockEditor
          content={content as AccordionBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "image_hotspot":
      return (
        <ImageHotspotBlockEditor
          lessonId={lessonId}
          content={content as ImageHotspotBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "before_after":
      return (
        <BeforeAfterBlockEditor
          lessonId={lessonId}
          content={content as BeforeAfterBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "fill_blanks":
      return (
        <FillBlanksBlockEditor
          content={content as FillBlanksBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "drag_words":
      return (
        <DragWordsBlockEditor
          content={content as DragWordsBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "summary":
      return (
        <SummaryBlockEditor
          content={content as SummaryBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    case "cta":
      return (
        <CtaBlockEditor
          lessonId={lessonId}
          content={content as CtaBlockContent}
          onChange={(c) => onChange(c)}
          slim={slim}
        />
      );
    default:
      return null;
  }
}
