import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Mic, Radio, Clock, AlertCircle, CheckCircle2, Loader2, RefreshCw, Trash2, ArchiveRestore, Copy } from "lucide-react";
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
import WpArticlesTab from "@/components/transcripts/WpArticlesTab";
import { TranscriptGenerationPanel } from "@/components/transcripts/TranscriptGenerationPanel";
import { useCopyToClipboard } from "@/hooks/useCopyToClipboard";
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

// ── Fiche éditoriale (ST-2026-0215) ──────────────────────────────────────────

const QUALIFICATION_CONFIG: Record<string, { label: string; className: string }> = {
  pro_exploitable:       { label: "Pro exploitable",       className: "bg-green-100 text-green-800" },
  pro_archiver:          { label: "Pro à archiver",        className: "bg-slate-100 text-slate-700" },
  personnel_hors_sujet:  { label: "Personnel / hors sujet", className: "bg-zinc-100 text-zinc-500" },
  sensible_confidentiel: { label: "Sensible / confidentiel", className: "bg-red-100 text-red-800" },
  non_exploitable:       { label: "Non exploitable",       className: "bg-orange-100 text-orange-800" },
};

const UNIVERS_LABELS: Record<string, string> = {
  facilitation_graphique: "Facilitation graphique",
  facilitation_intelligence_collective: "Facilitation / intelligence collective",
  agilite_produit_organisation: "Agilité / produit / organisation",
  ia: "IA",
  formation_pedagogie: "Formation / pédagogie",
  gestion_temps_priorites: "Gestion du temps / priorités",
  autre: "Autre",
};

const TYPE_MATIERE_LABELS: Record<string, string> = {
  question_client_frequente: "Question client fréquente",
  probleme_terrain: "Problème terrain",
  objection_commerciale: "Objection commerciale",
  feedback_formation: "Feedback formation",
  temoignage_potentiel: "Témoignage potentiel",
  cas_client_potentiel: "Cas client potentiel",
  idee_article: "Idée d'article",
  idee_newsletter: "Idée newsletter",
  idee_post_linkedin: "Idée post LinkedIn",
  ressource_pedagogique: "Ressource pédagogique",
  aucun_potentiel: "Aucun potentiel éditorial",
};

const RISQUE_CLASSES: Record<string, string> = {
  faible: "bg-green-100 text-green-800",
  moyen: "bg-amber-100 text-amber-800",
  fort: "bg-red-100 text-red-800",
};

