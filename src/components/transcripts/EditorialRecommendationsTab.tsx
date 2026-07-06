import { useState } from "react";
import {
  Sparkles, MailQuestion, Check, X, ExternalLink, ShieldAlert,
  Mic, MessageSquareText, RefreshCw,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  useEditorialRecommendations, useRunEditorialEngine, useDecideRecommendation,
  type EditorialRecommendation,
} from "@/hooks/useEditorialRecommendations";

const ACTION_LABELS: Record<string, string> = {
  creer_article: "Créer un article",
  ameliorer_article: "Améliorer un article",
  recycler: "Recycler un contenu",
  fusionner: "Fusionner",
  archiver: "Archiver",
  creer_post_linkedin: "Créer un post LinkedIn",
  a_discuter: "À discuter",
  ne_rien_faire: "Ne rien faire",
};

const ACTION_STYLES: Record<string, string> = {
  creer_article: "bg-emerald-100 text-emerald-800 border-emerald-200",
  ameliorer_article: "bg-blue-100 text-blue-800 border-blue-200",
  recycler: "bg-cyan-100 text-cyan-800 border-cyan-200",
  fusionner: "bg-violet-100 text-violet-800 border-violet-200",
  archiver: "bg-slate-100 text-slate-700 border-slate-200",
  creer_post_linkedin: "bg-sky-100 text-sky-800 border-sky-200",
  a_discuter: "bg-amber-100 text-amber-800 border-amber-200",
  ne_rien_faire: "bg-slate-100 text-slate-700 border-slate-200",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "À arbitrer",
  accepted: "Acceptée",
  rejected: "Refusée",
  discuss: "En discussion",
};

const CIBLE_LABELS: Record<string, string> = {
  formateur: "Formateur·rice",
  facilitateur: "Facilitateur·rice",
  coach: "Coach",
  manager: "Manager",
  rh: "RH",
  chef_de_projet: "Chef·fe de projet",
  product_owner_pm: "PO / PM",
  consultant: "Consultant·e",
  independant_tpe: "Indépendant / TPE",
  organisation_cliente: "Organisation cliente",
  autre: "Autre",
};

function ScoreBadge({ label, value, emphasis = false }: { label: string; value: number | null; emphasis?: boolean }) {
  if (value == null) return null;
  const tone = value >= 70 ? "text-emerald-700" : value >= 40 ? "text-amber-700" : "text-slate-500";
  return (
    <div className={`flex flex-col items-center rounded-md border px-2.5 py-1 ${emphasis ? "border-primary/40 bg-primary/5" : ""}`}>
      <span className={`text-sm font-bold ${emphasis ? "text-primary" : tone}`}>{value}</span>
      <span className="text-[10px] text-muted-foreground whitespace-nowrap">{label}</span>
    </div>
  );
}

