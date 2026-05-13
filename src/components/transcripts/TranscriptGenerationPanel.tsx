import { useEffect, useMemo, useState } from "react";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Loader2, Sparkles, RefreshCw, Copy, Send, Save } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { toast } from "sonner";
import {
  useGenerateTranscriptContent,
  useTranscriptGenerations,
  useUpdateTranscriptGeneration,
  type GenerationKind,
  type GenerationVariant,
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

function VariantEditor({
  gen,
  index,
  variant,
  kind,
  transcriptId,
  onChange,
}: {
  gen: TranscriptGeneration;
  index: number;
  variant: GenerationVariant;
  kind: GenerationKind;
  transcriptId: string;
  onChange: (v: GenerationVariant) => void;
}) {
  const [sendingNl, setSendingNl] = useState(false);
  const [sendingBoard, setSendingBoard] = useState(false);
  const [selectedNl, setSelectedNl] = useState<string>("");
  const [selectedColumn, setSelectedColumn] = useState<string>("");
  const newsletters = useNewslettersDraft();
  const columns = useContentColumns();
  const { copy: copyToClipboard } = useCopyToClipboard();

  const defaultColumn = useMemo(
    () => columns.data?.find((c) => /id[ée]e/i.test(c.name))?.id ?? columns.data?.[0]?.id ?? "",
    [columns.data],
  );

  const sendToBoard = async () => {
    const colId = selectedColumn || defaultColumn;
    if (!colId) { toast.error("Aucune colonne disponible"); return; }
    setSendingBoard(true);
    try {
      await createContentCard({
        columnId: colId,
        title: variant.title || (kind === "linkedin_post" ? `Post LinkedIn ${index + 1}` : `Article ${index + 1}`),
        description: variant.content,
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

  const sendToNewsletter = async () => {
    if (!selectedNl) { toast.error("Sélectionne une newsletter"); return; }
    const colId = defaultColumn;
    if (!colId) { toast.error("Aucune colonne contenu disponible"); return; }
    setSendingNl(true);
    try {
      const cardId = await createContentCard({
        columnId: colId,
        title: variant.title || `Article ${index + 1}`,
        description: variant.content,
        tags: gen.tags,
        cardType: "article",
      });
      const { error } = await supabase.from("newsletter_cards").insert({
        newsletter_id: selectedNl,
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

  return (
    <div className="space-y-3">
      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Titre</label>
        <input
          value={variant.title}
          onChange={(e) => onChange({ ...variant, title: e.target.value })}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1"
        />
      </div>

      <div>
        <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Contenu</label>
        <Textarea
          value={variant.content}
          onChange={(e) => onChange({ ...variant, content: e.target.value })}
          className="font-mono text-xs min-h-[300px] mt-1"
        />
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <Button size="sm" variant="outline" onClick={() => { copyToClipboard(variant.content); toast.success("Copié"); }}>
          <Copy className="h-3.5 w-3.5 mr-1" />Copier
        </Button>
      </div>

      <div className="border-t pt-3 space-y-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Envoyer cette proposition vers le board Contenus</p>
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
    </div>
  );
}

function GenerationView({ gen, kind, transcriptId }: { gen: TranscriptGeneration; kind: GenerationKind; transcriptId: string }) {
  // Build variants list with backward-compat fallback
  const initialVariants: GenerationVariant[] = useMemo(() => {
    if (Array.isArray(gen.variants) && gen.variants.length > 0) return gen.variants;
    return [{ title: gen.title_suggestion ?? "", content: gen.content ?? "" }];
  }, [gen.id]);

  const [variants, setVariants] = useState<GenerationVariant[]>(initialVariants);
  const [activeIdx, setActiveIdx] = useState(0);
  const update = useUpdateTranscriptGeneration();
  const generate = useGenerateTranscriptContent();

  useEffect(() => {
    setVariants(initialVariants);
    setActiveIdx(0);
  }, [gen.id]);

  const dirty = JSON.stringify(variants) !== JSON.stringify(initialVariants);

  const save = () => {
    const first = variants[0] ?? { title: "", content: "" };
    const concatenated = variants.length > 1
      ? variants.map((v, i) => `═══ Proposition ${i + 1} : ${v.title} ═══\n\n${v.content}`).join("\n\n\n")
      : first.content;
    update.mutate({
      id: gen.id,
      transcript_id: transcriptId,
      variants,
      title_suggestion: first.title || null,
      content: concatenated,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-muted-foreground">
          {variants.length} proposition{variants.length > 1 ? "s" : ""} · Généré le {new Date(gen.created_at).toLocaleString("fr-FR")} · {gen.model}
        </div>
        <div className="flex gap-2">
          {dirty && (
            <Button size="sm" variant="outline" onClick={save} disabled={update.isPending}>
              <Save className="h-3.5 w-3.5 mr-1" />Sauvegarder
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => generate.mutate({ transcript_id: transcriptId, kind })} disabled={generate.isPending}>
            {generate.isPending ? <Loader2 className="h-3.5 w-3.5 mr-1 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1" />}
            Régénérer
          </Button>
        </div>
      </div>

      {gen.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {gen.tags.map((t) => <Badge key={t} variant="secondary" className="text-xs">{t}</Badge>)}
        </div>
      )}

      {variants.length === 1 ? (
        <VariantEditor
          gen={gen}
          index={0}
          variant={variants[0]}
          kind={kind}
          transcriptId={transcriptId}
          onChange={(v) => setVariants([v])}
        />
      ) : (
        <Tabs value={String(activeIdx)} onValueChange={(v) => setActiveIdx(Number(v))}>
          <TabsList className="flex-wrap h-auto">
            {variants.map((v, i) => (
              <TabsTrigger key={i} value={String(i)} className="text-xs">
                #{i + 1} · {v.title?.slice(0, 30) || "Sans titre"}
              </TabsTrigger>
            ))}
          </TabsList>
          {variants.map((v, i) => (
            <TabsContent key={i} value={String(i)} className="mt-3">
              <VariantEditor
                gen={gen}
                index={i}
                variant={v}
                kind={kind}
                transcriptId={transcriptId}
                onChange={(nv) => {
                  const next = [...variants];
                  next[i] = nv;
                  setVariants(next);
                }}
              />
            </TabsContent>
          ))}
        </Tabs>
      )}
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
          {kind === "blog_article" ? "Générer des propositions d'articles" : "Générer des posts LinkedIn"}
        </Button>
      </div>
    );
  }

  return <GenerationView gen={latest} kind={kind} transcriptId={transcriptId} />;
}
