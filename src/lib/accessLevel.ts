import { supabase } from "@/integrations/supabase/client";

export type AccessLevel = "staff" | "learner" | "none";

/**
 * Niveau d'accès du compte connecté, résolu côté serveur.
 *
 * Repli si la fonction n'est pas encore déployée : on retombe sur la règle
 * précédente, un profil dans le back-office fait le staff, tout autre compte
 * authentifié est un apprenant. Sans ce repli, un déploiement du front avant
 * celui de la base enverrait tout le monde sur l'écran "compte sans accès".
 */
export async function fetchAccessLevel(userId: string): Promise<AccessLevel> {
  const { data, error } = await supabase.rpc("current_user_access_level");
  if (!error && (data === "staff" || data === "learner" || data === "none")) {
    return data;
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  return profile ? "staff" : "learner";
}
