import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { todayAsISO } from "@/lib/dateFormatters";
import { buildReportRecord, isOverdue, type VhdStatus } from "@/lib/vhdConstants";

/**
 * Accès au registre des signalements (indicateur 12).
 *
 * Le récit vit dans une table séparée, chargée à la demande : il ne descend
 * jamais avec la liste, pour qu'un écran ouvert par-dessus l'épaule de
 * quelqu'un n'expose pas des témoignages.
 */

export interface VhdReport {
  id: string;
  reported_at: string;
  training_id: string | null;
  channel: string;
  category: string;
  handled_by: string | null;
  actions_taken: string | null;
  due_date: string | null;
  status: string;
  closed_at: string | null;
  framework_version: string;
  created_at: string;
  trainings?: { training_name: string } | null;
}

export interface VhdReportForm {
  reported_at: string;
  training_id: string;
  channel: string;
  category: string;
  handled_by: string;
  actions_taken: string;
  due_date: string;
  status: string;
  narrative: string;
}

export const EMPTY_VHD_FORM: VhdReportForm = {
  reported_at: "",
  training_id: "",
  channel: "autre",
  category: "autre",
  handled_by: "",
  actions_taken: "",
  due_date: "",
  status: "recu",
  narrative: "",
};

export interface VhdTrainingOption {
  id: string;
  training_name: string;
}

export function useVhdReports() {
  const [reports, setReports] = useState<VhdReport[]>([]);
  const [trainings, setTrainings] = useState<VhdTrainingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("open");
  const { toast } = useToast();

  const fetchReports = useCallback(async () => {
    const { data, error } = await supabase
      .from("vhd_reports")
      .select("*, trainings(training_name)")
      .order("reported_at", { ascending: false });

    if (error) {
      console.error("Error fetching vhd_reports:", error);
      toastError(toast, "Impossible de charger le registre des signalements");
      return;
    }
    setReports((data || []) as unknown as VhdReport[]);
  }, [toast]);

  const fetchTrainings = useCallback(async () => {
    const { data } = await supabase
      .from("trainings")
      .select("id, training_name")
      .order("start_date", { ascending: false });
    if (data) setTrainings(data);
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchReports(), fetchTrainings()]).finally(() => setLoading(false));
  }, [fetchReports, fetchTrainings]);

  const today = todayAsISO();

  const visibleReports = useMemo(() => {
    if (statusFilter === "all") return reports;
    if (statusFilter === "open") return reports.filter((r) => r.status !== "cloture");
    return reports.filter((r) => r.status === statusFilter);
  }, [reports, statusFilter]);

  const stats = useMemo(
    () => ({
      overdue: reports.filter((r) => isOverdue(r, today)).length,
      total: reports.length,
    }),
    [reports, today],
  );

  /** Le récit n'est chargé que lorsqu'on ouvre un signalement précis. */
  const fetchNarrative = useCallback(async (reportId: string): Promise<string> => {
    const { data, error } = await supabase
      .from("vhd_report_narratives")
      .select("narrative")
      .eq("report_id", reportId)
      .maybeSingle();

    if (error) {
      console.error("Error fetching narrative:", error);
      return "";
    }
    return data?.narrative ?? "";
  }, []);

  const saveReport = useCallback(
    async (form: VhdReportForm, userId?: string, existingId?: string, narrativeLoaded = true) => {
      const record = buildReportRecord(form, new Date().toISOString(), todayAsISO());

      let reportId = existingId;

      if (existingId) {
        const { error } = await supabase.from("vhd_reports").update(record).eq("id", existingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("vhd_reports")
          .insert({ ...record, created_by: userId })
          .select("id")
          .single();
        if (error) throw error;
        reportId = data.id;
      }

      if (reportId) {
        const narrative = form.narrative.trim();
        if (narrative) {
          const { error } = await supabase
            .from("vhd_report_narratives")
            .upsert({ report_id: reportId, narrative, created_by: userId }, { onConflict: "report_id" });
          if (error) throw error;
        } else if (narrativeLoaded) {
          // Vider le champ efface réellement le récit. Sur des données aussi
          // sensibles, ne pas pouvoir effacer serait un défaut, pas une
          // sécurité : une demande d'effacement doit pouvoir être honorée.
          const { error } = await supabase
            .from("vhd_report_narratives")
            .delete()
            .eq("report_id", reportId);
          if (error) throw error;
        }
      }

      toast({ title: existingId ? "Signalement mis à jour" : "Signalement enregistré" });
      await fetchReports();
    },
    [toast, fetchReports],
  );

  const changeStatus = useCallback(
    async (id: string, status: VhdStatus) => {
      const { error } = await supabase
        .from("vhd_reports")
        .update({
          status,
          closed_at: status === "cloture" ? new Date().toISOString() : null,
        })
        .eq("id", id);

      if (error) {
        toastError(toast, "Impossible de mettre à jour le statut");
        return;
      }
      await fetchReports();
    },
    [toast, fetchReports],
  );

  const deleteReport = useCallback(
    async (id: string) => {
      // Le récit part avec, par cascade sur la clé étrangère.
      const { error } = await supabase.from("vhd_reports").delete().eq("id", id);
      if (error) {
        toastError(toast, "Impossible de supprimer le signalement");
        return;
      }
      toast({ title: "Signalement supprimé" });
      await fetchReports();
    },
    [toast, fetchReports],
  );

  return {
    reports: visibleReports,
    trainings,
    stats,
    loading,
    statusFilter,
    setStatusFilter,
    fetchNarrative,
    saveReport,
    deleteReport,
    changeStatus,
    refresh: fetchReports,
  };
}
