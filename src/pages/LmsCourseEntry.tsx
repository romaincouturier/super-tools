import { useEffect } from "react";
import { useNavigate, useParams, Link } from "react-router-dom";
import { Loader2, BookOpen, Settings } from "lucide-react";
import { useCourseLessons, useCourse } from "@/hooks/useLms";

export default function LmsCourseEntry() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { data: course } = useCourse(courseId);
  const { data: lessons, isLoading } = useCourseLessons(courseId);

  useEffect(() => {
    if (isLoading || !lessons) return;
    const first = lessons[0];
    if (first) {
      navigate(`/lms/${courseId}/lesson/${first.id}/builder`, { replace: true });
    }
  }, [isLoading, lessons, courseId, navigate]);

  if (isLoading) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif", background: "var(--st-white)" }}
      >
        <Loader2 className="animate-spin" size={24} style={{ color: "var(--st-ink-50)" }} />
      </div>
    );
  }

  // No lessons found — show empty state
  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-6"
      style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif", background: "var(--st-white)" }}
    >
      <div
        style={{
          width: 64, height: 64, borderRadius: "50%",
          background: "var(--st-surface)", display: "grid", placeItems: "center",
        }}
      >
        <BookOpen size={28} style={{ color: "var(--st-ink-50)" }} />
      </div>
      <div style={{ textAlign: "center" }}>
        <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 700, color: "var(--st-ink)" }}>
          {course?.title ?? "Ce cours"}
        </h2>
        <p style={{ margin: "0.5rem 0 0", fontSize: "0.9375rem", color: "var(--st-ink-60)" }}>
          Aucune leçon trouvée. Créez votre première leçon dans les paramètres du cours.
        </p>
      </div>
      <Link
        to={`/lms/${courseId}/settings`}
        style={{
          display: "inline-flex", alignItems: "center", gap: "0.5rem",
          padding: "0.625rem 1.5rem", borderRadius: 999,
          background: "var(--st-ink)", color: "#fff",
          fontWeight: 600, fontSize: "0.9375rem",
          textDecoration: "none",
        }}
      >
        <Settings size={16} />
        Paramètres du cours
      </Link>
    </div>
  );
}
