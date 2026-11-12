import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

export interface FormulaAlertTraining {
  id: string;
  training_name: string;
  catalog_id: string | null;
  start_date: string | null;
  is_cancelled: boolean | null;
  format_formation: string | null;
  session_type: string | null;
  assigned_to: string | null;
}

interface ShopFormula {
  id: string;
  formation_config_id: string;
  woocommerce_product_id: number | null;
}

export function findTrainingFormulaIssues(
  trainings: FormulaAlertTraining[],
  formulas: ShopFormula[],
  links: { training_id: string; formula_id: string }[],
  today: string,
): FormulaAlertTraining[] {
  return trainings.filter((training) => {
    if (training.is_cancelled || !training.start_date || training.start_date < today) return false;
    if (training.format_formation === "e_learning") return false;
    if (training.format_formation !== "inter-entreprises" && training.session_type !== "inter") return false;
    const shopFormulas = formulas.filter((f) => f.formation_config_id === training.catalog_id && f.woocommerce_product_id);
    return shopFormulas.length > 0 && !links.some((link) =>
      link.training_id === training.id && shopFormulas.some((formula) => formula.id === link.formula_id)
    );
  });
}

export async function fetchTrainingFormulaIssues(supabase: SupabaseClient, today: string) {
  const [trainings, formulas, links] = await Promise.all([
    supabase.from("trainings")
      .select("id, training_name, catalog_id, start_date, is_cancelled, format_formation, session_type, assigned_to")
      .gte("start_date", today),
    supabase.from("formation_formulas").select("id, formation_config_id, woocommerce_product_id")
      .not("woocommerce_product_id", "is", null),
    supabase.from("training_formulas").select("training_id, formula_id"),
  ]);
  const error = trainings.error || formulas.error || links.error;
  if (error) throw error;
  return findTrainingFormulaIssues(trainings.data || [], formulas.data || [], links.data || [], today);
}

export function trainingFormulaAlertRecipients(
  training: FormulaAlertTraining,
  recipients: { userId: string; isAdmin: boolean }[],
  formationUserIds: Set<string>,
): string[] {
  return recipients.filter((r) => r.isAdmin ||
    (r.userId === training.assigned_to && formationUserIds.has(r.userId))
  ).map((r) => r.userId);
}