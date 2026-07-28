import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";
import { logAction, resolveAutonomy, revertAction, writeAndLog } from "../_shared/agent-autonomy.ts";

/**
 * agent-objectives — l'orchestrateur qui manque à SuperTools.
 *
 * L'application compte déjà 224 edge functions, dont 36 d'analyse ou de
 * génération IA : ce sont autant d'agents à tâche unique. Ce qui manquait
 * n'était pas de l'IA, c'était un chef d'orchestre : quelque chose qui
 * poursuive un but, se déclenche seul, trace ce qu'il fait et permette de
 * défaire.
 *
 * Cette fonction lit les objectifs actifs (`agent_objectives`), fait tourner
 * la routine du métier concerné, journalise (`agent_action_log`) et met à
 * jour l'état de l'objectif.
 *
 * Elle ne décide jamais seule de son droit d'agir : chaque écriture passe par
 * `agent_autonomy_policy`. Une action non déclarée est refusée.
 *
 * Modes :
 *   POST {}                          → fait tourner tous les objectifs dus
 *   POST { objective_id }            → force un objectif précis
 *   POST { domain }                  → tous les objectifs actifs d'un métier
 *   POST { dry_run: true }           → constate sans écrire
 *   POST { revert_action_id }        → annule une action journalisée
 */

type Supabase = ReturnType<typeof getSupabaseClient>;

interface Objective {
  id: string;
  domain: string;
  title: string;
  criterion: string;
  cadence_hours: number;
  last_run_at: string | null;
  run_count: number;
  attempts: unknown;
}

interface DomainResult {
  /** L'objectif est-il atteint au terme de ce passage ? */
  met: boolean;
  /** Résumé destiné au journal et au digest. */
  summary: string;
  /** Détail des constats, pour l'utilisateur. */
  findings: Array<Record<string, unknown>>;
  /** Actions réellement effectuées. */
  actions: number;
}

/** Nombre d'entités traitées par passage, pour rester sous le temps d'exécution. */
const BATCH = 15;

// ── AG-35 : facilitateur ─────────────────────────────────────
//
// Objectif : chaque atelier produit sa synthèse sans intervention.
// Premier métier branché parce que le risque est nul (produit une note,
// n'envoie rien) et que tout le matériel de lecture existe déjà.

async function runFacilitateur(
  supabase: Supabase,
  objective: Objective,
  dryRun: boolean,
): Promise<DomainResult> {
  // Missions récentes portant de la matière d'atelier : photos ou transcript.
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, client_name")
    .neq("status", "cancelled")
    .order("updated_at", { ascending: false })
    .limit(60);

  const findings: Array<Record<string, unknown>> = [];
  let actions = 0;

  for (const mission of (missions || []).slice(0, BATCH) as Array<Record<string, unknown>>) {
    const [{ count: photos }, { data: pages }] = await Promise.all([
      supabase
        .from("media")
        .select("id", { count: "exact", head: true })
        .eq("source_type", "mission")
        .eq("source_id", mission.id),
      supabase
        .from("mission_pages")
        .select("id, title, updated_at")
        .eq("mission_id", mission.id),
    ]);

    const pageRows = (pages || []) as Array<Record<string, unknown>>;
    const hasSynthesis = pageRows.some((p) =>
      /synth|note agent|compte[- ]rendu/i.test((p.title as string) || "")
    );
    if (!photos || hasSynthesis) continue;

    findings.push({
      mission_id: mission.id,
      title: mission.title,
      client: mission.client_name,
      photos,
      gap: "Atelier avec photos, aucune synthèse",
      next: `read_media_image sur les ${photos} photos, puis save_mission_note`,
    });

    // L'agent ne transcrit pas les photos ici : cela demande une passe vision
    // par image, hors budget d'un tick. Il crée la page d'accueil de la
    // synthèse et programme l'action, ce qui rend le manque visible et
    // actionnable au lieu de rester invisible.
    if (!dryRun) {
      const level = await resolveAutonomy(supabase, "add_mission_page");
      if (level !== "confirm") {
        const { error } = await supabase.from("mission_pages").insert({
          mission_id: mission.id,
          title: "Note agent — Synthèse d'atelier à produire",
          content:
            `<p>${photos} photo(s) d'atelier sans synthèse associée.</p>` +
            `<p>Matière disponible : galerie de la mission. ` +
            `Produire la synthèse avec les tools de lecture d'image, puis remplacer cette page.</p>`,
          icon: "🤖",
        });
        if (!error) {
          actions++;
          await logAction(supabase, {
            objectiveId: objective.id,
            domain: "facilitateur",
            action: "add_mission_page",
            targetTable: "missions",
            targetId: mission.id as string,
            afterState: { photos, mission: mission.title },
            rationale: `Atelier de ${photos} photos sans synthèse`,
            autonomyLevel: level,
          });
        }
      }
    }
  }

  return {
    met: findings.length === 0,
    summary: findings.length
      ? `${findings.length} atelier(s) sans synthèse`
      : "Tous les ateliers avec photos ont une synthèse",
    findings,
    actions,
  };
}

