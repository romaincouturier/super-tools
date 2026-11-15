import { useCallback, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { AuditFacts } from "@/lib/auditChecks";
import { collectAuditFacts } from "../../supabase/functions/_shared/qualiopi-collector";

export interface AuditSample {
  trainingId: string;
  trainingName: string;
  endDate: string | null;
}
export interface AuditFactsResult {
  facts: AuditFacts;
  sample: AuditSample[];
}
export function useAuditFacts() {
  const [loading, setLoading] = useState(false);
  const gather = useCallback(async (): Promise<AuditFactsResult> => {
    setLoading(true);
    try {
      return await collectAuditFacts(supabase);
    } finally {
      setLoading(false);
    }
  }, []);
  return { gather, loading };
}
