import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getAppUrls } from "./app-urls.ts";

/**
 * Lien de réinitialisation de mot de passe, construit uniquement depuis
 * app_settings.app_url. Aucune URL de redirection n'est acceptée en paramètre :
 * une URL venue de la requête enverrait le token_hash sur un domaine tiers
 * (prise de compte par simple demande de réinitialisation).
 *
 * RG-21 : jamais l'action_link (auth/v1/verify) dans l'email, un GET sur cette
 * URL consomme le jeton. Le lien porte le seul token_hash, consommé au clic
 * par ConnexionReinitialisation.tsx.
 *
 * Renvoie null si aucun jeton n'a pu être généré (adresse inconnue comprise).
 */
export async function passwordResetLink(
  admin: SupabaseClient,
  email: string,
): Promise<string | null> {
  const urls = await getAppUrls();
  const resetPage = `${urls.app_url}/connexion/reinitialisation`;
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email,
    options: { redirectTo: resetPage },
  });
  if (error || !data?.properties?.hashed_token) return null;
  return `${resetPage}?token_hash=${encodeURIComponent(data.properties.hashed_token)}&type=recovery`;
}
