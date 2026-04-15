/**
 * Shared data fetchers for daily digest (email) and daily actions (TODO).
 *
 * Each function returns raw, format-agnostic data so consumers can render
 * however they need (HTML for emails, ActionItem for the TODO table).
 */

import type { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── Types ───────────────────────────────────────────────────────────
export interface Recipient {
  userId: string;
  email: string;
  firstName: string;
  isAdmin: boolean;
}

export interface MissionActionItem {
  id: string;
  title: string;
  clientName: string | null;
  emoji: string | null;
  assignedTo: string | null;
  actionText: string;
  actionDate: string;
  isOverdue: boolean;
}

export interface ElearningGroupItem {
  id: string;
  trainingName: string;
  privateGroupUrl: string;
  assignedTo: string | null;
}

export interface MissionInvoiceItem {
  id: string;
  title: string;
  clientName: string | null;
  emoji: string | null;
  assignedTo: string | null;
  consumed: number;
  billed: number;
  remaining: number;
}

export interface UnbilledActivityItem {
  missionId: string;
  title: string;
  clientName: string | null;
  emoji: string | null;
  assignedTo: string | null;
  activityCount: number;
  totalUnbilled: number;
}

export interface MissionNoDateItem {
  id: string;
  title: string;
  clientName: string | null;
  emoji: string | null;
  assignedTo: string | null;
}

export interface CrmCardItem {
  id: string;
  title: string;
  company: string | null;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
  columnId: string;
  estimatedValue: number | null;
  emoji: string | null;
  assignedTo: string | null;
  category: "devis_a_faire" | "opportunites" | "devis_a_relancer";
}

export interface TrainingConventionItem {
  trainingId: string;
  trainingName: string;
  startDate: string;
  assignedTo: string | null;
  issue: "not_generated" | "not_signed" | "pending_signature";
  participantNames?: string[];
}

export interface ReviewArticleItem {
  id: string;
  title: string;
  columnId: string;
  columnName: string;
  createdAt: string;
  assignedUserIds: string[];
}

export interface BlockedArticleItem {
  id: string;
  title: string;
  columnName: string;
}

export interface UnresolvedCommentItem {
  cardId: string;
  cardTitle: string;
  commentCount: number;
  targetUserIds: string[];
}

export interface EventItem {
  id: string;
  title: string;
  eventDate: string;
  eventTime: string | null;
  location: string | null;
  assignedTo: string | null;
  daysUntil: number;
}

export interface EventNoSummaryItem {
  id: string;
  title: string;
  eventDate: string;
  assignedTo: string | null;
  daysAgo: number;
}

export interface CfpItem {
  id: string;
  title: string;
  cfpDeadline: string;
  cfpUrl: string | null;
  assignedTo: string | null;
  daysUntil: number;
}

export interface CfpReminderItem {
  id: string;
  title: string;
  cfpDeadline: string;
  eventUrl: string | null;
  assignedTo: string | null;
}

export interface TrainingInvoiceItem {
  trainingId: string;
  trainingName: string;
  endDate: string;
  assignedTo: string | null;
  daysAgo: number;
}

export interface ReservationItem {
  entityType: "mission" | "training" | "event";
  entityId: string;
  title: string;
  emoji: string | null;
  location: string;
  startDate: string;
  assignedTo: string | null;
  needsTrain: boolean;
  needsHotel: boolean;
  needsRestaurant: boolean;
  needsRoom: boolean;
  needsEquipment: boolean;
}

export interface OkrInitiativeItem {
  id: string;
  title: string;
  objectiveTitle: string;
  keyResultTitle: string;
  progressPercentage: number;
}

export interface SupportTicketItem {
  id: string;
  ticketNumber: string;
  title: string;
  type: string;
  priority: string;
  status: string;
  createdAt: string;
  daysOpen: number;
}

/** Fetch columns that have at least one assigned user (dynamic review columns) */
export async function fetchAssignedColumns(supabase: SupabaseClient): Promise<Map<string, string[]>> {
  const { data } = await supabase
    .from("content_columns")
    .select("id, assigned_user_ids")
    .not("assigned_user_ids", "eq", "{}");
  const map = new Map<string, string[]>();
  if (data) {
    for (const col of data as any[]) {
      if (col.assigned_user_ids?.length) {
        map.set(col.id, col.assigned_user_ids);
      }
    }
  }
  return map;
}

// ─── Data Fetchers ───────────────────────────────────────────────────

export async function fetchRecipients(supabase: SupabaseClient): Promise<Recipient[]> {
  const { data: allProfiles } = await supabase
    .from("profiles")
    .select("user_id, email, first_name, is_admin");

  const { data: moduleAccess } = await supabase
    .from("user_module_access")
    .select("user_id, module");

  const moduleUserIds = new Set<string>();
  (moduleAccess || []).forEach((m: any) => {
    if (["formations", "crm", "missions", "contenu", "events"].includes(m.module)) {
      moduleUserIds.add(m.user_id);
    }
  });

  return (allProfiles || [])
    .filter((p: any) => p.is_admin || moduleUserIds.has(p.user_id))
    .map((p: any) => ({
      userId: p.user_id,
      email: p.email,
      firstName: p.first_name || p.email.split("@")[0],
      isAdmin: p.is_admin === true,
    }));
}

export async function fetchMissionActions(supabase: SupabaseClient, today: string): Promise<MissionActionItem[]> {
  const { data } = await supabase
    .from("missions")
    .select("id, title, client_name, emoji, assigned_to, waiting_next_action_date, waiting_next_action_text")
    .not("waiting_next_action_text", "is", null)
    .lte("waiting_next_action_date", today)
    .in("status", ["not_started", "in_progress", "pending"]);

  if (!data) return [];
  return data
    .filter((m: any) => m.waiting_next_action_text?.trim())
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      clientName: m.client_name,
      emoji: m.emoji,
      assignedTo: m.assigned_to,
      actionText: m.waiting_next_action_text,
      actionDate: m.waiting_next_action_date,
      isOverdue: m.waiting_next_action_date < today,
    }));
}

