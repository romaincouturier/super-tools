import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface SupertiltAction {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  assigned_to: string | null;
  deadline: string | null;
  is_completed: boolean;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

type InsertAction = Pick<SupertiltAction, "title"> &
  Partial<Pick<SupertiltAction, "description" | "assigned_to" | "deadline">>;

type UpdateAction = Partial<Pick<SupertiltAction, "title" | "description" | "assigned_to" | "deadline" | "is_completed">>;

const sb = supabase as any;
const TABLE = "supertilt_actions";

export function useSupertiltActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["supertilt-actions"];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await supabase
        .from(TABLE)
        .select("*")
        .order("is_completed", { ascending: true })
        .order("deadline", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupertiltAction[];
    },
    enabled: !!user,
  });

  const addAction = useMutation({
    mutationFn: async (action: InsertAction) => {
      const { data, error } = await supabase
        .from(TABLE)
        .insert({ ...action, user_id: user!.id })
        .select()
        .single();
      if (error) throw error;
      return data as SupertiltAction;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Action ajoutée");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur lors de l'ajout : ${msg}`);
    },
  });

  const updateAction = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateAction & { id: string }) => {
      const payload: Record<string, unknown> = { ...updates };
      if (updates.is_completed === true) payload.completed_at = new Date().toISOString();
      if (updates.is_completed === false) payload.completed_at = null;

      const { error } = await supabase.from(TABLE).update(payload).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur lors de la mise à jour : ${msg}`);
    },
  });

  const deleteAction = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from(TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Action supprimée");
    },
    onError: (err: unknown) => {
      const msg = err instanceof Error ? err.message : "Erreur inconnue";
      toast.error(`Erreur lors de la suppression : ${msg}`);
    },
  });

  return {
    actions: query.data ?? [],
    isLoading: query.isLoading,
    addAction,
    updateAction,
    deleteAction,
  };
}
