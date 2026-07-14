import { supabase } from "@/integrations/supabase/client";

/** Appels edge du module Idées (règle [020] : pas d'invoke inline dans les hooks). */

/** Upload d'un fichier (image/PDF) via l'edge function dédiée (pas de storage direct). */
export async function uploadIdeaFile(file: File): Promise<string> {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_").toLowerCase();
  const path = `${Date.now()}_${safeName}`;
  const formData = new FormData();
  formData.append("file", file, file.name);
  formData.append("path", path);
  const { data, error } = await supabase.functions.invoke("upload-idea-file", { body: formData });
  if (error) throw error;
  const publicUrl = (data as { publicUrl?: string } | null)?.publicUrl;
  if (!publicUrl) throw new Error("URL introuvable après l'upload");
  return publicUrl;
}

/** Enrichissement IA d'une idée en tâche de fond. */
export function enrichIdea(id: string) {
  return supabase.functions.invoke("enrich-idea", { body: { id } });
}

export function invokeFindSimilarIdeas(query: string, excludeId?: string) {
  return supabase.functions.invoke("find-similar-ideas", { body: { query, excludeId } });
}
