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
  if (isInternalCall(req, secretEnvName)) return true;

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const authHeader = req.headers.get("Authorization") ?? "";
  // Crons pg_cron et délégations envoient le service_role en Bearer. Comparaison
  // à temps constant : ce secret est le plus sensible du système.
  if (serviceRole !== "" && await timingSafeEqualSecret(authHeader, `Bearer ${serviceRole}`)) {
    return true;
  }

  // Appel frontend authentifié : JWT utilisateur validé via getUser().
  // Import dynamique volontaire : supabase-client.ts importe le SDK depuis une
  // URL esm.sh, non résoluble par le loader Node de vitest. Le garder paresseux
  // permet à cron-auth.test.ts (qui ne teste que isInternalCall) de se charger.
  const { verifyAuth } = await import("./supabase-client.ts");
  const user = await verifyAuth(authHeader);
  return user !== null;
}

type StaffLookup = {
  rpc: (fn: string, args: Record<string, unknown>) => PromiseLike<{ data: unknown; error: unknown }>;
  from: (table: string) => {
    select: (cols: string) => {
      eq: (col: string, value: string) => {
        limit: (n: number) => PromiseLike<{ data: unknown[] | null; error: unknown }>;
      };
    };
  };
};

/**
 * Staff = admin (profiles.is_admin) ou au moins une ligne dans
 * user_module_access. Un apprenant a une session et une ligne profiles : ni
 * l'une ni l'autre ne prouve un droit (règle [063]). Une erreur de lecture
 * vaut refus.
 */
export async function isStaffUser(admin: StaffLookup, userId: string): Promise<boolean> {
  const { data: isAdmin, error } = await admin.rpc("is_admin", { _user_id: userId });
  if (!error && isAdmin === true) return true;
  const { data: modules, error: modError } = await admin
    .from("user_module_access")
    .select("module")
    .eq("user_id", userId)
    .limit(1);
  return !modError && Array.isArray(modules) && modules.length > 0;
}

/**
 * Garde staff d'une edge function appelée par le frontend. Renvoie l'appelant
 * (id vérifié par getUser(), jamais lu dans le corps) ou null : l'appelant
 * répond alors 403. Les appels cron / fonction-à-fonction ne passent pas ici,
 * les combiner explicitement avec isInternalCall si besoin.
 */
export async function requireStaff(req: Request): Promise<{ id: string; email?: string } | null> {
  const { verifyAuth, getSupabaseClient } = await import("./supabase-client.ts");
  const user = await verifyAuth(req.headers.get("Authorization"));
  if (!user) return null;
  return (await isStaffUser(getSupabaseClient(), user.id)) ? user : null;
}
