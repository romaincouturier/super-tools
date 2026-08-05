/**
 * Décision Go / No Go sur un appel d'offres, côté serveur.
 *
 * Miroir exact des hooks front (`useTenderNoGo`, `useTenderGo`) : une carte
 * issue d'un marché public doit être en tout point identique à celles du
 * formulaire site ou du webhook — même colonne « Entrant », même tag
 * « Marché public », même notification Slack, même journal d'activité. La
 * logique vit ici pour être appelée par le connecteur MCP (décision prise
 * depuis Claude Cowork, étape 4 de docs/marches-publics.md) et testée
 * unitairement sans monter le serveur HTTP.
 *
 * Le contenu d'un avis vient d'une source externe non contrôlée : il est
 * échappé avant d'entrer dans le HTML de la description, et les URL ne sont
 * reprises en lien que si elles sont bien http(s).
 *
 * Voir docs/marches-publics.md et docs/mcp-connector.md.
 */

import { postCrmOpportunityToSlack } from "./crm-slack.ts";

// deno-lint-ignore no-explicit-any
type Supabase = any;

/** Motifs de No Go. Liste fermée : c'est la donnée qui affine le filtrage.
 *  Doit rester synchronisée avec src/types/tenders.ts (TenderNoGoReason). */
export const TENDER_NO_GO_REASONS = [
  "hors_domaine",
  "trop_gros",
  "trop_petit",
  "delai_trop_court",
  "criteres_prix",
  "titulaire_sortant",
  "geographie",
  "charge_de_travail",
  "autre",
] as const;

export type TenderNoGoReason = (typeof TENDER_NO_GO_REASONS)[number];

export type TenderServiceType = "formation" | "mission";

interface TenderDecisionInfo {
  montant?: number | null;
  criteres?: Array<{ libelle: string; poids: number | null }>;
  url_dce?: string | null;
  contact_email?: string | null;
}

interface TenderRow {
  id: string;
  objet: string | null;
  acheteur: string | null;
  datelimitereponse: string | null;
  url_avis: string | null;
  source_ref: string | null;
  decision: TenderDecisionInfo | null;
  crm_card_id: string | null;
  status: string | null;
}

// ── Helpers de mise en forme (contenu externe, donc échappé) ──

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function safeUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === "http:" || parsed.protocol === "https:"
      ? escapeHtml(parsed.toString())
      : null;
  } catch {
    return null;
  }
}

/** Aujourd'hui en Europe/Paris, pour dater la prochaine action. */
export function todayParis(now = new Date()): string {
  const paris = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  return `${paris.getFullYear()}-${String(paris.getMonth() + 1).padStart(2, "0")}-${String(
    paris.getDate(),
  ).padStart(2, "0")}`;
}

const RANDOM_EMOJIS = ["📋", "📌", "🗂️", "🏛️", "📝", "🔎", "🎯", "🧩", "🗺️", "⚖️"];

function pickRandomEmoji(): string {
  return RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];
}

/**
 * Description HTML de la carte créée sur un Go. Reprend, dans l'ordre des
 * éléments de décision de la spec : acheteur, date limite, montant, critères,
 * puis les liens DCE et avis.
 */
export function buildGoDescription(tender: TenderRow): string {
  const decision = tender.decision ?? {};
  const deadline = tender.datelimitereponse
    ? new Date(tender.datelimitereponse).toLocaleDateString("fr-FR")
    : null;
  const dceUrl = safeUrl(decision.url_dce);
  const avisUrl = safeUrl(tender.url_avis);

  return [
    tender.acheteur ? `<p><strong>Acheteur :</strong> ${escapeHtml(tender.acheteur)}</p>` : "",
    deadline ? `<p><strong>Remise des offres avant le ${deadline}</strong></p>` : "",
    decision.montant
      ? `<p><strong>Montant annoncé :</strong> ${decision.montant.toLocaleString("fr-FR")} €</p>`
      : "",
    decision.criteres?.length
      ? `<p><strong>Critères :</strong> ${escapeHtml(
          decision.criteres
            .map((c) => `${c.libelle}${c.poids !== null ? ` ${c.poids}%` : ""}`)
            .join(", "),
        )}</p>`
      : "",
    dceUrl
      ? `<p><a href="${dceUrl}" target="_blank" rel="noopener noreferrer">Retirer le DCE</a></p>`
      : "",
    avisUrl
      ? `<p><a href="${avisUrl}" target="_blank" rel="noopener noreferrer">Voir l'avis</a></p>`
      : "",
  ]
    .filter(Boolean)
    .join("");
}

