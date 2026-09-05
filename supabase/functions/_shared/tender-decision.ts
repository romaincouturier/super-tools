/**
 * Qualification Go / No Go des marchés publics, côté serveur.
 *
 * Miroir de `src/hooks/crm/useTenderOpportunities.ts` : le connecteur MCP
 * (Claude Cowork) et l'écran CRM doivent voir la même file et produire la
 * même carte. Toute divergence ici se paie en cartes CRM qui ne ressemblent
 * pas aux autres.
 *
 * Étape 4 du workflow de docs/marches-publics.md. La décision reste humaine :
 * ce module ne fait qu'exécuter un Go ou un No Go déjà tranché, il ne décide
 * jamais à partir du contenu d'un avis — contenu externe non contrôlé.
 */

// deno-lint-ignore no-explicit-any
type Supabase = any;

/** Liste fermée, identique à `src/types/tenders.ts`. */
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

export type TenderNoGoReason = typeof TENDER_NO_GO_REASONS[number];

/** Statuts qui appellent une décision. */
const OPEN_STATUSES = ["raw", "to_review"];
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 100;
/** `.in()` voyage dans l'URL : au-delà, la requête dépasse la limite serveur. */
const BUYERS_MAX = 60;

export interface TenderDecisionInfo {
  titulaire?: string | null;
  montant?: number | null;
  duree_mois?: number | null;
  reconductible?: boolean | null;
  criteres?: Array<{ libelle: string; poids: number | null }>;
  lots?: string[];
  url_dce?: string | null;
  contact_email?: string | null;
  ville?: string | null;
  devise?: string | null;
  procedure?: string | null;
  langue?: string | null;
  [key: string]: unknown;
}

export interface TenderRow {
  id: string;
  source: string;
  source_ref: string;
  objet: string | null;
  acheteur: string | null;
  nature: string | null;
  type_marche: string | null;
  code_departement: string[] | null;
  cpv_codes: string[] | null;
  dateparution: string | null;
  datelimitereponse: string | null;
  decision: TenderDecisionInfo | null;
  matched_on: string[] | null;
  status: string;
  url_avis: string | null;
  crm_card_id: string | null;
}

export interface PendingTender extends TenderRow {
  decision: TenderDecisionInfo;
  buyer_history: Array<{
    id: string;
    title: string;
    sales_status: string;
    estimated_value: number | null;
    created_at: string;
  }>;
  buyer_awards: Array<{
    id: string;
    objet: string | null;
    titulaire: string;
    montant: number | null;
    dateparution: string | null;
    url_avis: string | null;
  }>;
}

export interface PendingTendersResult {
  total: number;
  truncated: boolean;
  items: PendingTender[];
}

// ── Mise en forme (contenu externe : tout est échappé) ────────

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

