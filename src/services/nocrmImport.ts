import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface NocrmImportRun {
  id: string;
  mode: "simulation" | "test" | "full";
  status: "running" | "done" | "error" | "reconciliation_failed";
  leads_path: string;
  comments_path: string;
  lead_limit: number | null;
  cursor: number;
  total_leads: number;
  batches_done: number;
  created_count: number;
  updated_count: number;
  merged_count: number;
  skipped_count: number;
  notes_count: number;
  activities_count: number;
  errors: Array<{ nocrm_id?: string; error: string }>;
  report: any;
  reconciliation: { ok: boolean; checks: Array<{ key: string; expected_spec: number; expected_file: number; actual: number; ok: boolean }>; won_value_in_crm: number } | null;
  started_at: string;
  finished_at: string | null;
}

/** Envoie les deux CSV au serveur, qui les range dans un espace privé. */
export async function uploadNocrmFiles(leads: File, comments: File) {
  const [leadsCsv, commentsCsv] = await Promise.all([leads.text(), comments.text()]);
  const { data, error } = await supabase.functions.invoke("nocrm-import", { body: { action: "upload", leadsCsv, commentsCsv } });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    throw new Error(details);
  }
  if (data?.error) throw new Error(data.error);
  return data as { leadsPath: string; commentsPath: string };
}

async function call(body: Record<string, unknown>): Promise<NocrmImportRun> {
  const { data, error } = await supabase.functions.invoke("nocrm-import", { body });
  if (error) {
    const details = error instanceof FunctionsHttpError ? await error.context.text() : error.message;
    let msg = details;
    try { msg = JSON.parse(details).error ?? details; } catch (parseError) { void parseError; }
    throw new Error(msg);
  }
  if (data?.error) throw new Error(data.error);
  return data.run as NocrmImportRun;
}

export const simulateNocrmImport = (leadsPath: string, commentsPath: string) => call({ action: "simulate", leadsPath, commentsPath });
export const startNocrmImport = (mode: "test" | "full", leadsPath: string, commentsPath: string) => call({ action: "start", mode, leadsPath, commentsPath });
export const stepNocrmImport = (runId: string) => call({ action: "step", runId });
export const reconcileNocrmImport = (runId: string) => call({ action: "reconcile", runId });

export async function listNocrmImportRuns(): Promise<NocrmImportRun[]> {
  const { data, error } = await supabase.from("nocrm_import_runs").select("*").order("started_at", { ascending: false }).limit(20);
  if (error) throw error;
  return (data ?? []) as unknown as NocrmImportRun[];
}
