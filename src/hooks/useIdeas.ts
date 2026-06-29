import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { resolveContentType } from "@/lib/file-utils";

export type IdeaStatus =
  | "nouvelle"
  | "a_l_etude"
  | "acceptee"
  | "promue"
  | "realisee"
  | "rejetee";

export interface Idea {
  id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  tags: string[];
  status: IdeaStatus;
  promoted_to_improvement_id: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  vote_count: number;
  has_voted: boolean;
}

export const IDEA_STATUS_CONFIG: Record<IdeaStatus, { label: string; color: string }> = {
  nouvelle: { label: "Nouvelle", color: "bg-blue-100 text-blue-800" },
  a_l_etude: { label: "À l'étude", color: "bg-amber-100 text-amber-800" },
  acceptee: { label: "Acceptée", color: "bg-emerald-100 text-emerald-800" },
  promue: { label: "Promue", color: "bg-violet-100 text-violet-800" },
  realisee: { label: "Réalisée", color: "bg-green-100 text-green-800" },
  rejetee: { label: "Rejetée", color: "bg-gray-100 text-gray-600" },
};

export const IDEA_COLUMNS: IdeaStatus[] = [
  "nouvelle",
  "a_l_etude",
  "acceptee",
  "promue",
  "realisee",
  "rejetee",
];

// `ideas` / `idea_votes` ne sont pas encore dans les types générés Supabase.
const anyDb = supabase as unknown as {
  from: (t: string) => ReturnType<typeof supabase.from>;
};

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

export interface CreateIdeaInput {
  title: string;
  description?: string;
  tags?: string[];
  file?: File | null;
}

export function useIdeas() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchIdeas = useCallback(async () => {
    const [{ data: rows, error }, { data: votes }] = await Promise.all([
      anyDb.from("ideas").select("*").order("created_at", { ascending: false }),
      anyDb.from("idea_votes").select("idea_id, user_id"),
    ]);
    if (error) {
      console.error("[useIdeas] fetch error", error);
      return;
    }
    const voteRows = (votes ?? []) as unknown as { idea_id: string; user_id: string }[];
    const countByIdea = new Map<string, number>();
    const mineByIdea = new Set<string>();
    for (const v of voteRows) {
      countByIdea.set(v.idea_id, (countByIdea.get(v.idea_id) ?? 0) + 1);
      if (user?.id && v.user_id === user.id) mineByIdea.add(v.idea_id);
    }
    const list = ((rows ?? []) as unknown as Idea[]).map((r) => ({
      ...r,
      vote_count: countByIdea.get(r.id) ?? 0,
      has_voted: mineByIdea.has(r.id),
    }));
    setIdeas(list);
  }, [user?.id]);

  useEffect(() => {
    setLoading(true);
    fetchIdeas().finally(() => setLoading(false));
  }, [fetchIdeas]);

  const grouped = useMemo(() => {
    const result = Object.fromEntries(IDEA_COLUMNS.map((c) => [c, [] as Idea[]])) as Record<IdeaStatus, Idea[]>;
    for (const idea of ideas) {
      (result[idea.status] ?? result.nouvelle).push(idea);
    }
    return result;
  }, [ideas]);

  const createIdea = useCallback(
    async (input: CreateIdeaInput) => {
      try {
        let imageUrl: string | null = null;
        if (input.file) imageUrl = await uploadIdeaFile(input.file);
        const { error } = await anyDb.from("ideas").insert({
          title: input.title.trim(),
          description: input.description?.trim() || null,
          tags: input.tags ?? [],
          image_url: imageUrl,
          created_by: user?.id ?? null,
        } as never);
        if (error) throw error;
        toast({ title: "Idée ajoutée" });
        await fetchIdeas();
      } catch (err) {
        toastError(toast, err);
        throw err;
      }
    },
    [user?.id, toast, fetchIdeas],
  );

  const toggleVote = useCallback(
    async (idea: Idea) => {
      if (!user?.id) return;
      if (idea.has_voted) {
        await anyDb.from("idea_votes").delete().eq("idea_id", idea.id).eq("user_id", user.id);
      } else {
        await anyDb.from("idea_votes").insert({ idea_id: idea.id, user_id: user.id } as never);
      }
      await fetchIdeas();
    },
    [user?.id, fetchIdeas],
  );

  const changeStatus = useCallback(
    async (id: string, status: IdeaStatus) => {
      const { error } = await anyDb.from("ideas").update({ status } as never).eq("id", id);
      if (error) {
        toastError(toast, "Impossible de mettre à jour le statut");
        return;
      }
      await fetchIdeas();
    },
    [toast, fetchIdeas],
  );

  const promoteIdea = useCallback(
    async (idea: Idea) => {
      try {
        const { data: created, error } = await supabase
          .from("improvements")
          .insert({
            title: idea.title,
            description: idea.description || idea.title,
            category: "manual",
            status: "pending",
            source_type: "idea",
            source_description: `Idée promue (#${idea.id})`,
            created_by: user?.id ?? null,
          })
          .select("id")
          .single();
        if (error) throw error;
        await anyDb
          .from("ideas")
          .update({ status: "promue", promoted_to_improvement_id: created.id } as never)
          .eq("id", idea.id);
        toast({ title: "Idée promue en amélioration" });
        await fetchIdeas();
      } catch (err) {
        toastError(toast, err);
      }
    },
    [user?.id, toast, fetchIdeas],
  );

  const removeIdea = useCallback(
    async (id: string) => {
      const { error } = await anyDb.from("ideas").delete().eq("id", id);
      if (error) {
        toastError(toast, "Impossible de supprimer l'idée");
        return;
      }
      toast({ title: "Idée supprimée" });
      await fetchIdeas();
    },
    [toast, fetchIdeas],
  );

  return {
    ideas,
    grouped,
    loading,
    createIdea,
    toggleVote,
    changeStatus,
    promoteIdea,
    removeIdea,
    refresh: fetchIdeas,
  };
}
