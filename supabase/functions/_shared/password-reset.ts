import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getAppUrls } from "./app-urls.ts";

/** Lien envoyé dans les mails d'accès apprenant (création du mot de passe). */
export const SETUP_LINK_TTL_HOURS = 24;
/** Lien redemandé (mot de passe oublié, lien expiré). */
export const RESET_LINK_TTL_HOURS = 24;

export type PasswordLinkState = "valid" | "expired" | "used";

/** Pur : état d'un lien SuperTools à l'instant `now`. */
export function passwordLinkState(row: { expires_at: string; used_at: string | null }, now: Date = new Date()): PasswordLinkState {
  if (row.used_at) return "used";
  return new Date(row.expires_at).getTime() <= now.getTime() ? "expired" : "valid";
}

export async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

/**
 * Lien de création / réinitialisation de mot de passe, construit uniquement
 * depuis app_settings.app_url (aucune URL de redirection acceptée en paramètre).
 *
 * Le jeton de connexion natif ne vit qu'une heure : le mail porte donc un jeton
 * SuperTools (`?link=`), haché en base avec sa propre échéance. Le jeton natif
 * n'est généré qu'au clic « Continuer » par `redeem-password-link` (RG-21 :
 * rien n'est consommé à l'ouverture de la page, les scanners restent sans effet).
 *
 * Renvoie null si l'adresse ne correspond à aucun compte.
 */
export async function passwordResetLink(
  admin: SupabaseClient,
  email: string,
  strict = false,
  ttlHours: number = RESET_LINK_TTL_HOURS,
): Promise<string | null> {
  const urls = await getAppUrls();
  const resetPage = `${urls.app_url}/connexion/reinitialisation`;
  const normalized = email.trim().toLowerCase();
  // Vérifie que le compte existe (même comportement qu'avant pour les adresses inconnues).
  const { data, error } = await admin.auth.admin.generateLink({
    type: "recovery",
    email: normalized,
    options: { redirectTo: resetPage },
  });
  if (error || !data?.properties?.hashed_token) {
    if (strict) throw new Error(`Génération du lien de création de mot de passe impossible (${error?.code ?? "jeton absent"}, statut ${error?.status ?? "inconnu"}). Aucun email envoyé.`);
    return null;
  }
  const token = `${crypto.randomUUID()}${crypto.randomUUID()}`.replace(/-/g, "");
  const { error: insertError } = await admin.from("password_setup_links").insert({
    token_hash: await sha256Hex(token),
    email: normalized,
    expires_at: new Date(Date.now() + ttlHours * 3600_000).toISOString(),
  });
  if (insertError) {
    if (strict) throw new Error(`Enregistrement du lien de création de mot de passe impossible. Aucun email envoyé.`);
    return null;
  }
  return `${resetPage}?link=${token}`;
}
