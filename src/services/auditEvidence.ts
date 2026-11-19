import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export interface AuditEvidence {
  id: string;
  question_id: string;
  indicator: number;
  answer: "oui" | "non";
  evidence_summary: string;
  evidence_urls: string[];
  evidence_details: Json | null;
  checked_at: string;
  recorded_at: string;
  source_type: "human" | "agent";
  source_label: string;
  recorded_by: string | null;
}

export async function fetchAuditEvidence(): Promise<AuditEvidence[]> {
  const { data, error } = await supabase
    .from("audit_question_evidence")
    .select("*")
    .order("recorded_at", { ascending: false })
    .limit(1000);
  if (error) throw error;
  return (data ?? []) as AuditEvidence[];
}

export interface HumanEvidenceInput {
  question_id: string;
  indicator: number;
  answer: "oui" | "non";
  summary: string;
  sourceLabel: string;
}

export async function recordHumanEvidence(rows: HumanEvidenceInput[], userId: string) {
  if (rows.length === 0) return;
  const now = new Date().toISOString();
  const { error } = await supabase.from("audit_question_evidence").insert(rows.map((r) => ({
    question_id: r.question_id,
    indicator: r.indicator,
    answer: r.answer,
    evidence_summary: r.summary,
    checked_at: now,
    source_type: "human",
    source_label: r.sourceLabel,
    recorded_by: userId,
  })));
  if (error) throw error;
}
