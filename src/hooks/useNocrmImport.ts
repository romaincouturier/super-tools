import { useCallback, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listNocrmImportRuns, reconcileNocrmImport, simulateNocrmImport, startNocrmImport, stepNocrmImport, uploadNocrmFiles,
  type NocrmImportRun,
} from "@/services/nocrmImport";

export function useNocrmImportRuns() {
  return useQuery({ queryKey: ["nocrm-import-runs"], queryFn: listNocrmImportRuns });
}

/** Pilote l'import : chaque appel serveur traite un lot ; la boucle reprend là où l'import s'est arrêté. */
export function useNocrmImportRunner() {
  const qc = useQueryClient();
  const [busy, setBusy] = useState(false);
  const [current, setCurrent] = useState<NocrmImportRun | null>(null);
  const stopRef = useRef(false);
  const refresh = () => qc.invalidateQueries({ queryKey: ["nocrm-import-runs"] });

  const loop = useCallback(async (run: NocrmImportRun) => {
    let r = run;
    setCurrent(r);
    while (r.status === "running" && !stopRef.current) {
      r = await stepNocrmImport(r.id);
      setCurrent(r);
    }
    refresh();
    return r;
  }, []);

  const wrap = <A extends unknown[]>(fn: (...a: A) => Promise<NocrmImportRun>) => async (...a: A) => {
    setBusy(true); stopRef.current = false;
    try { return await fn(...a); } finally { setBusy(false); refresh(); }
  };

  return {
    busy,
    current,
    stop: () => { stopRef.current = true; },
    upload: wrap(async (leads: File) => {
      const paths = await uploadNocrmFiles(leads);
      return { leads_path: paths.leadsPath, comments_path: paths.commentsPath } as NocrmImportRun;
    }),
    simulate: wrap(async (leadsPath: string, commentsPath: string) => { const r = await simulateNocrmImport(leadsPath, commentsPath); setCurrent(r); return r; }),
    start: wrap(async (mode: "test" | "full", leadsPath: string, commentsPath: string) => loop(await startNocrmImport(mode, leadsPath, commentsPath))),
    resume: wrap(async (run: NocrmImportRun) => loop(run)),
    reconcile: wrap(async (runId: string) => { const r = await reconcileNocrmImport(runId); setCurrent(r); return r; }),
  };
}
