import { supabase } from "@/integrations/supabase/client";
import { db, throwIfError } from "@/lib/supabase-helpers";
import type { SupportTicket, TicketStatus, TicketAiAnalysis } from "@/types/support";
import type { KanbanRepository } from "./repository";
import { MODULE_LABELS, type AppModule } from "@/hooks/useModuleAccess";

/** Maps the first path segment of a page URL to a human module label. */
function moduleLabelFromPageUrl(pageUrl: string | null | undefined): string | null {
  if (!pageUrl) return null;
  let path = pageUrl;
  try {
    path = new URL(pageUrl, "http://x").pathname;
  } catch {
    // pageUrl may already be a path
  }
  const seg = path.split("/").filter(Boolean)[0];
  if (!seg) return null;
  const map: Record<string, AppModule> = {
    "dashboard": "parametres",
    "micro-devis": "micro_devis",
    "historique": "historique",
    "parametres": "parametres",
    "formations": "formations",
    "besoins": "besoins",
    "evaluations": "evaluations",
    "ameliorations": "ameliorations",
    "contenu": "contenu",
    "emails": "emails",
    "emails-a-valider": "emails",
    "emails-erreur": "emails",
    "web-analytics": "web_analytics",
    "crm": "crm",
    "missions": "missions",
    "okr": "okr",
    "medias": "medias",
    "events": "events",
    "monitoring": "monitoring",
    "screenshots": "screenshots",
    "catalogue": "catalogue",
    "lms": "lms",
    "certificates": "certificates",
    "support": "support",
    "supertilt": "supertilt",
    "veille": "veille",
    "reseau": "reseau",
    "reclamations": "reclamations",
    "arena": "arena",
    "finances": "finances",
    "statistiques": "statistiques",
  };
  const mod = map[seg];
  return mod ? MODULE_LABELS[mod] : null;
}

/**
 * Resolves the displayable screenshot URL for a ticket by looking up the first
 * image attachment in the public `support-attachments` bucket and resolving the
 * direct public URL. Falls back to whatever was stored historically in
 * `screenshot_url`.
 */
async function resolveTicketScreenshots<T extends { id: string; screenshot_url: string | null }>(
  tickets: T[]
): Promise<T[]> {
  if (tickets.length === 0) return tickets;
  const ids = tickets.map((t) => t.id);
  const { data: attachments } = await db()
    .from("support_ticket_attachments")
    .select("ticket_id, file_path, mime_type, created_at")
    .in("ticket_id", ids)
    .order("created_at", { ascending: true });

  const firstImageByTicket = new Map<string, string>();
  for (const a of (attachments || []) as Array<{ ticket_id: string; file_path: string; mime_type: string | null }>) {
    if (firstImageByTicket.has(a.ticket_id)) continue;
    const mime = (a.mime_type || "").toLowerCase();
    const isImage = mime.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg)$/i.test(a.file_path);
    if (isImage) firstImageByTicket.set(a.ticket_id, a.file_path);
  }

  // Extract file path from a stored screenshot_url (legacy rows may store full URLs).
  const extractPath = (url: string | null): string | null => {
    if (!url) return null;
    const m = url.match(/\/storage\/v1\/object\/(?:public|sign)\/support-attachments\/([^?]+)/);
    return m ? decodeURIComponent(m[1]) : null;
  };

  for (const t of tickets) {
    const path = firstImageByTicket.get(t.id) ?? extractPath(t.screenshot_url);
    if (!path) continue;
    const { data } = supabase.storage.from("support-attachments").getPublicUrl(path);
    if (data?.publicUrl) t.screenshot_url = data.publicUrl;
  }

  return tickets;
}

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  const result = await db().from("support_tickets").select("*").is("archived_at", null).order("created_at", { ascending: false });
  const tickets = (throwIfError(result) || []) as SupportTicket[];
  return resolveTicketScreenshots(tickets);
}

export async function fetchSupportTicketById(id: string): Promise<SupportTicket> {
  const result = await db().from("support_tickets").select("*").eq("id", id).single();
  const ticket = throwIfError(result) as SupportTicket;
  const [enriched] = await resolveTicketScreenshots([ticket]);
  return enriched;
}

export async function deleteSupportTicket(id: string): Promise<void> {
  const result = await db().from("support_tickets").delete().eq("id", id);
  throwIfError(result);
}

export async function analyzeTicket(description: string): Promise<TicketAiAnalysis> {
  const { data, error } = await supabase.functions.invoke("support-analyze-ticket", {
    body: { description },
  });
  if (error) throw error;
  return data.analysis as TicketAiAnalysis;
}

export async function createSupportTicket(
  input: Pick<SupportTicket, "type" | "title" | "description" | "priority" | "page_url"> & {
    files?: File[];
    ai_analysis?: TicketAiAnalysis | null;
  }
): Promise<SupportTicket> {
  const { data: { user } } = await supabase.auth.getUser();
  const { files, ai_analysis, ...ticketInput } = input;
  const result = await db()
    .from("support_tickets")
    .insert({
      ...ticketInput,
      ticket_number: "",
      submitted_by: user?.id || null,
      submitted_by_email: user?.email || null,
      ai_analysis: ai_analysis || null,
    })
    .select()
    .single();
  const data = throwIfError(result) as SupportTicket;

  if (files && files.length > 0) {
    let firstImageUrl: string | null = null;
    for (const file of files) {
      const formData = new FormData();
      formData.append("ticketId", data.id);
      formData.append("file", file);

      const { data: uploadData, error: uploadError } = await supabase.functions.invoke(
        "upload-support-attachment",
        { body: formData },
      );

      if (uploadError) {
        console.error("[createSupportTicket] attachment upload failed:", uploadError);
        continue;
      }

      if (!firstImageUrl && uploadData?.isImage && uploadData?.fileUrl) {
        firstImageUrl = uploadData.fileUrl;
      }
    }
    if (firstImageUrl) {
      await db().from("support_tickets").update({ screenshot_url: firstImageUrl }).eq("id", data.id);
      data.screenshot_url = firstImageUrl;
    }
  }

  // Notify admin of new ticket and send a confirmation copy to the submitter
  // (both fire-and-forget; failures are logged, ticket creation succeeds either way)
  notifyNewTicket(data);
  notifyNewTicketCopy(data);

  return data;
}