export async function fetchElearningGroups(supabase: SupabaseClient, today: string): Promise<ElearningGroupItem[]> {
  const { data } = await supabase
    .from("trainings")
    .select("id, training_name, start_date, end_date, private_group_url, assigned_to")
    .in("format_formation", ["e_learning"])
    .not("private_group_url", "is", null)
    .lte("start_date", today);

  if (!data) return [];
  return data
    .filter((t: any) => !(t.end_date && t.end_date < today) && t.private_group_url?.trim())
    .map((t: any) => ({
      id: t.id,
      trainingName: t.training_name,
      privateGroupUrl: t.private_group_url.trim(),
      assignedTo: t.assigned_to,
    }));
}

export async function fetchMissionsToInvoice(supabase: SupabaseClient, today: string): Promise<MissionInvoiceItem[]> {
  const { data } = await supabase
    .from("missions")
    .select("id, title, client_name, consumed_amount, billed_amount, emoji, assigned_to, waiting_next_action_date")
    .in("status", ["in_progress", "completed"]);

  if (!data) return [];
  const results: MissionInvoiceItem[] = [];
  for (const m of data) {
    const consumed = Number(m.consumed_amount) || 0;
    const billed = Number(m.billed_amount) || 0;
    if (consumed <= 0 || billed >= consumed) continue;
    if (m.waiting_next_action_date && m.waiting_next_action_date > today) continue;
    results.push({
      id: m.id,
      title: m.title,
      clientName: m.client_name,
      emoji: m.emoji,
      assignedTo: m.assigned_to,
      consumed,
      billed,
      remaining: consumed - billed,
    });
  }
  return results;
}

export async function fetchUnbilledActivities(supabase: SupabaseClient, today: string): Promise<UnbilledActivityItem[]> {
  const { data: unbilledActivities } = await supabase
    .from("mission_activities")
    .select("id, mission_id, billable_amount")
    .eq("is_billed", false)
    .gt("billable_amount", 0);

  if (!unbilledActivities || unbilledActivities.length === 0) return [];

  const byMission = new Map<string, any[]>();
  for (const a of unbilledActivities) {
    const list = byMission.get(a.mission_id) || [];
    list.push(a);
    byMission.set(a.mission_id, list);
  }

  const missionIds = [...byMission.keys()];
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, client_name, emoji, assigned_to, waiting_next_action_date")
    .in("id", missionIds);

  if (!missions) return [];
  const results: UnbilledActivityItem[] = [];
  for (const m of missions) {
    if (m.waiting_next_action_date && m.waiting_next_action_date > today) continue;
    const activities = byMission.get(m.id) || [];
    const totalUnbilled = activities.reduce((sum: number, a: any) => sum + (Number(a.billable_amount) || 0), 0);
    results.push({
      missionId: m.id,
      title: m.title,
      clientName: m.client_name,
      emoji: m.emoji,
      assignedTo: m.assigned_to,
      activityCount: activities.length,
      totalUnbilled,
    });
  }
  return results;
}

