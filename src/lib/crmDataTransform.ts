import type {
  CrmColumn,
  CrmCard,
  CrmTag,
  CrmAttachment,
  CrmComment,
  CrmActivityLog,
  CrmCardEmail,
  CrmActivityType,
} from "@/types/crm";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RawRow = Record<string, any>;

export function mapColumns(data: RawRow[]): CrmColumn[] {
  return (data || []).map((col) => ({
    id: col.id,
    name: col.name,
    position: col.position,
    is_archived: col.is_archived,
    created_at: col.created_at,
    updated_at: col.updated_at,
  }));
}

export function mapTags(data: RawRow[]): CrmTag[] {
  return (data || []).map((t) => ({
    id: t.id,
    name: t.name,
    color: t.color,
    category: t.category,
    created_at: t.created_at,
  }));
}

export function mapCards(
  data: RawRow[],
  cardTagRows: RawRow[],
  tags: CrmTag[]
): CrmCard[] {
  return (data || []).map((card) => {
    const cardTagIds = cardTagRows
      .filter((ct) => ct.card_id === card.id)
      .map((ct) => ct.tag_id);
    const cardTagsList = tags.filter((t) => cardTagIds.includes(t.id));
    return {
      id: card.id,
      column_id: card.column_id,
      title: card.title,
      description_html: card.description_html,
      status_operational: card.status_operational as CrmCard["status_operational"],
      waiting_next_action_date: card.waiting_next_action_date,
      waiting_next_action_text: card.waiting_next_action_text,
      sales_status: card.sales_status as CrmCard["sales_status"],
      estimated_value: card.estimated_value ?? 0,
      quote_url: card.quote_url,
      position: card.position,
      created_at: card.created_at,
      updated_at: card.updated_at,
      first_name: card.first_name,
      last_name: card.last_name,
      phone: card.phone,
      company: card.company,
      email: card.email,
      linkedin_url: card.linkedin_url,
      website_url: (card as unknown as { website_url?: string }).website_url ?? null,
      service_type: card.service_type as CrmCard["service_type"],
      brief_questions: (Array.isArray(card.brief_questions) ? card.brief_questions : []) as unknown as CrmCard["brief_questions"],
      raw_input: card.raw_input,
      next_action_text: (card as unknown as { next_action_text?: string }).next_action_text ?? null,
      next_action_done: (card as unknown as { next_action_done?: boolean }).next_action_done ?? false,
      next_action_type: ((card as unknown as { next_action_type?: string }).next_action_type ?? "other") as CrmCard["next_action_type"],
      linked_mission_id: (card as unknown as { linked_mission_id?: string }).linked_mission_id ?? null,
      emoji: (card as unknown as { emoji?: string }).emoji ?? null,
      confidence_score: (card as unknown as { confidence_score?: number }).confidence_score ?? null,
      won_at: (card as unknown as { won_at?: string }).won_at ?? null,
      lost_at: (card as unknown as { lost_at?: string }).lost_at ?? null,
      acquisition_source: ((card as unknown as { acquisition_source?: string }).acquisition_source ?? null) as CrmCard["acquisition_source"],
      loss_reason: ((card as unknown as { loss_reason?: string }).loss_reason ?? null) as CrmCard["loss_reason"],
      loss_reason_detail: (card as unknown as { loss_reason_detail?: string }).loss_reason_detail ?? null,
      assigned_to: (card as unknown as { assigned_to?: string }).assigned_to ?? null,
      tags: cardTagsList,
    };
  });
}

export function mapAttachments(data: RawRow[]): CrmAttachment[] {
  return (data || []).map((a) => ({
    id: a.id,
    card_id: a.card_id,
    file_name: a.file_name,
    file_path: a.file_path,
    file_size: a.file_size,
    mime_type: a.mime_type,
    created_at: a.created_at,
  }));
}

export function mapComments(data: RawRow[]): CrmComment[] {
  return (data || []).map((c) => ({
    id: c.id,
    card_id: c.card_id,
    author_email: c.author_email,
    content: c.content,
    is_deleted: c.is_deleted,
    created_at: c.created_at,
  }));
}

export function mapActivity(data: RawRow[]): CrmActivityLog[] {
  return (data || []).map((a) => ({
    id: a.id,
    card_id: a.card_id,
    action_type: a.action_type as CrmActivityType,
    old_value: a.old_value,
    new_value: a.new_value,
    metadata: a.metadata as Record<string, unknown> | null,
    actor_email: a.actor_email,
    created_at: a.created_at,
  }));
}

export function mapEmails(data: RawRow[]): CrmCardEmail[] {
  return (data || []).map((e) => ({
    id: e.id,
    card_id: e.card_id,
    sender_email: e.sender_email,
    recipient_email: e.recipient_email,
    subject: e.subject,
    body_html: e.body_html,
    sent_at: e.sent_at,
    attachment_names: (e.attachment_names as string[]) || [],
    attachment_paths: (e.attachment_paths as string[] | null) || null,
    resend_email_id: (e.resend_email_id as string | null) || null,
    delivery_status: (e.delivery_status as CrmCardEmail["delivery_status"]) || "sent",
    delivered_at: (e.delivered_at as string | null) || null,
    opened_at: (e.opened_at as string | null) || null,
    open_count: (e.open_count as number) || 0,
    clicked_at: (e.clicked_at as string | null) || null,
    click_count: (e.click_count as number) || 0,
  }));
}
