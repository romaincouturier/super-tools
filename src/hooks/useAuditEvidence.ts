import { useCallback, useEffect, useState } from "react";
import { fetchAuditEvidence, recordHumanEvidence, type AuditEvidence, type HumanEvidenceInput } from "@/services/auditEvidence";

export function useAuditEvidence() {
  const [evidence, setEvidence] = useState<AuditEvidence[]>([]);
  const [loading, setLoading] = useState(true);
  const refresh = useCallback(async () => {
    try { setEvidence(await fetchAuditEvidence()); } catch (e) { console.error("Error fetching audit evidence:", e); }
  }, []);
  useEffect(() => { refresh().finally(() => setLoading(false)); }, [refresh]);
  const recordHuman = useCallback(async (rows: HumanEvidenceInput[], userId: string) => {
    await recordHumanEvidence(rows, userId);
    await refresh();
  }, [refresh]);
  return { evidence, loading, recordHuman, refresh };
}
