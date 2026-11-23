import { supabase } from "@/integrations/supabase/client";

/** Marque le commentaire d'une évaluation comme publié sur le site (clôt l'action quotidienne liée). */
export async function markSiteCommentPublished(evaluationId: string): Promise<string> {
  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError) throw authError;
  if (!user) throw new Error("Connexion requise pour marquer un avis comme publié");

  const { data, error } = await supabase
    .from("training_evaluations")
    .update({ site_comment_published_at: new Date().toISOString(), site_comment_published_by: user.id })
    .eq("id", evaluationId)
    .is("site_comment_published_at", null)
    .select("site_comment_published_at")
    .single();
  if (error) throw error;
  return data.site_comment_published_at;
}
