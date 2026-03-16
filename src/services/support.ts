import { supabase } from "@/integrations/supabase/client";
import { sanitizeFileName } from "@/lib/file-utils";
import type { SupportTicket, TicketStatus, TicketAiAnalysis } from "@/types/support";

export async function fetchSupportTickets(): Promise<SupportTicket[]> {
  const { data, error } = await (supabase as any)
    .from("support_tickets")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
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
  const { data, error } = await (supabase as any)
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
  if (error) throw error;

  // Upload attachments if any
  if (files && files.length > 0) {
    for (const file of files) {
      const filePath = `${data.id}/${Date.now()}_${sanitizeFileName(file.name)}`;
      await supabase.storage.from("support-attachments").upload(filePath, file);
      await (supabase as any).from("support_ticket_attachments").insert({
        ticket_id: data.id,
        file_name: file.name,
        file_path: filePath,
        file_size: file.size,
        mime_type: file.type,
      });
    }
  }

  return data;
}

function withResolvedAt(payload: Record<string, unknown>, status?: string): Record<string, unknown> {
  if (status === "resolu" || status === "ferme") {
    return { ...payload, resolved_at: new Date().toISOString() };
  }
  return payload;
}

export async function updateSupportTicket(
  id: string,
  updates: Partial<Pick<SupportTicket, "title" | "type" | "status" | "priority" | "assigned_to" | "resolution_notes" | "position" | "page_url">>
): Promise<SupportTicket> {
  const payload = withResolvedAt({ ...updates }, updates.status);
  const { data, error } = await (supabase as any)
    .from("support_tickets")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function moveSupportTicket(
  id: string,
  newStatus: TicketStatus,
  newPosition: number
): Promise<void> {
  const payload = withResolvedAt({ status: newStatus, position: newPosition }, newStatus);
  const { error } = await (supabase as any)
    .from("support_tickets")
    .update(payload)
    .eq("id", id);
  if (error) throw error;
}