export async function fetchMissionsNoStartDate(supabase: SupabaseClient, today: string): Promise<MissionNoDateItem[]> {
  const { data } = await supabase
    .from("missions")
    .select("id, title, client_name, emoji, assigned_to, waiting_next_action_date")
    .in("status", ["not_started", "in_progress"])
    .is("start_date", null);

  if (!data) return [];
  return data
    .filter((m: any) => !(m.waiting_next_action_date && m.waiting_next_action_date > today))
    .map((m: any) => ({
      id: m.id,
      title: m.title,
      clientName: m.client_name,
      emoji: m.emoji,
      assignedTo: m.assigned_to,
    }));
}

export async function fetchCrmAlerts(supabase: SupabaseClient, today: string): Promise<CrmCardItem[]> {
  const { data: crmColumns } = await supabase
    .from("crm_columns")
    .select("id, name, position")
    .eq("is_archived", false)
    .order("position", { ascending: true });

  const columns = crmColumns || [];
  const firstColumn = columns.length > 0 ? columns[0] : null;
  const contacteColumn = columns.find((c: any) => c.name.toLowerCase().includes("contact"));
  const devisEnvoyeColumn = columns.find((c: any) => c.name.toLowerCase().includes("devis envoy"));

  const targetColumnIds = new Set<string>();
  if (firstColumn) targetColumnIds.add(firstColumn.id);
  if (contacteColumn) targetColumnIds.add(contacteColumn.id);
  if (devisEnvoyeColumn) targetColumnIds.add(devisEnvoyeColumn.id);

  if (targetColumnIds.size === 0) return [];

  const { data: cards } = await supabase
    .from("crm_cards")
    .select("id, title, company, first_name, last_name, email, phone, column_id, estimated_value, emoji, assigned_to, waiting_next_action_date, next_action_done")
    .eq("sales_status", "OPEN")
    .in("column_id", [...targetColumnIds]);

  const filteredCards = (cards || []).filter((c: any) => {
    if (c.next_action_done === true) return false;
    if (!c.waiting_next_action_date) return true;
    return c.waiting_next_action_date <= today;
  });

  return filteredCards.map((card: any) => {
    let category: CrmCardItem["category"];
    if (contacteColumn && card.column_id === contacteColumn.id) {
      category = "devis_a_faire";
    } else if (devisEnvoyeColumn && card.column_id === devisEnvoyeColumn.id) {
      category = "devis_a_relancer";
    } else if (firstColumn && card.column_id === firstColumn.id) {
      category = "opportunites";
    } else {
      category = "opportunites"; // fallback
    }
    return {
      id: card.id,
      title: card.title,
      company: card.company,
      firstName: card.first_name,
      lastName: card.last_name,
      email: card.email,
      phone: card.phone,
      columnId: card.column_id,
      estimatedValue: card.estimated_value ? Number(card.estimated_value) : null,
      emoji: card.emoji,
      assignedTo: card.assigned_to,
      category,
    };
  });
}

