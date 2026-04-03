import { supabase } from "@/integrations/supabase/client";
import type { CrmColumn, CreateColumnInput } from "@/types/crm";
import { useCrmMutation } from "./useCrmMutation";

export const useCreateColumn = () =>
  useCrmMutation(async (input: CreateColumnInput) => {
    const { data: cols } = await supabase
      .from("crm_columns")
      .select("position")
      .order("position", { ascending: false })
      .limit(1);
    const maxPos = cols?.[0]?.position ?? -1;

    const { data, error } = await supabase
      .from("crm_columns")
      .insert({ name: input.name, position: input.position ?? maxPos + 1 })
      .select()
      .single();
    if (error) throw error;
    return data;
  }, { successMessage: "Colonne créée" });

export const useUpdateColumn = () =>
  useCrmMutation(
    async ({ id, ...updates }: Partial<CrmColumn> & { id: string }) => {
      const { error } = await supabase
        .from("crm_columns")
        .update(updates)
        .eq("id", id);
      if (error) throw error;
    }
  );

export const useArchiveColumn = () =>
  useCrmMutation(async (id: string) => {
    const { error } = await supabase
      .from("crm_columns")
      .update({ is_archived: true })
      .eq("id", id);
    if (error) throw error;
  }, { successMessage: "Colonne archivée" });

export const useReorderColumns = () =>
  useCrmMutation(async (columns: { id: string; position: number }[]) => {
    const updates = columns.map((col) =>
      supabase
        .from("crm_columns")
        .update({ position: col.position })
        .eq("id", col.id)
    );
    await Promise.all(updates);
  });