// ── File de décision (lecture) ───────────────────────────────

/** Statuts qui appellent une décision. */
const OPEN_STATUSES = ["raw", "to_review"];

export interface ListPendingTendersOptions {
  /** Nombre max d'avis renvoyés (défaut 50, plafond 100). */
  limit?: number;
}

/**
 * Avis en attente de décision, avec le contexte qui fait basculer un Go / No
 * Go. Miroir serveur de `useTenderOpportunities("open")` : mêmes filtres
 * (doublons inter-sources écartés, avis d'attribution exclus, échéances
 * dépassées retirées), même tri (date limite croissante puis parution
 * décroissante), et le même enrichissement par acheteur (historique CRM +
 * attributions passées, soit le titulaire sortant et le montant du marché
 * précédent, signal de décision numéro un de la spec).
 *
 * `total` porte le nombre réel d'avis à décider avant plafonnement : afficher
 * 50 quand il y en a 120 ferait croire la revue terminée.
 */
export async function listPendingTenders(
  supabase: Supabase,
  { limit }: ListPendingTendersOptions = {},
): Promise<{ total: number; truncated: boolean; items: Array<Record<string, unknown>> }> {
  const pageMax = Math.min(Math.max(limit ?? 50, 1), 100);

  const { data, error, count } = await supabase
    .from("tender_opportunities")
    .select(
      "id, source, source_ref, url_avis, objet, acheteur, nature, type_marche, famille_libelle, code_departement, cpv_codes, dateparution, datelimitereponse, decision, matched_on, score, status, created_at",
      { count: "exact" },
    )
    .is("duplicate_of", null)
    .neq("nature", "ATTRIBUTION")
    .in("status", OPEN_STATUSES)
    .or(`datelimitereponse.is.null,datelimitereponse.gte.${new Date().toISOString()}`)
    .order("datelimitereponse", { ascending: true, nullsFirst: false })
    .order("dateparution", { ascending: false })
    .limit(pageMax);
  if (error) throw new Error(error.message);

  const rows = (data ?? []) as Array<Record<string, unknown>>;

  // Contexte par acheteur, plafonné : `.in()` part dans l'URL, 100 noms la
  // feraient dépasser la limite serveur. Les avis les plus urgents sont en
  // tête, ce sont eux qui ont besoin du contexte.
  const buyers = [...new Set(rows.map((r) => r.acheteur).filter(Boolean))].slice(0, 60) as string[];
  const history = new Map<string, Array<Record<string, unknown>>>();
  const awards = new Map<string, Array<Record<string, unknown>>>();

  if (buyers.length) {
    const [{ data: cards }, { data: attributions }] = await Promise.all([
      supabase
        .from("crm_cards")
        .select("id, title, company, sales_status, estimated_value, created_at")
        .in("company", buyers)
        .order("created_at", { ascending: false })
        .limit(100),
      supabase
        .from("tender_opportunities")
        .select("id, objet, acheteur, decision, dateparution, url_avis")
        .eq("nature", "ATTRIBUTION")
        .in("acheteur", buyers)
        .order("dateparution", { ascending: false })
        .limit(100),
    ]);

    for (const card of (cards ?? []) as Array<Record<string, unknown>>) {
      const key = card.company as string;
      if (!history.has(key)) history.set(key, []);
      history.get(key)!.push({
        id: card.id,
        title: card.title,
        sales_status: card.sales_status,
        estimated_value: card.estimated_value,
        created_at: card.created_at,
      });
    }
    for (const row of (attributions ?? []) as Array<Record<string, unknown>>) {
      const key = row.acheteur as string;
      const decision = (row.decision ?? {}) as { titulaire?: string | null; montant?: number | null };
      if (!key || !decision.titulaire) continue;
      if (!awards.has(key)) awards.set(key, []);
      awards.get(key)!.push({
        id: row.id,
        objet: row.objet,
        titulaire: decision.titulaire,
        montant: decision.montant ?? null,
        dateparution: row.dateparution,
        url_avis: row.url_avis,
      });
    }
  }

  const items = rows.map((row) => ({
    ...row,
    decision: row.decision ?? {},
    buyer_history: (row.acheteur && history.get(row.acheteur as string)) || [],
    buyer_awards: (row.acheteur && awards.get(row.acheteur as string)?.slice(0, 3)) || [],
  }));

  return { total: count ?? items.length, truncated: (count ?? 0) > pageMax, items };
}

