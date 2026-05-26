import { useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useCourse } from "@/hooks/useLms";

export default function LmsCourseEntry() {
  const { courseId } = useParams<{ courseId: string }>();
  const navigate = useNavigate();
  const { data: course } = useCourse(courseId);

  useEffect(() => {
    if (courseId) navigate(`/lms/${courseId}/home/builder`, { replace: true });
  }, [courseId, navigate]);

  if (!course) {
    return (
      <div
        className="flex items-center justify-center h-screen"
        style={{ fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif", background: "var(--st-white)" }}
      >
        <Loader2 className="animate-spin" size={24} style={{ color: "var(--st-ink-50)" }} />
      </div>
    );
  }

  return null;
}
