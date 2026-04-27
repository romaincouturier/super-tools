import type { ReactNode } from "react";
import type {
  LessonBlock,
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
} from "@/types/lms-blocks";
import TextBlockViewer from "./viewers/TextBlockViewer";
import VideoBlockViewer from "./viewers/VideoBlockViewer";
import ImageBlockViewer from "./viewers/ImageBlockViewer";
import FileBlockViewer from "./viewers/FileBlockViewer";
import CalloutBlockViewer from "./viewers/CalloutBlockViewer";
import KeyPointsBlockViewer from "./viewers/KeyPointsBlockViewer";
import ChecklistBlockViewer from "./viewers/ChecklistBlockViewer";
import ButtonBlockViewer from "./viewers/ButtonBlockViewer";
import ExerciseBlockViewer from "./viewers/ExerciseBlockViewer";
import SelfAssessmentBlockViewer from "./viewers/SelfAssessmentBlockViewer";

interface Props {
  blocks: LessonBlock[];
  /** Renderer injected by the page so the QuizPlayer keeps its external context. */
  renderQuiz?: (quizId: string, lessonId: string) => ReactNode;
  /** Renderer injected by the page so the AssignmentSubmitter keeps its context. */
  renderAssignment?: (lessonId: string) => ReactNode;
}

export default function LessonBlocksPlayer({ blocks, renderQuiz, renderAssignment }: Props) {
  const visible = blocks.filter((b) => !b.hidden);
  if (visible.length === 0) return null;
  return (
    <div className="space-y-6">
      {visible.map((block) => (
        <BlockRenderer
          key={block.id}
          block={block}
          renderQuiz={renderQuiz}
          renderAssignment={renderAssignment}
        />
      ))}
    </div>
  );
}

function BlockRenderer({
  block,
  renderQuiz,
  renderAssignment,
}: {
  block: LessonBlock;
  renderQuiz?: (quizId: string, lessonId: string) => ReactNode;
  renderAssignment?: (lessonId: string) => ReactNode;
}) {
  switch (block.type) {
    case "text":
      return <TextBlockViewer content={block.content as TextBlockContent} />;
    case "video":
      return <VideoBlockViewer content={block.content as VideoBlockContent} />;
    case "image":
      return <ImageBlockViewer content={block.content as ImageBlockContent} />;
    case "file":
      return <FileBlockViewer content={block.content as FileBlockContent} />;
    case "quiz": {
      const c = block.content as QuizBlockContent;
      return c.quiz_id && renderQuiz ? <>{renderQuiz(c.quiz_id, block.lesson_id)}</> : null;
    }
    case "assignment": {
      const c = block.content as AssignmentBlockContent;
      return (
        <div className="space-y-4">
          {c.instructions_html && (
            <div
              className="prose prose-sm max-w-none"
              dangerouslySetInnerHTML={{ __html: c.instructions_html }}
            />
          )}
          {renderAssignment?.(block.lesson_id)}
        </div>
      );
    }
    case "callout":
      return <CalloutBlockViewer content={block.content as CalloutBlockContent} />;
    case "key_points":
      return <KeyPointsBlockViewer content={block.content as KeyPointsBlockContent} />;
    case "checklist":
      return <ChecklistBlockViewer content={block.content as ChecklistBlockContent} />;
    case "button":
      return <ButtonBlockViewer content={block.content as ButtonBlockContent} />;
    case "exercise":
      return <ExerciseBlockViewer content={block.content as ExerciseBlockContent} />;
    case "self_assessment":
      return <SelfAssessmentBlockViewer content={block.content as SelfAssessmentBlockContent} />;
    default:
      return null;
  }
}
