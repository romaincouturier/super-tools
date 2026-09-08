import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import {
  buildProcedureRecord,
  nextVersion,
  type VhdProcedureFormValues,
} from "@/lib/vhdProcedure";

/**
 * Versions de la procédure de prévention (indicateur 12).
 *
 * Publier n'écrase pas : la version en vigueur passe en archivée et la
 * nouvelle prend sa place. Un signalement de 2026 doit pouvoir désigner la
 * procédure qui s'appliquait à sa date, même si le texte a changé depuis.
 */

export interface VhdProcedure {
  id: string;
  version: string;
  content: string;
  contact_name: string | null;
  contact_email: string | null;
  effective_from: string | null;
  status: string;
  framework_version: string;
  created_at: string;
  updated_at: string;
}

export function useVhdProcedures() {
  const [procedures, setProcedures] = useState<VhdProcedure[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchProcedures = useCallback(async () => {
    const { data, error } = await supabase
      .from("vhd_procedures")
      .select("*")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error fetching vhd_procedures:", error);
      toastError(toast, "Impossible de charger les procédures");
      return;
    }
    setProcedures((data || []) as unknown as VhdProcedure[]);
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    fetchProcedures().finally(() => setLoading(false));
  }, [fetchProcedures]);

  const active = useMemo(
    () => procedures.find((p) => p.status === "active") ?? null,
    [procedures],
  );

  const suggestedVersion = useMemo(
    () => nextVersion(procedures.map((p) => p.version)),
    [procedures],
  );

  const saveDraft = useCallback(
    async (form: VhdProcedureFormValues, userId?: string, existingId?: string) => {
      const record = buildProcedureRecord(form);

      if (existingId) {
        const { error } = await supabase
          .from("vhd_procedures")
          .update(record)
          .eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("vhd_procedures")
          .insert({ ...record, status: "draft", created_by: userId });
        if (error) throw error;
      }

      toast({ title: "Brouillon enregistré" });
      await fetchProcedures();
    },
    [toast, fetchProcedures],
  );

  /**
   * Met une version en vigueur. L'archivage de l'ancienne passe **avant** :
   * un index unique interdit deux procédures actives, donc l'ordre inverse
   * échouerait et laisserait l'ancienne en vigueur sans le dire.
   */
  const publish = useCallback(
    async (id: string) => {
      const current = procedures.find((p) => p.status === "active" && p.id !== id);

      if (current) {
        const { error } = await supabase
          .from("vhd_procedures")
          .update({ status: "archived" })
          .eq("id", current.id);
        if (error) {
          toastError(toast, "Impossible d'archiver la version en vigueur");
          return;
        }
      }

      const { error } = await supabase
        .from("vhd_procedures")
        .update({ status: "active" })
        .eq("id", id);

      if (error) {
        toastError(toast, "Impossible de publier cette version");
        await fetchProcedures();
        return;
      }

      toast({ title: "Procédure publiée", description: "Elle apparaît sur les pages de session." });
      await fetchProcedures();
    },
    [procedures, toast, fetchProcedures],
  );

  const deleteProcedure = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("vhd_procedures").delete().eq("id", id);
      if (error) {
        toastError(toast, "Impossible de supprimer cette version");
        return;
      }
      toast({ title: "Version supprimée" });
      await fetchProcedures();
    },
    [toast, fetchProcedures],
  );

  return {
    procedures,
    active,
    suggestedVersion,
    loading,
    saveDraft,
    publish,
    deleteProcedure,
    refresh: fetchProcedures,
  };
}
