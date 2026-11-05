import { supabase } from "@/integrations/supabase/client";
import type { OpportunityExtraction } from "@/types/crm";
import {
  estimateOpportunityValue,
  loadOpportunityValueData,
  type ValueEstimate,
} from "../../supabase/functions/_shared/opportunity-value";

export async function estimateCrmOpportunityValue(extraction: OpportunityExtraction): Promise<ValueEstimate> {
  const { catalog, won } = await loadOpportunityValueData(supabase);
  return estimateOpportunityValue(
    {
      service_type: extraction.service_type === "formation" || extraction.service_type === "mission" ? extraction.service_type : null,
      company: extraction.company,
      title: extraction.title,
      formation_name: extraction.formation_name ?? null,
      format: extraction.format ?? null,
      participants: extraction.participants ?? null,
    },
    catalog,
    won,
  );
}