// ── No Go ────────────────────────────────────────────────────

export interface TenderNoGoInput {
  id: string;
  reason: string;
  detail?: string | null;
  actorEmail: string;
}

/**
 * Écarte un avis avec un motif obligatoire. N'écrit que sur la ligne
 * `tender_opportunities` existante (champs de décision) : rien n'est créé ni
 * supprimé. Le motif est contraint à la liste fermée, seule donnée qui sert
 * ensuite à resserrer le filtrage.
 */
export async function tenderNoGo(
  supabase: Supabase,
  { id, reason, detail, actorEmail }: TenderNoGoInput,
): Promise<{ status: string; id: string; no_go_reason: string }> {
  if (!id) throw new Error("tender_id requis");
  if (!(TENDER_NO_GO_REASONS as readonly string[]).includes(reason)) {
    throw new Error(
      `Motif de No Go invalide : « ${reason} ». Valeurs acceptées : ${TENDER_NO_GO_REASONS.join(", ")}.`,
    );
  }

  const { data, error } = await supabase
    .from("tender_opportunities")
    .update({
      status: "no_go",
      no_go_reason: reason,
      no_go_detail: detail || null,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorEmail,
    })
    .eq("id", id)
    .select("id")
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!data) throw new Error(`Aucun appel d'offres avec l'id ${id}.`);

  return { status: "no_go", id, no_go_reason: reason };
}

// ── Go : promotion en carte CRM ──────────────────────────────

export interface TenderGoInput {
  tenderId: string;
  serviceType: TenderServiceType;
  estimatedValue?: number | null;
  actorEmail: string;
}

/**
 * Promeut un avis en carte CRM, à l'identique du chemin manuel : colonne
 * « Entrant » (ou la première non archivée), tag « Marché public »,
 * prochaine action datée du jour, date limite portée en `expected_close_date`,
 * puis notification Slack. L'avis est marqué `go` et relié à la carte.
 *
 * Garde-fous repris du front : un avis déjà relié à une carte ne peut pas être
 * promu deux fois, et si le marquage de l'avis échoue après création de la
 * carte, l'erreur dit explicitement de ne pas recliquer.
 */
