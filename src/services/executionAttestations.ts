import { supabase } from "@/integrations/supabase/client";
import type { Tables, TablesUpdate } from "@/integrations/supabase/types";

export type ExecutionAttestation = Tables<"execution_attestations">;
export type ExecutionAttestationPatch = Pick<TablesUpdate<"execution_attestations">,
  "client_name" | "client_address" | "signer_name" | "signer_function" | "signer_email" | "is_public_entity" |
  "public_entity_name" | "public_contract_reference" | "subject" | "start_date" | "end_date" | "location" |
  "participants_count" | "days_count" | "amount_ht" | "free_text" | "certification_text" | "link_validity_days" |
  "provider_name" | "provider_siren" | "provider_nda" | "provider_address">;

export interface AttestationFilter { missionId?: string; trainingId?: string }

export async function listExecutionAttestations(filter: AttestationFilter = {}) {
  let q = supabase.from("execution_attestations").select("*").order("created_at", { ascending: false });
  if (filter.missionId) q = q.eq("mission_id", filter.missionId);
  if (filter.trainingId) q = q.eq("training_id", filter.trainingId);
  const { data, error } = await q;
  if (error) throw error;
  return data;
}

export async function createExecutionAttestation(source: AttestationFilter) {
  const { data, error } = await supabase.rpc("create_execution_attestation", {
    p_mission_id: source.missionId ?? undefined, p_training_id: source.trainingId ?? undefined, p_overrides: {},
  });
  if (error) throw error;
  return data as ExecutionAttestation;
}

export async function updateExecutionAttestation(id: string, patch: ExecutionAttestationPatch) {
  const { data, error } = await supabase.from("execution_attestations").update(patch).eq("id", id).select("*").single();
  if (error) throw error;
  return data;
}

export async function cancelExecutionAttestation(id: string) {
  const { error } = await supabase.from("execution_attestations").update({ status: "cancelled" }).eq("id", id);
  if (error) throw error;
}

export function attestationSignUrl(token: string) {
  return `${window.location.origin}/attestation/${token}`;
}

export async function generateExecutionAttestationLink(id: string) {
  const { data, error } = await supabase.rpc("generate_execution_attestation_link", { p_id: id });
  if (error) throw error;
  const d = data as { token: string; expires_at: string };
  return { url: attestationSignUrl(d.token), expiresAt: d.expires_at };
}

export async function getSignedAttestationPdfUrl(path: string) {
  const { data, error } = await supabase.storage.from("attestations").createSignedUrl(path, 600);
  if (error) throw error;
  return data.signedUrl;
}

export async function fetchPublicAttestation(token: string) {
  const { data, error } = await supabase.functions.invoke("attestation-public", { body: { token } });
  if (error) throw error;
  return data as PublicAttestation;
}

export async function refusePublicAttestation(token: string, reason: string) {
  const { error } = await supabase.functions.invoke("attestation-public", { body: { token, action: "refuse", reason } });
  if (error) throw error;
}

export async function submitAttestationSignature(payload: Record<string, unknown>) {
  const { data, error } = await supabase.functions.invoke("submit-attestation-signature", { body: payload });
  if (error) {
    const ctx = (error as { context?: Response }).context;
    const msg = ctx ? await ctx.json().then((j) => j.error).catch(() => null) : null;
    throw new Error(msg || "La signature n'a pas pu être enregistrée");
  }
  return data;
}

export interface PublicAttestation {
  status: string;
  signed_at: string | null;
  expires_at: string | null;
  signer_name: string | null;
  signer_function: string | null;
  is_public_entity: boolean;
  public_entity_name: string | null;
  sections: { title: string; lines: string[] }[];
}