export async function fetchTrainingConventions(supabase: SupabaseClient, today: string): Promise<TrainingConventionItem[]> {
  const { data: allTrainings } = await supabase
    .from("trainings")
    .select("id, training_name, start_date, format_formation, convention_file_url, signed_convention_urls, sponsor_email, assigned_to, is_cancelled")
    .gt("start_date", today)
    .or("is_cancelled.is.null,is_cancelled.eq.false");

  const trainings = allTrainings || [];
  const trainingIds = trainings.map((t: any) => t.id);

  const { data: allParticipants } = trainingIds.length > 0
    ? await supabase
        .from("training_participants")
        .select("id, training_id, first_name, last_name, email, convention_file_url, signed_convention_url, sponsor_email, payment_mode")
        .in("training_id", trainingIds)
    : { data: [] };

  const { data: allSignatures } = trainingIds.length > 0
    ? await supabase
        .from("convention_signatures")
        .select("training_id, recipient_email, status")
        .in("training_id", trainingIds)
    : { data: [] };

  const participantsByTraining = new Map<string, any[]>();
  for (const p of (allParticipants || [])) {
    const list = participantsByTraining.get(p.training_id) || [];
    list.push(p);
    participantsByTraining.set(p.training_id, list);
  }

  const signaturesByKey = new Map<string, string>();
  for (const sig of (allSignatures || [])) {
    signaturesByKey.set(`${sig.training_id}:${sig.recipient_email}`, sig.status);
  }

  const results: TrainingConventionItem[] = [];

  for (const t of trainings) {
    const isIntra = t.format_formation === "intra" || t.format_formation === "classe_virtuelle";
    const isInterOrElearning = t.format_formation === "inter-entreprises" || t.format_formation === "e_learning";

    // Convention non générée
    if (isIntra && !t.convention_file_url) {
      results.push({
        trainingId: t.id,
        trainingName: t.training_name,
        startDate: t.start_date,
        assignedTo: t.assigned_to,
        issue: "not_generated",
      });
    } else if (isInterOrElearning) {
      const tParticipants = participantsByTraining.get(t.id) || [];
      const missing = tParticipants.filter((p: any) => !p.convention_file_url && p.payment_mode !== "online");
      if (missing.length > 0) {
        results.push({
          trainingId: t.id,
          trainingName: t.training_name,
          startDate: t.start_date,
          assignedTo: t.assigned_to,
          issue: "not_generated",
          participantNames: missing.map((p: any) => `${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email),
        });
      }
    }

    // Convention non signée
    if (isIntra && t.convention_file_url) {
      const signedUrls = t.signed_convention_urls || [];
      if (signedUrls.length === 0) {
        const sigKey = `${t.id}:${t.sponsor_email}`;
        const sigStatus = signaturesByKey.get(sigKey);
        if (sigStatus !== "signed") {
          results.push({
            trainingId: t.id,
            trainingName: t.training_name,
            startDate: t.start_date,
            assignedTo: t.assigned_to,
            issue: sigStatus === "pending" ? "pending_signature" : "not_signed",
          });
        }
      }
    } else if (isInterOrElearning) {
      const tParticipants = participantsByTraining.get(t.id) || [];
      const unsignedNames: string[] = [];
      for (const p of tParticipants) {
        if (p.payment_mode === "online") continue;
        if (!p.convention_file_url) continue;
        if (p.signed_convention_url) continue;
        const sigKey = `${t.id}:${p.sponsor_email}`;
        const sigStatus = signaturesByKey.get(sigKey);
        if (sigStatus === "signed") continue;
        unsignedNames.push(`${p.first_name || ""} ${p.last_name || ""}`.trim() || p.email);
      }
      if (unsignedNames.length > 0) {
        results.push({
          trainingId: t.id,
          trainingName: t.training_name,
          startDate: t.start_date,
          assignedTo: t.assigned_to,
          issue: "not_signed",
          participantNames: unsignedNames,
        });
      }
    }
  }

  return results;
}

export async function fetchReviewArticles(supabase: SupabaseClient, assignedColumns: Map<string, string[]>): Promise<ReviewArticleItem[]> {
  const columnIds = [...assignedColumns.keys()];
  if (columnIds.length === 0) return [];

  const { data } = await supabase
    .from("content_cards")
    .select("id, title, column_id, created_at, content_columns:column_id(name)")
    .in("column_id", columnIds);

  if (!data) return [];
  return data
    .filter((card: any) => assignedColumns.has(card.column_id))
    .map((card: any) => ({
      id: card.id,
      title: card.title,
      columnId: card.column_id,
      columnName: (card as any).content_columns?.name || "",
      createdAt: card.created_at,
      assignedUserIds: assignedColumns.get(card.column_id) || [],
    }));
}

export async function fetchBlockedArticles(supabase: SupabaseClient): Promise<BlockedArticleItem[]> {
  const { data } = await supabase
    .from("content_cards")
    .select("id, title, column_id, content_columns:column_id(name)")
    .not("column_id", "is", null);

  if (!data) return [];
  return data
    .filter((card: any) => {
      const name = ((card as any).content_columns?.name || "").toLowerCase();
      return name.includes("bloqu") || name.includes("attente");
    })
    .map((card: any) => ({
      id: card.id,
      title: card.title,
      columnName: (card as any).content_columns?.name || "",
    }));
}

export async function fetchUnresolvedComments(supabase: SupabaseClient, assignedColumns: Map<string, string[]>): Promise<UnresolvedCommentItem[]> {
  const { data } = await supabase
    .from("review_comments")
    .select("id, card_id, author_id, content, mentioned_user_ids, assigned_to, content_cards:card_id(title, column_id, content_columns:column_id(name))")
    .eq("status", "pending")
    .is("parent_comment_id", null);

  if (!data) return [];

  // Group comments by card (article)
  const byCard = new Map<string, { cardTitle: string; commentCount: number; targetUserIds: Set<string> }>();
  for (const c of data as any[]) {
    const card = c.content_cards;
    if (!card?.column_id) continue;
    const columnUserIds = assignedColumns.get(card.column_id);
    if (!columnUserIds?.length) continue;

    const cardId = c.card_id as string;
    let group = byCard.get(cardId);
    if (!group) {
      group = { cardTitle: card?.title || "Sans titre", commentCount: 0, targetUserIds: new Set<string>() };
      byCard.set(cardId, group);
    }
    group.commentCount++;
    for (const uid of columnUserIds) group.targetUserIds.add(uid);
    if (c.author_id) group.targetUserIds.add(c.author_id);
    if (c.assigned_to) group.targetUserIds.add(c.assigned_to);
    if (c.mentioned_user_ids && Array.isArray(c.mentioned_user_ids)) {
      for (const uid of c.mentioned_user_ids) group.targetUserIds.add(uid);
    }
  }

  const results: UnresolvedCommentItem[] = [];
  for (const [cardId, group] of byCard) {
    results.push({
      cardId,
      cardTitle: group.cardTitle,
      commentCount: group.commentCount,
      targetUserIds: [...group.targetUserIds],
    });
  }
  return results;
}

export async function fetchUpcomingEvents(supabase: SupabaseClient, today: string): Promise<EventItem[]> {
  const todayDate = new Date(today);
  const fifteenDays = new Date(todayDate);
  fifteenDays.setDate(fifteenDays.getDate() + 15);
  const maxDate = fifteenDays.toISOString().split("T")[0];

  const { data } = await supabase
    .from("events")
    .select("id, title, event_date, event_time, location, assigned_to")
    .gte("event_date", today)
    .lte("event_date", maxDate)
    .eq("status", "active")
    .order("event_date", { ascending: true });

  if (!data) return [];
  return data.map((ev: any) => ({
    id: ev.id,
    title: ev.title,
    eventDate: ev.event_date,
    eventTime: ev.event_time,
    location: ev.location,
    assignedTo: ev.assigned_to,
    daysUntil: Math.ceil((new Date(ev.event_date).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

export async function fetchPastEventsNoSummary(supabase: SupabaseClient, today: string): Promise<EventNoSummaryItem[]> {
  const todayDate = new Date(today);
  // Events in the last 60 days without summary notes
  const sixtyDaysAgo = new Date(todayDate);
  sixtyDaysAgo.setDate(sixtyDaysAgo.getDate() - 60);
  const minDate = sixtyDaysAgo.toISOString().split("T")[0];

  const { data } = await supabase
    .from("events")
    .select("id, title, event_date, assigned_to, summary_notes")
    .eq("status", "active")
    .lt("event_date", today)
    .gte("event_date", minDate)
    .is("summary_notes", null)
    .order("event_date", { ascending: false });

  if (!data) return [];
  return data.map((ev: any) => ({
    id: ev.id,
    title: ev.title,
    eventDate: ev.event_date,
    assignedTo: ev.assigned_to,
    daysAgo: Math.ceil((todayDate.getTime() - new Date(ev.event_date).getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

export async function fetchCfpAlerts(supabase: SupabaseClient, today: string): Promise<CfpItem[]> {
  const todayDate = new Date(today);
  const thirtyDays = new Date(todayDate);
  thirtyDays.setDate(thirtyDays.getDate() + 30);
  const maxDate = thirtyDays.toISOString().split("T")[0];

  const { data } = await supabase
    .from("events")
    .select("id, title, cfp_deadline, cfp_url, assigned_to")
    .eq("event_type", "external")
    .eq("status", "active")
    .not("cfp_deadline", "is", null)
    .gte("cfp_deadline", today)
    .lte("cfp_deadline", maxDate)
    .order("cfp_deadline", { ascending: true });

  if (!data) return [];
  return data.map((ev: any) => ({
    id: ev.id,
    title: ev.title,
    cfpDeadline: ev.cfp_deadline,
    cfpUrl: ev.cfp_url,
    assignedTo: ev.assigned_to,
    daysUntil: Math.ceil((new Date(ev.cfp_deadline).getTime() - todayDate.getTime()) / (1000 * 60 * 60 * 24)),
  }));
}

export async function fetchCfpReminders(supabase: SupabaseClient, today: string): Promise<CfpReminderItem[]> {
  const todayDate = new Date(today);
  const tenMonthsAgo = new Date(todayDate);
  tenMonthsAgo.setMonth(tenMonthsAgo.getMonth() - 10);
  const tenMonthsAgoStr = tenMonthsAgo.toISOString().split("T")[0];
  const tenMonthsAgoMinus7 = new Date(tenMonthsAgo);
  tenMonthsAgoMinus7.setDate(tenMonthsAgoMinus7.getDate() - 7);
  const tenMonthsAgoMinus7Str = tenMonthsAgoMinus7.toISOString().split("T")[0];

  const { data } = await supabase
    .from("events")
    .select("id, title, cfp_deadline, event_url, assigned_to")
    .eq("event_type", "external")
    .not("cfp_deadline", "is", null)
    .gte("cfp_deadline", tenMonthsAgoMinus7Str)
    .lte("cfp_deadline", tenMonthsAgoStr);

  if (!data) return [];
  return data.map((ev: any) => ({
    id: ev.id,
    title: ev.title,
    cfpDeadline: ev.cfp_deadline,
    eventUrl: ev.event_url,
    assignedTo: ev.assigned_to,
  }));
}

export async function fetchPastTrainingsNoInvoice(supabase: SupabaseClient, today: string): Promise<TrainingInvoiceItem[]> {
  const { data: pastTrainings } = await supabase
    .from("trainings")
    .select("id, training_name, start_date, end_date, invoice_file_url, assigned_to, format_formation, session_type, is_cancelled")
    .lt("start_date", today)
    .is("invoice_file_url", null)
    .or("is_cancelled.is.null,is_cancelled.eq.false");

  if (!pastTrainings) return [];

  const pastTrainingIds = pastTrainings
    .filter((t: any) => {
      const endDate = t.end_date || t.start_date;
      return new Date(endDate) < new Date(today);
    })
    .map((t: any) => t.id);

  const participantsByTraining = new Map<string, any[]>();
  if (pastTrainingIds.length > 0) {
    const { data: pts } = await supabase
      .from("training_participants")
      .select("training_id, payment_mode, invoice_file_url")
      .in("training_id", pastTrainingIds);
    if (pts) {
      for (const p of pts) {
        const list = participantsByTraining.get(p.training_id) || [];
        list.push(p);
        participantsByTraining.set(p.training_id, list);
      }
    }
  }

  const results: TrainingInvoiceItem[] = [];
  for (const t of pastTrainings) {
    const endDate = t.end_date || t.start_date;
    if (new Date(endDate) >= new Date(today)) continue;

    const participants = participantsByTraining.get(t.id) || [];
    if (participants.length > 0) {
      const allPaidOnline = participants.every((p: any) => p.payment_mode === "online");
      if (allPaidOnline) continue;

      const isInterOrElearning = ["inter-entreprises", "e_learning"].includes(t.format_formation) || t.session_type === "inter";
      if (isInterOrElearning) {
        const invoiceParticipants = participants.filter((p: any) => p.payment_mode !== "online");
        const allInvoiced = invoiceParticipants.length > 0 && invoiceParticipants.every((p: any) => p.invoice_file_url);
        if (allInvoiced) continue;
      }
    }

    results.push({
      trainingId: t.id,
      trainingName: t.training_name,
      endDate,
      assignedTo: t.assigned_to,
      daysAgo: Math.ceil((Date.now() - new Date(endDate).getTime()) / (1000 * 60 * 60 * 24)),
    });
  }
  return results;
}

export async function fetchReservationAlerts(supabase: SupabaseClient, today: string): Promise<ReservationItem[]> {
  const todayDate = new Date(today);
  const sixtyDaysLater = new Date(todayDate);
  sixtyDaysLater.setDate(sixtyDaysLater.getDate() + 60);
  const sixtyDaysStr = sixtyDaysLater.toISOString().split("T")[0];

  const results: ReservationItem[] = [];

  // Missions
  const { data: missions } = await supabase
    .from("missions")
    .select("id, title, client_name, location, start_date, train_booked, hotel_booked, assigned_to, emoji")
    .not("location", "is", null)
    .not("start_date", "is", null)
    .gte("start_date", today)
    .lte("start_date", sixtyDaysStr)
    .in("status", ["pending", "in_progress", "not_started"]);

  if (missions) {
    for (const m of missions) {
      if (!m.location?.trim()) continue;
      const needsTrain = !m.train_booked;
      const needsHotel = !m.hotel_booked;
      if (!needsTrain && !needsHotel) continue;
      results.push({
        entityType: "mission",
        entityId: m.id,
        title: m.title,
        emoji: m.emoji,
        location: m.location,
        startDate: m.start_date,
        assignedTo: m.assigned_to,
        needsTrain, needsHotel,
        needsRestaurant: false, needsRoom: false, needsEquipment: false,
      });
    }
  }

  // Trainings
  const { data: trainings } = await supabase
    .from("trainings")
    .select("id, training_name, location, start_date, train_booked, hotel_booked, restaurant_booked, room_rental_booked, equipment_ready, format_formation, session_type, assigned_to, is_cancelled")
    .not("start_date", "is", null)
    .gte("start_date", today)
    .lte("start_date", sixtyDaysStr)
    .or("is_cancelled.is.null,is_cancelled.eq.false");

  if (trainings) {
    for (const t of trainings) {
      const hasLocation = t.location?.trim();
      const isPresentiel = t.format_formation !== "e_learning" && t.format_formation !== "classe_virtuelle";
      const isInter = t.format_formation === "inter-entreprises" || t.session_type === "inter";

      let needsTrain = false, needsHotel = false, needsRestaurant = false, needsRoom = false, needsEquipment = false;
      if (isPresentiel && hasLocation) {
        needsTrain = !t.train_booked;
        needsHotel = !t.hotel_booked;
        if (isInter) needsRestaurant = !t.restaurant_booked;
        needsRoom = !t.room_rental_booked;
      }
      if (isPresentiel) needsEquipment = !t.equipment_ready;

      if (!needsTrain && !needsHotel && !needsRestaurant && !needsRoom && !needsEquipment) continue;

      results.push({
        entityType: "training",
        entityId: t.id,
        title: t.training_name,
        emoji: "🎓",
        location: hasLocation ? t.location : "",
        startDate: t.start_date,
        assignedTo: t.assigned_to,
        needsTrain, needsHotel, needsRestaurant, needsRoom, needsEquipment,
      });
    }
  }

  // Events
  const { data: events } = await supabase
    .from("events")
    .select("id, title, event_date, location, location_type, event_type, train_booked, hotel_booked, room_rental_booked, restaurant_booked, assigned_to")
    .eq("event_type", "internal")
    .eq("location_type", "physical")
    .eq("status", "active")
    .not("location", "is", null)
    .gte("event_date", today)
    .lte("event_date", sixtyDaysStr);

  if (events) {
    for (const ev of events) {
      if (!ev.location?.trim()) continue;
      const needsTrain = !ev.train_booked;
      const needsHotel = !ev.hotel_booked;
      const needsRoom = !ev.room_rental_booked;
      const needsRestaurant = !ev.restaurant_booked;
      if (!needsTrain && !needsHotel && !needsRoom && !needsRestaurant) continue;
      results.push({
        entityType: "event",
        entityId: ev.id,
        title: ev.title,
        emoji: "📅",
        location: ev.location,
        startDate: ev.event_date,
        assignedTo: ev.assigned_to,
        needsTrain, needsHotel, needsRestaurant, needsRoom,
        needsEquipment: false,
      });
    }
  }

  return results;
}

export async function fetchOkrInitiatives(supabase: SupabaseClient): Promise<OkrInitiativeItem[]> {
  const { data: activeInitiatives } = await supabase
    .from("okr_initiatives")
    .select("id, title, progress_percentage, key_result_id, status")
    .in("status", ["active", "draft"]);

  if (!activeInitiatives || activeInitiatives.length === 0) return [];

  const krIds = [...new Set(activeInitiatives.map((i: any) => i.key_result_id))];
  const { data: keyResults } = await supabase
    .from("okr_key_results")
    .select("id, title, objective_id")
    .in("id", krIds);

  let objectiveMap: Record<string, any> = {};
  if (keyResults && keyResults.length > 0) {
    const objIds = [...new Set(keyResults.map((kr: any) => kr.objective_id))];
    const { data: objectives } = await supabase
      .from("okr_objectives")
      .select("id, title, status")
      .in("id", objIds)
      .in("status", ["active"]);
    if (objectives) {
      for (const o of objectives) objectiveMap[o.id] = o;
    }
  }

  const krMap: Record<string, any> = {};
  if (keyResults) {
    for (const kr of keyResults) krMap[kr.id] = kr;
  }

  const results: OkrInitiativeItem[] = [];
  for (const init of activeInitiatives) {
    const kr = krMap[init.key_result_id];
    if (!kr) continue;
    const obj = objectiveMap[kr.objective_id];
    if (!obj) continue;
    results.push({
      id: init.id,
      title: init.title,
      objectiveTitle: obj.title,
      keyResultTitle: kr.title,
      progressPercentage: init.progress_percentage,
    });
  }
  return results;
}

/**
 * Fetch pending support tickets (nouveau, en_cours, en_attente).
 * Excludes resolved/closed tickets.
 */
export async function fetchPendingSupportTickets(supabase: SupabaseClient, today: string): Promise<SupportTicketItem[]> {
  const PENDING_STATUSES = ["nouveau", "en_cours", "en_attente"];

  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, ticket_number, title, type, priority, status, created_at")
    .in("status", PENDING_STATUSES)
    .order("priority", { ascending: true })
    .order("created_at", { ascending: true });

  if (error) {
    console.error("fetchPendingSupportTickets error:", error.message);
    return [];
  }
  if (!data || data.length === 0) return [];

  return data.map((t: any) => {
    const created = t.created_at?.slice(0, 10) || today;
    const daysOpen = Math.max(0, Math.floor((new Date(today).getTime() - new Date(created).getTime()) / 86400000));
    return {
      id: t.id,
      ticketNumber: t.ticket_number,
      title: t.title,
      type: t.type,
      priority: t.priority,
      status: t.status,
      createdAt: created,
      daysOpen,
    };
  });
}

// ─── Convenience: fetch everything at once ───────────────────────────

export interface DailyData {
  recipients: Recipient[];
  missionActions: MissionActionItem[];
  elearningGroups: ElearningGroupItem[];
  missionsToInvoice: MissionInvoiceItem[];
  unbilledActivities: UnbilledActivityItem[];
  missionsNoStartDate: MissionNoDateItem[];
  crmCards: CrmCardItem[];
  trainingConventions: TrainingConventionItem[];
  reviewArticles: ReviewArticleItem[];
  blockedArticles: BlockedArticleItem[];
  unresolvedComments: UnresolvedCommentItem[];
  upcomingEvents: EventItem[];
  cfpAlerts: CfpItem[];
  cfpReminders: CfpReminderItem[];
  pastTrainingsNoInvoice: TrainingInvoiceItem[];
  pastEventsNoSummary: EventNoSummaryItem[];
  reservations: ReservationItem[];
  okrInitiatives: OkrInitiativeItem[];
  supportTickets: SupportTicketItem[];
}

export async function fetchAllDailyData(supabase: SupabaseClient, today: string): Promise<DailyData> {
  // Fetch dynamic column assignments first (needed by review & comment fetchers)
  const assignedColumns = await fetchAssignedColumns(supabase);

  const [
    recipients,
    missionActions,
    elearningGroups,
    missionsToInvoice,
    unbilledActivities,
    missionsNoStartDate,
    crmCards,
    trainingConventions,
    reviewArticles,
    blockedArticles,
    unresolvedComments,
    upcomingEvents,
    cfpAlerts,
    cfpReminders,
    pastTrainingsNoInvoice,
    pastEventsNoSummary,
    reservations,
    okrInitiatives,
    supportTickets,
  ] = await Promise.all([
    fetchRecipients(supabase),
    fetchMissionActions(supabase, today),
    fetchElearningGroups(supabase, today),
    fetchMissionsToInvoice(supabase, today),
    fetchUnbilledActivities(supabase, today),
    fetchMissionsNoStartDate(supabase, today),
    fetchCrmAlerts(supabase, today),
    fetchTrainingConventions(supabase, today),
    fetchReviewArticles(supabase, assignedColumns),
    fetchBlockedArticles(supabase),
    fetchUnresolvedComments(supabase, assignedColumns),
    fetchUpcomingEvents(supabase, today),
    fetchCfpAlerts(supabase, today),
    fetchCfpReminders(supabase, today),
    fetchPastTrainingsNoInvoice(supabase, today),
    fetchPastEventsNoSummary(supabase, today),
    fetchReservationAlerts(supabase, today),
    fetchOkrInitiatives(supabase),
    fetchPendingSupportTickets(supabase, today),
  ]);

  return {
    recipients, missionActions, elearningGroups, missionsToInvoice,
    unbilledActivities, missionsNoStartDate, crmCards, trainingConventions,
    reviewArticles, blockedArticles, unresolvedComments, upcomingEvents,
    cfpAlerts, cfpReminders, pastTrainingsNoInvoice, pastEventsNoSummary,
    reservations, okrInitiatives, supportTickets,
  };
}

// ─── Visibility helpers ──────────────────────────────────────────────

export function userCanSee(recipient: Recipient, assignedTo: string | null): boolean {
  if (recipient.isAdmin) return true;
  if (!assignedTo) return false;
  return assignedTo === recipient.userId;
}
