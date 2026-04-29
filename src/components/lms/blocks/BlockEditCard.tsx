import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useConfirm } from "@/hooks/useConfirm";
import { useAutoSaveForm } from "@/hooks/useAutoSaveForm";
import { Eye, EyeOff, GripVertical, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type {
  LessonBlock,
  LessonBlockContent,
  TextBlockContent,
  VideoBlockContent,
  ImageBlockContent,
  FileBlockContent,
  QuizBlockContent,
  AssignmentBlockContent,
  CalloutBlockContent,
  KeyPointsBlockContent,
  ChecklistBlockContent,
  ButtonBlockContent,
  ExerciseBlockContent,
  SelfAssessmentBlockContent,
  WorkDepositBlockContent,
  SectionBlockContent,
  RowBlockContent,
  ContainerBlockContent,
  DividerBlockContent,
  SpacerBlockContent,
} from "@/types/lms-blocks";
import { BLOCK_META } from "./registry";
import TextBlockEditor from "./editors/TextBlockEditor";
import VideoBlockEditor from "./editors/VideoBlockEditor";
import ImageBlockEditor from "./editors/ImageBlockEditor";
import FileBlockEditor from "./editors/FileBlockEditor";
import QuizBlockEditor from "./editors/QuizBlockEditor";
import AssignmentBlockEditor from "./editors/AssignmentBlockEditor";
import CalloutBlockEditor from "./editors/CalloutBlockEditor";
import KeyPointsBlockEditor from "./editors/KeyPointsBlockEditor";
import ChecklistBlockEditor from "./editors/ChecklistBlockEditor";
import ButtonBlockEditor from "./editors/ButtonBlockEditor";
import ExerciseBlockEditor from "./editors/ExerciseBlockEditor";
import SelfAssessmentBlockEditor from "./editors/SelfAssessmentBlockEditor";
import WorkDepositBlockEditor from "./editors/WorkDepositBlockEditor";
import SectionBlockEditor from "./editors/SectionBlockEditor";
import RowBlockEditor from "./editors/RowBlockEditor";
import ContainerBlockEditor from "./editors/ContainerBlockEditor";
import DividerBlockEditor from "./editors/DividerBlockEditor";
import SpacerBlockEditor from "./editors/SpacerBlockEditor";

interface Props {
  block: LessonBlock;
  lessonId: string;
  courseId?: string;
  /** Saves content updates. */
  onUpdateContent: (content: LessonBlockContent) => Promise<void>;
  onToggleHidden: (hidden: boolean) => void;
  onDelete: () => void;
  /** Drag-handle attributes from useSortable, applied to the grip icon. */
  dragHandleProps?: Record<string, unknown>;
}

export default function BlockEditCard({
  block,
  lessonId,
  courseId,
  onUpdateContent,
  onToggleHidden,
  onDelete,
  dragHandleProps,
}: Props) {
  const meta = BLOCK_META[block.type];
  const Icon = meta.icon;
  const [content, setContent] = useState<LessonBlockContent>(block.content);
  const { confirm, ConfirmDialog } = useConfirm();

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
        "border rounded-lg bg-card",
        block.hidden && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 px-3 py-2 border-b bg-muted/30">
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
      </div>

      <div className="p-3 sm:p-4">
        {meta.editable ? (
          <BlockEditorBody
            block={block}
            lessonId={lessonId}
            courseId={courseId}
            content={content}
            onChange={setContent}
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
}: {
  block: LessonBlock;
  lessonId: string;
  courseId?: string;
  content: LessonBlockContent;
  onChange: (content: LessonBlockContent) => void;
}) {
  switch (block.type) {
    case "text":
      return (
        <TextBlockEditor
          content={content as TextBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "video":
      return (
        <VideoBlockEditor
          lessonId={lessonId}
          content={content as VideoBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "image":
      return (
        <ImageBlockEditor
          lessonId={lessonId}
          content={content as ImageBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "file":
      return (
        <FileBlockEditor
          lessonId={lessonId}
          content={content as FileBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "quiz":
      return (
        <QuizBlockEditor
          courseId={courseId}
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
        />
      );
    case "key_points":
      return (
        <KeyPointsBlockEditor
          content={content as KeyPointsBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "checklist":
      return (
        <ChecklistBlockEditor
          content={content as ChecklistBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "button":
      return (
        <ButtonBlockEditor
          content={content as ButtonBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    case "exercise":
      return (
        <ExerciseBlockEditor
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
        />
      );
    case "spacer":
      return (
        <SpacerBlockEditor
          content={content as SpacerBlockContent}
          onChange={(c) => onChange(c)}
        />
      );
    default:
      return null;
  }
}
