import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { hasManagedCronCredential } from "../_shared/cron-auth.ts";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { isResourceLimit, RESOURCE_ALERT_THRESHOLD } from "../_shared/backup-relay.ts";



/** Compte l'interruption sur le run en cours ; null si aucun run n'est en cours. */
async function recordResourceInterruption(client: any, detail: string): Promise<number | null> {
  const { data: run } = await client.from("backup_runs").select("id, totals, errors").eq("status", "running")
    .order("started_at", { ascending: false }).limit(1).maybeSingle();
  if (!run) return null;
  const n = Number(run.totals?.relayResourceInterruptions ?? 0) + 1;
  const errors = [...(run.errors ?? []).filter((e: string) => !e.startsWith("[Relais]")),
    `[Relais] ${n} passage(s) interrompu(s) faute de ressources, repris automatiquement au curseur (dernier : ${detail.slice(0, 120)})`];
  await client.from("backup_runs").update({ totals: { ...(run.totals ?? {}), relayResourceInterruptions: n }, errors }).eq("id", run.id);
  return n;
}

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;
  if (!(await hasManagedCronCredential(req))) return createErrorResponse("Unauthorized", 401);
  if (req.method !== "POST") return createErrorResponse("Method not allowed", 405);

  try {
    const body = await req.json();
    if (!body || body.mode !== "tick" || Object.keys(body).length !== 1) {
      return createErrorResponse("Seul le mode tick est autorisé", 400);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) return createErrorResponse("Configuration de sauvegarde indisponible", 500);
    const client = createClient(url, key);
    const invoke = async () => {
      const { data, error } = await client.functions.invoke("scheduled-backup", { body: { mode: "tick" } });
      if (!error) return { data, detail: null as string | null, resource: false };
      const ctx = (error as { context?: Response }).context;
      let detail = error.message;
      if (ctx && typeof ctx.text === "function") {
        const text = await ctx.text().catch(() => "");
        detail = `HTTP ${ctx.status}${text ? ` : ${text.slice(0, 500)}` : ""}`;
      }
      return { data: null, detail, resource: isResourceLimit(detail) };
    };
    // Retry contrôlé : pas de nouvel essai immédiat (le run est encore verrouillé) ;
    // le passage suivant, deux minutes plus tard, reprend au curseur enregistré.
    const attempt = await invoke();
    const { data } = attempt;
    if (attempt.detail) {
      const detail = attempt.detail;
      if (attempt.resource) {
        // Le run reprend à son curseur au tick suivant : on le trace sur le run
        // et on n'alerte que si les interruptions se répètent.
        const n = await recordResourceInterruption(client, detail);
        if (n !== null && n < RESOURCE_ALERT_THRESHOLD) {
          console.warn(`[backup-managed-tick] Interruption ressources n°${n}, reprise au prochain passage`);
          return createJsonResponse({ resourceLimit: true, interruptions: n, willResume: true });
        }
      }
      const message = `Échec du relais de sauvegarde (scheduled-backup ${detail})`;
      console.error(`[backup-managed-tick] ${message}`);
      return createErrorResponse(message, 502, { cause: new Error(message), fn: "backup-managed-tick" });
    }
    console.log("[backup-managed-tick]", JSON.stringify(data));
    return createJsonResponse(data);
  } catch {
    return createErrorResponse("Requête de sauvegarde invalide", 400);
  }
});