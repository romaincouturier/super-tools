import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ChevronRight, FileText, Plus } from "lucide-react";
import {
  useCourseModules,
  useModuleLessons,
  useCreateModule,
  useCreateLesson,
  LmsModule,
  LmsLesson,
} from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";

interface Props {
  courseId: string;
  activeLessonId: string;
  courseTitle: string;
}

export default function BuilderSidebar({ courseId, activeLessonId, courseTitle }: Props) {
  const { data: modules = [] } = useCourseModules(courseId);
  const createModule = useCreateModule();
  const { toast } = useToast();

  const handleAddModule = async () => {
    try {
      await createModule.mutateAsync({
        course_id: courseId,
        title: "Nouveau module",
        position: modules.length,
      });
      toast({ title: "Module ajouté" });
    } catch {
      toast({ title: "Erreur lors de la création du module", variant: "destructive" });
    }
  };

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
          disabled={createModule.isPending}
          onClick={handleAddModule}
          className="w-full flex items-center gap-2 text-left"
          style={{
            padding: ".5rem .75rem",
            fontSize: ".8125rem",
            color: "var(--st-ink-60)",
            borderRadius: 6,
            fontWeight: 500,
            marginTop: ".25rem",
            opacity: createModule.isPending ? 0.5 : 1,
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
          <span>{createModule.isPending ? "Création…" : "Ajouter un module"}</span>
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
  const createLesson = useCreateLesson();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleAddLesson = async () => {
    try {
      const lesson = await createLesson.mutateAsync({
        module_id: mod.id,
        title: "Nouvelle leçon",
        lesson_type: "text",
        position: lessons.length,
      });
      toast({ title: "Leçon ajoutée" });
      navigate(`/lms/${courseId}/lesson/${lesson.id}/builder`);
    } catch {
      toast({ title: "Erreur lors de la création de la leçon", variant: "destructive" });
    }
  };

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

        {/* Add lesson button */}
        <button
          disabled={createLesson.isPending}
          onClick={handleAddLesson}
          className="w-full flex items-center gap-2 text-left"
          style={{
            padding: ".375rem .75rem .375rem 2rem",
            fontSize: ".8125rem",
            color: "var(--st-ink-50)",
            borderRadius: 6,
            fontWeight: 400,
            opacity: createLesson.isPending ? 0.5 : 1,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink)";
            (e.currentTarget as HTMLElement).style.background = "rgba(16,24,32,0.04)";
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLElement).style.color = "var(--st-ink-50)";
            (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
        >
          <Plus size={12} />
          <span>{createLesson.isPending ? "Création…" : "Ajouter une leçon"}</span>
        </button>
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
