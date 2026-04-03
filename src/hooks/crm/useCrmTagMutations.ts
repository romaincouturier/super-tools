import { supabase } from "@/integrations/supabase/client";
import { logCrmActivity } from "@/services/crmActivity";
import type { CreateTagInput } from "@/types/crm";
import { useCrmMutation } from "./useCrmMutation";

export const useCreateTag = () =>
  useCrmMutation(async (input: CreateTagInput) => {
    const { data, error } = await supabase
      .from("crm_tags")
      .insert({
        name: input.name,
        color: input.color || "#3b82f6",
        category: input.category || null,
      })
      .select()
      .single();
    if (error) throw error;
    return data;
  }, { successMessage: "Tag créé" });

export const useDeleteTag = () =>
  useCrmMutation(async (id: string) => {
    const { error } = await supabase.from("crm_tags").delete().eq("id", id);
    if (error) throw error;
  }, { successMessage: "Tag supprimé" });

export const useAssignTag = () =>
  useCrmMutation(
    async ({
      cardId,
      tagId,
      actorEmail,
    }: {
      cardId: string;
      tagId: string;
      actorEmail: string;
    }) => {
      const { error } = await supabase
        .from("crm_card_tags")
        .upsert(
          { card_id: cardId, tag_id: tagId },
          { onConflict: "card_id,tag_id", ignoreDuplicates: true }
        );
      if (error) throw error;
      const { data: tag } = await supabase
        .from("crm_tags")
        .select("name")
        .eq("id", tagId)
        .single();
      await logCrmActivity(cardId, "tag_added", actorEmail, null, tag?.name);
    }
  );

export const useUnassignTag = () =>
  useCrmMutation(
    async ({
      cardId,
      tagId,
      actorEmail,
    }: {
      cardId: string;
      tagId: string;
      actorEmail: string;
    }) => {
      const { data: tag } = await supabase
        .from("crm_tags")
        .select("name")
        .eq("id", tagId)
        .single();
      const { error } = await supabase
        .from("crm_card_tags")
        .delete()
        .eq("card_id", cardId)
        .eq("tag_id", tagId);
      if (error) throw error;
      await logCrmActivity(cardId, "tag_removed", actorEmail, tag?.name, null);
    }
  );
