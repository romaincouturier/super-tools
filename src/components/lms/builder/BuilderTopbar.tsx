import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Menu, ArrowLeft, Eye, ArrowRight } from "lucide-react";
import { useUpdateLesson, LmsLesson } from "@/hooks/useLms";
import { useToast } from "@/hooks/use-toast";

interface Props {
  lesson: LmsLesson;
  courseId: string;
  onMenuToggle: () => void;
}

export default function BuilderTopbar({ lesson, courseId, onMenuToggle }: Props) {
  const navigate = useNavigate();
  const updateLesson = useUpdateLesson();
  const { toast } = useToast();
  const [title, setTitle] = useState(lesson.title);
  const inputRef = useRef<HTMLInputElement>(null);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setTitle(lesson.title);
  }, [lesson.title]);

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const value = e.target.value;
      setTitle(value);
      if (saveTimer.current) clearTimeout(saveTimer.current);
      saveTimer.current = setTimeout(() => {
        if (value.trim() && value.trim() !== lesson.title) {
          updateLesson.mutate({ id: lesson.id, title: value.trim() });
        }
      }, 1500);
    },
    [lesson.id, lesson.title, updateLesson],
  );

  const isPublished = (lesson as { status?: string }).status === "published";

  return (
    <header
      className="sticky top-0 z-30 flex items-center gap-3 px-4 h-16 border-b"
      style={{ background: "var(--st-white)", borderColor: "rgba(16,24,32,0.08)" }}
    >
      {/* Hamburger (mobile) */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden flex items-center justify-center w-8 h-8 rounded-lg transition-colors hover:bg-black/5"
        aria-label="Menu"
      >
        <Menu size={18} style={{ color: "var(--st-ink)" }} />
      </button>

      {/* Back */}
      <button
        onClick={() => navigate(`/lms/${courseId}`)}
        className="hidden lg:flex items-center gap-1.5 text-sm font-medium transition-colors hover:opacity-70 shrink-0"
        style={{ color: "var(--st-ink)", fontFamily: "inherit" }}
      >
        <ArrowLeft size={15} />
        Retour
      </button>

      {/* Divider */}
      <div
        className="hidden lg:block w-px self-stretch my-3 shrink-0"
        style={{ background: "rgba(16,24,32,0.1)" }}
      />

      {/* Title — centred */}
      <div className="flex-1 flex justify-center min-w-0 px-2">
        <input
          ref={inputRef}
          value={title}
          onChange={handleTitleChange}
          className="w-full max-w-md text-center bg-transparent border-none outline-none truncate"
          style={{ color: "var(--st-ink)", fontFamily: "inherit", fontSize: "1.25rem", fontWeight: 600 }}
          aria-label="Titre de la leçon"
        />
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Status badge */}
        <span
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border"
          style={{
            color: "var(--st-ink-muted)",
            borderColor: "rgba(16,24,32,0.15)",
            fontFamily: "inherit",
          }}
        >
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: isPublished ? "#22c55e" : "var(--st-ink-muted)" }}
          />
          {isPublished ? "Publié" : "Brouillon"}
        </span>

        {/* Preview */}
        <button
          onClick={() =>
            toast({ title: "Aperçu bientôt disponible" })
          }
          className="hidden sm:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-all hover:bg-black/5"
          style={{
            color: "var(--st-ink)",
            borderColor: "rgba(16,24,32,0.2)",
            fontFamily: "inherit",
          }}
        >
          <Eye size={14} />
          Aperçu
        </button>

        {/* Publish */}
        <button
          onClick={() =>
            toast({ title: "Publication bientôt disponible" })
          }
          className="flex items-center gap-1.5 text-sm font-semibold px-4 py-1.5 rounded-full transition-all hover:-translate-y-px active:translate-y-0"
          style={{
            background: "var(--st-ink)",
            color: "#fff",
            fontFamily: "inherit",
          }}
        >
          Publier
          <ArrowRight size={14} />
        </button>
      </div>
    </header>
  );
}
