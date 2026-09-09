import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { todayAsISO } from "@/lib/dateFormatters";
import {
  buildRiskRecord,
  summarizeRisks,
  type QualityRiskFormValues,
  type RiskStatus,
} from "@/lib/qualityRiskConstants";

/**
 * Registre des risques qualité (indicateur 32).
 *
 * Les trois rattachements possibles — formation du catalogue, réclamation à
 * l'origine, action d'amélioration engagée — sont chargés en même temps que le
 * registre : ce sont eux qui distinguent la prévention de la correction, et
 * les charger à l'ouverture d'un formulaire ferait attendre à chaque saisie.
 */

export interface QualityRisk {
  id: string;
  label: string;
  formation_config_id: string | null;
  modality: string | null;
  cause: string | null;
  probability: number;
  impact: number;
  criticality: number;
  preventive_measure: string | null;
  owner: string | null;
  review_date: string | null;
  status: string;
  reclamation_id: string | null;
  improvement_id: string | null;
  framework_version: string;
  created_at: string;
  formation_configs?: { formation_name: string } | null;
}

export interface RiskLinkOption {
  id: string;
  label: string;
}

export function useQualityRisks() {
  const [risks, setRisks] = useState<QualityRisk[]>([]);
  const [formations, setFormations] = useState<RiskLinkOption[]>([]);
  const [reclamations, setReclamations] = useState<RiskLinkOption[]>([]);
  const [improvements, setImprovements] = useState<RiskLinkOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("active");
  const { toast } = useToast();

  const fetchRisks = useCallback(async () => {
    const { data, error } = await supabase
      .from("quality_risks")
      .select("*, formation_configs(formation_name)")
      .order("criticality", { ascending: false })
      .order("review_date", { ascending: true, nullsFirst: false });

    if (error) {
      console.error("Error fetching quality_risks:", error);
      toastError(toast, "Impossible de charger le registre des risques");
      return;
    }
    setRisks((data || []) as unknown as QualityRisk[]);
  }, [toast]);

  const fetchLinks = useCallback(async () => {
    const [configs, recs, imps] = await Promise.all([
      supabase
        .from("formation_configs")
        .select("id, formation_name")
        .eq("is_active", true)
        .order("formation_name"),
      supabase
        .from("reclamations")
        .select("id, client_name, date_reclamation, problem_type")
        .order("date_reclamation", { ascending: false })
        .limit(100),
      supabase
        .from("improvements")
        .select("id, title")
        .neq("status", "completed")
        .order("created_at", { ascending: false })
        .limit(100),
    ]);

    setFormations((configs.data || []).map((c) => ({ id: c.id, label: c.formation_name })));
    setReclamations(
      (recs.data || []).map((r) => ({
        id: r.id,
        label: [r.date_reclamation, r.client_name || "sans client", r.problem_type]
          .filter(Boolean)
          .join(" · "),
      })),
    );
    setImprovements((imps.data || []).map((i) => ({ id: i.id, label: i.title })));
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchRisks(), fetchLinks()]).finally(() => setLoading(false));
  }, [fetchRisks, fetchLinks]);

  const today = todayAsISO();

  const visibleRisks = useMemo(() => {
    if (statusFilter === "all") return risks;
    if (statusFilter === "active") return risks.filter((r) => r.status !== "closed");
    return risks.filter((r) => r.status === statusFilter);
  }, [risks, statusFilter]);

  const summary = useMemo(() => summarizeRisks(risks, today), [risks, today]);

  const saveRisk = useCallback(
    async (form: QualityRiskFormValues, userId?: string, existingId?: string) => {
      const record = buildRiskRecord(form);

      if (existingId) {
        const { error } = await supabase.from("quality_risks").update(record).eq("id", existingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("quality_risks")
          .insert({ ...record, created_by: userId });
        if (error) throw error;
      }

      toast({ title: existingId ? "Risque mis à jour" : "Risque enregistré" });
      await fetchRisks();
    },
    [toast, fetchRisks],
  );

  const changeStatus = useCallback(
    async (id: string, status: RiskStatus) => {
      const { error } = await supabase.from("quality_risks").update({ status }).eq("id", id);
      if (error) {
        toastError(toast, "Impossible de mettre à jour le statut");
        return;
      }
      await fetchRisks();
    },
    [toast, fetchRisks],
  );

  const deleteRisk = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("quality_risks").delete().eq("id", id);
      if (error) {
        toastError(toast, "Impossible de supprimer le risque");
        return;
      }
      toast({ title: "Risque supprimé" });
      await fetchRisks();
    },
    [toast, fetchRisks],
  );

  return {
    risks: visibleRisks,
    formations,
    reclamations,
    improvements,
    summary,
    loading,
    statusFilter,
    setStatusFilter,
    saveRisk,
    deleteRisk,
    changeStatus,
    refresh: fetchRisks,
  };
}
