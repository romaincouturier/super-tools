import type { KanbanCardDef, KanbanColumnDef } from "./kanban";

export type TicketType = "bug" | "evolution";
export type TicketPriority = "low" | "medium" | "high" | "critical";
export type TicketStatus = "nouveau" | "qualification" | "vibe_coding" | "resolu";

export interface BugAnalysis {
  type: "bug";
  title: string;
  priority: TicketPriority;
  constat: string;
  reproduction: string;
  situation_desiree: string;
  procedure_test: string;
}

export interface EvolutionAnalysis {
  type: "evolution";
  title: string;
  priority: TicketPriority;
  user_stories: string;
  criteres_acceptation: string;
  impact_produit: string;
}

export type TicketAiAnalysis = BugAnalysis | EvolutionAnalysis;

export interface SupportTicket {
  id: string;
  ticket_number: string;
  type: TicketType;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  position: number;
  page_url: string | null;
  screenshot_url: string | null;
  submitted_by: string | null;
  submitted_by_email: string | null;
  assigned_to: string | null;
  resolution_notes: string | null;
  ai_analysis: TicketAiAnalysis | null;
  created_at: string;
  updated_at: string;
  resolved_at: string | null;
}

export interface SupportTicketCard extends KanbanCardDef {
  ticket: SupportTicket;
  columnId: string;
}

export const SUPPORT_COLUMNS: KanbanColumnDef[] = [
  { id: "nouveau", name: "Nouveau", position: 0, color: "#6b7280" },
  { id: "qualification", name: "Qualification", position: 1, color: "#f59e0b" },
  { id: "vibe_coding", name: "Vibe Coding", position: 2, color: "#3b82f6" },
  { id: "resolu", name: "Résolu", position: 3, color: "#22c55e" },
];

export const TICKET_TYPE_CONFIG: Record<TicketType, { label: string; color: string }> = {
  bug: { label: "Bug", color: "#ef4444" },
  evolution: { label: "Évolution", color: "#8b5cf6" },
};

export const TICKET_PRIORITY_CONFIG: Record<TicketPriority, { label: string; color: string }> = {
  low: { label: "Basse", color: "#6b7280" },
  medium: { label: "Moyenne", color: "#f59e0b" },
  high: { label: "Haute", color: "#f97316" },
  critical: { label: "Critique", color: "#ef4444" },
};
