import { supabase } from "@/integrations/supabase/client";

/** Marque le commentaire d'une évaluation comme publié sur le site (clôt l'action quotidienne liée). */
export async function markSiteCommentPublished(evaluationId: string): Promise<string> {
  const { data: { user } } = await supabase.auth.getUser();
  const now = new Date().toISOString();
  const { error } = await supabase
    .from("training_evaluations")
    .update({ site_comment_published_at: now, site_comment_published_by: user?.id ?? null })
    .eq("id", evaluationId)
    .is("site_comment_published_at", null);
  if (error) throw error;
  return now;
}
