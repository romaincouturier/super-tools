import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// Tables hors types générés : cast assumé (legacy).
const c = supabase as any;
const reactionsKey = (depositId: string) => ["admin-deposit-reactions", depositId];

export function useDepositReactions(depositId: string) {
  return useQuery<{ author_email: string }[]>({
    queryKey: reactionsKey(depositId),
    queryFn: async () => {
      const { data, error } = await c.from("lms_deposit_reactions").select("author_email").eq("deposit_id", depositId);
      if (error) throw error;
      return data || [];
    },
  });
}

export function useToggleStaffDepositReaction(depositId: string, email: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (iReacted: boolean) => {
      if (!email) throw new Error("Session introuvable");
      const q = c.from("lms_deposit_reactions");
      const { error } = iReacted
        ? await q.delete().eq("deposit_id", depositId).eq("author_email", email)
        : await q.insert({ deposit_id: depositId, author_email: email });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: reactionsKey(depositId) }),
  });
}

export function useCreateStaffDepositComment(depositId: string, email: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (content: string) => {
      if (!email) throw new Error("Session introuvable");
      const { error } = await c.from("lms_deposit_comments").insert({ deposit_id: depositId, author_email: email, content });
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-comments", depositId] }),
  });
}
