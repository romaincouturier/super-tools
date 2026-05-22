import { useCallback, useEffect, useRef, useState } from "react";
import type React from "react";
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

  // Resizable sidebar
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("builder-sidebar-width");
    return saved ? Math.max(220, Math.min(520, parseInt(saved, 10))) : 288;
  });
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const handleMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(220, Math.min(520, startWidth + (ev.clientX - startX)));
      setSidebarWidth(newWidth);
      sidebarWidthRef.current = newWidth;
    };

    const handleMouseUp = () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
      localStorage.setItem("builder-sidebar-width", String(sidebarWidthRef.current));
    };

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    document.addEventListener("mousemove", handleMouseMove);
    document.addEventListener("mouseup", handleMouseUp);
  }, []);

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
        className="hidden lg:flex flex-col shrink-0 border-r relative"
        style={{ width: sidebarWidth, borderColor: "rgba(16,24,32,0.08)" }}
      >
        <BuilderSidebar
          courseId={courseId}
          activeLessonId={lesson.id}
          courseTitle={course?.title ?? ""}
        />
        {/* Drag-resize handle */}
        <ResizeHandle onMouseDown={handleResizeStart} />
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

function ResizeHandle({ onMouseDown }: { onMouseDown: (e: React.MouseEvent) => void }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      onMouseDown={onMouseDown}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: "absolute",
        right: -3,
        top: 0,
        bottom: 0,
        width: 6,
        cursor: "col-resize",
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <div
        style={{
          width: 2,
          height: hovered ? "60%" : "30%",
          borderRadius: 2,
          background: hovered ? "var(--st-yellow)" : "rgba(16,24,32,0.12)",
          transition: "height 160ms ease, background 160ms ease",
          pointerEvents: "none",
        }}
      />
    </div>
  );
}
