import { supabase } from "@/integrations/supabase/client";
import { soloFormulaValues } from "@/lib/permanentTraining";
import type { FormationFormula } from "@/types/training";

export async function fetchAssignedCourseIds(): Promise<string[]> {
  const { data, error } = await supabase.from("trainings").select("supports_lms_course_id").not("supports_lms_course_id", "is", null);
  if (error) throw error;
  return (data ?? []).flatMap(row => row.supports_lms_course_id ? [row.supports_lms_course_id] : []);
}

export async function createSoloFormula(catalogId: string): Promise<FormationFormula[]> {
  const { data: existing, error: readError } = await supabase.from("formation_formulas").select("*").eq("formation_config_id", catalogId).order("display_order");
  if (readError) throw readError;
  if (existing?.length) return existing;
  const { data: config, error: configError } = await supabase.from("formation_configs")
    .select("id, duree_heures, prix, elearning_access_email_content, supports_url, woocommerce_product_id, learndash_course_id").eq("id", catalogId).single();
  if (configError) throw configError;
  const { data, error } = await supabase.from("formation_formulas").insert(soloFormulaValues(config)).select("*").single();
  if (error) throw error;
  return [data];
}