import { timingSafeEqualSecret } from "./crypto.ts";

/**
 * Authentification des appels automatiques d'une edge function (règle [036]).
 *
 * Deux voies, aucune ne passant par le vault (vide sur ce projet) :
 *   - `x-cron-secret` comparé à un secret d'edge function, posé inline dans le
 *     SQL du cron planifié en base ;
 *   - `x-internal-secret` comparé à la service_role, pour un appel d'une edge
 *     function à une autre.
 *
 * Un secret absent ne vaut jamais autorisation : sans secret configuré, la
 * voie correspondante est simplement fermée et l'appelant doit présenter un
 * JWT. C'est l'inverse du garde qu'on trouve dans les fonctions plus
 * anciennes, où l'absence d'en-tête laissait passer.
 *
 * Le nom du secret est un paramètre parce qu'un secret se rattache à un
 * domaine, jamais à tout le projet : EDITORIAL_CRON_SECRET, SEO_CRON_SECRET,
 * VEILLE_CRON_SECRET. La valeur est recopiée en clair dans le SQL de chaque
 * cron, donc un secret partagé ne peut pas être remplacé sans casser, en
 * silence et en 401, tous les crons qui portent encore l'ancienne valeur.
 */
export function isInternalCall(req: Request, secretEnvName = "CRON_SECRET"): boolean {
  const cronSecret = Deno.env.get(secretEnvName) ?? "";
  if (cronSecret !== "" && req.headers.get("x-cron-secret") === cronSecret) {
    return true;
  }

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return serviceRole !== "" && req.headers.get("x-internal-secret") === serviceRole;
}

/**
 * Garde pour une fonction verify_jwt=false appelée à la fois par le frontend
 * staff (JWT utilisateur) ET par un cron / une délégation fonction-à-fonction
 * (les deux envoient `Authorization: Bearer <service_role>` ou un secret
 * interne). Renvoie true si l'appel est interne OU authentifié ; ne laisse
 * passer que le trafic non anonyme.
 *
 * NE PAS utiliser sur un flux public tokenisé légitimement anonyme (formulaire
 * de sondage, signature, évaluation) : là, l'anonymat est attendu et le
 * contrôle d'accès passe par un token à usage unique validé en base.
 */
export async function isInternalOrAuthenticated(
  req: Request,
  secretEnvName = "CRON_SECRET",
): Promise<boolean> {
  if (await isInternalOrServiceRole(req, secretEnvName)) return true;

  // Appel frontend authentifié : JWT utilisateur validé via getUser().
  // Import dynamique volontaire : supabase-client.ts importe le SDK depuis une
  // URL esm.sh, non résoluble par le loader Node de vitest. Le garder paresseux
  // permet à cron-auth.test.ts (qui ne teste que isInternalCall) de se charger.
  const { verifyAuth } = await import("./supabase-client.ts");
  const user = await verifyAuth(req.headers.get("Authorization") ?? "");
  return user !== null;
}

/**
 * Garde d'une action réservée au staff : JWT d'un admin, ou d'un utilisateur
 * ayant accès au module indiqué. Un apprenant a lui aussi un JWT valide :
 * `verifyAuth` seul ne suffit donc jamais à ouvrir une action staff.
 */
export async function isStaffCaller(req: Request, module?: string): Promise<boolean> {
  const { verifyAuth, getSupabaseClient } = await import("./supabase-client.ts");
  const user = await verifyAuth(req.headers.get("Authorization") ?? "");
  if (!user) return false;

  const supabase = getSupabaseClient();
  const { data: isAdmin } = await supabase.rpc("is_admin", { _user_id: user.id });
  if (isAdmin === true) return true;
  if (!module) return false;

  const { data: hasAccess } = await supabase.rpc("has_module_access", {
    _user_id: user.id,
    _module: module,
  });
  return hasAccess === true;
}

/**
 * Garde d'une fonction appelée par un cron ou une autre fonction, et
 * déclenchable à la main par un admin (page Monitoring, réglages).
 */
export async function isInternalOrAdmin(
  req: Request,
  secretEnvName = "CRON_SECRET",
): Promise<boolean> {
  if (await isInternalOrServiceRole(req, secretEnvName)) return true;
  return isStaffCaller(req);
}

async function isInternalOrServiceRole(req: Request, secretEnvName: string): Promise<boolean> {
  if (isInternalCall(req, secretEnvName)) return true;

  // Crons pg_cron et délégations envoient le service_role en Bearer. Comparaison
  // à temps constant : ce secret est le plus sensible du système.
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  return serviceRole !== "" && await timingSafeEqualSecret(authHeader, `Bearer ${serviceRole}`);
}
