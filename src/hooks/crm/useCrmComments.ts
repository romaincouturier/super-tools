import { supabase } from "@/integrations/supabase/client";
import { logCrmActivity } from "@/services/crmActivity";
import { useCrmMutation } from "./useCrmMutation";

export const useAddComment = () =>
  useCrmMutation(
    async ({
      cardId,
      content,
      authorEmail,
    }: {
      cardId: string;
      content: string;
      authorEmail: string;
    }) => {
      const { error } = await supabase
        .from("crm_comments")
        .insert({ card_id: cardId, content, author_email: authorEmail });
      if (error) throw error;
      await logCrmActivity(
        cardId,
        "comment_added",
        authorEmail,
        null,
        content.substring(0, 100)
      );
    },
    { successMessage: "Commentaire ajouté" }
  );

export const useDeleteComment = () =>
  useCrmMutation(async (id: string) => {
    const { error } = await supabase
      .from("crm_comments")
      .update({ is_deleted: true })
      .eq("id", id);
    if (error) throw error;
  });
