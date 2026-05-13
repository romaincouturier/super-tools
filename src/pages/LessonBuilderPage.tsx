import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useLesson, useCourse, useCourseModules, useModuleLessons } from "@/hooks/useLms";
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
  const { courseId, lessonId } = useParams<{ courseId: string; lessonId: string }>();
  const navigate = useNavigate();

  const { data: lesson, isLoading: lessonLoading } = useLesson(lessonId);
  const { data: course } = useCourse(courseId);
  const { data: modules = [] } = useCourseModules(courseId);

  const [tweaks, setTweaks] = useState<TweakValues>(DEFAULT_TWEAKS);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
      {/* Desktop */}
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
          />
        </div>
      </div>

      {/* Tweaks panel */}
      <BuilderTweaksPanel values={tweaks} onChange={setTweaks} />
    </div>
  );
}
