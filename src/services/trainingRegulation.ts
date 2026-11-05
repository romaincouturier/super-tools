import { supabase } from "@/integrations/supabase/client";
import { REGULATION_SETTING_KEYS, type RegulationVersion } from "@/lib/trainingRegulation";

export async function prepareRegulationDownload(url: string) {
  const response = await fetch(url);
  if (!response.ok) throw new Error("Le règlement n'est pas disponible");
  const blob = await response.blob();
  if (!blob.size || !blob.type.includes("application/pdf")) throw new Error("Le règlement reçu n'est pas un PDF");
  return blob;
}

export async function loadTrainingRegulation() {
  const { data, error } = await supabase.from("app_settings").select("setting_key,setting_value").in("setting_key", REGULATION_SETTING_KEYS);
  if (error) throw error;
  const values = Object.fromEntries((data ?? []).map(row => [row.setting_key, row.setting_value]));
  return { url: values.reglement_interieur_url ?? "", draft: values.reglement_interieur_draft ?? "", hasDraft: "reglement_interieur_draft" in values, versions: JSON.parse(values.reglement_interieur_versions || "[]") as RegulationVersion[] };
}

export async function saveRegulationDraft(content: string, expected: string) {
  const { error } = await supabase.rpc("save_training_regulation_draft", { p_content: content, p_expected: expected });
  if (error) throw error;
}

export async function publishRegulation(content: string, blob: Blob, expectedUrl: string) {
  const fileName = `reglement-interieur-${crypto.randomUUID()}.pdf`;
  const body = new FormData();
  body.append("file", new File([blob], fileName, { type: "application/pdf" }));
  body.append("path", `reglement-interieur/${fileName}`);
  const { data, error } = await supabase.functions.invoke("upload-training-file", { body });
  if (error) throw error;
  const url = data?.publicUrl;
  if (typeof url !== "string") throw new Error("Le PDF n'a pas été enregistré");
  const { error: publishError } = await supabase.rpc("publish_training_regulation", { p_content: content, p_url: url, p_expected_url: expectedUrl });
  if (publishError) throw publishError;
  return loadTrainingRegulation();
}