import { FileText } from "lucide-react";
import { useTranscriptTitle } from "@/hooks/useTranscripts";

/** Provenance d'une leçon générée depuis un transcript. */
export default function LessonTranscriptBadge({ transcriptId }: { transcriptId: string }) {
  const { data } = useTranscriptTitle(transcriptId);

  if (!data) return null;
  const label = data.ai_title || data.title || "Transcript";

  return (
    <a
      href={`/transcripts?transcript=${data.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-medium rounded-full hover:underline"
      style={{
        background: "var(--st-surface)",
        color: "var(--st-ink-muted)",
        fontFamily: "'Lexend', ui-sans-serif, system-ui, sans-serif",
        textDecoration: "none",
      }}
      title="Ouvrir le transcript d'origine"
    >
      <FileText size={11} />
      Issu du transcript : {label}
    </a>
  );
}
