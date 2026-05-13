import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, RefreshCw, Copy, Send, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import {
  useGenerateTranscriptContent,
  useTranscriptGenerations,
  useUpdateTranscriptGeneration,
  type GenerationKind,
  type TranscriptGeneration,
} from "@/hooks/useTranscriptGenerations";

interface Props {
  transcriptId: string;
  kind: GenerationKind;
}

function useNewslettersDraft() {
  return useQuery({
    queryKey: ["newsletters_draft"],
    queryFn: async () => {
      const { data } = await supabase
        .from("newsletters")
        .select("id, title, scheduled_date")
        .eq("status", "draft")
        .order("scheduled_date", { ascending: true });
      return (data ?? []) as { id: string; title: string | null; scheduled_date: string }[];
    },
  });
}

function useContentColumns() {
  return useQuery({
    queryKey: ["content_columns_minimal"],
    queryFn: async () => {
      const { data } = await supabase
        .from("content_columns")
        .select("id, name")
        .order("display_order");
      return (data ?? []) as { id: string; name: string }[];
    },
  });
}

async function createContentCard(opts: {
  columnId: string;
  title: string;
  description: string;
  tags: string[];
  cardType: "article" | "linkedin";
}) {
  const { data: existing } = await supabase
    .from("content_cards")
    .select("display_order")
    .eq("column_id", opts.columnId)
    .order("display_order", { ascending: false })
    .limit(1);
  const nextOrder = (existing?.[0]?.display_order ?? -1) + 1;
  const session = await supabase.auth.getSession();
  const { data, error } = await supabase
    .from("content_cards")
    .insert({
      column_id: opts.columnId,
      title: opts.title,
      description: opts.description,
      tags: opts.tags as any,
      card_type: opts.cardType,
      display_order: nextOrder,
      created_by: session.data.session?.user?.id || null,
    })
    .select("id")
    .single();
  if (error) throw error;
  return data!.id as string;
}

function GenerationView({ gen, kind, transcriptId }: { gen: TranscriptGeneration; kind: GenerationKind; transcriptId: string }) {
  const [content, setContent] = useState(gen.content);
  const [title, setTitle] = useState(gen.title_suggestion ?? "");
  const [sendingNl, setSendingNl] = useState(false);
  const [sendingBoard, setSendingBoard] = useState(false);
  const [selectedNl, setSelectedNl] = useState<string>("");
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const update = useUpdateTranscriptGeneration();
  const generate = useGenerateTranscriptContent();
  const newsletters = useNewslettersDraft();
  const columns = useContentColumns();

  // Default: "Idées" column if present
  const defaultColumn = useMemo(() => columns.data?.find((c) => /id[ée]e/i.test(c.name))?.id ?? columns.data?.[0]?.id ?? "", [columns.data]);

  const sendToNewsletter = async () => {
    const nlId = selectedNl;
    if (!nlId) { toast.error("Sélectionne une newsletter"); return; }
    const colId = defaultColumn;
    if (!colId) { toast.error("Aucune colonne contenu disponible"); return; }
    setSendingNl(true);
    try {
      const cardId = await createContentCard({
        columnId: colId,
        title: title || "Article généré",
        description: content,
        tags: gen.tags,
        cardType: "article",
      });
      const { error } = await supabase.from("newsletter_cards").insert({
        newsletter_id: nlId,
        card_id: cardId,
        display_order: 0,
      });
      if (error) throw error;
      toast.success("Envoyé vers la newsletter");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSendingNl(false);
    }
  };

  const sendToBoard = async () => {
    const colId = selectedColumn || defaultColumn;
    if (!colId) { toast.error("Aucune colonne disponible"); return; }
    setSendingBoard(true);
    try {
      await createContentCard({
        columnId: colId,
        title: title || (kind === "linkedin_post" ? "Post LinkedIn généré" : "Article généré"),
        description: content,
        tags: gen.tags,
        cardType: kind === "linkedin_post" ? "linkedin" : "article",
      });
      toast.success("Envoyé vers le board Contenus");
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setSendingBoard(false);
    }
  };

  const dirty = content !== gen.content || title !== (gen.title_suggestion ?? "");

  return (
    <div className="space-y-3">
      {gen.title_suggestion !== null && (
        <div>
          <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Titre suggéré</label>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
          />
        </div>
      )}

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contenu</label>
        <Textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          className="font-mono text-xs min-h-[300px] mt-1"
        />
      </div>

      {gen.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gen.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {dirty && (
          <Button size="sm" variant="outline" onClick={() => update.mutate({ id: gen.id, transcript_id: transcriptId, content, title_suggestion: title || null })} disabled={update.isPending}>
            <Save className="h-3.5 w-3.5 mr-1" />Sauvegarder
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={() => { navigator.clipboard.writeText(content); toast.success("Copié"); }}>
          <Copy className="h-3.5 w-3.5 mr-1" />Copier
        </Button>
        <Button size="sm" variant="outline" onClick={() => generate.mutate({ transcript_id: transcriptId, kind })} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
          Régénérer
        </Button>
      </div>

      <div className="border-t pt-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Envoyer vers le board Contenus</p>
        <div className="flex gap-2">
          <Select value={selectedColumn || defaultColumn} onValueChange={setSelectedColumn}>
            <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Colonne…" /></SelectTrigger>
            <SelectContent>
              {columns.data?.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button size="sm" onClick={sendToBoard} disabled={sendingBoard}>
            <Send className="h-3.5 w-3.5 mr-1" />{sendingBoard ? "Envoi…" : "Envoyer"}
          </Button>
        </div>
      </div>

      {kind === "blog_article" && (
        <div className="border-t pt-3 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Envoyer vers une newsletter (brouillon)</p>
          <div className="flex gap-2">
            <Select value={selectedNl} onValueChange={setSelectedNl}>
              <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Sélectionner une newsletter…" /></SelectTrigger>
              <SelectContent>
                {newsletters.data?.length === 0 && <div className="text-xs px-2 py-1 text-muted-foreground">Aucune newsletter en brouillon</div>}
                {newsletters.data?.map((n) => (
                  <SelectItem key={n.id} value={n.id}>{n.title || `Newsletter du ${new Date(n.scheduled_date).toLocaleDateString("fr-FR")}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button size="sm" onClick={sendToNewsletter} disabled={sendingNl || !selectedNl}>
              <Send className="h-3.5 w-3.5 mr-1" />{sendingNl ? "Envoi…" : "Envoyer"}
            </Button>
          </div>
        </div>
      )}

      <p className="text-xs text-muted-foreground">Généré le {new Date(gen.created_at).toLocaleString("fr-FR")} · {gen.model}</p>
    </div>
  );
}

export function TranscriptGenerationPanel({ transcriptId, kind }: Props) {
  const { data: generations, isLoading } = useTranscriptGenerations(transcriptId);
  const generate = useGenerateTranscriptContent();

  const latest = generations?.find((g) => g.kind === kind) ?? null;

  if (isLoading) return <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>;

  if (!latest) {
    return (
      <div className="flex flex-col items-center gap-3 py-12 text-center">
        <Sparkles className="h-8 w-8 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Aucune {kind === "blog_article" ? "proposition d'article" : "proposition de post LinkedIn"} générée pour ce transcript.
        </p>
        <Button onClick={() => generate.mutate({ transcript_id: transcriptId, kind })} disabled={generate.isPending}>
          {generate.isPending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          {kind === "blog_article" ? "Générer une proposition d'article" : "Générer un post LinkedIn"}
        </Button>
      </div>
    );
  }

  return <GenerationView gen={latest} kind={kind} transcriptId={transcriptId} />;
}