/** Aujourd'hui en Europe/Paris (YYYY-MM-DD), pour dater la prochaine action. */
export function todayParis(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Description de la carte CRM : acheteur, échéance, montant, critères, liens. */
export function buildTenderDescriptionHtml(tender: TenderRow): string {
  const decision = tender.decision ?? {};
  const deadline = tender.datelimitereponse
    ? new Date(tender.datelimitereponse).toLocaleDateString("fr-FR")
    : null;
  const dceUrl = safeUrl(decision.url_dce);
  const avisUrl = safeUrl(tender.url_avis);

  return [
    tender.acheteur ? `<p><strong>Acheteur :</strong> ${escapeHtml(tender.acheteur)}</p>` : "",
    deadline ? `<p><strong>Remise des offres avant le ${deadline}</strong></p>` : "",
    typeof decision.montant === "number"
      ? `<p><strong>Montant annoncé :</strong> ${decision.montant.toLocaleString("fr-FR")} €</p>`
      : "",
    decision.criteres?.length
      ? `<p><strong>Critères :</strong> ${escapeHtml(
        decision.criteres
          .map((c) => `${c.libelle}${c.poids !== null && c.poids !== undefined ? ` ${c.poids}%` : ""}`)
          .join(", "),
      )}</p>`
      : "",
    dceUrl ? `<p><a href="${dceUrl}" target="_blank" rel="noopener noreferrer">Retirer le DCE</a></p>` : "",
    avisUrl ? `<p><a href="${avisUrl}" target="_blank" rel="noopener noreferrer">Voir l'avis</a></p>` : "",
  ].filter(Boolean).join("");
}

// ── 1. La file à décider ─────────────────────────────────────

/**
 * Avis en attente de décision, enrichis du contexte par acheteur.
 *
 * Mêmes filtres que le hook front : pas de doublon inter-sources, pas d'avis
 * d'attribution (ils servent à nommer le titulaire sortant, il n'y a rien à
 * décider dessus), pas d'échéance dépassée.
 */
export async function listPendingTenders(
  supabase: Supabase,
  options: { limit?: number } = {},
): Promise<PendingTendersResult> {
  const limit = Math.min(Math.max(options.limit ?? DEFAULT_LIMIT, 1), MAX_LIMIT);

  const { data, error, count } = await supabase
    .from("tender_opportunities")
    .select("*", { count: "exact" })
    .is("duplicate_of", null)
    .neq("nature", "ATTRIBUTION")
    .in("status", OPEN_STATUSES)
    .or(`datelimitereponse.is.null,datelimitereponse.gte.${new Date().toISOString()}`)
    // Les avis sans date limite passent EN PREMIER : une échéance inconnue
    // peut être imminente. Même ordre que l'écran CRM.
    .order("datelimitereponse", { ascending: true, nullsFirst: true })
    .order("dateparution", { ascending: false })
    .limit(limit);
  if (error) throw new Error(error.message);

  const rows = (data || []) as TenderRow[];
  const buyers = ([...new Set(rows.map((r) => r.acheteur).filter(Boolean))] as string[])
    .slice(0, BUYERS_MAX);

  const history = new Map<string, PendingTender["buyer_history"]>();
  const awards = new Map<string, PendingTender["buyer_awards"]>();

  if (buyers.length) {
    const [cardsRes, attributionsRes] = await Promise.all([
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

    for (const card of cardsRes?.data || []) {
      const key = card.company as string;
      if (!key) continue;
      if (!history.has(key)) history.set(key, []);
      history.get(key)!.push({
        id: card.id,
        title: card.title,
        sales_status: card.sales_status,
        estimated_value: card.estimated_value,
        created_at: card.created_at,
      });
    }
    for (const row of (attributionsRes?.data || []) as TenderRow[]) {
      const key = row.acheteur as string;
      const titulaire = row.decision?.titulaire ?? null;
      if (!key || !titulaire) continue;
      if (!awards.has(key)) awards.set(key, []);
      awards.get(key)!.push({
        id: row.id,
        objet: row.objet,
        titulaire,
        montant: row.decision?.montant ?? null,
        dateparution: row.dateparution,
        url_avis: row.url_avis,
      });
    }
  }

  const items: PendingTender[] = rows.map((row) => ({
    ...row,
    decision: row.decision ?? {},
    buyer_history: (row.acheteur && history.get(row.acheteur)) || [],
    buyer_awards: (row.acheteur && awards.get(row.acheteur)?.slice(0, 3)) || [],
  }));

  const total = count ?? items.length;
  return { total, truncated: total > items.length, items };
}

// ── 2. No Go ─────────────────────────────────────────────────

/**
 * Écarte un avis, motif obligatoire : sans motif, l'historique des No Go ne
 * sert ni à affiner le filtrage ni à calibrer, et c'est le seul usage qui
 * justifie de conserver ces lignes.
 *
 * Ne touche que la ligne existante : aucune création, aucune suppression.
 */
export async function tenderNoGo(
  supabase: Supabase,
  params: { id: string; reason: string; detail?: string | null; actorEmail: string },
): Promise<{ id: string; status: "no_go"; reason: TenderNoGoReason }> {
  const { id, reason, detail, actorEmail } = params;
  if (!id) throw new Error("tender_id manquant.");
  if (!TENDER_NO_GO_REASONS.includes(reason as TenderNoGoReason)) {
    throw new Error(
      `Motif de No Go invalide « ${reason} ». Motifs acceptés : ${TENDER_NO_GO_REASONS.join(", ")}.`,
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
  if (!data) throw new Error(`Avis introuvable : ${id}`);

  return { id, status: "no_go", reason: reason as TenderNoGoReason };
}

// ── 3. Go : promotion en carte CRM ───────────────────────────

export interface TenderGoResult {
  tender_id: string;
  card_id: string;
  column: string;
  title: string;
  tagged: boolean;
}

/**
 * Promotion en carte CRM par le même chemin que `crm-elementor-webhook` :
 * colonne « Entrant », prochaine action datée du jour, tag « Marché public »,
 * journal d'activité et notification Slack. Une carte issue d'un marché public
 * doit être en tout point identique aux autres.
 */
export async function tenderGo(
  supabase: Supabase,
  params: {
    tenderId: string;
    serviceType?: string | null;
    estimatedValue?: number | null;
    actorEmail: string;
    /** Notification Slack, injectée pour rester testable. */
    notify?: (card: Record<string, unknown>) => void | Promise<void>;
  },
): Promise<TenderGoResult> {
  const { tenderId, serviceType, estimatedValue, actorEmail, notify } = params;
  if (!tenderId) throw new Error("tender_id manquant.");

  const { data: tender, error: readError } = await supabase
    .from("tender_opportunities")
    .select("*")
    .eq("id", tenderId)
    .maybeSingle();
  if (readError) throw new Error(readError.message);
  if (!tender) throw new Error(`Avis introuvable : ${tenderId}`);

  // Un second Go créerait une deuxième carte pour le même marché.
  if ((tender as TenderRow).crm_card_id) {
    throw new Error(
      `Cet avis a déjà une carte dans le CRM (${(tender as TenderRow).crm_card_id}). Aucune action.`,
    );
  }

  const row = tender as TenderRow;
  const title = (row.objet || "Appel d'offres").slice(0, 180);

  // Colonne « Entrant », sinon la première non archivée.
  const { data: columns } = await supabase
    .from("crm_columns")
    .select("id, name")
    .eq("is_archived", false)
    .order("position", { ascending: true });
  const targetColumn = (columns || []).find((c: { name: string }) => c.name === "Entrant")
    || (columns || [])[0];
  if (!targetColumn) throw new Error("Aucune colonne CRM disponible.");

  const { data: lastCards } = await supabase
    .from("crm_cards")
    .select("position")
    .eq("column_id", targetColumn.id)
    .order("position", { ascending: false })
    .limit(1);
  const maxPos = lastCards?.[0]?.position ?? -1;

  const { data: card, error: cardError } = await supabase
    .from("crm_cards")
    .insert({
      column_id: targetColumn.id,
      title,
      description_html: buildTenderDescriptionHtml(row),
      position: maxPos + 1,
      sales_status: "OPEN",
      status_operational: "WAITING",
      waiting_next_action_date: todayParis(),
      waiting_next_action_text: "Retirer le DCE et décider de candidater",
      next_action_type: "other",
      // La date limite pilote le suivi commercial : sans elle, la bascule
      // automatique à J-7 ne peut pas retrouver la carte.
      expected_close_date: row.datelimitereponse ? row.datelimitereponse.slice(0, 10) : null,
      company: row.acheteur || null,
      email: row.decision?.contact_email || null,
      service_type: serviceType || null,
      acquisition_source: "marche_public",
      estimated_value: estimatedValue ?? null,
      raw_input: row.url_avis || null,
    })
    .select("id")
    .single();
  if (cardError) throw new Error(`Création de la carte CRM impossible : ${cardError.message}`);

  await supabase.from("crm_activity_log").insert({
    card_id: card.id,
    action_type: "card_created",
    actor_email: actorEmail,
    new_value: title,
  });

  // Tag « Marché public » : c'est ce qui isole ces cartes dans les rapports.
  let tagged = false;
  const { data: tag } = await supabase
    .from("crm_tags")
    .select("id")
    .eq("name", "Marché public")
    .maybeSingle();
  if (tag?.id) {
    const { error: tagError } = await supabase
      .from("crm_card_tags")
      .insert({ card_id: card.id, tag_id: tag.id });
    tagged = !tagError;
  }

  const { error: linkError } = await supabase
    .from("tender_opportunities")
    .update({
      status: "go",
      crm_card_id: card.id,
      reviewed_at: new Date().toISOString(),
      reviewed_by: actorEmail,
    })
    .eq("id", tenderId);
  // La carte existe déjà : un message générique ferait relancer un Go et
  // créerait un doublon. On dit explicitement quoi faire.
  if (linkError) {
    throw new Error(
      `La carte CRM ${card.id} a bien été créée mais l'avis n'a pas pu être marqué comme traité `
        + `(${linkError.message}). Ne pas relancer un Go : l'opportunité est dans le kanban.`,
    );
  }

  if (notify) {
    await notify({
      title,
      company: row.acheteur,
      email: row.decision?.contact_email ?? null,
      service_type: serviceType ?? null,
      message: `Marché public — ${row.url_avis ?? row.source_ref}`,
      source_label: "Marché public (décision Go)",
    });
  }

  return {
    tender_id: tenderId,
    card_id: card.id,
    column: targetColumn.name,
    title,
    tagged,
  };
}
