import { useState } from "react";
import { FileAudio, Search, Check } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Spinner } from "@/components/ui/spinner";
import { useTranscripts, useTranscript, type Transcript } from "@/hooks/useTranscripts";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onPick: (payload: { title: string; content: string; icon: string }) => void | Promise<void>;
  usedTitles?: Set<string>;
}


function escapeHtml(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function transcriptToHtml(t: Transcript): string {
  const parts: string[] = [];
  if (t.summary) {
    parts.push(`<h2>Résumé</h2>`);
    parts.push(
      ...t.summary
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`),
    );
  }
  if (t.raw_text) {
    parts.push(`<h2>Transcript</h2>`);
    parts.push(
      ...t.raw_text
        .split(/\n{2,}/)
        .map((p) => `<p>${escapeHtml(p).replace(/\n/g, "<br/>")}</p>`),
    );
  }
  return parts.join("\n");
}

const MissionTranscriptPagePicker = ({ open, onOpenChange, onPick, usedTitles }: Props) => {
  const [search, setSearch] = useState("");
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const { data: transcripts = [], isLoading } = useTranscripts({
    search: search || undefined,
    status: "ready",
  });
  const { refetch: fetchOne } = useTranscript(null);

  const handlePick = async (t: Transcript) => {
    setLoadingId(t.id);
    try {
      // The list already includes raw_text/summary via select("*")
      const title = t.ai_title || t.title || "Transcript";
      const content = transcriptToHtml(t);
      await onPick({ title, content, icon: "🎙️" });
      onOpenChange(false);
      setSearch("");
    } finally {
      setLoadingId(null);
    }
  };

  // silence unused
  void fetchOne;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-full max-w-lg">
        <DialogHeader>
          <DialogTitle>Ajouter une page depuis un transcript</DialogTitle>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            autoFocus
            placeholder="Filtrer par titre..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <ScrollArea className="h-[400px] pr-2">
          {isLoading && <Spinner />}
          {!isLoading && transcripts.length === 0 && (
            <p className="text-sm text-muted-foreground text-center py-8">
              Aucun transcript disponible
            </p>
          )}
          <div className="space-y-1">
            {transcripts.map((t) => {
              const title = t.ai_title || t.title || "Sans titre";
              return (
                <button
                  key={t.id}
                  disabled={loadingId === t.id}
                  className="w-full text-left p-2 rounded hover:bg-accent transition-colors flex items-center gap-2 disabled:opacity-50"
                  onClick={() => handlePick(t)}
                >
                  <FileAudio className="h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(t.created_at), "d MMM yyyy", { locale: fr })}
                      {t.duration_seconds
                        ? ` • ${Math.round(t.duration_seconds / 60)} min`
                        : ""}
                    </p>
                  </div>
                  {loadingId === t.id && <Spinner />}
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </DialogContent>
    </Dialog>
  );
};

export default MissionTranscriptPagePicker;
