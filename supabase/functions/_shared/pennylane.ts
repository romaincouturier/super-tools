/**
 * Dialogue avec l'API externe Pennylane v2 — exemplaire unique (règle [052]).
 *
 * Tout ce qui est propre au fournisseur vit ici : URL de base, lecture du
 * token, en-têtes, forme des erreurs. `pennylane-proxy` (appelé par le front)
 * et le tool MCP `create_quote` passent tous les deux par ce module, pour
 * qu'un changement côté Pennylane se corrige à un seul endroit.
 */

// deno-lint-ignore no-explicit-any
type Supabase = any;

export const PENNYLANE_BASE = "https://app.pennylane.com/api/external/v2";

/** Réglage général où le token Bearer Pennylane est saisi par l'utilisateur. */
export const PENNYLANE_TOKEN_SETTING = "pennylane_api_token";

/** Délai au-delà duquel un appel Pennylane est abandonné. */
const PENNYLANE_TIMEOUT_MS = 30000;

export type PennylaneResponse = {
  ok: boolean;
  status: number;
  data: unknown;
  /** Corps brut, tronqué — sert à remonter une erreur exploitable telle quelle. */
  raw: string;
};

/**
 * Token Bearer longue durée, stocké dans `app_settings`. Pennylane n'exige pas
 * d'échange OAuth pour l'API externe : le token saisi dans les réglages
 * généraux est envoyé tel quel.
 */
export async function getPennylaneToken(supabase: Supabase): Promise<string> {
  const { data } = await supabase
    .from("app_settings")
    .select("setting_value")
    .eq("setting_key", PENNYLANE_TOKEN_SETTING)
    .maybeSingle();

  const token = (data?.setting_value ?? "").toString().trim();
  if (!token) {
    throw new Error(
      "Token API Pennylane non configuré (Réglages généraux > pennylane_api_token).",
    );
  }
  return token;
}

/**
 * Un appel, une réponse. Jamais de retry ici : `pennylaneFetch` sert aussi aux
 * POST, qui ne sont pas idempotents — rejouer une création de devis après un
 * timeout produit un second devis. L'appelant décide de rejouer, et seulement
 * pour une lecture.
 */
export async function pennylaneFetch(
  token: string,
  method: "GET" | "POST" | "PUT" | "DELETE",
  path: string,
  options: { query?: Record<string, string | number | boolean>; body?: unknown } = {},
): Promise<PennylaneResponse> {
  const url = new URL(`${PENNYLANE_BASE}/${path.replace(/^\/+/, "")}`);
  for (const [k, v] of Object.entries(options.query ?? {})) {
    if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
  }

  const init: RequestInit = {
    method,
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
      "Content-Type": "application/json",
      // Comportement 2026 de l'API (tri décroissant, etc.)
      "X-Use-2026-API-Changes": "true",
    },
    signal: AbortSignal.timeout(PENNYLANE_TIMEOUT_MS),
  };
  if (method !== "GET" && options.body !== undefined) {
    init.body = JSON.stringify(options.body);
  }

  const response = await fetch(url.toString(), init);
  const raw = await response.text();
  let data: unknown = null;
  try {
    data = raw ? JSON.parse(raw) : null;
  } catch {
    data = { raw };
  }

  return { ok: response.ok, status: response.status, data, raw: raw.slice(0, 2000) };
}

/**
 * Message d'erreur exploitable par l'appelant : le statut HTTP, sa traduction
 * en cause probable, et le corps renvoyé par Pennylane tel quel — c'est lui qui
 * nomme le champ refusé sur un 422.
 */
export function pennylaneErrorMessage(res: PennylaneResponse, action: string): string {
  const hint = res.status === 401
    ? "token invalide ou expiré"
    : res.status === 403
    ? "scope insuffisant sur le token (quotes:all requis pour les devis)"
    : res.status === 404
    ? "ressource introuvable"
    : res.status === 422
    ? "payload refusé"
    : res.status === 429
    ? "quota d'appels dépassé"
    : "erreur Pennylane";
  return `${action} : ${hint} (HTTP ${res.status}). Réponse Pennylane : ${res.raw || "(vide)"}`;
}