// ── AG-36 : contenus et marketing ────────────────────────────
//
// Objectif : le pipeline éditorial ne se vide jamais, et s'alimente de ce qui
// est vécu en mission. Les briques existent (editorial-engine,
// analyze-transcript-editorial, search-content-ideas) ; ce qui manquait est le
// fil entre un transcript et une carte de contenu.

const CONTENT_FLOOR = 5;

async function runContenus(
  supabase: Supabase,
  objective: Objective,
  dryRun: boolean,
): Promise<DomainResult> {
  const { count: ready } = await supabase
    .from("content_cards")
    .select("id", { count: "exact", head: true });

  // Transcripts exploitables n'ayant encore rien produit.
  const { data: transcripts } = await supabase
    .from("transcripts")
    .select("id, title, summary, created_at")
    .eq("status", "ready")
    .order("created_at", { ascending: false })
    .limit(30);

  const { data: cards } = await supabase
    .from("content_cards")
    .select("title, content")
    .order("created_at", { ascending: false })
    .limit(100);
  const cardText = ((cards || []) as Array<Record<string, unknown>>)
    .map((c) => `${c.title ?? ""} ${c.content ?? ""}`)
    .join(" ")
    .toLowerCase();

  const orphans = ((transcripts || []) as Array<Record<string, unknown>>).filter((t) => {
    const title = ((t.title as string) || "").toLowerCase().slice(0, 40);
    return title.length > 8 && !cardText.includes(title);
  });

  const findings: Array<Record<string, unknown>> = [];
  let actions = 0;

  if ((ready ?? 0) < CONTENT_FLOOR) {
    findings.push({
      gap: "Pipeline éditorial sous le seuil",
      ready: ready ?? 0,
      floor: CONTENT_FLOOR,
    });
  }

  for (const t of orphans.slice(0, BATCH)) {
    findings.push({
      transcript_id: t.id,
      title: t.title,
      gap: "Transcript exploitable sans proposition de contenu",
    });

    if (!dryRun) {
      const level = await resolveAutonomy(supabase, "add_content_card");
      if (level !== "confirm") {
        const { error } = await supabase.from("content_cards").insert({
          title: `À exploiter : ${t.title}`,
          content:
            `<p>Issu du transcript « ${t.title} ».</p>` +
            (t.summary ? `<p>${t.summary}</p>` : "") +
            `<p>Proposition générée automatiquement, à arbitrer.</p>`,
          tags: ["agent", "transcript"],
        });
        if (!error) {
          actions++;
          await logAction(supabase, {
            objectiveId: objective.id,
            domain: "contenus",
            action: "add_content_card",
            targetTable: "transcripts",
            targetId: t.id as string,
            afterState: { from_transcript: t.title },
            rationale: "Transcript exploitable sans proposition de contenu",
            autonomyLevel: level,
          });
        }
      }
    }
  }

  return {
    met: findings.length === 0,
    summary: findings.length
      ? `${findings.length} manque(s) éditorial(aux), ${ready ?? 0} carte(s) en stock`
      : `Pipeline éditorial fourni (${ready ?? 0} cartes)`,
    findings,
    actions,
  };
}

// ── AG-37 : commerce ─────────────────────────────────────────
//
// Objectif : aucune opportunité ne dort.
// Autonomie volontairement basse : l'agent rédige, il n'envoie jamais. Un
// email parti en son nom est irréversible et engage la signature de
// l'utilisateur, qui écrit lui-même ses emails CRM.

const DORMANT_DAYS = 21;

