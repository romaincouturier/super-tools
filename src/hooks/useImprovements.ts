import { useState, useEffect, useMemo, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import type { Database } from "@/integrations/supabase/types";

type ImprovementInsert = Database["public"]["Tables"]["improvements"]["Insert"];

// ── Types ────────────────────────────────────────────────────────────────────

export interface Training {
  id: string;
  training_name: string;
}

export interface ImprovementNote {
  id: string;
  improvement_id: string;
  content: string;
  created_at: string;
  created_by: string | null;
}

export interface Improvement {
  id: string;
  training_id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  source_type: string | null;
  source_description: string | null;
  priority: string | null;
  deadline: string | null;
  responsible: string | null;
  trainings?: { training_name: string } | null;
}

export type ImprovementStatus = "draft" | "pending" | "in_progress" | "completed" | "cancelled";

export const STATUS_CONFIG: Record<
  ImprovementStatus,
  { label: string; color: string }
> = {
  draft: { label: "Brouillon", color: "bg-gray-100 text-gray-600" },
  pending: { label: "En attente", color: "bg-yellow-100 text-yellow-800" },
  in_progress: { label: "En cours", color: "bg-blue-100 text-blue-800" },
  completed: { label: "Terminée", color: "bg-green-100 text-green-800" },
  cancelled: { label: "Annulée", color: "bg-gray-100 text-gray-800" },
};

export const CATEGORY_CONFIG: Record<
  string,
  { label: string; variant: "default" | "secondary" | "outline" }
> = {
  weakness: { label: "Point faible", variant: "secondary" },
  recommendation: { label: "Recommandation", variant: "default" },
  strength: { label: "Point fort", variant: "outline" },
  manual: { label: "Manuel", variant: "outline" },
};

export const KANBAN_COLUMNS: ImprovementStatus[] = [
  "draft",
  "pending",
  "in_progress",
  "completed",
  "cancelled",
];

export const SOURCE_TYPES = [
  { value: "reclamation", label: "Réclamation" },
  { value: "appreciation", label: "Appréciation" },
  { value: "evaluation", label: "Évaluation" },
  { value: "alea", label: "Aléa" },
  { value: "audit", label: "Audit" },
  { value: "autre", label: "Autre" },
];

export const PRIORITIES = [
  { value: "haute", label: "Haute" },
  { value: "moyenne", label: "Moyenne" },
  { value: "basse", label: "Basse" },
];

// ── Empty form state ─────────────────────────────────────────────────────────

export const EMPTY_FORM = {
  training_id: "",
  title: "",
  description: "",
  category: "recommendation",
  source_type: "",
  source_description: "",
  priority: "",
  deadline: "",
  responsible: "",
};

export type ImprovementFormData = typeof EMPTY_FORM;

// ── Hook ─────────────────────────────────────────────────────────────────────

export function useImprovements() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [improvements, setImprovements] = useState<Improvement[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterTraining, setFilterTraining] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const { toast } = useToast();

  const fetchTrainings = useCallback(async () => {
    const { data } = await supabase
      .from("trainings")
      .select("id, training_name")
      .order("start_date", { ascending: false });
    if (data) setTrainings(data);
  }, []);

  const fetchImprovements = useCallback(async () => {
    let query = supabase
      .from("improvements")
      .select("*, trainings(training_name)")
      .order("created_at", { ascending: false });

    if (filterTraining !== "all") query = query.eq("training_id", filterTraining);
    if (filterStatus !== "all") query = query.eq("status", filterStatus);

    const { data, error } = await query;
    if (data) setImprovements(data as unknown as Improvement[]);
    if (error) console.error("Error fetching improvements:", error);
  }, [filterTraining, filterStatus]);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchTrainings(), fetchImprovements()]);
    setLoading(false);
  }, [fetchTrainings, fetchImprovements]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const grouped = useMemo(() => {
    const result: Record<ImprovementStatus, Improvement[]> = {
      draft: [],
      pending: [],
      in_progress: [],
      completed: [],
      cancelled: [],
    };
    for (const imp of improvements) {
      const status = imp.status as ImprovementStatus;
      if (result[status]) result[status].push(imp);
      else result.pending.push(imp);
    }
    return result;
  }, [improvements]);

  const stats = useMemo(
    () => ({
      draft: grouped.draft.length,
      pending: grouped.pending.length,
      in_progress: grouped.in_progress.length,
      completed: grouped.completed.length,
      total: improvements.length,
    }),
    [grouped, improvements.length],
  );

  const changeStatus = useCallback(
    async (id: string, newStatus: ImprovementStatus) => {
      const updateData: Record<string, unknown> = { status: newStatus };
      if (newStatus === "completed") updateData.completed_at = new Date().toISOString();

      const { error } = await supabase.from("improvements").update(updateData).eq("id", id);
      if (error) {
        toastError(toast, "Impossible de mettre à jour le statut");
        return;
      }
      toast({ title: "Statut mis à jour", description: `Marquée "${STATUS_CONFIG[newStatus].label}"` });
      fetchImprovements();
    },
    [toast, fetchImprovements],
  );

  const deleteImprovement = useCallback(
    async (id: string) => {
      const imp = improvements.find((i) => i.id === id);
      if (imp && imp.status !== "draft" && imp.status !== "pending") {
        toastError(toast, "Seules les améliorations en brouillon ou en attente peuvent être supprimées.", { title: "Suppression interdite" });
        return;
      }
      const { error } = await supabase.from("improvements").delete().eq("id", id);
      if (error) {
        toastError(toast, "Impossible de supprimer");
        return;
      }
      toast({ title: "Amélioration supprimée" });
      fetchImprovements();
    },
    [improvements, toast, fetchImprovements],
  );

  const saveImprovement = useCallback(
    async (data: ImprovementFormData, userId?: string, existingId?: string) => {
      const record = {
        training_id: data.training_id,
        title: data.title.trim(),
        description: data.description.trim(),
        category: data.category,
        status: existingId ? undefined : "pending",
        created_by: existingId ? undefined : userId,
        source_type: data.source_type || null,
        source_description: data.source_description.trim() || null,
        priority: data.priority || null,
        deadline: data.deadline || null,
        responsible: data.responsible.trim() || null,
      };

      // Remove undefined fields for update
      const cleaned = Object.fromEntries(
        Object.entries(record).filter(([, v]) => v !== undefined),
      );

      if (existingId) {
        const { error } = await supabase
          .from("improvements")
          .update(cleaned)
          .eq("id", existingId);
        if (error) throw error;
        toast({ title: "Amélioration modifiée" });
      } else {
        const { error } = await supabase.from("improvements").insert(cleaned as ImprovementInsert);
        if (error) throw error;
        toast({ title: "Amélioration ajoutée" });
      }
      fetchImprovements();
    },
    [toast, fetchImprovements],
  );

  // ── Notes ────────────────────────────────────────────────────────────────

  const fetchNotes = useCallback(async (improvementId: string) => {
    const { data } = await (supabase.from as (table: string) => ReturnType<typeof supabase.from>)("improvement_notes")
      .select("*")
      .eq("improvement_id" as never, improvementId)
      .order("created_at", { ascending: false });
    return (data || []) as unknown as ImprovementNote[];
  }, []);

  const addNote = useCallback(
    async (improvementId: string, content: string, userId?: string) => {
      const { error } = await (supabase.from as (table: string) => ReturnType<typeof supabase.from>)("improvement_notes")
        .insert({
          improvement_id: improvementId,
          content: content.trim(),
          created_by: userId,
        } as never);
      if (error) {
        toastError(toast, "Impossible d'ajouter la note");
        return;
      }
      toast({ title: "Note ajoutée" });
    },
    [toast],
  );

  return {
    trainings,
    improvements,
    grouped,
    stats,
    loading,
    filterTraining,
    setFilterTraining,
    filterStatus,
    setFilterStatus,
    changeStatus,
    deleteImprovement,
    saveImprovement,
    fetchNotes,
    addNote,
    refresh: fetchImprovements,
  };
}
