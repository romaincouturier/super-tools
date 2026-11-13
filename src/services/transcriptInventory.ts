import { supabase } from "@/integrations/supabase/client";
import { FunctionsHttpError } from "@supabase/supabase-js";

export interface TranscriptInventoryItem {
  external_id: string;
  title: string;
  date?: string;
  state: string;
  detail?: string;
  transcript_id?: string;
}
export interface TranscriptInventoryRun {
  id: string;
  source: "fireflies" | "google_drive";
  status: "running" | "complete" | "incomplete";
  created_at: string;
  completed_at?: string;
  updated_at: string;
  items: TranscriptInventoryItem[];
  summary: Record<string, number>;
  errors: string[];
  cursor: { phase?: string; detail_index?: number; skip?: number; index?: number; queue?: string[] };
}

export async function fetchTranscriptInventories(): Promise<TranscriptInventoryRun[]> {
  const { data, error } = await supabase.from("transcript_inventory_runs").select("*").order("created_at", { ascending: false }).limit(20);
  if (error) throw error;
  return data as unknown as TranscriptInventoryRun[];
}

export async function controlTranscriptInventory(body: { action: "start" | "continue" | "refresh" | "repair"; source?: string; run_id?: string; external_id?: string }): Promise<TranscriptInventoryRun> {
  const { data, error } = await supabase.functions.invoke("drive-list-check", { body });
  if (error) {
    if (error instanceof FunctionsHttpError) {
      const payload = await error.context.json().catch(() => null);
      throw new Error(payload?.error ?? error.message);
    }
    throw error;
  }
  return data.run;
}