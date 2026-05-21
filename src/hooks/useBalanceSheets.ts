import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";
import type { BalanceSheetData } from "@/lib/balanceSheetParser";

export interface BalanceSheetRow {
  id: string;
  user_id: string;
  annee: number;
  data: BalanceSheetData;
  pdf_filename: string | null;
  pdf_storage_path: string | null;
  extracted_at: string;
  created_at: string;
  updated_at: string;
}

const QUERY_KEY = ["balance_sheets"] as const;

export function useBalanceSheets() {
  return useQuery({
    queryKey: QUERY_KEY,
    queryFn: async (): Promise<BalanceSheetRow[]> => {
      const { data, error } = await supabase
        .from("balance_sheets")
        .select("*")
        .order("annee", { ascending: false })
        .limit(10);
      if (error) throw error;
      // Supabase types `data` comme `Json` (union large) ; on coerce vers
      // le type domaine. La donnée est produite par notre edge function
      // qui garantit la forme du JSON (cf. extract-balance-sheet).
      return (data ?? []) as unknown as BalanceSheetRow[];
    },
    staleTime: 60 * 1000,
  });
}

export function useDeleteBalanceSheet() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (row: BalanceSheetRow): Promise<void> => {
      // Supprimer le PDF du bucket si présent (best effort).
      if (row.pdf_storage_path) {
        await supabase.storage.from("balance-sheets").remove([row.pdf_storage_path]);
      }
      const { error } = await supabase.from("balance_sheets").delete().eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}

export interface UploadResult {
  storage_path: string;
  filename: string;
}

export function useUploadBalanceSheetPDF() {
  return useMutation({
    mutationFn: async (input: { file: File; annee: number }): Promise<UploadResult> => {
      const { data: userData, error: userErr } = await supabase.auth.getUser();
      if (userErr || !userData.user) throw new Error("Utilisateur non authentifié");

      const ts = Date.now();
      const path = `${userData.user.id}/${input.annee}-${ts}.pdf`;
      const formData = new FormData();
      formData.append("file", input.file, input.file.name);
      formData.append("path", path);
      const { data, error } = await supabase.functions.invoke("upload-balance-sheet", { body: formData });
      if (error) throw error;
      if (!(data as { publicUrl?: string } | null)?.publicUrl) throw new Error("Upload échoué");
      return { storage_path: path, filename: input.file.name };
    },
  });
}

export function useUpdateBalanceSheetData() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; data: BalanceSheetData }): Promise<void> => {
      const { error } = await supabase
        .from("balance_sheets")
        .update({ data: input.data as unknown as Json })
        .eq("id", input.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: QUERY_KEY }),
  });
}
