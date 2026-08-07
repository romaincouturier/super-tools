/**
 * Historique des événements (conférences, salons, interventions) exposé au
 * connecteur MCP.
 *
 * La table `events` porte tout le texte utile à la réécriture d'une soumission :
 * `description` (le pitch envoyé), `notes` (les notes de préparation) et
 * `summary_notes` (le retour à chaud une fois l'événement passé). Aucun de ces
 * champs n'était atteignable autrement que par du SQL improvisé :
 * get_editorial_brief ne renvoie que les événements à venir, sur six colonnes.
 *
 * SuperTools ne stocke pas de statut « accepté / refusé » : `status` vaut
 * `active` ou `cancelled`, et un refus de CFP se lit dans
 * `cancellation_reason = 'non_selectionne'`. L'issue est donc déduite ici, une
 * fois pour toutes, plutôt que réinterprétée à chaque appel.
 *
 * Lecture seule, jamais de médias : `event_media` reste hors allowlist agent.
 */
import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

/** Colonnes renvoyées. Ni médias, ni logistique (train/hôtel/salle/resto). */
const EVENT_COLUMNS =
  "id, title, event_date, event_time, location, location_type, event_type, status, " +
  "cancellation_reason, description, notes, summary_notes, cfp_deadline, " +
  "cfp_submitted_at, cfp_url, event_url, created_at, updated_at";

/** Champs texte balayés par le paramètre `search`. */
const SEARCHABLE_COLUMNS = ["title", "description", "notes", "summary_notes", "location"];

export type EventOutcome = "held" | "not_selected" | "cancelled" | "upcoming";
export type CfpStatus = "no_cfp" | "not_submitted" | "submitted";

export interface EventHistoryOptions {
  search?: string;
  from?: string;
  to?: string;
  event_type?: string;
  include_upcoming?: boolean;
  limit?: number;
}

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * Issue d'un événement, déduite de `status` + `cancellation_reason` + la date.
 * `not_selected` est le seul refus de CFP explicite du modèle.
 */
export function eventOutcome(
  event: { status?: string | null; cancellation_reason?: string | null; event_date: string },
  today: string,
): EventOutcome {
  if (event.status === "cancelled") {
    return event.cancellation_reason === "non_selectionne" ? "not_selected" : "cancelled";
  }
  return event.event_date < today ? "held" : "upcoming";
}

/** Où en est la soumission : pas de CFP, CFP repéré mais non soumis, soumis. */
export function cfpStatus(event: {
  cfp_deadline?: string | null;
  cfp_url?: string | null;
  cfp_submitted_at?: string | null;
}): CfpStatus {
  if (event.cfp_submitted_at) return "submitted";
  return event.cfp_deadline || event.cfp_url ? "not_submitted" : "no_cfp";
}

/**
 * Échappe les caractères joker de PostgREST/`ILIKE` pour qu'une recherche
 * contenant `%`, `_` ou une virgule ne casse ni le filtre `or()` ni le motif.
 */
function escapeLike(term: string): string {
  return term.replace(/[%_\\]/g, "\\$&").replace(/[,()]/g, " ");
}

/**
 * Historique des événements soumis ou tenus, du plus récent au plus ancien.
 *
 * Par défaut : les événements passés uniquement, ce qui est la matière pour
 * repartir d'un pitch déjà écrit.
 */
export async function getEventHistory(
  supabase: SupabaseClient,
  opts: EventHistoryOptions = {},
): Promise<Record<string, unknown>> {
  const today = isoDay(new Date());
  const limit = Math.min(Math.max(opts.limit ?? 50, 1), 200);

  let query = supabase.from("events").select(EVENT_COLUMNS);

  if (opts.from) query = query.gte("event_date", opts.from);
  if (opts.to) query = query.lte("event_date", opts.to);
  else if (!opts.include_upcoming) query = query.lte("event_date", today);

  if (opts.event_type) query = query.eq("event_type", opts.event_type);

  const search = opts.search?.trim();
  if (search) {
    const term = escapeLike(search);
    query = query.or(SEARCHABLE_COLUMNS.map((c) => `${c}.ilike.%${term}%`).join(","));
  }

  const { data, error } = await query
    .order("event_date", { ascending: false })
    .limit(limit);

  if (error) throw new Error(error.message);

  const events = ((data ?? []) as Array<Record<string, unknown>>).map((e) => ({
    ...e,
    outcome: eventOutcome(e as { status?: string | null; cancellation_reason?: string | null; event_date: string }, today),
    cfp_status: cfpStatus(e as { cfp_deadline?: string | null; cfp_url?: string | null; cfp_submitted_at?: string | null }),
  }));

  const countBy = (key: "outcome" | "cfp_status") =>
    events.reduce<Record<string, number>>((acc, e) => {
      const value = e[key] as string;
      acc[value] = (acc[value] ?? 0) + 1;
      return acc;
    }, {});

  return {
    filters: {
      search: search || null,
      from: opts.from ?? null,
      to: opts.to ?? (opts.include_upcoming ? null : today),
      event_type: opts.event_type ?? null,
      include_upcoming: Boolean(opts.include_upcoming),
      limit,
    },
    events,
    summary: {
      returned: events.length,
      truncated: events.length === limit,
      by_outcome: countBy("outcome"),
      by_cfp_status: countBy("cfp_status"),
    },
    reading_guide: [
      "description = le pitch soumis, notes = les notes de préparation, summary_notes = le bilan écrit après l'événement. Les trois sont du texte libre : aucun n'est garanti rempli.",
      "outcome est déduit, SuperTools n'a pas de champ « accepté » : held = événement passé non annulé, not_selected = annulé pour « non sélectionné » (refus de CFP), cancelled = annulé pour une autre raison (voir cancellation_reason), upcoming = à venir.",
      "cfp_status : submitted quand cfp_submitted_at est renseigné, not_submitted quand un CFP est repéré (deadline ou URL) sans soumission, no_cfp sinon.",
      "search balaye titre, description, notes, summary_notes et lieu en insensible à la casse. Il ne fait pas de recherche sémantique : un synonyme ne remonte pas.",
      "Les médias des événements ne sont pas exposés par ce tool.",
    ],
  };
}