function RecommendationCard({ rec }: { rec: EditorialRecommendation }) {
  const decide = useDecideRecommendation();
  const [note, setNote] = useState("");

  const onDecide = async (decision: "accepted" | "rejected" | "discuss") => {
    try {
      const { cardId } = await decide.mutateAsync({ rec, decision, note: note || undefined });
      if (decision === "accepted") {
        toast.success("Carte créée dans la colonne Idées du kanban contenus.");
      } else if (decision === "discuss") {
        const subject = encodeURIComponent(`Recommandation éditoriale à discuter : ${rec.titre_provisoire}`);
        const body = encodeURIComponent(`${rec.besoin_cible}\n\nAction recommandée : ${ACTION_LABELS[rec.action_recommandee]}\nJustification : ${rec.justification}`);
        window.open(`mailto:?subject=${subject}&body=${body}`, "_blank");
        toast.success("Marquée « en discussion » — email pré-rempli ouvert.");
      } else {
        toast.success("Recommandation refusée.");
      }
      void cardId;
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de la décision");
    }
  };

  return (
    <Card className={rec.sensible ? "border-amber-300" : ""}>
      <CardHeader className="pb-2">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="space-y-1 min-w-0">
            <CardTitle className="text-base leading-snug">{rec.titre_provisoire || "(sans titre)"}</CardTitle>
            <div className="flex flex-wrap items-center gap-1.5">
              <Badge variant="outline" className={ACTION_STYLES[rec.action_recommandee] ?? ""}>
                {ACTION_LABELS[rec.action_recommandee] ?? rec.action_recommandee}
              </Badge>
              <Badge variant="secondary" className="gap-1">
                {rec.source_type === "transcript" ? <Mic className="h-3 w-3" /> : <MessageSquareText className="h-3 w-3" />}
                {rec.source_type === "transcript" ? "Transcript" : "Feedbacks formation"}
              </Badge>
              {rec.sensible && (
                <Badge variant="outline" className="gap-1 bg-amber-100 text-amber-800 border-amber-200">
                  <ShieldAlert className="h-3 w-3" />Sensible — validation humaine
                </Badge>
              )}
              {rec.status !== "pending" && <Badge variant="outline">{STATUS_LABELS[rec.status]}</Badge>}
            </div>
          </div>
          <div className="flex items-start gap-1.5">
            <ScoreBadge label="Priorité" value={rec.score_priorite} emphasis />
            <ScoreBadge label="Besoin" value={rec.score_besoin} />
            <ScoreBadge label="Créativité" value={rec.score_creativite} />
            <ScoreBadge label="SEO" value={rec.score_seo} />
            <ScoreBadge label="Commercial" value={rec.score_commercial} />
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <p><span className="font-medium">Besoin cible :</span> {rec.besoin_cible || "—"}</p>

        <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
          <span><span className="font-medium text-foreground">Cibles :</span> {rec.cibles.map((c) => CIBLE_LABELS[c] ?? c).join(", ") || "—"}</span>
          <span><span className="font-medium text-foreground">Univers :</span> {rec.univers ?? "—"}</span>
          <span><span className="font-medium text-foreground">Format :</span> {rec.format_recommande?.replace(/_/g, " ") ?? "—"}</span>
          <span><span className="font-medium text-foreground">Couverture :</span> {rec.niveau_couverture?.replace(/_/g, " ") ?? "—"}</span>
          <span><span className="font-medium text-foreground">Demande :</span> {rec.niveau_demande ?? "—"}</span>
          <span><span className="font-medium text-foreground">Redondance :</span> {rec.risque_redondance ?? "—"}</span>
        </div>

        {rec.contenus_existants_proches.length > 0 && (
          <div>
            <p className="font-medium mb-1">Contenus existants proches</p>
            <ul className="space-y-0.5">
              {rec.contenus_existants_proches.map((p, i) => (
                <li key={i} className="text-xs text-muted-foreground flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-foreground">{Math.round((p.similarity ?? 0) * 100)}%</span>
                  {p.url ? (
                    <a href={p.url} target="_blank" rel="noreferrer" className="text-primary hover:underline inline-flex items-center gap-0.5">
                      {p.title ?? p.url}<ExternalLink className="h-3 w-3" />
                    </a>
                  ) : (
                    <span>{p.title}</span>
                  )}
                  {p.views != null && <span>· {p.views} vues</span>}
                  {p.gsc && <span>· {p.gsc.clicks} clics SEO, pos. {p.gsc.position.toFixed(1)}</span>}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-muted-foreground"><span className="font-medium text-foreground">Justification :</span> {rec.justification || "—"}</p>
        {rec.action_secondaire && (
          <p className="text-muted-foreground"><span className="font-medium text-foreground">Action secondaire :</span> {rec.action_secondaire}</p>
        )}
        {rec.prochaine_etape && (
          <p className="text-muted-foreground"><span className="font-medium text-foreground">Prochaine étape :</span> {rec.prochaine_etape}</p>
        )}
        {rec.decision_note && (
          <p className="text-xs text-muted-foreground italic">Note de décision : {rec.decision_note}</p>
        )}

        {rec.status === "pending" && (
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <Button size="sm" onClick={() => onDecide("accepted")} disabled={decide.isPending} className="gap-1.5">
              <Check className="h-3.5 w-3.5" />Accepter → carte Idées
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDecide("discuss")} disabled={decide.isPending} className="gap-1.5">
              <MailQuestion className="h-3.5 w-3.5" />À discuter
            </Button>
            <Button size="sm" variant="outline" onClick={() => onDecide("rejected")} disabled={decide.isPending} className="gap-1.5 text-destructive">
              <X className="h-3.5 w-3.5" />Refuser
            </Button>
            <input
              className="flex-1 min-w-[180px] h-8 rounded-md border bg-background px-2 text-xs"
              placeholder="Note de décision (optionnelle)"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        )}
      </CardContent>
    </Card>
  );
}

const EditorialRecommendationsTab = () => {
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const { data: recommendations, isLoading, error } = useEditorialRecommendations(statusFilter);
  const runEngine = useRunEditorialEngine();

  const launch = async () => {
    try {
      const res = await runEngine.mutateAsync({ limit: 10 });
      const created = res.results.filter((r) => r.status === "créée").length;
      toast.success(
        `Analyse terminée : ${created} recommandation(s) créée(s) sur ${res.processed} signal(aux) analysé(s)` +
        (res.remaining > 0 ? ` — ${res.remaining} restant(s), relancez pour continuer.` : "."),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Erreur lors de l'analyse");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={statusFilter}
          onValueChange={(v) => { if (v) setStatusFilter(v); }}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="pending">À arbitrer</ToggleGroupItem>
          <ToggleGroupItem value="accepted">Acceptées</ToggleGroupItem>
          <ToggleGroupItem value="discuss">En discussion</ToggleGroupItem>
          <ToggleGroupItem value="rejected">Refusées</ToggleGroupItem>
          <ToggleGroupItem value="all">Toutes</ToggleGroupItem>
        </ToggleGroup>
        <Button onClick={launch} disabled={runEngine.isPending} className="gap-1.5">
          {runEngine.isPending
            ? <RefreshCw className="h-4 w-4 animate-spin" />
            : <Sparkles className="h-4 w-4" />}
          {runEngine.isPending ? "Analyse en cours…" : "Lancer l'analyse éditoriale"}
        </Button>
      </div>

      <p className="text-xs text-muted-foreground">
        Le moteur croise les transcripts exploitables et les feedbacks de formation avec les articles publiés,
        les statistiques (Search Console, site, newsletter), les OKR et les sessions programmées.
        L'IA recommande, la décision finale reste humaine. Une analyse automatique tourne chaque lundi matin.
      </p>

      {isLoading ? (
        <div className="flex justify-center py-12"><Spinner size="lg" className="text-primary" /></div>
      ) : error ? (
        <p className="text-sm text-destructive">Erreur de chargement : {(error as Error).message}</p>
      ) : !recommendations?.length ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Aucune recommandation {statusFilter !== "all" ? `« ${STATUS_LABELS[statusFilter] ?? statusFilter} »` : ""} pour le moment.
            Lancez l'analyse pour traiter les signaux en attente.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {recommendations.map((rec) => <RecommendationCard key={rec.id} rec={rec} />)}
        </div>
      )}
    </div>
  );
};

export default EditorialRecommendationsTab;
