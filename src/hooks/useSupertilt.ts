import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useEffect } from "react";

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
  column_id: string | null;
  position: number;
  mission_id: string | null;
}

export interface SupertiltColumn {
  id: string;
  user_id: string;
  name: string;
  position: number;
}

type InsertAction = Pick<SupertiltAction, "title"> &
  Partial<Pick<SupertiltAction, "description" | "assigned_to" | "deadline" | "column_id" | "position">>;

type UpdateAction = Partial<
  Pick<SupertiltAction, "title" | "description" | "assigned_to" | "deadline" | "is_completed" | "column_id" | "position">
>;

const sb = supabase as any;
const TABLE = "supertilt_actions";
const COLS_TABLE = "supertilt_columns";

const DEFAULT_COLUMNS = ["À faire", "En cours", "Terminé"];

export function useSupertiltColumns() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["supertilt-columns"];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await sb
        .from(COLS_TABLE)
        .select("*")
        .order("position", { ascending: true });
      if (error) throw error;
      return data as SupertiltColumn[];
    },
    enabled: !!user,
  });

  // Auto-create default columns if user has none
  useEffect(() => {
    if (!user || query.isLoading || !query.data) return;
    if (query.data.length === 0) {
      (async () => {
        const rows = DEFAULT_COLUMNS.map((name, position) => ({
          user_id: user.id,
          name,
          position,
        }));
        const { error } = await sb.from(COLS_TABLE).insert(rows);
        if (!error) qc.invalidateQueries({ queryKey: key });
      })();
    }
  }, [user, query.data, query.isLoading]);

  const addColumn = useMutation({
    mutationFn: async (name: string) => {
      const cols = query.data || [];
      const position = cols.length;
      const { error } = await sb
        .from(COLS_TABLE)
        .insert({ name, position, user_id: user!.id });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      toast.success("Colonne ajoutée");
    },
    onError: (err: unknown) => toast.error(err instanceof Error ? err.message : "Erreur"),
  });

  const renameColumn = useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await sb.from(COLS_TABLE).update({ name }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  const deleteColumn = useMutation({
    mutationFn: async (id: string) => {
      // Delete contained actions first (no FK cascade)
      const { error: actErr } = await sb.from(TABLE).delete().eq("column_id", id);
      if (actErr) throw actErr;
      const { error } = await sb.from(COLS_TABLE).delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: key });
      qc.invalidateQueries({ queryKey: ["supertilt-actions"] });
      toast.success("Colonne supprimée");
    },
  });

  const reorderColumns = useMutation({
    mutationFn: async (orderedIds: string[]) => {
      await Promise.all(
        orderedIds.map((id, position) =>
          sb.from(COLS_TABLE).update({ position }).eq("id", id),
        ),
      );
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
  });

  return {
    columns: query.data ?? [],
    isLoading: query.isLoading,
    addColumn,
    renameColumn,
    deleteColumn,
    reorderColumns,
  };
}

/**
 * Garantit qu'une action Supertilt a une mission liée (espace pages/documents/galerie).
 * Crée la mission archivée et rattache son id à l'action si nécessaire.
 */
export function useEnsureActionMission() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (action: SupertiltAction) => {
      if (action.mission_id) return action.mission_id;
      const { data: u } = await supabase.auth.getUser();
      const userId = u.user?.id;
      const { data: mission, error } = await sb
        .from("missions")
        .insert({
          title: action.title || "Action Supertilt",
          status: "not_started",
          archived: true,
          created_by: userId,
          assigned_to: userId,
        })
        .select("id")
        .single();
      if (error) throw error;
      const newMissionId = mission.id as string;
      const { error: updErr } = await sb
        .from(TABLE)
        .update({ mission_id: newMissionId })
        .eq("id", action.id);
      if (updErr) throw updErr;
      return newMissionId;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["supertilt-actions"] });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : "Erreur création espace");
    },
  });
}

export function useSupertiltActions() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const key = ["supertilt-actions"];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data, error } = await sb
        .from(TABLE)
        .select("*")
        .order("position", { ascending: true })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as SupertiltAction[];
    },
    enabled: !!user,
  });

  const addAction = useMutation({
    mutationFn: async (action: InsertAction) => {
      const { data, error } = await sb
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

      const { error } = await sb.from(TABLE).update(payload).eq("id", id);
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
      const { error } = await sb.from(TABLE).delete().eq("id", id);
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
