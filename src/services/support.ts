import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName, resolveContentType } from "@/lib/file-utils";
import { db, throwIfError } from "@/lib/supabase-helpers";
import type { SupportTicket, TicketStatus, TicketAiAnalysis } from "@/types/support";
import type { KanbanRepository } from "./repository";

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  const result = await db().from("support_tickets").select("*").order("created_at", { ascending: false });
  return (throwIfError(result) || []) as SupportTicket[];
}

export async function fetchSupportTicketById(id: string): Promise<SupportTicket> {
  const result = await db().from("support_tickets").select("*").eq("id", id).single();
  return throwIfError(result) as SupportTicket;
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
    for (const file of files) {
      const filePath = `${data.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
      await supabase.storage.from("support-attachments").upload(filePath, file);
      await db().from("support_ticket_attachments").insert({
        ticket_id: data.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: resolveContentType(file),
      });
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

const RESOLVED_STATUSES: TicketStatus[] = ["resolu", "ferme"];

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
        ticketTitle: ticket.title,
        status: ticket.status,
        resolutionNotes: ticket.resolution_notes || null,
      },
    });
  } catch (err) {
    console.error("Failed to send support notification:", err);
  }
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
