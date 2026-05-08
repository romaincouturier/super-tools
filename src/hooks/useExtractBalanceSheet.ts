import { useQueryClient } from "@tanstack/react-query";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";
import type { BalanceSheetData } from "@/lib/balanceSheetParser";

export interface ExtractedBalanceSheet extends BalanceSheetData {
  warnings?: string[];
}

export function useExtractBalanceSheet() {
  const qc = useQueryClient();
  const edge = useEdgeFunction<ExtractedBalanceSheet>("extract-balance-sheet", {
    errorMessage: "Échec de l'extraction du bilan",
  });

  const extract = async (input: { storage_path: string; annee: number; pdf_filename?: string }) => {
    const result = await edge.invoke({
      storage_path: input.storage_path,
      annee: input.annee,
      pdf_filename: input.pdf_filename,
    });
    if (result) {
      qc.invalidateQueries({ queryKey: ["balance_sheets"] });
    }
    return result;
  };

  return { extract, loading: edge.loading, error: edge.error };
}