async function runCommerce(
  supabase: Supabase,
  objective: Objective,
  dryRun: boolean,
): Promise<DomainResult> {
  const threshold = new Date(Date.now() - DORMANT_DAYS * 24 * 3600 * 1000).toISOString();
  const today = new Date().toISOString().slice(0, 10);

  const { data: cards } = await supabase
    .from("crm_cards")
    .select("id, title, sales_status, estimated_value, waiting_next_action_date, waiting_next_action_text, updated_at")
    .not("sales_status", "in", '("gagne","perdu","abandonne")')
    .order("updated_at", { ascending: true })
    .limit(80);

  const findings: Array<Record<string, unknown>> = [];
  let actions = 0;

  for (const card of ((cards || []) as Array<Record<string, unknown>>).slice(0, BATCH)) {
    const nextDate = card.waiting_next_action_date as string | null;
    const overdue = nextDate ? nextDate < today : false;
    const dormant = !nextDate && (card.updated_at as string) < threshold;
    if (!overdue && !dormant) continue;

    findings.push({
      card_id: card.id,
      title: card.title,
      status: card.sales_status,
      value: card.estimated_value,
      gap: overdue ? `Action datée dépassée (${nextDate})` : `Sans action datée depuis ${DORMANT_DAYS} jours`,
    });

    if (!dryRun) {
      // Note interne uniquement : la relance elle-même reste à écrire et à
      // envoyer par l'utilisateur.
      const level = await resolveAutonomy(supabase, "add_crm_comment");
      if (level !== "confirm") {
        const { error } = await supabase.from("crm_comments").insert({
          card_id: card.id,
          content: overdue
            ? `Action datée du ${nextDate} dépassée : « ${card.waiting_next_action_text ?? "sans intitulé"} ». Relance à décider.`
            : `Aucune action datée et aucune activité depuis plus de ${DORMANT_DAYS} jours. Opportunité en sommeil.`,
        });
        if (!error) {
          actions++;
          await logAction(supabase, {
            objectiveId: objective.id,
            domain: "commerce",
            action: "add_crm_comment",
            targetTable: "crm_cards",
            targetId: card.id as string,
            afterState: { flagged: overdue ? "overdue" : "dormant" },
            rationale: "Opportunité sans suite planifiée",
            autonomyLevel: level,
          });
        }
      }
    }
  }

  return {
    met: findings.length === 0,
    summary: findings.length
      ? `${findings.length} opportunité(s) en sommeil ou en retard`
      : "Toutes les opportunités actives ont une suite planifiée",
    findings,
    actions,
  };
}

// ── AG-38 : transformation ───────────────────────────────────
//
// Objectif : chaque mission a un livrable à jour et un budget maîtrisé.
// C'est le métier où l'objectif persistant compte le plus : une mission se
// suit sur des semaines, exactement le cas où une conversation ne suffit pas.

const STALE_MISSION_DAYS = 21;

async function runTransformation(
  supabase: Supabase,
  objective: Objective,
  dryRun: boolean,
): Promise<DomainResult> {
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, client_name, status, initial_amount, consumed_amount, waiting_next_action_date, updated_at")
    .eq("status", "in_progress")
    .limit(60);

  const staleBefore = Date.now() - STALE_MISSION_DAYS * 24 * 3600 * 1000;
  const findings: Array<Record<string, unknown>> = [];
  let actions = 0;

  for (const m of ((missions || []) as Array<Record<string, unknown>>).slice(0, BATCH)) {
    const initial = Number(m.initial_amount ?? 0);
    const consumed = Number(m.consumed_amount ?? 0);
    const overBudget = initial > 0 && consumed > initial;
    const nearBudget = initial > 0 && !overBudget && consumed >= initial * 0.9;
    const stale = new Date(m.updated_at as string).getTime() < staleBefore;
    if (!overBudget && !nearBudget && !stale) continue;

    const gaps: string[] = [];
    if (overBudget) gaps.push(`Budget dépassé (${consumed} / ${initial})`);
    if (nearBudget) gaps.push(`Budget à ${Math.round((consumed / initial) * 100)} %`);
    if (stale) gaps.push(`Aucune activité depuis plus de ${STALE_MISSION_DAYS} jours`);

    findings.push({
      mission_id: m.id,
      title: m.title,
      client: m.client_name,
      gap: gaps.join(" ; "),
    });

    // Programmer une action datée est une modification d'état visible :
    // la politique la classe en `notify`, donc l'agent agit puis signale.
    if (!dryRun && !m.waiting_next_action_date) {
      const result = await writeAndLog(supabase, {
        table: "missions",
        id: m.id as string,
        updates: {
          waiting_next_action_date: new Date().toISOString().slice(0, 10),
          waiting_next_action_text: gaps.join(" ; "),
          updated_at: new Date().toISOString(),
        },
        action: "update_mission",
        domain: "transformation",
        objectiveId: objective.id,
        rationale: gaps.join(" ; "),
        columns: "id, title, waiting_next_action_date, waiting_next_action_text",
      });
      if (result.ok) actions++;
    }
  }

  return {
    met: findings.length === 0,
    summary: findings.length
      ? `${findings.length} mission(s) à surveiller (budget ou inactivité)`
      : "Toutes les missions en cours sont sous contrôle",
    findings,
    actions,
  };
}

