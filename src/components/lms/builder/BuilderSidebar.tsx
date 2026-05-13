import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronDown, ChevronRight, FileText, CheckCircle2, Circle } from "lucide-react";
import { useCourseModules, useModuleLessons, LmsModule, LmsLesson } from "@/hooks/useLms";

interface Props {
  courseId: string;
  activeLessonId: string;
  courseTitle: string;
}

export default function BuilderSidebar({ courseId, activeLessonId, courseTitle }: Props) {
  const { data: modules = [] } = useCourseModules(courseId);

  return (
    <aside
      className="flex flex-col h-full overflow-y-auto"
      style={{ background: "var(--st-surface)", fontFamily: "inherit" }}
    >
      {/* Course title */}
      <div
        className="px-5 py-4 border-b"
        style={{ borderColor: "rgba(16,24,32,0.08)" }}
      >
        <p
          className="text-xs font-medium uppercase tracking-wider mb-0.5"
          style={{ color: "var(--st-ink-muted)" }}
        >
          Formation
        </p>
        <p
          className="text-sm font-semibold leading-tight line-clamp-2"
          style={{ color: "var(--st-ink)" }}
        >
          {courseTitle}
        </p>
      </div>

      {/* Modules list */}
      <nav className="flex-1 py-3">
        {modules.map((mod, index) => (
          <ModuleItem
            key={mod.id}
            mod={mod}
            courseId={courseId}
            index={index}
            activeLessonId={activeLessonId}
          />
        ))}
      </nav>
    </aside>
  );
}

function ModuleItem({
  mod,
  courseId,
  index,
  activeLessonId,
}: {
  mod: LmsModule;
  courseId: string;
  index: number;
  activeLessonId: string;
}) {
  const { data: lessons = [] } = useModuleLessons(mod.id);
  const hasActive = lessons.some((l) => l.id === activeLessonId);
  const [open, setOpen] = useState(hasActive);

  return (
    <div>
      {/* Module header */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-2 px-4 py-2.5 text-left transition-colors hover:bg-black/5"
        style={{ fontFamily: "inherit" }}
      >
        <span
          className="w-5 h-5 flex items-center justify-center rounded-full text-xs font-bold shrink-0"
          style={{ background: "rgba(16,24,32,0.1)", color: "var(--st-ink)" }}
        >
          {index + 1}
        </span>
        <span
          className="flex-1 text-xs font-semibold truncate"
          style={{ color: "var(--st-ink)" }}
        >
          {mod.title}
        </span>
        {open ? (
          <ChevronDown size={13} style={{ color: "var(--st-ink-muted)" }} />
        ) : (
          <ChevronRight size={13} style={{ color: "var(--st-ink-muted)" }} />
        )}
      </button>

      {/* Lessons */}
      {open && (
        <div className="pb-1">
          {lessons.map((lesson, lIdx) => (
            <LessonItem
              key={lesson.id}
              lesson={lesson}
              courseId={courseId}
              index={lIdx}
              isActive={lesson.id === activeLessonId}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function LessonItem({
  lesson,
  courseId,
  index,
  isActive,
}: {
  lesson: LmsLesson;
  courseId: string;
  index: number;
  isActive: boolean;
}) {
  const navigate = useNavigate();
  const isPublished = (lesson as { status?: string }).status === "published";

  return (
    <button
      onClick={() => navigate(`/lms/${courseId}/lesson/${lesson.id}/builder`)}
      className="w-full flex items-center gap-2.5 pl-11 pr-4 py-2 text-left transition-all relative"
      style={{
        fontFamily: "inherit",
        background: isActive ? "var(--st-yellow-soft)" : "transparent",
        borderLeft: isActive ? "3px solid var(--st-yellow)" : "3px solid transparent",
      }}
    >
      {isPublished ? (
        <CheckCircle2 size={13} style={{ color: isActive ? "var(--st-ink)" : "var(--st-ink-muted)", shrink: 0 }} className="shrink-0" />
      ) : (
        <Circle size={13} style={{ color: isActive ? "var(--st-ink)" : "var(--st-ink-muted)" }} className="shrink-0" />
      )}
      <span
        className="text-xs leading-snug truncate flex-1"
        style={{
          color: isActive ? "var(--st-ink)" : "var(--st-ink-muted)",
          fontWeight: isActive ? 600 : 400,
        }}
      >
        {index + 1}. {lesson.title}
      </span>
    </button>
  );
}
