import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { useLesson, useCourse, useCourseModules, useModuleLessons, useUpdateLesson } from "@/hooks/useLms";
import { useAuth } from "@/hooks/useAuth";
import BuilderTopbar from "@/components/lms/builder/BuilderTopbar";
import BuilderSidebar from "@/components/lms/builder/BuilderSidebar";
import BuilderCanvas from "@/components/lms/builder/BuilderCanvas";
import BuilderTweaksPanel, { type TweakValues } from "@/components/lms/builder/BuilderTweaksPanel";

const DEFAULT_TWEAKS: TweakValues = {
  contentWidth: 768,
  h1Size: 40,
  blockRadius: 20,
  density: "spacious",
  showArc: true,
};

export default function LessonBuilderPage() {
  // Auth guard: redirects to /auth if no session — without it, the page loads via
  // anon SELECT policies but every storage upload fails with RLS errors.
  useAuth();
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();

  const { data: lesson, isLoading: lessonLoading } = useLesson(lessonId);
  const { data: course } = useCourse(courseId);
  const { data: modules = [] } = useCourseModules(courseId);
  const updateLesson = useUpdateLesson();

  const [tweaks, setTweaks] = useState<TweakValues>(DEFAULT_TWEAKS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // Single source of truth for the title — shared by topbar input and canvas H1
  const [titleValue, setTitleValue] = useState("");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (lesson?.title) setTitleValue(lesson.title);
  }, [lesson?.title]);

  const handleTitleChange = useCallback(
    (value: string) => {
      setTitleValue(value);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (lesson && value.trim() && value.trim() !== lesson.title) {
          updateLesson.mutate({ id: lesson.id, title: value.trim() });
        }
      }, 1500);
    },
    [lesson, updateLesson],
  );

  // Find the module this lesson belongs to
  const lessonModule = modules.find((m) => m.id === lesson?.module_id);

  // Find lesson sequence number within its module
  const { data: moduleLessons = [] } = useModuleLessons(lesson?.module_id);
  const sequenceNumber = moduleLessons.findIndex((l) => l.id === lessonId) + 1 || undefined;

  if (lessonLoading || !lesson || !courseId) {
    return (
      <div
        className="builder-layout flex items-center justify-center h-screen"
        style={{ background: "var(--st-white)", fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}
      >
        <p style={{ color: "var(--st-ink-muted)", fontSize: 14 }}>Chargement…</p>
      </div>
    );
  }

  return (
    <div
      className="builder-layout flex h-screen overflow-hidden"
      style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif" }}
    >
      {/* Sidebar — fixed left on desktop, drawer overlay on mobile */}
      <div
        className="hidden lg:flex flex-col shrink-0 border-r"
        style={{ width: 288, borderColor: "rgba(16,24,32,0.08)" }}
      >
        <BuilderSidebar
          courseId={courseId}
          activeLessonId={lesson.id}
          courseTitle={course?.title ?? ""}
        />
      </div>

      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <>
          <div
            className="lg:hidden fixed inset-0 z-40 bg-black/30"
            onClick={() => setSidebarOpen(false)}
          />
          <div
            className="lg:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r"
            style={{ width: 288, borderColor: "rgba(16,24,32,0.08)" }}
          >
            <BuilderSidebar
              courseId={courseId}
              activeLessonId={lesson.id}
              courseTitle={course?.title ?? ""}
            />
          </div>
        </>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col min-w-0">
        <BuilderTopbar
          lesson={lesson}
          courseId={courseId}
          titleValue={titleValue}
          onTitleChange={handleTitleChange}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
        />

        {/* Scrollable canvas */}
        <div className="flex-1 overflow-y-auto" style={{ background: "var(--st-white)" }}>
          <BuilderCanvas
            lesson={lesson}
            courseId={courseId}
            tweaks={tweaks}
            moduleName={lessonModule?.title}
            sequenceNumber={sequenceNumber}
            titleValue={titleValue}
            onTitleChange={handleTitleChange}
          />
        </div>
      </div>

      {/* Tweaks panel */}
      <BuilderTweaksPanel values={tweaks} onChange={setTweaks} />
    </div>
  );
}
