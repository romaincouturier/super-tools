import { useQuery } from "@tanstack/react-query";
import { FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Provenance d'une leçon générée depuis un transcript. Requête volontairement
 * limitée aux titres : `raw_text` peut peser plusieurs centaines de Ko.
 */
export default function LessonTranscriptBadge({ transcriptId }: { transcriptId: string }) {
  const { data } = useQuery({
    queryKey: ["transcript-title", transcriptId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("transcripts")
        .select("id, title, ai_title")
        .eq("id", transcriptId)
        .maybeSingle();
      if (error) throw error;
      return data as { id: string; title: string | null; ai_title: string | null } | null;
    },
  });

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
