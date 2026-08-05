/**
 * Synthèse d'un avis et analyse des pièces du DCE.
 *
 * Les deux passent par la même edge function, et les deux écrivent leur
 * résultat en base : rouvrir une fiche ne doit jamais repayer un appel au
 * modèle. Le bouton reste disponible pour refaire l'analyse quand l'avis a
 * été rectifié ou qu'une pièce a été ajoutée.
 */
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import { TENDERS_QUERY_KEY } from "./useTenderOpportunities";
import type {
  TenderDocumentAi,
  TenderDocumentAnalysis,
  TenderNoticeSummary,
} from "@/types/tenders";

export const TENDER_DOCS_AI_QUERY_KEY = "tender-documents-ai";

/** Analyses des pièces déposées, séparées de la liste des fichiers elle-même,
 *  qui reste gérée par le gestionnaire de documents mutualisé. */
export const useTenderDocumentAnalyses = (tenderId: string | undefined) => {
  return useQuery({
    queryKey: [TENDER_DOCS_AI_QUERY_KEY, tenderId],
    enabled: !!tenderId,
    queryFn: async (): Promise<TenderDocumentAi[]> => {
      const { data, error } = await supabase
        .from("tender_documents")
        .select("id, file_name, ai_analysis, ai_analysis_at, ai_error")
        .eq("tender_id", tenderId!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as TenderDocumentAi[];
    },
  });
};

export const useTenderNoticeSummary = () => {
  const queryClient = useQueryClient();
  const { loading, invoke } = useEdgeFunction<{ summary: TenderNoticeSummary | null }>(
    "tender-analyze",
    { errorMessage: "Impossible de produire la synthèse de cet avis" },
  );

  return {
    loading,
    run: async (tenderId: string) => {
      const result = await invoke({ tender_id: tenderId });
      if (result) queryClient.invalidateQueries({ queryKey: [TENDERS_QUERY_KEY] });
      return result?.summary ?? null;
    },
  };
};

export const useTenderDocumentAnalysis = (tenderId: string | undefined) => {
  const queryClient = useQueryClient();
  const { loading, invoke } = useEdgeFunction<{
    analysis: TenderDocumentAnalysis | null;
    error?: string;
  }>("tender-analyze", { errorMessage: "Impossible d'analyser ce document" });

  return {
    loading,
    run: async (documentId: string) => {
      const result = await invoke({ document_id: documentId });
      // L'échec d'extraction est stocké sur la ligne : on rafraîchit même
      // quand aucune analyse n'est revenue, sinon le motif reste invisible.
      queryClient.invalidateQueries({ queryKey: [TENDER_DOCS_AI_QUERY_KEY, tenderId] });
      return result?.analysis ?? null;
    },
  };
};
