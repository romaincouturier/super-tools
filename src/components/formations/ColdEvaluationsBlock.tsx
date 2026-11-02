import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertTriangle, ChevronDown, ChevronUp, Lightbulb, Snowflake } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import {
  BESOINS,
  FREINS,
  FREQUENCE_UTILISATION,
  MISE_EN_PRATIQUE,
  OBJECTIFS_ATTEINTS,
  RECOMMANDATION,
  labelOf,
} from "@/lib/coldEvaluationOptions";

interface Props {
  /** Omit to list every session (Qualité overview). */
  trainingId?: string;
}

interface Row {
  id: string;
  kind: "participant" | "commanditaire";
  trainingId: string;
  trainingName: string;
  who: string;
  etat: string;
  sentAt: string | null;
  openedAt: string | null;
  remindedAt: string | null;
  submittedAt: string | null;
  answers: { label: string; value: string }[];
  improvementText: string;
}

interface Blocked {
  id: string;
  trainingId: string;
  trainingName: string;
  type: string;
  error: string;
}

const fmt = (d: string | null) => (d ? new Date(d).toLocaleDateString("fr-FR", { timeZone: "Europe/Paris" }) : "");
const listLabels = (opts: { value: string; label: string }[], values: string[] | null) =>
  (values || []).map((v) => labelOf(opts, v)).join(", ");

const statusBadge = (r: Row) => {
  if (r.submittedAt) return <Badge>Soumise le {fmt(r.submittedAt)}</Badge>;
  if (r.openedAt) return <Badge variant="secondary">Ouverte le {fmt(r.openedAt)}</Badge>;
  return <Badge variant="outline">Envoyée le {fmt(r.sentAt)}</Badge>;
};

