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

type RawRow = Record<string, any>;

export function mapColumns(data: RawRow[]): CrmColumn[] {
  return (data || []).map((col): CrmColumn => ({
    id: col.id,
    name: col.name,
    position: col.position,
    is_archived: col.is_archived,
    created_at: col.created_at,
    updated_at: col.updated_at,
  }));
}

export function mapTags(data: RawRow[]): CrmTag[] {
  return (data || []).map((t): CrmTag => ({
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
  return (data || []).map((card): CrmCard => {
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
      website_url: (card.website_url as string | undefined) ?? null,
      service_type: card.service_type as CrmCard["service_type"],
      brief_questions: (Array.isArray(card.brief_questions) ? card.brief_questions : []) as CrmCard["brief_questions"],
      raw_input: card.raw_input,
      next_action_text: (card.next_action_text as string | undefined) ?? null,
      next_action_done: (card.next_action_done as boolean | undefined) ?? false,
      next_action_type: ((card.next_action_type as string | undefined) ?? "other") as CrmCard["next_action_type"],
      linked_mission_id: (card.linked_mission_id as string | undefined) ?? null,
      emoji: (card.emoji as string | undefined) ?? null,
      confidence_score: (card.confidence_score as number | undefined) ?? null,
      won_at: (card.won_at as string | undefined) ?? null,
      lost_at: (card.lost_at as string | undefined) ?? null,
      acquisition_source: ((card.acquisition_source as string | undefined) ?? null) as CrmCard["acquisition_source"],
      loss_reason: ((card.loss_reason as string | undefined) ?? null) as CrmCard["loss_reason"],
      loss_reason_detail: (card.loss_reason_detail as string | undefined) ?? null,
      assigned_to: (card.assigned_to as string | undefined) ?? null,
      source_metadata: (card.source_metadata as CrmCard["source_metadata"]) ?? null,
      tags: cardTagsList,
    };
  });
}

export function mapAttachments(data: RawRow[]): CrmAttachment[] {
  return (data || []).map((a): CrmAttachment => ({
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
  return (data || []).map((c): CrmComment => ({
    id: c.id,
    card_id: c.card_id,
    author_email: c.author_email,
    content: c.content,
    is_deleted: c.is_deleted,
    created_at: c.created_at,
  }));
}

export function mapActivity(data: RawRow[]): CrmActivityLog[] {
  return (data || []).map((a): CrmActivityLog => ({
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
  return (data || []).map((e): CrmCardEmail => ({
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