/** Best-effort email to admin when a new ticket is submitted. */
async function notifyNewTicket(ticket: SupportTicket): Promise<void> {
  try {
    await supabase.functions.invoke("send-support-notification", {
      body: {
        type: "new_ticket",
        ticketNumber: ticket.ticket_number,
        ticketTitle: ticket.title,
        ticketType: ticket.type,
        ticketPriority: ticket.priority,
        description: ticket.description,
        submittedByEmail: ticket.submitted_by_email,
      },
    });
  } catch (err) {
    console.error("Failed to send new ticket notification:", err);
  }
}

/** Best-effort confirmation copy to the submitter of a new ticket. */
async function notifyNewTicketCopy(ticket: SupportTicket): Promise<void> {
  if (!ticket.submitted_by_email) return;
  try {
    await supabase.functions.invoke("send-support-notification", {
      body: {
        type: "new_ticket_copy",
        recipientEmail: ticket.submitted_by_email,
        ticketNumber: ticket.ticket_number,
        ticketTitle: ticket.title,
        ticketType: ticket.type,
        ticketPriority: ticket.priority,
        description: ticket.description,
      },
    });
  } catch (err) {
    console.error("Failed to send new ticket copy:", err);
  }
}

const RESOLVED_STATUSES: TicketStatus[] = ["resolu"];

function withResolvedAt(payload: Record<string, unknown>, status?: string): Record<string, unknown> {
  if (status && RESOLVED_STATUSES.includes(status as TicketStatus)) {
    return { ...payload, resolved_at: new Date().toISOString() };
  }
  return payload;
}

/** Best-effort email to the ticket submitter when the ticket is resolved/closed. */
async function notifyTicketResolved(ticket: SupportTicket): Promise<void> {
  if (!ticket.submitted_by_email) return;
  try {
    await supabase.functions.invoke("send-support-notification", {
      body: {
        recipientEmail: ticket.submitted_by_email,
        ticketNumber: ticket.ticket_number,
        ticketId: ticket.id,
        ticketTitle: ticket.title,
        moduleLabel: moduleLabelFromPageUrl(ticket.page_url),
        description: ticket.description || null,
        status: ticket.status,
        resolutionNotes: ticket.resolution_notes || null,
      },
    });
  } catch (err) {
    console.error("Failed to send support notification:", err);
  }
}

/** Best-effort email asking the submitter to schedule a discussion. */
export async function requestTicketDiscussion(ticket: SupportTicket): Promise<void> {
  if (!ticket.submitted_by_email) {
    throw new Error("Pas d'email pour ce ticket");
  }
  const { error } = await supabase.functions.invoke("send-support-notification", {
    body: {
      type: "discussion_request",
      recipientEmail: ticket.submitted_by_email,
      ticketNumber: ticket.ticket_number,
      ticketTitle: ticket.title,
      description: ticket.description,
    },
  });
  if (error) throw error;
  await db()
    .from("support_tickets")
    .update({ discussion_requested_at: new Date().toISOString() })
    .eq("id", ticket.id);
}

export async function updateSupportTicket(
  id: string,
  updates: Partial<Pick<SupportTicket, "title" | "type" | "status" | "priority" | "assigned_to" | "resolution_notes" | "position" | "page_url" | "ai_analysis">>
): Promise<SupportTicket> {
  const payload = withResolvedAt({ ...updates }, updates.status);
  const result = await db().from("support_tickets").update(payload).eq("id", id).select().single();
  const data = throwIfError(result) as SupportTicket;

  if (updates.status && RESOLVED_STATUSES.includes(updates.status as TicketStatus)) {
    notifyTicketResolved(data);
  }

  return data;
}

export async function moveSupportTicket(
  id: string,
  newStatus: TicketStatus,
  newPosition: number
): Promise<void> {
  const payload = withResolvedAt({ status: newStatus, position: newPosition }, newStatus);
  const result = await db().from("support_tickets").update(payload).eq("id", id).select().single();
  const data = throwIfError(result) as SupportTicket;

  if (RESOLVED_STATUSES.includes(newStatus)) {
    notifyTicketResolved(data);
  }
}

// ── Compile-time contract check ─────────────────────────────────────
type CreateTicketInput = Pick<SupportTicket, "type" | "title" | "description" | "priority" | "page_url"> & {
  files?: File[];
  ai_analysis?: TicketAiAnalysis | null;
};
type UpdateTicketInput = Partial<Pick<SupportTicket, "title" | "type" | "status" | "priority" | "assigned_to" | "resolution_notes" | "position" | "page_url" | "ai_analysis">>;

({
  fetch: fetchSupportTickets,
  fetchById: fetchSupportTicketById,
  create: createSupportTicket,
  update: updateSupportTicket,
  remove: deleteSupportTicket,
  move: moveSupportTicket,
}) satisfies KanbanRepository<SupportTicket, CreateTicketInput, UpdateTicketInput, TicketStatus>;
