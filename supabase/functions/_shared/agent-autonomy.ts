import { getSupabaseClient } from "./mod.ts";

/**
 * Couche d'autonomie de l'agent : ce qu'il a le droit de faire seul, ce qu'il
 * a fait, et comment le défaire.
 *
 * Trois garde-fous, dans cet ordre :
 *   1. `resolveAutonomy` lit la politique en base plutôt qu'une règle figée
 *      dans le prompt. Une action inconnue est traitée comme `confirm` :
 *      l'absence de décision n'autorise rien.
 *   2. `logAction` enregistre l'état AVANT et APRÈS chaque écriture autonome.
 *      Sans l'état antérieur, une annulation devrait deviner.
 *   3. `revertAction` remet la ligne dans son état antérieur.
 */

type Supabase = ReturnType<typeof getSupabaseClient>;

export type AutonomyLevel = "auto" | "notify" | "confirm";

export interface ActionRecord {
  objectiveId?: string | null;
  domain?: string | null;
  action: string;
  targetTable?: string | null;
  targetId?: string | null;
  beforeState?: Record<string, unknown> | null;
  afterState?: Record<string, unknown> | null;
  rationale?: string | null;
  autonomyLevel?: AutonomyLevel;
  succeeded?: boolean;
  errorMessage?: string | null;
}

/**
 * Niveau d'autonomie d'une action. Défaut volontairement restrictif : une
 * action absente de la politique n'a jamais été autorisée par personne.
 */
export async function resolveAutonomy(
  supabase: Supabase,
  action: string,
): Promise<AutonomyLevel> {
  const { data } = await supabase
    .from("agent_autonomy_policy")
    .select("level")
    .eq("action", action)
    .maybeSingle();
  const level = (data as { level?: string } | null)?.level;
  return level === "auto" || level === "notify" ? level : "confirm";
}

export async function logAction(supabase: Supabase, record: ActionRecord): Promise<string | null> {
  const { data, error } = await supabase
    .from("agent_action_log")
    .insert({
      objective_id: record.objectiveId ?? null,
      domain: record.domain ?? null,
      action: record.action,
      target_table: record.targetTable ?? null,
      target_id: record.targetId ?? null,
      before_state: record.beforeState ?? null,
      after_state: record.afterState ?? null,
      rationale: record.rationale ?? null,
      autonomy_level: record.autonomyLevel ?? "auto",
      succeeded: record.succeeded ?? true,
      error_message: record.errorMessage ?? null,
    })
    .select("id")
    .maybeSingle();
  if (error) {
    // Une écriture non journalisée est pire qu'une écriture manquée : on le
    // signale dans les logs sans faire échouer l'action elle-même.
    console.error("agent_action_log insert failed:", error.message);
    return null;
  }
  return (data as { id?: string } | null)?.id ?? null;
}

/**
 * Écrit sur une table en relisant avant et après, et journalise le tout.
 * La relecture n'est pas cosmétique : une mise à jour Supabase visant un id
 * inexistant ne lève aucune erreur et ne touche aucune ligne.
 */
export async function writeAndLog(
  supabase: Supabase,
  opts: {
    table: string;
    id: string;
    updates: Record<string, unknown>;
    action: string;
    domain?: string;
    objectiveId?: string | null;
    rationale?: string;
    columns?: string;
  },
): Promise<{ ok: boolean; message: string; row?: Record<string, unknown> }> {
  const level = await resolveAutonomy(supabase, opts.action);
  if (level === "confirm") {
    return {
      ok: false,
      message: `Action « ${opts.action} » soumise à confirmation par la politique d'autonomie : non exécutée automatiquement.`,
    };
  }

  const columns = opts.columns ?? "*";
  const { data: before } = await supabase
    .from(opts.table)
    .select(columns)
    .eq("id", opts.id)
    .maybeSingle();

  if (!before) {
    await logAction(supabase, {
      ...opts,
      objectiveId: opts.objectiveId,
      targetTable: opts.table,
      targetId: opts.id,
      autonomyLevel: level,
      succeeded: false,
      errorMessage: "Ligne introuvable",
    });
    return { ok: false, message: `Aucune ligne ${opts.table} avec l'id ${opts.id}.` };
  }

  const { error } = await supabase.from(opts.table).update(opts.updates).eq("id", opts.id);
  if (error) {
    await logAction(supabase, {
      ...opts,
      targetTable: opts.table,
      targetId: opts.id,
      beforeState: before as Record<string, unknown>,
      autonomyLevel: level,
      succeeded: false,
      errorMessage: error.message,
    });
    return { ok: false, message: error.message };
  }

  const { data: after } = await supabase
    .from(opts.table)
    .select(columns)
    .eq("id", opts.id)
    .maybeSingle();

  await logAction(supabase, {
    ...opts,
    targetTable: opts.table,
    targetId: opts.id,
    beforeState: before as Record<string, unknown>,
    afterState: (after ?? null) as Record<string, unknown> | null,
    autonomyLevel: level,
  });

  return { ok: true, message: `${opts.action} exécutée`, row: (after ?? undefined) as Record<string, unknown> };
}

