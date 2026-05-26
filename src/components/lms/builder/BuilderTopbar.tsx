import { useNavigate } from "react-router-dom";
import { Menu, ArrowLeft, Eye } from "lucide-react";
import { LmsLesson } from "@/hooks/useLms";

interface Props {
  lesson?: LmsLesson;
  courseId: string;
  titleValue: string;
  onTitleChange: (value: string) => void;
  onMenuToggle: () => void;
  isHome?: boolean;
}

export default function BuilderTopbar({ lesson, courseId, titleValue, onTitleChange, onMenuToggle, isHome = false }: Props) {
  const navigate = useNavigate();

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

      {/* Back → courses list */}
      <button
        onClick={() => navigate("/lms")}
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

      {/* Title — centred, shared state */}
      <div className="flex-1 flex justify-center min-w-0 px-2">
        <input
          value={titleValue}
          onChange={(e) => onTitleChange(e.target.value)}
          readOnly={isHome}
          className="w-full max-w-md text-center outline-none truncate"
          style={{
            color: "var(--st-ink)",
            fontFamily: "inherit",
            fontSize: "1.25rem",
            fontWeight: 600,
            background: "transparent",
            border: "1px solid transparent",
            borderRadius: 8,
            padding: ".25rem .75rem",
            transition: "background 120ms, border-color 120ms",
          }}
          onMouseEnter={(e) => {
            if (document.activeElement !== e.currentTarget)
              (e.currentTarget as HTMLElement).style.background = "var(--st-ink-06)";
          }}
          onMouseLeave={(e) => {
            if (document.activeElement !== e.currentTarget)
              (e.currentTarget as HTMLElement).style.background = "transparent";
          }}
          onFocus={(e) => {
            (e.currentTarget as HTMLElement).style.background = "var(--st-white)";
            (e.currentTarget as HTMLElement).style.borderColor = "var(--st-ink-08)";
          }}
          onBlur={(e) => {
            (e.currentTarget as HTMLElement).style.background = "transparent";
            (e.currentTarget as HTMLElement).style.borderColor = "transparent";
          }}
          aria-label={isHome ? "Page d'accueil" : "Titre de la leçon"}
        />
      </div>

      {/* Status + actions */}
      <div className="flex items-center gap-2 shrink-0">
        <span
          className="hidden sm:inline-flex items-center gap-1.5 text-xs font-medium px-3 py-1 rounded-full border"
          style={{
            color: "var(--st-ink-muted)",
            borderColor: "rgba(16,24,32,0.15)",
            fontFamily: "inherit",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--st-ink-muted)" }} />
          Brouillon
        </span>

        {/* Preview */}
        <a
          href={lesson ? `/lms/${courseId}/player?preview=admin&lesson=${lesson.id}` : `/lms/${courseId}/home?preview=admin`}
          target="_blank"
          rel="noopener noreferrer"
          className="hidden sm:flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-full border transition-all hover:bg-black/5"
          style={{
            color: "var(--st-ink)",
            borderColor: "rgba(16,24,32,0.2)",
            fontFamily: "inherit",
            textDecoration: "none",
          }}
        >
          <Eye size={14} />
          Aperçu
        </a>


      </div>
    </header>
  );
}
