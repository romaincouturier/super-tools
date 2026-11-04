/**
 * Suites à donner aux retours après formation, pour les actions du jour (catégorie suites_retours).
 * Une suite reste ouverte tant que follow_up_done_at est vide ; cocher l'action le pose
 * (trigger trg_daily_actions_follow_up_done).
 */

/** Besoins du questionnaire à froid participant. Aligné sur BESOINS de src/lib/coldEvaluationOptions.ts (vérifié par test). */
export const COLD_NEED_LABELS: Record<string, string> = {
  acces_elearning: "Revoir le parcours en ligne",
  seance_suivi: "Une séance de suivi individuel",
  ressources: "Des ressources complémentaires",
  formation_complementaire: "Une formation pour aller plus loin",
};

export interface ColdNeedRow {
  id: string;
  training_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  besoins_complementaires: string[] | null;
  trainings?: { training_name: string | null } | null;
}

export interface FeedbackFollowUpRow {
  id: string;
  training_id: string;
  author_name: string | null;
  follow_up: string | null;
  trainings?: { training_name: string | null } | null;
}

export interface FollowUpAction {
  category: "suites_retours";
  title: string;
  description: string;
  link: string;
  entityType: "participant_cold_evaluation" | "training_feedback";
  entityId: string;
  scope: "global";
}

export function buildFollowUpActions(cold: ColdNeedRow[], feedbacks: FeedbackFollowUpRow[], appUrl: string): FollowUpAction[] {
  const actions: FollowUpAction[] = [];
  for (const e of cold) {
    const needs = (e.besoins_complementaires || []).filter((b) => b !== "aucun").map((b) => COLD_NEED_LABELS[b] || b);
    if (needs.length === 0) continue;
    const who = [e.first_name, e.last_name].filter(Boolean).join(" ") || e.email || "Un participant";
    actions.push({
      category: "suites_retours",
      title: `${who} — ${e.trainings?.training_name || "Formation"}`,
      description: `Demande après la formation : ${needs.join(", ")}`,
      link: `${appUrl}/formations/${e.training_id}`,
      entityType: "participant_cold_evaluation",
      entityId: e.id,
      scope: "global",
    });
  }
  for (const f of feedbacks) {
    const todo = f.follow_up?.trim();
    if (!todo) continue;
    actions.push({
      category: "suites_retours",
      title: `${f.author_name || "Retour"} — ${f.trainings?.training_name || "Formation"}`,
      description: todo,
      link: `${appUrl}/formations/${f.training_id}`,
      entityType: "training_feedback",
      entityId: f.id,
      scope: "global",
    });
  }
  return actions;
}