export async function tenderGo(
  supabase: Supabase,
  { tenderId, serviceType, estimatedValue, actorEmail }: TenderGoInput,
): Promise<{ status: string; card_id: string; column: string; title: string; tagged: boolean }> {
  if (!tenderId) throw new Error("tender_id requis");
  if (serviceType !== "formation" && serviceType !== "mission") {
    throw new Error("service_type requis pour un Go : « formation » ou « mission ».");
  }

  const { data: tender, error: fetchError } = await supabase
    .from("tender_opportunities")
    .select("id, objet, acheteur, datelimitereponse, url_avis, source_ref, decision, crm_card_id, status")
    .eq("id", tenderId)
    .maybeSingle();
  if (fetchError) throw new Error(fetchError.message);
  if (!tender) throw new Error(`Aucun appel d'offres avec l'id ${tenderId}.`);
  if (tender.crm_card_id) {
    throw new Error("Cet appel d'offres a déjà une carte dans le CRM.");
  }

  const row = tender as TenderRow;

  // Colonne cible : « Entrant » en priorité, sinon la première non archivée.
  const { data: columns } = await supabase
    .from("crm_columns")
    .select("id, name")
    .eq("is_archived", false)
    .order("position", { ascending: true });
  const targetColumn =
    (columns as Array<{ id: string; name: string }> | null)?.find((c) => c.name === "Entrant") ||
    (columns as Array<{ id: string; name: string }> | null)?.[0];
  if (!targetColumn) throw new Error("Aucune colonne CRM disponible.");

  // Tag « Marché public » : optionnel, la carte reste dans le pipeline commun.
  const { data: tag } = await supabase
    .from("crm_tags")
    .select("id")
    .eq("name", "Marché public")
    .maybeSingle();

  const { data: existingCards } = await supabase
    .from("crm_cards")
    .select("position")
    .eq("column_id", targetColumn.id)
    .order("position", { ascending: false })
    .limit(1);
  const maxPos = (existingCards as Array<{ position: number }> | null)?.[0]?.position ?? -1;

  const title = (row.objet || "Appel d'offres").slice(0, 180);
  const contactEmail = row.decision?.contact_email || null;

  const { data: card, error: cardError } = await supabase
    .from("crm_cards")
    .insert({
      column_id: targetColumn.id,
      title,
      description_html: buildGoDescription(row) || null,
      position: maxPos + 1,
      sales_status: "OPEN",
      status_operational: "WAITING",
      waiting_next_action_date: todayParis(),
      waiting_next_action_text: "Retirer le DCE et décider de candidater",
      estimated_value: estimatedValue ?? 0,
      company: row.acheteur || null,
      email: contactEmail,
      service_type: serviceType,
      acquisition_source: "marche_public",
      next_action_type: "other",
      expected_close_date: row.datelimitereponse ? row.datelimitereponse.slice(0, 10) : null,
      raw_input: row.url_avis || null,
      emoji: pickRandomEmoji(),
    })
    .select("id")
    .single();
  if (cardError) throw new Error(cardError.message);

  await supabase.from("crm_activity_log").insert({
    card_id: card.id,
    action_type: "card_created",
    actor_email: actorEmail,
    new_value: title,
  });

  let tagged = false;
  if (tag?.id) {
    const { error: tagErr } = await supabase
      .from("crm_card_tags")
      .insert({ card_id: card.id, tag_id: tag.id });
    tagged = !tagErr;
  }

  const { error: linkError } = await supabase
    .from("tender_opportunities")
    .update({
      status: "go",
      crm_card_id: card.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorEmail,
    })
    .eq("id", row.id);
  if (linkError) {
    throw new Error(
      `La carte CRM a bien été créée mais l'avis n'a pas pu être marqué comme traité ` +
        `(${linkError.message}). Ne pas relancer le Go : l'opportunité est déjà dans le kanban.`,
    );
  }

  // Slack best-effort : mêmes notifications que le formulaire et le webhook,
  // pour qu'un marché public promu depuis Cowork ne soit pas invisible.
  postCrmOpportunityToSlack(supabase, {
    title,
    company: row.acheteur,
    service_type: serviceType,
    message: `Marché public — ${row.url_avis ?? row.source_ref ?? ""}`.trim(),
    source_label: "Marché public (décision Claude Cowork)",
  });

  return { status: "go", card_id: card.id, column: targetColumn.name, title, tagged };
}