function QualificationBadge({ q }: { q: string | null }) {
  if (!q) return null;
  const cfg = QUALIFICATION_CONFIG[q];
  if (!cfg) return null;
  return <span className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${cfg.className}`}>{cfg.label}</span>;
}

/** Fiche éditoriale IA affichée en tête du détail d'un transcript. */
function EditorialSheet({ t }: { t: Transcript }) {
  const queryClient = useQueryClient();
  const [analyzing, setAnalyzing] = useState(false);
  const a = t.editorial_analysis;
  const q = t.editorial_qualification;

  const runAnalysis = async () => {
    setAnalyzing(true);
    const { data, error } = await supabase.functions.invoke("analyze-transcript-editorial", {
      body: { transcript_id: t.id },
    });
    setAnalyzing(false);
    if (error || (data as any)?.error) {
      toast.error((error?.message || (data as any)?.error) ?? "Erreur d'analyse");
      return;
    }
    toast.success("Fiche éditoriale générée");
    queryClient.invalidateQueries({ queryKey: ["transcript", t.id] });
    queryClient.invalidateQueries({ queryKey: ["transcripts"] });
  };

  return (
    <div className="rounded-lg border bg-muted/30 p-3 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Fiche éditoriale</p>
        <Button
          variant="outline"
          size="sm"
          className="h-7 text-xs"
          onClick={runAnalysis}
          disabled={analyzing || !t.raw_text}
        >
          {analyzing ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5 mr-1.5" />}
          {q ? "Réanalyser" : "Analyser"}
        </Button>
      </div>

      {!q ? (
        <p className="text-xs text-muted-foreground italic">
          Pas encore analysé. L'analyse se lance automatiquement pour les nouvelles transcriptions.
        </p>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <QualificationBadge q={q} />
            {a?.univers && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-blue-100 text-blue-800">
                {UNIVERS_LABELS[a.univers] ?? a.univers}
              </span>
            )}
            {a?.type_matiere && q === "pro_exploitable" && (
              <span className="text-[11px] px-2 py-0.5 rounded-full bg-purple-100 text-purple-800">
                {TYPE_MATIERE_LABELS[a.type_matiere] ?? a.type_matiere}
              </span>
            )}
            {a?.risque_confidentialite && (
              <span
                className={`text-[11px] px-2 py-0.5 rounded-full ${RISQUE_CLASSES[a.risque_confidentialite] ?? ""}`}
                title={a.risque_justification || undefined}
              >
                Confidentialité : {a.risque_confidentialite}
              </span>
            )}
          </div>

          {a?.resume_editorial && (
            <p className="text-sm whitespace-pre-wrap">{a.resume_editorial}</p>
          )}

          {a?.signaux && a.signaux.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground mb-1">Signaux intéressants</p>
              <ul className="space-y-1">
                {a.signaux.map((s, i) => (
                  <li key={i} className="text-xs flex gap-1.5">
                    <span className="text-muted-foreground shrink-0">•</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {q !== "pro_exploitable" && (
            <p className="text-[11px] text-muted-foreground italic">
              Aucune idée éditoriale générée pour cette qualification.
            </p>
          )}
        </>
      )}
    </div>
  );
}

function TranscriptCard({ t, onClick }: { t: Transcript; onClick: () => void }) {
  const displayTitle = t.ai_title || t.title || "Sans titre";
  const showFilename = !!t.ai_title && !!t.title && t.ai_title !== t.title;
  const { copy } = useCopyToClipboard();
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!t.raw_text) return;
    copy(t.raw_text, { title: "Transcript copié" });
  };
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
            {t.raw_text && (
              <Button
                variant="ghost"
                size="icon"
                className="h-6 w-6"
                onClick={handleCopy}
                title="Copier le transcript"
              >
                <Copy className="h-3.5 w-3.5" />
              </Button>
            )}
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
          <QualificationBadge q={t.editorial_qualification} />
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
  const { copy: copyDetail } = useCopyToClipboard();
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
                <EditorialSheet t={t} />
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
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript complet</p>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => copyDetail(t.raw_text!, { title: "Transcript copié" })}
                      >
                        <Copy className="h-3.5 w-3.5 mr-1.5" />
                        Copier
                      </Button>
                    </div>
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
  const [qualification, setQualification] = useState<string>("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const { data: rawData, isLoading, refetch } = useTranscripts({
    search,
    source,
    status: status === "trashed" ? "" : status,
    trashed: status === "trashed",
  });

  // Vue éditoriale : filtre par qualification IA. "editorial" = vue resserrée
  // qui exclut automatiquement le personnel/hors sujet et le non exploitable.
  const data = (rawData ?? []).filter((t) => {
    if (!qualification) return true;
    if (qualification === "editorial") {
      return t.editorial_qualification === "pro_exploitable";
    }
    if (qualification === "none") return !t.editorial_qualification;
    return t.editorial_qualification === qualification;
  });

  const counts = {
    total: data?.length ?? 0,
    ready: data?.filter((t) => t.status === "ready").length ?? 0,
    processing: data?.filter((t) => t.status === "processing").length ?? 0,
  };

  return (
    <ModuleLayout>
      <PageHeader title="Transcripts" />

      <Tabs defaultValue="transcripts">
        <TabsList className="mb-4">
          <TabsTrigger value="transcripts">Transcripts</TabsTrigger>
          <TabsTrigger value="articles">Articles publiés</TabsTrigger>
        </TabsList>

        <TabsContent value="articles">
          <WpArticlesTab />
        </TabsContent>

        <TabsContent value="transcripts">

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
        <Select value={qualification || "all"} onValueChange={(v) => setQualification(v === "all" ? "" : v)}>
          <SelectTrigger className="w-52">
            <SelectValue placeholder="Toutes les qualifications" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toutes les qualifications</SelectItem>
            <SelectItem value="editorial">Vue éditoriale (exploitables)</SelectItem>
            <SelectItem value="pro_exploitable">Pro exploitable</SelectItem>
            <SelectItem value="pro_archiver">Pro à archiver</SelectItem>
            <SelectItem value="personnel_hors_sujet">Personnel / hors sujet</SelectItem>
            <SelectItem value="sensible_confidentiel">Sensible / confidentiel</SelectItem>
            <SelectItem value="non_exploitable">Non exploitable</SelectItem>
            <SelectItem value="none">Non analysé</SelectItem>
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
        </TabsContent>
      </Tabs>
    </ModuleLayout>
  );
}
