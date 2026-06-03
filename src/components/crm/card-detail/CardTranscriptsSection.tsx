import { useMemo, useState } from "react";
import { Plus, FileAudio, Eye, Trash2, Search, Copy } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTranscripts, useTranscript } from "@/hooks/useTranscripts";
import {
  useCardTranscripts,
  useAssociateTranscript,
  useUnlinkTranscript,
} from "@/hooks/useCardTranscripts";

interface Props {
  cardId: string;
}

const CardTranscriptsSection = ({ cardId }: Props) => {
  const [associateOpen, setAssociateOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [viewId, setViewId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: links = [], isLoading } = useCardTranscripts(cardId);
  const associate = useAssociateTranscript();
  const unlink = useUnlinkTranscript();

  const copyTranscript = async (transcriptId: string) => {
    const { data, error } = await (supabase as unknown as { from: typeof supabase.from }).from("transcripts").select("ai_title,title,summary,raw_text").eq("id", transcriptId).single();
    if (error || !data) { toast({ title: "Erreur", description: "Impossible de récupérer le transcript", variant: "destructive" }); return; }
    const t = data as { ai_title: string | null; title: string | null; summary: string | null; raw_text: string | null };
    const parts = [t.ai_title || t.title || "Transcript", t.summary ? `\nRésumé:\n${t.summary}` : "", t.raw_text ? `\n${t.raw_text}` : ""].filter(Boolean);
    try {
      await navigator.clipboard.writeText(parts.join("\n"));
      toast({ title: "Copié", description: "Le transcript complet est dans le presse-papier." });
    } catch {
      toast({ title: "Erreur", description: "Copie impossible", variant: "destructive" });
    }
  };

  const { data: allTranscripts = [], isLoading: loadingList } = useTranscripts({
    search: search || undefined,
    status: "ready",
  });

  const linkedIds = useMemo(() => new Set(links.map((l) => l.transcript_id)), [links]);
  const candidates = useMemo(
    () => allTranscripts.filter((t) => !linkedIds.has(t.id)),
    [allTranscripts, linkedIds],
  );

  const { data: viewedTranscript, isLoading: loadingView } = useTranscript(viewId);

  return (
    <div className="space-y-4 mt-4">
      <div>
        <Button variant="outline" onClick={() => setAssociateOpen(true)}>
          <Plus className="h-4 w-4 mr-2" />
          Associer un transcript
        </Button>
      </div>

      <div className="space-y-2">
        {isLoading && <Spinner />}
        {!isLoading && links.length === 0 && (
          <p className="text-sm text-muted-foreground">Aucun transcript associé</p>
        )}
        {links.map((link) => {
          const title = link.transcript?.ai_title || link.transcript?.title || "Sans titre";
          return (
            <div
              key={link.id}
              className="flex items-center justify-between gap-2 p-2 bg-muted rounded"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileAudio className="h-4 w-4 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{title}</p>
                  <p className="text-xs text-muted-foreground">
                    {format(new Date(link.transcript.created_at), "d MMM yyyy", { locale: fr })}
                    {link.transcript.duration_seconds
                      ? ` • ${Math.round(link.transcript.duration_seconds / 60)} min`
                      : ""}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setViewId(link.transcript_id)}
                  title="Voir le transcript"
                >
                  <Eye className="h-4 w-4 mr-1" />
                  Voir
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyTranscript(link.transcript_id)}
                  title="Copier le transcript"
                >
                  <Copy className="h-4 w-4 mr-1" />
                  Copier
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7"
                  onClick={() => unlink.mutate({ linkId: link.id, cardId })}
                  title="Retirer l'association"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Associate dialog */}
      <Dialog open={associateOpen} onOpenChange={setAssociateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Associer un transcript</DialogTitle>
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
            {loadingList && <Spinner />}
            {!loadingList && candidates.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-8">
                Aucun transcript disponible
              </p>
            )}
            <div className="space-y-1">
              {candidates.map((t) => {
                const title = t.ai_title || t.title || "Sans titre";
                return (
                  <button
                    key={t.id}
                    className="w-full text-left p-2 rounded hover:bg-accent transition-colors flex items-center gap-2"
                    onClick={async () => {
                      await associate.mutateAsync({ cardId, transcriptId: t.id });
                      setAssociateOpen(false);
                      setSearch("");
                    }}
                  >
                    <FileAudio className="h-4 w-4 shrink-0" />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{title}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(t.created_at), "d MMM yyyy", { locale: fr })}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* View dialog */}
      <Dialog open={!!viewId} onOpenChange={(o) => !o && setViewId(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>
              {viewedTranscript?.ai_title || viewedTranscript?.title || "Transcript"}
            </DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 pr-4">
            {loadingView && <Spinner />}
            {viewedTranscript?.summary && (
              <div className="mb-4 p-3 bg-muted rounded">
                <p className="text-xs font-semibold uppercase text-muted-foreground mb-1">
                  Résumé
                </p>
                <p className="text-sm whitespace-pre-wrap">{viewedTranscript.summary}</p>
              </div>
            )}
            <p className="text-sm whitespace-pre-wrap leading-relaxed">
              {viewedTranscript?.raw_text || "Aucun contenu"}
            </p>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={() => setViewId(null)}>
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default CardTranscriptsSection;
