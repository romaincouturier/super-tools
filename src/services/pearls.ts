import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { resolveContentType } from "@/lib/file-utils";

export type PearlSource = "mail" | "oral" | "linkedin" | "evaluation" | "notion" | "autre";

export const PEARL_SOURCE_LABELS: Record<PearlSource, string> = {
  mail: "Mail",
  oral: "Oral",
  linkedin: "LinkedIn",
  evaluation: "Évaluation",
  notion: "Notion",
  autre: "Autre",
};

export const PEARL_BUCKET = "client-pearls";

type PearlRow = Database["public"]["Tables"]["client_pearls"]["Row"];
type PearlInsert = Database["public"]["Tables"]["client_pearls"]["Insert"];

export interface Pearl extends Omit<PearlRow, "source"> {
  source: PearlSource;
  /** Titre de la mission liée, quand la liste le charge. */
  mission: { title: string } | null;
  /** Formation liée, quand la liste la charge. */
  training: { training_name: string } | null;
}

export type PearlInput = Partial<
  Pick<
    PearlInsert,
    | "title" | "message_fr" | "author_name" | "author_company" | "is_anonymous" | "is_positive"
    | "pearl_date" | "pearl_time" | "image_path" | "archived" | "mission_id" | "training_id"
  >
> & { message: string; source?: PearlSource };

export interface PearlLinkTargets {
  missions: { id: string; title: string }[];
  trainings: { id: string; training_name: string; start_date: string | null }[];
}

const LIST_SELECT = "*, mission:missions(title), training:trainings(training_name)";

/** Ligne brute -> Pearl : la base type `source` en texte, la contrainte CHECK en garantit les valeurs. */
function toPearl(row: PearlRow & { mission?: Pearl["mission"]; training?: Pearl["training"] }): Pearl {
  return { ...row, source: row.source as PearlSource, mission: row.mission ?? null, training: row.training ?? null };
}

export async function listPearls(): Promise<Pearl[]> {
  const { data, error } = await supabase
    .from("client_pearls")
    .select(LIST_SELECT)
    .order("pearl_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(toPearl);
}

export async function getRandomPearl(excludeId?: string | null): Promise<Pearl | null> {
  const { data, error } = await supabase.rpc("get_random_client_pearl", { p_exclude: excludeId ?? undefined });
  if (error) throw error;
  const row = (data ?? [])[0];
  return row ? toPearl(row) : null;
}

export async function createPearl(input: PearlInput): Promise<Pearl> {
  const { data, error } = await supabase.from("client_pearls").insert(input).select(LIST_SELECT).single();
  if (error) throw error;
  return toPearl(data);
}

export async function updatePearl(id: string, patch: Partial<PearlInput>): Promise<Pearl> {
  const { data, error } = await supabase.from("client_pearls").update(patch).eq("id", id).select(LIST_SELECT).single();
  if (error) throw error;
  return toPearl(data);
}

export async function deletePearl(id: string): Promise<void> {
  const { error } = await supabase.from("client_pearls").delete().eq("id", id);
  if (error) throw error;
}

/** Missions et formations proposées au rattachement d'une perle, les plus récentes d'abord. */
export async function listPearlLinkTargets(): Promise<PearlLinkTargets> {
  const [missions, trainings] = await Promise.all([
    supabase.from("missions").select("id, title").order("created_at", { ascending: false }).limit(300),
    supabase.from("trainings").select("id, training_name, start_date").order("start_date", { ascending: false, nullsFirst: false }).limit(300),
  ]);
  if (missions.error) throw missions.error;
  if (trainings.error) throw trainings.error;
  return { missions: missions.data ?? [], trainings: trainings.data ?? [] };
}

export async function uploadPearlImage(file: File): Promise<string> {
  const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
  const path = `${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from(PEARL_BUCKET).upload(path, file, { contentType: resolveContentType(file) });
  if (error) throw error;
  return path;
}

/** Nom affiché d'une perle : jamais l'auteur d'une perle anonyme. */
export function pearlAuthorLabel(p: Pick<Pearl, "is_anonymous" | "author_name" | "author_company">): string {
  if (p.is_anonymous) return "Anonyme";
  return [p.author_name, p.author_company].filter(Boolean).join(", ") || "Anonyme";
}
