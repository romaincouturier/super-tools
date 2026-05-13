import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, CheckCircle2, FileText, Plus } from "lucide-react";
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
      style={{ background: "var(--st-surface)", fontFamily: "inherit", padding: "1rem" }}
    >
      {/* Section header */}
      <div
        className="px-2 py-2"
        style={{ fontWeight: 700, fontSize: ".6875rem", letterSpacing: ".05em", color: "var(--st-ink-50)", textTransform: "uppercase" }}
      >
        Structure du cours
      </div>

      {/* Module list */}
      <nav className="flex-1">
        {modules.map((mod) => (
          <ModuleItem
            key={mod.id}
            mod={mod}
            courseId={courseId}
            activeLessonId={activeLessonId}
          />
        ))}

        {/* Add module button */}
        <button
          className="w-full flex items-center gap-2 text-left"
          style={{
            padding: ".5rem .75rem",
            fontSize: ".8125rem",
            color: "var(--st-ink-60)",
            borderRadius: 6,
            fontWeight: 500,
            marginTop: ".25rem",
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.04)";
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink-60)";
          }}
        >
          <Plus size={14} />
          <span>Ajouter un module</span>
        </button>
      </nav>

      {/* User footer */}
      <div style={{ marginTop: "auto", paddingTop: "1rem", borderTop: "1px solid var(--st-ink-06)" }}>
        <div className="flex items-center gap-2.5 px-3 py-2" style={{ borderRadius: 8 }}>
          <div
            className="flex items-center justify-center shrink-0 font-bold"
            style={{ width: 32, height: 32, borderRadius: "50%", background: "var(--st-ink)", color: "var(--st-yellow)", fontSize: ".75rem" }}
          >
            {courseTitle ? courseTitle.slice(0, 2).toUpperCase() : "—"}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: ".8125rem", fontWeight: 600, color: "var(--st-ink)" }}>
              {courseTitle ? courseTitle.split(" ").slice(0, 2).join(" ") : "Auteur"}
            </div>
            <div style={{ fontSize: ".6875rem", color: "var(--st-ink-60)" }}>Formateur</div>
          </div>
        </div>
      </div>
    </aside>
  );
}

function ModuleItem({
  mod,
  courseId,
  activeLessonId,
}: {
  mod: LmsModule;
  courseId: string;
  activeLessonId: string;
}) {
  const { data: lessons = [] } = useModuleLessons(mod.id);
  const hasActive = lessons.some((l) => l.id === activeLessonId);
  const [open, setOpen] = useState(hasActive);

  return (
    <div style={{ marginBottom: ".25rem" }}>
      {/* Module header */}
      <div
        className="flex items-center gap-2 cursor-pointer"
        onClick={() => setOpen((o) => !o)}
        style={{ padding: ".5rem .75rem", fontWeight: 600, fontSize: ".875rem", color: "var(--st-ink)", borderRadius: 8, justifyContent: "space-between" }}
        onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.04)")}
        onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.background = "transparent")}
      >
        <div className="flex items-center gap-2" style={{ minWidth: 0, flex: 1, overflow: "hidden" }}>
          <ChevronRight
            size={14}
            style={{
              color: "var(--st-ink-50)",
              transform: open ? "rotate(90deg)" : "none",
              transition: "transform 160ms",
              flexShrink: 0,
            }}
          />
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {mod.title}
          </span>
        </div>
        <span style={{ fontWeight: 500, fontSize: ".75rem", color: "var(--st-ink-50)", flexShrink: 0 }}>
          {lessons.length}
        </span>
      </div>

      {/* Lessons with slide animation */}
      <div style={{ overflow: "hidden", maxHeight: open ? "1000px" : 0, transition: "max-height 240ms ease" }}>
        {lessons.map((lesson) => (
          <LessonItem
            key={lesson.id}
            lesson={lesson}
            courseId={courseId}
            isActive={lesson.id === activeLessonId}
          />
        ))}
      </div>
    </div>
  );
}

function LessonItem({
  lesson,
  courseId,
  isActive,
}: {
  lesson: LmsLesson;
  courseId: string;
  isActive: boolean;
}) {
  const navigate = useNavigate();

  return (
    <div
      className={"flex items-center gap-2 cursor-pointer"}
      onClick={() => navigate(`/lms/${courseId}/lesson/${lesson.id}/builder`)}
      style={{
        padding: isActive ? ".5rem .75rem .5rem 1.75rem" : ".5rem .75rem .5rem 2rem",
        fontSize: ".875rem",
        fontWeight: isActive ? 600 : 400,
        color: isActive ? "var(--st-ink)" : "var(--st-ink-70, rgba(16,24,32,0.7))",
        borderRadius: 6,
        borderLeft: isActive ? "3px solid var(--st-yellow)" : "3px solid transparent",
        background: isActive ? "var(--st-yellow-soft)" : "transparent",
        transition: "color 120ms ease, background 120ms ease",
      }}
      onMouseEnter={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
          (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.03)";
        }
      }}
      onMouseLeave={(e) => {
        if (!isActive) {
          (e.currentTarget as HTMLElement).style.color = "var(--st-ink-70, rgba(16,24,32,0.7))";
          (e.currentTarget as HTMLElement).style.background = "transparent";
        }
      }}
    >
      {/* Icon: file-text by default; check-circle if we could detect published */}
      <span
        className="flex items-center justify-center shrink-0"
        style={{ width: 16, height: 16, color: isActive ? "var(--st-ink)" : "rgba(16,24,32,0.4)" }}
      >
        <FileText size={16} />
      </span>
      <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
        {lesson.title}
      </span>
    </div>
  );
}
