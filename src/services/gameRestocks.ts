import { supabase } from "@/integrations/supabase/client";

/** Upload d'un fichier de réassort via l'edge function (règle 026d : pas de storage.upload direct). */
export async function uploadRestockFile(actionId: string, gameId: string, file: File): Promise<void> {
  const formData = new FormData();
  formData.append("actionId", actionId);
  formData.append("gameId", gameId);
  formData.append("file", file);
  const { error } = await supabase.functions.invoke("upload-game-restock-file", { body: formData });
  if (error) throw error;
}
