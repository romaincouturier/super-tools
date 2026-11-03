import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { countDevisByFormation } from "@/lib/formationDemand";

/**
 * Nombre de demandes de devis (micro-devis envoyés) par formation,
 * d'après le journal d'activité. Sert à trier le sélecteur de formation
 * du micro-devis du plus demandé au moins demandé.
 */
export function useDevisDemandCounts(enabled: boolean) {
  const [demandByFormation, setDemandByFormation] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from("activity_logs")
          .select("details")
          .eq("action_type", "micro_devis_sent");
        if (error) throw error;
        if (cancelled) return;
        const labels = ((data ?? []) as { details?: unknown }[])
          .map((row) => {
            const details = row.details;
            if (details && typeof details === "object") {
              return (details as { formation_name?: string }).formation_name ?? "";
            }
            return "";
          })
          .filter(Boolean);
        setDemandByFormation(countDevisByFormation(labels));
      } catch (error) {
        // En cas d'échec, le sélecteur garde son ordre manuel habituel.
        console.error("Error loading devis demand counts:", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [enabled]);

  return { demandByFormation };
}
