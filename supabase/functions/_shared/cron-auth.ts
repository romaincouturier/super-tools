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
 */
export function isInternalCall(req: Request, secretEnvName = "CRON_SECRET"): boolean {
  const cronSecret = Deno.env.get(secretEnvName) ?? "";
  if (cronSecret !== "" && req.headers.get("x-cron-secret") === cronSecret) {
    return true;
  }

  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  return serviceRole !== "" && req.headers.get("x-internal-secret") === serviceRole;
}