const DOMAINS: Record<
  string,
  (s: Supabase, o: Objective, dry: boolean) => Promise<DomainResult>
> = {
  facilitateur: runFacilitateur,
  contenus: runContenus,
  commerce: runCommerce,
  transformation: runTransformation,
};

// ── Boucle d'orchestration ───────────────────────────────────

function isDue(objective: Objective): boolean {
  if (!objective.last_run_at) return true;
  const elapsedH = (Date.now() - new Date(objective.last_run_at).getTime()) / 3600000;
  return elapsedH >= objective.cadence_hours;
}

async function runObjective(
  supabase: Supabase,
  objective: Objective,
  dryRun: boolean,
): Promise<Record<string, unknown>> {
  const routine = DOMAINS[objective.domain];
  if (!routine) {
    return { objective_id: objective.id, error: `Métier inconnu : ${objective.domain}` };
  }

  let result: DomainResult;
  try {
    result = await routine(supabase, objective, dryRun);
  } catch (e) {
    const message = e instanceof Error ? e.message : "échec";
    await supabase
      .from("agent_objectives")
      .update({ last_run_at: new Date().toISOString(), last_result: `Erreur : ${message}` })
      .eq("id", objective.id);
    return { objective_id: objective.id, title: objective.title, error: message };
  }

  if (!dryRun) {
    // On conserve les 20 derniers passages : assez pour voir une tendance,
    // assez peu pour que la ligne reste lisible.
    const attempts = Array.isArray(objective.attempts) ? objective.attempts : [];
    const nextAttempts = [
      ...attempts.slice(-19),
      { at: new Date().toISOString(), summary: result.summary, actions: result.actions },
    ];

    await supabase
      .from("agent_objectives")
      .update({
        last_run_at: new Date().toISOString(),
        last_result: result.summary,
        run_count: objective.run_count + 1,
        state: result.met ? "met" : "active",
        attempts: nextAttempts,
        updated_at: new Date().toISOString(),
      })
      .eq("id", objective.id);
  }

  return {
    objective_id: objective.id,
    domain: objective.domain,
    title: objective.title,
    met: result.met,
    summary: result.summary,
    actions: result.actions,
    findings: result.findings,
  };
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const auth = await verifyAuth(req);
    if (!auth.user) return createErrorResponse("Non authentifié", 401);

    const supabase = getSupabaseClient();
    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;

    if (body.revert_action_id) {
      const result = await revertAction(supabase, body.revert_action_id as string, auth.user.id);
      if (!result.ok) return createErrorResponse(result.message, 400);
      return createJsonResponse({ success: true, message: result.message });
    }

    let query = supabase
      .from("agent_objectives")
      .select("id, domain, title, criterion, cadence_hours, last_run_at, run_count, attempts");
    if (body.objective_id) {
      query = query.eq("id", body.objective_id as string);
    } else {
      query = query.eq("state", "active");
      if (body.domain) query = query.eq("domain", body.domain as string);
    }

    const { data, error } = await query;
    if (error) return createErrorResponse(error.message, 500);

    const objectives = (data || []) as Objective[];
    // Un objectif explicitement demandé s'exécute même hors cadence.
    const due = body.objective_id ? objectives : objectives.filter(isDue);

    const results: Array<Record<string, unknown>> = [];
    for (const objective of due) {
      results.push(await runObjective(supabase, objective, dryRun));
    }

    return createJsonResponse({
      success: true,
      dry_run: dryRun,
      objectives_considered: objectives.length,
      objectives_run: due.length,
      total_actions: results.reduce((n, r) => n + ((r.actions as number) ?? 0), 0),
      results,
    });
  } catch (e) {
    return createErrorResponse(e instanceof Error ? e.message : "Échec de l'orchestration", 500);
  }
});
