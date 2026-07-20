import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type RestockActionFile = {
  id: string;
  action_id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  mime_type: string | null;
  created_at: string;
};

export type RestockAction = {
  id: string;
  game_id: string;
  label: string;
  url: string | null;
  instructions: string | null;
  unit_price_ht: number | null;
  position: number;
  created_at: string;
  updated_at: string;
  files?: RestockActionFile[];
};

export type RestockItemStatus = "todo" | "in_progress" | "awaiting_delivery" | "received";

export type RestockItem = {
  id: string;
  restock_id: string;
  template_action_id: string | null;
  label: string;
  url: string | null;
  instructions: string | null;
  unit_price_ht: number | null;
  status: RestockItemStatus;
  final_cost_ht: number | null;
  final_cost_ttc: number | null;
  completed_at: string | null;
  position: number;
  created_at: string;
  updated_at: string;
  files?: RestockActionFile[];
};

export type RestockRun = {
  id: string;
  game_id: string;
  status: "in_progress" | "completed" | "cancelled";
  notes: string | null;
  started_at: string;
  completed_at: string | null;
  created_by: string | null;
  items?: RestockItem[];
};

// ── Actions templates ────────────────────────────────────────────

export const useRestockActions = (gameId: string | null | undefined) =>
  useQuery({
    queryKey: ["game-restock-actions", gameId],
    enabled: !!gameId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_restock_actions")
        .select("*, files:game_restock_action_files(*)")
        .eq("game_id", gameId)
        .order("position", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RestockAction[];
    },
  });

export const useUpsertRestockAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: Partial<RestockAction> & { game_id: string; label: string }) => {
      const { files, ...payload } = input as any;
      const { data, error } = await (supabase as any)
        .from("game_restock_actions")
        .upsert(payload)
        .select()
        .single();
      if (error) throw error;
      return data as RestockAction;
    },
    onSuccess: (a) => qc.invalidateQueries({ queryKey: ["game-restock-actions", a.game_id] }),
  });
};

export const useDeleteRestockAction = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, gameId }: { id: string; gameId: string }) => {
      const { error } = await (supabase as any).from("game_restock_actions").delete().eq("id", id);
      if (error) throw error;
      return gameId;
    },
    onSuccess: (gameId) => qc.invalidateQueries({ queryKey: ["game-restock-actions", gameId] }),
  });
};

export const useUploadRestockFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ actionId, gameId, file }: { actionId: string; gameId: string; file: File }) => {
      const path = `${gameId}/${actionId}/${Date.now()}-${file.name.replace(/[^\w.\-]/g, "_")}`;
      const { error: upErr } = await supabase.storage
        .from("game-restock-files")
        .upload(path, file, { contentType: file.type || "application/octet-stream", upsert: false });
      if (upErr) throw upErr;
      const { error } = await (supabase as any).from("game_restock_action_files").insert({
        action_id: actionId,
        file_name: file.name,
        file_url: path,
        file_size: file.size,
        mime_type: file.type || null,
      });
      if (error) throw error;
      return gameId;
    },
    onSuccess: (gameId) => qc.invalidateQueries({ queryKey: ["game-restock-actions", gameId] }),
  });
};

export const useDeleteRestockFile = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, path, gameId }: { id: string; path: string; gameId: string }) => {
      await supabase.storage.from("game-restock-files").remove([path]);
      const { error } = await (supabase as any).from("game_restock_action_files").delete().eq("id", id);
      if (error) throw error;
      return gameId;
    },
    onSuccess: (gameId) => qc.invalidateQueries({ queryKey: ["game-restock-actions", gameId] }),
  });
};

export const getRestockFileSignedUrl = async (path: string): Promise<string | null> => {
  const { data, error } = await supabase.storage
    .from("game-restock-files")
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data?.signedUrl ?? null;
};

// ── Restock runs ─────────────────────────────────────────────────

export const useRestockRuns = (gameId: string | null | undefined) =>
  useQuery({
    queryKey: ["game-restocks", gameId],
    enabled: !!gameId,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_restocks")
        .select("*, items:game_restock_items(*)")
        .eq("game_id", gameId)
        .order("started_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as RestockRun[];
    },
  });

export const useLaunchRestock = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ gameId }: { gameId: string }) => {
      const { data: actions, error: aErr } = await (supabase as any)
        .from("game_restock_actions")
        .select("*")
        .eq("game_id", gameId)
        .order("position", { ascending: true });
      if (aErr) throw aErr;
      if (!actions?.length) throw new Error("Aucune action de réassort configurée pour ce jeu.");

      const { data: user } = await supabase.auth.getUser();
      const { data: run, error: rErr } = await (supabase as any)
        .from("game_restocks")
        .insert({ game_id: gameId, status: "in_progress", created_by: user?.user?.id ?? null })
        .select()
        .single();
      if (rErr) throw rErr;

      const items = actions.map((a: RestockAction, i: number) => ({
        restock_id: run.id,
        template_action_id: a.id,
        label: a.label,
        url: a.url,
        instructions: a.instructions,
        unit_price_ht: a.unit_price_ht,
        position: i,
      }));
      const { error: iErr } = await (supabase as any).from("game_restock_items").insert(items);
      if (iErr) throw iErr;
      return { runId: run.id as string, gameId };
    },
    onSuccess: ({ gameId }) => qc.invalidateQueries({ queryKey: ["game-restocks", gameId] }),
  });
};

export const useUpdateRestockItem = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      gameId,
      patch,
    }: {
      id: string;
      gameId: string;
      patch: Partial<RestockItem>;
    }) => {
      const { error } = await (supabase as any)
        .from("game_restock_items")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      return gameId;
    },
    onSuccess: (gameId) => qc.invalidateQueries({ queryKey: ["game-restocks", gameId] }),
  });
};

export const useUpdateRestockRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      id,
      gameId,
      patch,
    }: {
      id: string;
      gameId: string;
      patch: Partial<RestockRun>;
    }) => {
      const { error } = await (supabase as any)
        .from("game_restocks")
        .update(patch)
        .eq("id", id);
      if (error) throw error;
      return gameId;
    },
    onSuccess: (gameId) => qc.invalidateQueries({ queryKey: ["game-restocks", gameId] }),
  });
};

export const useDeleteRestockRun = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, gameId }: { id: string; gameId: string }) => {
      const { error } = await (supabase as any).from("game_restocks").delete().eq("id", id);
      if (error) throw error;
      return gameId;
    },
    onSuccess: (gameId) => qc.invalidateQueries({ queryKey: ["game-restocks", gameId] }),
  });
};

// Fetch template action files for a specific template_action_id (used inside a run item)
export const useRestockActionFiles = (actionIds: string[]) =>
  useQuery({
    queryKey: ["game-restock-action-files", actionIds.slice().sort().join(",")],
    enabled: actionIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("game_restock_action_files")
        .select("*")
        .in("action_id", actionIds);
      if (error) throw error;
      return (data ?? []) as RestockActionFile[];
    },
  });
