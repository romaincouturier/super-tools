import { useCallback, useRef, useState } from "react";
import type React from "react";
import { useParams } from "react-router-dom";
import { useCourse } from "@/hooks/useLms";
import { useAuth } from "@/hooks/useAuth";
import BuilderTopbar from "@/components/lms/builder/BuilderTopbar";
import BuilderSidebar from "@/components/lms/builder/BuilderSidebar";
import HomePageEditor from "@/components/lms/HomePageEditor";

export default function LmsCourseHomeBuilderPage() {
  useAuth();
  const { courseId } = useParams<{ courseId: string }>();
  const { data: course, isLoading } = useCourse(courseId);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sidebarWidth, setSidebarWidth] = useState(() => {
    const saved = localStorage.getItem("builder-sidebar-width");
    return saved ? Math.max(280, Math.min(520, parseInt(saved, 10))) : 320;
  });
  const sidebarWidthRef = useRef(sidebarWidth);
  sidebarWidthRef.current = sidebarWidth;

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const handleMouseMove = (ev: MouseEvent) => {
      const newWidth = Math.max(280, Math.min(520, startWidth + (ev.clientX - startX)));
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

  if (isLoading || !course || !courseId) {
    return (
      <div
        className="builder-layout flex items-center justify-center h-screen"
        style={{ background: "hsl(var(--white))", fontFamily: "var(--font-learner)" }}
      >
        <p style={{ color: "hsl(var(--ink) / 0.55)", fontSize: 14 }}>Chargement…</p>
      </div>
    );
  }

  return (
    <div
      className="builder-layout flex h-screen overflow-hidden"
      style={{ fontFamily: "var(--font-learner)" }}
    >
      <div
        className="hidden lg:flex flex-col shrink-0 border-r relative"
        style={{ width: sidebarWidth, borderColor: "hsl(var(--ink) / 0.08)" }}
      >
        <BuilderSidebar courseId={courseId} activeLessonId="" courseTitle={course.title} activeHome />
        <ResizeHandle onMouseDown={handleResizeStart} />
      </div>

      {sidebarOpen && (
        <>
          <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setSidebarOpen(false)} />
          <div
            className="lg:hidden fixed left-0 top-0 bottom-0 z-50 flex flex-col border-r"
            style={{ width: 288, borderColor: "hsl(var(--ink) / 0.08)" }}
          >
            <BuilderSidebar courseId={courseId} activeLessonId="" courseTitle={course.title} activeHome />
          </div>
        </>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <BuilderTopbar
          courseId={courseId}
          titleValue="Accueil"
          onTitleChange={() => undefined}
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          isHome
        />

        <div className="flex-1 overflow-y-auto" style={{ background: "hsl(var(--white))" }}>
          <main className="max-w-4xl mx-auto px-6 py-8">
            <HomePageEditor course={course} />
          </main>
        </div>
      </div>
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
        background: hovered ? "hsl(var(--yellow-brand) / 0.35)" : "transparent",
        zIndex: 10,
        transition: "background 120ms ease",
      }}
    />
  );
}