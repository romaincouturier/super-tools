import { useState } from "react";
import LearnerCourseHeader from "@/components/lms/LearnerCourseHeader";

type Props = {
  courseTitle: string;
  learnerEmail: string;
  isPreview?: boolean;
  editHref?: string;
  previewBanner?: React.ReactNode;
  /** Called once for desktop (no-op closeSidebar) and once for mobile (real close). */
  sidebar: (closeSidebar: () => void) => React.ReactNode;
  mainRef?: React.RefObject<HTMLElement>;
  scrollable?: boolean;
  children: React.ReactNode;
};

export default function LmsCourseLayout({
  courseTitle,
  learnerEmail,
  isPreview = false,
  editHref,
  previewBanner,
  sidebar,
  mainRef,
  scrollable = false,
  children,
}: Props) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const closeSidebar = () => setSidebarOpen(false);

  return (
    <div
      className="flex flex-col min-h-screen"
      style={{ fontFamily: "var(--font-learner)", background: "hsl(var(--grey-light))" }}
    >
      {previewBanner}
      <LearnerCourseHeader
        courseTitle={courseTitle}
        learnerEmail={learnerEmail}
        isPreview={isPreview}
        onToggleSidebar={() => setSidebarOpen((v) => !v)}
        editHref={editHref}
      />

      <div className={`flex flex-1${scrollable ? " overflow-hidden" : ""}`}>
        {/* Desktop sidebar */}
        <aside
          className={`hidden lg:flex flex-col shrink-0 transition-all duration-300 overflow-hidden ${sidebarOpen ? "w-[360px]" : "w-0"}`}
          aria-hidden={!sidebarOpen}
          style={{ padding: sidebarOpen ? "1rem" : undefined }}
        >
          {sidebarOpen && (
            <div style={{ background: "hsl(var(--white))", borderRadius: "var(--radius-block)", boxShadow: "0 2px 12px hsl(var(--ink) / 0.06)", overflow: "hidden", display: "flex", flexDirection: "column", flex: 1 }}>
              {sidebar(() => {})}
            </div>
          )}
        </aside>

        {/* Mobile sidebar overlay */}
        {sidebarOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 z-40 bg-black/30"
              onClick={closeSidebar}
            />
            <div
              className="lg:hidden fixed left-0 top-16 bottom-0 z-50 w-[300px] overflow-hidden"
              style={{ background: "hsl(var(--white))", boxShadow: "4px 0 20px hsl(var(--ink) / 0.1)" }}
            >
              {sidebar(closeSidebar)}
            </div>
          </>
        )}

        <main
          ref={mainRef}
          className={`flex-1${scrollable ? " overflow-auto" : ""}`}
          style={{ background: "hsl(var(--grey-light))" }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
