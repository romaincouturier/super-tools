import { useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface GameDevisItem {
  title: string;
  quantity: number;
  unitPrice: number;
}

export interface GameDevisPayload {
  nomClient: string;
  adresseClient: string;
  codePostalClient: string;
  villeClient: string;
  pays: string;
  emailCommanditaire: string;
  adresseCommanditaire: string;
  items: GameDevisItem[];
  fraisDePort: number;
  fraisDossier: number;
  noteDevis: string;
  crmCardId?: string;
  senderEmail?: string;
}

export function useGenerateGameDevis() {
  return useMutation({
    mutationFn: async (payload: GameDevisPayload) => {
      const { data, error } = await supabase.functions.invoke("generate-game-devis", {
        body: payload,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      return data as { success: boolean; pdfUrl: string | null };
    },
  });
}
