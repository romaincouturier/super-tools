import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Radio, Clock, AlertCircle, CheckCircle2, Loader2, RefreshCw, Trash2, ArchiveRestore } from "lucide-react";
import { PollingIndicator } from "@/components/shared/PollingIndicator";
import ModuleLayout from "@/components/ModuleLayout";
import PageHeader from "@/components/PageHeader";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { TranscriptGenerationPanel } from "@/components/transcripts/TranscriptGenerationPanel";
import {
  useTranscripts,
  useTranscript,
  useTrashTranscript,
  useRestoreTranscript,
  type Transcript,
  type TranscriptSource,
  type TranscriptStatus,
} from "@/hooks/useTranscripts";

const SOURCE_LABELS: Record<TranscriptSource, string> = {
  google_drive: "Google Drive",
  fireflies: "Fireflies",
};

const STATUS_ICONS: Record<TranscriptStatus, React.ReactNode> = {
  pending: <Clock className="h-3.5 w-3.5" />,
  processing: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
  ready: <CheckCircle2 className="h-3.5 w-3.5" />,
  error: <AlertCircle className="h-3.5 w-3.5" />,
  trashed: <Trash2 className="h-3.5 w-3.5" />,
};

const STATUS_VARIANTS: Record<TranscriptStatus, "default" | "secondary" | "outline" | "destructive"> = {
  pending: "outline",
  processing: "secondary",
  ready: "default",
  error: "destructive",
  trashed: "outline",
};

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function TranscriptCard({ t, onClick }: { t: Transcript; onClick: () => void }) {
  const displayTitle = t.ai_title || t.title || "Sans titre";
  const showFilename = !!t.ai_title && !!t.title && t.ai_title !== t.title;
  return (
    <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={onClick}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-medium text-sm leading-snug line-clamp-2">{displayTitle}</p>
            {showFilename && (
              <p className="text-[11px] text-muted-foreground truncate mt-0.5" title={t.title ?? ""}>
                📄 {t.title}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Badge variant={t.source === "fireflies" ? "secondary" : "outline"} className="text-xs">
              {SOURCE_LABELS[t.source]}
            </Badge>
            <Badge variant={STATUS_VARIANTS[t.status]} className="flex items-center gap-1 text-xs">
              {STATUS_ICONS[t.status]}
              {t.status}
            </Badge>
          </div>
        </div>
        {t.summary && <p className="text-xs text-muted-foreground line-clamp-2">{t.summary}</p>}
        <div className="flex items-center gap-2 flex-wrap">
          {t.tags?.map((tag) => (
            <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded-full">{tag}</span>
          ))}
        </div>
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{new Date(t.created_at).toLocaleDateString("fr-FR")}</span>
          {t.duration_seconds && <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{formatDuration(t.duration_seconds)}</span>}
        </div>
      </CardContent>
    </Card>
  );
}

function TranscriptDetail({ id, onClose }: { id: string; onClose: () => void }) {
  const { data: t, isLoading } = useTranscript(id);
  const [regenerating, setRegenerating] = useState(false);
  const queryClient = useQueryClient();
  const trashMutation = useTrashTranscript();
  const restoreMutation = useRestoreTranscript();

  const regenerateTitle = async () => {
    if (!t) return;
    setRegenerating(true);
    const { data, error } = await supabase.functions.invoke("generate-transcript-title", {
      body: { transcript_id: t.id },
    });
    setRegenerating(false);
    if (error || (data as any)?.error) {
      toast.error((error?.message || (data as any)?.error) ?? "Erreur");
      return;
    }
    toast.success("Titre régénéré");
    queryClient.invalidateQueries({ queryKey: ["transcript", t.id] });
    queryClient.invalidateQueries({ queryKey: ["transcripts"] });
  };

  const handleTrash = () => {
    if (!t) return;
    if (!confirm("Mettre ce transcript à la corbeille ?")) return;
    trashMutation.mutate(t.id, {
      onSuccess: () => {
        toast.success("Mis à la corbeille");
        onClose();
      },
      onError: (e: any) => toast.error(e?.message ?? "Erreur"),
    });
  };

  const handleRestore = () => {
    if (!t) return;
    const target: TranscriptStatus = t.raw_text ? "ready" : "error";
    restoreMutation.mutate({ id: t.id, status: target }, {
      onSuccess: () => toast.success("Restauré"),
      onError: (e: any) => toast.error(e?.message ?? "Erreur"),
    });
  };

  const headerTitle = t?.ai_title || t?.title || "Transcript";
  const showFilename = !!t?.ai_title && !!t?.title && t.ai_title !== t.title;

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl flex flex-col">
        <SheetHeader className="shrink-0">
          <div className="flex items-start justify-between gap-2">
            <SheetTitle className="text-left line-clamp-2 flex-1">{headerTitle}</SheetTitle>
            <div className="flex items-center gap-1 shrink-0">
              {t && t.status === "ready" && t.raw_text && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={regenerateTitle}
                  disabled={regenerating}
                  title="Régénérer le titre IA"
                >
                  {regenerating ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                </Button>
              )}
              {t && t.status !== "trashed" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleTrash}
                  disabled={trashMutation.isPending}
                  title="Mettre à la corbeille"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              )}
              {t && t.status === "trashed" && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleRestore}
                  disabled={restoreMutation.isPending}
                  title="Restaurer depuis la corbeille"
                >
                  <ArchiveRestore className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
          {showFilename && (
            <p className="text-xs text-muted-foreground text-left">📄 {t!.title}</p>
          )}
          {t && (
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={t.source === "fireflies" ? "secondary" : "outline"}>{SOURCE_LABELS[t.source]}</Badge>
              <Badge variant={STATUS_VARIANTS[t.status]} className="flex items-center gap-1">
                {STATUS_ICONS[t.status]}{t.status}
              </Badge>
              {t.duration_seconds && <span className="text-xs text-muted-foreground">{formatDuration(t.duration_seconds)}</span>}
            </div>
          )}
        </SheetHeader>
        <ScrollArea className="flex-1 mt-4">
          {isLoading && <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>}
          {t && (
            <Tabs defaultValue="transcript" className="pr-4">
              <TabsList>
                <TabsTrigger value="transcript">Transcript</TabsTrigger>
                <TabsTrigger value="blog" disabled={t.status !== "ready"}>Article blog</TabsTrigger>
                <TabsTrigger value="linkedin" disabled={t.status !== "ready"}>Post LinkedIn</TabsTrigger>
              </TabsList>
              <TabsContent value="transcript" className="space-y-4">
                {t.summary && (
                  <>
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">Résumé</p>
                      <p className="text-sm">{t.summary}</p>
                    </div>
                    <Separator />
                  </>
                )}
                {t.tags?.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Tags</p>
                    <div className="flex flex-wrap gap-1.5">
                      {t.tags.map((tag) => <span key={tag} className="text-xs bg-muted px-2 py-0.5 rounded-full">{tag}</span>)}
                    </div>
                  </div>
                )}
                {t.raw_text && (
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-2">Transcript complet</p>
                    <pre className="text-xs whitespace-pre-wrap font-sans leading-relaxed text-foreground/80">{t.raw_text}</pre>
                  </div>
                )}
                {t.error_message && (
                  <div className="rounded-md bg-destructive/10 p-3">
                    <p className="text-xs text-destructive font-medium">Erreur : {t.error_message}</p>
                  </div>
                )}
              </TabsContent>
              <TabsContent value="blog">
                <TranscriptGenerationPanel transcriptId={t.id} kind="blog_article" />
              </TabsContent>
              <TabsContent value="linkedin">
                <TranscriptGenerationPanel transcriptId={t.id} kind="linkedin_post" />
              </TabsContent>
            </Tabs>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}

export default function Transcripts() {
  const [search, setSearch] = useState("");
  const [source, setSource] = useState<TranscriptSource | "">("");
  const [status, setStatus] = useState<TranscriptStatus | "">("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data, isLoading, refetch } = useTranscripts({
    search,
    source,
    status: status === "trashed" ? "" : status,
    trashed: status === "trashed",
  });

  const counts = {
    total: data?.length ?? 0,
    ready: data?.filter((t) => t.status === "ready").length ?? 0,
    processing: data?.filter((t) => t.status === "processing").length ?? 0,
  };

  return (
    <ModuleLayout>
      <PageHeader title="Transcripts" />

      {/* KPIs */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        {[
          { label: "Total", value: counts.total, icon: <Mic className="h-4 w-4" /> },
          { label: "Prêts", value: counts.ready, icon: <CheckCircle2 className="h-4 w-4 text-green-600" /> },
          {
            label: "En cours",
            value: counts.processing,
            icon: counts.processing > 0
              ? <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
              : <Clock className="h-4 w-4 text-blue-600" />,
          },
        ].map(({ label, value, icon }) => (
          <Card key={label}>
            <CardContent className="p-4 flex items-center gap-3">
              {icon}
              <div>
                <p className="text-2xl font-bold">{value}</p>
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <PollingIndicator source="drive_transcripts" label="Google Drive — Transcripts" functionName="poll-drive-transcripts" forceLabel="Forcer Google Drive" />
        <PollingIndicator source="fireflies" label="Fireflies — Transcripts" functionName="fireflies-backfill" forceLabel="Forcer Fireflies" />
        <Input
          placeholder="Rechercher par titre…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <Select value={source || "all"} onValueChange={(v) => setSource(v === "all" ? "" : (v as TranscriptSource))}>
          <SelectTrigger className="w-40">
            <SelectValue placeholder="Toutes les sources" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les sources</SelectItem>
            <SelectItem value="google_drive">Google Drive</SelectItem>
            <SelectItem value="fireflies">Fireflies</SelectItem>
          </SelectContent>
        </Select>
        <Select value={status || "all"} onValueChange={(v) => setStatus(v === "all" ? "" : (v as TranscriptStatus))}>
          <SelectTrigger className="w-36">
            <SelectValue placeholder="Tous les statuts" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tous les statuts</SelectItem>
            <SelectItem value="ready">Prêt</SelectItem>
            <SelectItem value="processing">En cours</SelectItem>
            <SelectItem value="pending">En attente</SelectItem>
            <SelectItem value="error">Erreur</SelectItem>
            <SelectItem value="trashed">Corbeille</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => refetch()} title="Rafraîchir">
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {/* List */}
      {isLoading && (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>
      )}
      {!isLoading && !data?.length && (
        <Card>
          <CardContent className="flex flex-col items-center py-16 text-center gap-3">
            <Radio className="h-10 w-10 text-muted-foreground" />
            <p className="font-medium">Aucun transcript</p>
            <p className="text-sm text-muted-foreground">
              Déposez une vidéo dans votre dossier Google Drive ou enregistrez une réunion avec Fireflies.
            </p>
          </CardContent>
        </Card>
      )}
      {!isLoading && data && data.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {data.map((t) => (
            <TranscriptCard key={t.id} t={t} onClick={() => setSelectedId(t.id)} />
          ))}
        </div>
      )}

      {selectedId && <TranscriptDetail id={selectedId} onClose={() => setSelectedId(null)} />}
    </ModuleLayout>
  );
}
