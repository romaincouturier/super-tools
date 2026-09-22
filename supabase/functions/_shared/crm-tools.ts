/**
 * Outils CRM exposés au serveur MCP.
 * Écriture volontairement limitée : passer une opportunité en perdue
 * (mêmes champs que l'interface : sales_status, lost_at, loss_reason,
 * loss_reason_detail, colonne « Perdu »), plus le journal d'activité.
 */

export const LOSS_REASONS = [
  "prix",
  "timing",
  "concurrent",
  "besoin_non_qualifie",
  "pas_de_budget",
  "pas_de_reponse",
  "indisponible",
  "no_go",
  "changement_avis",
  "financement_cpf",
  "autre",
] as const;

export type LossReason = (typeof LOSS_REASONS)[number];

export interface MarkOpportunityLostInput {
  card_id?: string;
  search?: string;
  loss_reason: string;
  detail?: string;
  comment?: string;
}

interface CardRow {
  id: string;
  title: string;
  company: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  sales_status: string;
  column_id: string;
}

const CARD_FIELDS = "id, title, company, first_name, last_name, email, sales_status, column_id";

function label(card: CardRow): string {
  const who = card.company || [card.first_name, card.last_name].filter(Boolean).join(" ") || card.email || "";
  return who ? `${card.title} (${who})` : card.title;
}

async function findCards(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  search: string,
): Promise<CardRow[]> {
  const term = search.trim().replace(/[%,]/g, " ");
  const like = `%${term}%`;
  const { data, error } = await supabase
    .from("crm_cards")
    .select(CARD_FIELDS)
    .or(
      [
        `company.ilike.${like}`,
        `title.ilike.${like}`,
        `email.ilike.${like}`,
        `first_name.ilike.${like}`,
        `last_name.ilike.${like}`,
      ].join(","),
    )
    .limit(20);
  if (error) throw new Error(error.message);
  const rows = (data || []) as CardRow[];
  const open = rows.filter((r) => r.sales_status === "OPEN");
  return open.length > 0 ? open : rows;
}

export async function markOpportunityLost(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  input: MarkOpportunityLostInput,
  log: (tool: string, details?: unknown) => Promise<void>,
  actorEmail: string,
): Promise<string> {
  const reason = (input.loss_reason || "").trim() as LossReason;
  if (!LOSS_REASONS.includes(reason)) {
    throw new Error(`loss_reason invalide. Valeurs acceptées : ${LOSS_REASONS.join(", ")}`);
  }
  if (!input.card_id && !input.search) {
    throw new Error("Fournir card_id ou search (nom de la société, du contact ou de l'opportunité).");
  }

  let card: CardRow;
  if (input.card_id) {
    const { data, error } = await supabase
      .from("crm_cards")
      .select(CARD_FIELDS)
      .eq("id", input.card_id)
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!data) throw new Error(`Aucune opportunité avec l'id ${input.card_id}`);
    card = data as CardRow;
  } else {
    const matches = await findCards(supabase, input.search!);
    if (matches.length === 0) {
      return JSON.stringify({ updated: false, reason: "not_found", search: input.search });
    }
    if (matches.length > 1) {
      return JSON.stringify({
        updated: false,
        reason: "ambiguous",
        message: "Plusieurs opportunités correspondent : rappeler l'outil avec card_id.",
        candidates: matches.map((m) => ({ card_id: m.id, label: label(m), sales_status: m.sales_status })),
      });
    }
    card = matches[0];
  }

  if (card.sales_status === "LOST") {
    return JSON.stringify({ updated: false, reason: "already_lost", card_id: card.id, label: label(card) });
  }

  const { data: lostColumn } = await supabase
    .from("crm_columns")
    .select("id, name")
    .ilike("name", "%perdu%")
    .limit(1)
    .maybeSingle();

  const updates: Record<string, unknown> = {
    sales_status: "LOST",
    lost_at: new Date().toISOString(),
    loss_reason: reason,
    loss_reason_detail: input.detail?.trim() || null,
    status_operational: "TODAY",
    waiting_next_action_date: null,
    waiting_next_action_text: null,
  };
  if (lostColumn?.id) updates.column_id = lostColumn.id;

  const { error: updateError } = await supabase.from("crm_cards").update(updates).eq("id", card.id);
  if (updateError) throw new Error(updateError.message);

  await supabase.from("crm_activity_log").insert([{
    card_id: card.id,
    action_type: "sales_status_changed",
    old_value: card.sales_status,
    new_value: "LOST",
    actor_email: actorEmail,
    metadata: { loss_reason: reason, loss_reason_detail: input.detail || null, via: "mcp" },
  }]);

  if (lostColumn?.id && lostColumn.id !== card.column_id) {
    await supabase.from("crm_activity_log").insert([{
      card_id: card.id,
      action_type: "card_moved",
      old_value: card.column_id,
      new_value: lostColumn.id,
      actor_email: actorEmail,
      metadata: { via: "mcp" },
    }]);
  }

  const commentText = (input.comment || input.detail || "").trim();
  if (commentText) {
    await supabase.from("crm_comments").insert([{
      card_id: card.id,
      content: commentText,
      author_email: actorEmail,
    }]);
  }

  await log("mark_opportunity_lost", { card_id: card.id, loss_reason: reason });

  return JSON.stringify({
    updated: true,
    card_id: card.id,
    label: label(card),
    sales_status: "LOST",
    loss_reason: reason,
    loss_reason_detail: input.detail?.trim() || null,
    colonne: lostColumn?.name || null,
    commentaire_ajoute: Boolean(commentText),
  });
}