/**
 * Annule une action journalisée en réécrivant l'état antérieur.
 * Les créations (pas d'état antérieur) ne sont pas annulables ici : les
 * supprimer demanderait un droit de suppression que l'agent n'a pas.
 */
export async function revertAction(
  supabase: Supabase,
  actionId: string,
  userId?: string | null,
): Promise<{ ok: boolean; message: string }> {
  const { data: entry } = await supabase
    .from("agent_action_log")
    .select("id, target_table, target_id, before_state, reverted_at")
    .eq("id", actionId)
    .maybeSingle();

  if (!entry) return { ok: false, message: "Action introuvable" };
  if (entry.reverted_at) return { ok: false, message: "Action déjà annulée" };

  const before = entry.before_state as Record<string, unknown> | null;
  if (!before || !entry.target_table || !entry.target_id) {
    return {
      ok: false,
      message:
        "Cette action n'a pas d'état antérieur (création de contenu) : la supprimer relève de l'application, pas de l'agent.",
    };
  }

  // `id` et les horodatages de création ne se réécrivent pas.
  const restore = { ...before };
  delete restore.id;
  delete restore.created_at;

  const { error } = await supabase
    .from(entry.target_table as string)
    .update(restore)
    .eq("id", entry.target_id);
  if (error) return { ok: false, message: error.message };

  await supabase
    .from("agent_action_log")
    .update({ reverted_at: new Date().toISOString(), reverted_by: userId ?? null })
    .eq("id", actionId);

  return { ok: true, message: "Action annulée, état antérieur rétabli" };
}

// ── AG-12 : mémoire longue ───────────────────────────────────

/** Nombre d'entrées injectées dans le prompt. Une mémoire non bornée dilue. */
const MEMORY_MAX_ENTRIES = 40;

export async function loadMemory(supabase: Supabase): Promise<string> {
  const { data } = await supabase
    .from("agent_memory")
    .select("key, value, kind, confirmed_at, expires_at")
    .order("confirmed_at", { ascending: false })
    .limit(MEMORY_MAX_ENTRIES);

  const now = Date.now();
  const live = (data || []).filter(
    (m: Record<string, unknown>) =>
      !m.expires_at || new Date(m.expires_at as string).getTime() > now,
  );
  if (!live.length) return "";

  return live
    .map((m: Record<string, unknown>) => `- [${m.kind}] ${m.key} : ${m.value}`)
    .join("\n");
}

/** Enregistre ou remplace un fait. La clé unique évite d'empiler des doublons. */
export async function rememberFact(
  supabase: Supabase,
  key: string,
  value: string,
  kind: string,
  userId?: string | null,
): Promise<string> {
  const validKind = ["fait", "preference", "contexte"].includes(kind) ? kind : "fait";
  // Un contexte est périssable par nature : 90 jours, puis il cesse d'être injecté.
  const expiresAt =
    validKind === "contexte"
      ? new Date(Date.now() + 90 * 24 * 3600 * 1000).toISOString()
      : null;

  const { error } = await supabase.from("agent_memory").upsert(
    {
      key: key.slice(0, 120),
      value: value.slice(0, 2000),
      kind: validKind,
      confirmed_at: new Date().toISOString(),
      expires_at: expiresAt,
      created_by: userId ?? null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "key" },
  );
  if (error) throw new Error(error.message);
  return JSON.stringify({ remembered: true, key, kind: validKind });
}
