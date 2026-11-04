import { supabase } from "@/integrations/supabase/client";
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

export interface Pearl {
  id: string;
  title: string | null;
  message: string;
  message_fr: string | null;
  author_name: string | null;
  author_company: string | null;
  is_anonymous: boolean;
  pearl_date: string;
  pearl_time: string | null;
  source: PearlSource;
  image_path: string | null;
  gmail_thread_id: string | null;
  legacy_notion_id: string | null;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

export type PearlInput = Partial<
  Pick<
    Pearl,
    | "title" | "message_fr" | "author_name" | "author_company" | "is_anonymous"
    | "pearl_date" | "pearl_time" | "source" | "image_path" | "archived"
  >
> & { message: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = () => supabase as any;

export async function listPearls(): Promise<Pearl[]> {
  const { data, error } = await db()
    .from("client_pearls")
    .select("*")
    .order("pearl_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Pearl[];
}

export async function getRandomPearl(excludeId?: string | null): Promise<Pearl | null> {
  const { data, error } = await db().rpc("get_random_client_pearl", { p_exclude: excludeId ?? null });
  if (error) throw error;
  return ((data as Pearl[] | null) ?? [])[0] ?? null;
}

export async function createPearl(input: PearlInput): Promise<Pearl> {
  const { data, error } = await db().from("client_pearls").insert(input).select().single();
  if (error) throw error;
  return data as Pearl;
}

export async function updatePearl(id: string, patch: Partial<PearlInput>): Promise<Pearl> {
  const { data, error } = await db().from("client_pearls").update(patch).eq("id", id).select().single();
  if (error) throw error;
  return data as Pearl;
}

export async function deletePearl(id: string): Promise<void> {
  const { error } = await db().from("client_pearls").delete().eq("id", id);
  if (error) throw error;
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
