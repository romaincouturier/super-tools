import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import type { AuditFacts, AnswerValue, IndicatorFinding } from "@/lib/auditChecks";

/**
 * Historique des passages d'audit blanc.
 *
 * Le guide cite « l'organisation de l'audit interne » parmi les preuves de la
 * démarche d'amélioration continue : un audit blanc qui ne laisserait aucune
 * trace ne prouverait rien. Chaque passage conserve les faits constatés ce
 * jour-là, pour qu'un rapport relu plus tard dise ce qui était vrai à sa date.
 */

export interface AuditRun {
  id: string;
  label: string | null;
  framework_version: string;
  started_at: string;
  finished_at: string | null;
  sample_training_ids: string[];
  facts: unknown;
  answers: unknown;
  findings: unknown;
  notes: string | null;
}

export interface SaveRunInput {
  facts: AuditFacts;
  answers: Record<string, AnswerValue>;
  findings: IndicatorFinding[];
  notes: string;
  sampleTrainingIds: string[];
}

export function useAuditRuns() {
  const [runs, setRuns] = useState<AuditRun[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchRuns = useCallback(async () => {
    const { data, error } = await supabase
      .from("audit_runs")
      .select("*")
      .order("started_at", { ascending: false })
      .limit(20);

    if (error) {
      console.error("Error fetching audit runs:", error);
      toastError(toast, "Impossible de charger l'historique des audits");
      return;
    }
    setRuns((data || []) as unknown as AuditRun[]);
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    fetchRuns().finally(() => setLoading(false));
  }, [fetchRuns]);

  const saveRun = useCallback(
    async (input: SaveRunInput) => {
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("audit_runs").insert({
        label: `Audit blanc du ${new Date().toLocaleDateString("fr-FR")}`,
        finished_at: new Date().toISOString(),
        sample_training_ids: input.sampleTrainingIds,
        // Les trois colonnes sont des jsonb : le type généré attend Json.
        facts: input.facts as unknown as Json,
        answers: input.answers as unknown as Json,
        findings: input.findings as unknown as Json,
        notes: input.notes.trim() || null,
        created_by: userData?.user?.id ?? null,
      });

      if (error) {
        console.error("Error saving audit run:", error);
        toastError(toast, "Enregistrement du passage impossible");
        return false;
      }
      toast({ title: "Passage enregistré", description: "Il rejoint l'historique des audits internes." });
      await fetchRuns();
      return true;
    },
    [toast, fetchRuns],
  );

  return { runs, loading, saveRun, refresh: fetchRuns };
}