const ColdEvaluationsBlock = ({ trainingId }: Props) => {
  const { toast } = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [blocked, setBlocked] = useState<Blocked[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(!trainingId);
  const [expanded, setExpanded] = useState<string | null>(null);

  const load = useCallback(async () => {
    const db = supabase as any;
    let sq = db.from("sponsor_cold_evaluations").select("*, trainings(training_name)").order("date_envoi", { ascending: false }).limit(300);
    let pq = db.from("participant_cold_evaluations").select("*, trainings(training_name)").order("date_envoi", { ascending: false }).limit(300);
    let bq = db
      .from("scheduled_emails")
      .select("id, training_id, email_type, error_message, trainings(training_name)")
      .eq("status", "pending")
      .in("email_type", ["cold_evaluation", "cold_evaluation_reminder", "participant_cold_evaluation", "participant_cold_evaluation_reminder"])
      .not("error_message", "is", null);
    if (trainingId) {
      sq = sq.eq("training_id", trainingId);
      pq = pq.eq("training_id", trainingId);
      bq = bq.eq("training_id", trainingId);
    }
    const [{ data: s }, { data: p }, { data: b }] = await Promise.all([sq, pq, bq]);

    const sponsorRows: Row[] = (s || []).map((e: any) => ({
      id: e.id,
      kind: "commanditaire",
      trainingId: e.training_id,
      trainingName: e.trainings?.training_name || e.training_name || "",
      who: [e.sponsor_name, e.company].filter(Boolean).join(" · ") || e.sponsor_email,
      etat: e.etat,
      sentAt: e.date_envoi,
      openedAt: e.date_premiere_ouverture,
      remindedAt: e.date_relance,
      submittedAt: e.date_soumission,
      answers: [
        { label: "Satisfaction globale", value: e.satisfaction_globale ? `${e.satisfaction_globale}/5` : "" },
        { label: "Attentes satisfaites", value: e.attentes_satisfaites || "" },
        { label: "Objectifs atteints", value: e.objectifs_atteints || "" },
        { label: "Impact sur les compétences", value: e.impact_competences || "" },
        { label: "Description de l'impact", value: e.description_impact || "" },
        { label: "Recommandation", value: labelOf(RECOMMANDATION, e.recommandation) },
        { label: "Points forts", value: e.points_forts || "" },
        { label: "Axes d'amélioration", value: e.axes_amelioration || "" },
        { label: "Commentaires", value: e.commentaires_libres || "" },
        { label: "Témoignage", value: e.message_recommandation ? `${e.message_recommandation}${e.consent_publication ? " (publication acceptée)" : " (publication non acceptée)"}` : "" },
      ].filter((a) => a.value),
      improvementText: [e.axes_amelioration, e.commentaires_libres].filter(Boolean).join("\n"),
    }));

    const participantRows: Row[] = (p || []).map((e: any) => ({
      id: e.id,
      kind: "participant",
      trainingId: e.training_id,
      trainingName: e.trainings?.training_name || e.training_name || "",
      who: [[e.first_name, e.last_name].filter(Boolean).join(" "), e.company].filter(Boolean).join(" · ") || e.email,
      etat: e.etat,
      sentAt: e.date_envoi,
      openedAt: e.date_premiere_ouverture,
      remindedAt: e.date_relance,
      submittedAt: e.date_soumission,
      answers: [
        { label: "Mise en pratique", value: labelOf(MISE_EN_PRATIQUE, e.mise_en_pratique) },
        { label: "Fréquence", value: labelOf(FREQUENCE_UTILISATION, e.frequence_utilisation) },
        { label: "Exemple", value: e.exemple_application || "" },
        { label: "Aisance aujourd'hui", value: e.niveau_maitrise ? `${e.niveau_maitrise}/5` : "" },
        { label: "Freins", value: [listLabels(FREINS, e.freins), e.freins_details].filter(Boolean).join(" · ") },
        { label: "Effets constatés", value: e.effets_constates || "" },
        { label: "Objectifs atteints", value: labelOf(OBJECTIFS_ATTEINTS, e.objectifs_atteints) },
        { label: "Besoins", value: listLabels(BESOINS, e.besoins_complementaires) },
        { label: "Recommandation", value: labelOf(RECOMMANDATION, e.recommandation) },
        { label: "Témoignage", value: e.temoignage ? `${e.temoignage}${e.consent_publication ? " (publication acceptée)" : " (publication non acceptée)"}` : "" },
        { label: "Commentaires", value: e.commentaires_libres || "" },
      ].filter((a) => a.value),
      improvementText: [
        e.freins?.length ? `Freins : ${listLabels(FREINS, e.freins)}` : "",
        e.freins_details,
        e.besoins_complementaires?.length ? `Besoins : ${listLabels(BESOINS, e.besoins_complementaires)}` : "",
        e.commentaires_libres,
      ].filter(Boolean).join("\n"),
    }));

    setRows([...sponsorRows, ...participantRows].sort((a, b) => (b.sentAt || "").localeCompare(a.sentAt || "")));
    setBlocked((b || []).map((e: any) => ({
      id: e.id,
      trainingId: e.training_id,
      trainingName: e.trainings?.training_name || "",
      type: e.email_type.startsWith("participant") ? "participant" : "commanditaire",
      error: e.error_message,
    })));
    setLoading(false);
  }, [trainingId]);

  useEffect(() => { load(); }, [load]);

  const createImprovement = async (r: Row) => {
    const { error } = await (supabase as any).from("improvements").insert({
      training_id: r.trainingId,
      title: `Évaluation à froid ${r.kind} : ${r.trainingName}`,
      description: r.improvementText || "Retour de l'évaluation à froid à analyser.",
      category: "recommendation",
      source_type: "evaluation",
      source_id: r.id,
      source_description: `Évaluation à froid ${r.kind} de ${r.who}, soumise le ${fmt(r.submittedAt)}`,
    });
    if (error) {
      toast({ title: "Erreur", description: "L'action d'amélioration n'a pas pu être créée.", variant: "destructive" });
      return;
    }
    toast({ title: "Action d'amélioration créée", description: "Elle apparaît dans le plan d'amélioration." });
  };

  if (loading) return null;

  const submitted = rows.filter((r) => r.submittedAt).length;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CardHeader className="pb-3">
          <CollapsibleTrigger asChild>
            <button className="flex items-center justify-between w-full text-left">
              <CardTitle className="flex items-center gap-2 text-base">
                <Snowflake className="h-5 w-5" />
                Évaluations à froid
                <Badge variant="secondary" className="ml-1">{submitted}/{rows.length}</Badge>
                {blocked.length > 0 && <Badge variant="destructive">{blocked.length} non envoyée{blocked.length > 1 ? "s" : ""}</Badge>}
              </CardTitle>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>
          </CollapsibleTrigger>
        </CardHeader>
        <CollapsibleContent>
          <CardContent className="pt-0 space-y-3">
            {blocked.map((b) => (
              <div key={b.id} className="flex items-start gap-2 rounded-md border border-destructive/40 bg-destructive/5 p-3 text-sm">
                <AlertTriangle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
                <div>
                  <p className="font-medium">
                    Évaluation {b.type} non envoyée
                    {!trainingId && <> · <Link className="underline" to={`/formations/${b.trainingId}`}>{b.trainingName}</Link></>}
                  </p>
                  <p className="text-muted-foreground">{b.error}</p>
                </div>
              </div>
            ))}
            {rows.length === 0 && blocked.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-2">Aucune évaluation à froid envoyée pour l'instant.</p>
            )}
            {rows.map((r) => (
              <div key={`${r.kind}-${r.id}`} className="rounded-md border p-3 text-sm space-y-2">
                <div className="flex flex-wrap items-center gap-2 justify-between">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{r.kind === "participant" ? "Participant" : "Commanditaire"}</Badge>
                    <span className="font-medium">{r.who}</span>
                    {!trainingId && <Link className="text-muted-foreground underline" to={`/formations/${r.trainingId}`}>{r.trainingName}</Link>}
                  </div>
                  <div className="flex items-center gap-2">
                    {statusBadge(r)}
                    {r.remindedAt && !r.submittedAt && <span className="text-xs text-muted-foreground">Relancée le {fmt(r.remindedAt)}</span>}
                  </div>
                </div>
                {r.submittedAt && (
                  <div className="flex gap-2">
                    <Button size="sm" variant="ghost" onClick={() => setExpanded(expanded === r.id ? null : r.id)}>
                      {expanded === r.id ? "Masquer les réponses" : "Voir les réponses"}
                    </Button>
                    <Button size="sm" variant="outline" onClick={() => createImprovement(r)}>
                      <Lightbulb className="h-4 w-4 mr-1" />Créer une action d'amélioration
                    </Button>
                  </div>
                )}
                {expanded === r.id && (
                  <dl className="grid gap-1">
                    {r.answers.map((a) => (
                      <div key={a.label} className="grid grid-cols-1 sm:grid-cols-[180px_1fr] gap-1">
                        <dt className="text-muted-foreground">{a.label}</dt>
                        <dd className="whitespace-pre-wrap">{a.value}</dd>
                      </div>
                    ))}
                  </dl>
                )}
              </div>
            ))}
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
};

export default ColdEvaluationsBlock;
