import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEdgeFunction } from "@/hooks/useEdgeFunction";

// Table absente des types générés.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = supabase as any;

export interface LocationExtensionSignature {
  status: "pending" | "signed" | "expired" | "cancelled";
  signed_at: string | null;
  email_sent_at: string | null;
  signed_pdf_url: string | null;
  created_at: string;
}

export interface LocationExtension {
  id: string;
  order_item_id: string;
  sequence: number;
  start_date: string;
  end_date: string;
  amount_ht: number;
  vat_rate: string;
  contrat_reference: string;
  contract_file_url: string | null;
  invoice_number: string | null;
  invoice_url: string | null;
  created_at: string;
  /** Dernier envoi en signature de l'avenant, s'il y en a un. */
  signature: LocationExtensionSignature | null;
}

export interface LocationExtensionPrepare {
  customer: {
    type: "company";
    name: string;
    email: string;
    address: string;
    postal_code: string;
    city: string;
    country: string;
    reg_no: string;
  };
  start_date: string | null;
  amount_ht: number | null;
}

const key = (orderItemId: string) => ["location-extensions", orderItemId];

export function useLocationExtensions(orderItemId: string) {
  return useQuery({
    queryKey: key(orderItemId),
    queryFn: async (): Promise<LocationExtension[]> => {
      const { data, error } = await db
        .from("location_extensions")
        .select(
          "id, order_item_id, sequence, start_date, end_date, amount_ht, vat_rate, contrat_reference, contract_file_url, invoice_number, invoice_url, created_at, location_contract_signatures(status, signed_at, email_sent_at, signed_pdf_url, created_at)",
        )
        .eq("order_item_id", orderItemId)
        .order("sequence", { ascending: true });
      if (error) throw error;
      return (data ?? []).map((row: LocationExtension & { location_contract_signatures: LocationExtensionSignature[] }) => {
        const { location_contract_signatures: sigs, ...ext } = row;
        const latest = [...(sigs ?? [])].sort((a, b) => b.created_at.localeCompare(a.created_at))[0] ?? null;
        return { ...ext, signature: latest };
      });
    },
  });
}

/** Préparation, création (facture Pennylane), génération et envoi de l'avenant. */
export function useLocationExtensionActions(orderItemId: string) {
  const qc = useQueryClient();
  const prepare = useEdgeFunction<LocationExtensionPrepare>("create-location-extension", {
    errorMessage: "Impossible de préparer la prolongation",
  });
  const create = useEdgeFunction<{
    extension_id: string;
    contrat_reference: string;
    invoice_number: string;
    saved: boolean;
    update_error: string | null;
  }>("create-location-extension");
  const generate = useEdgeFunction<{ contratReference: string }>("generate-location-contract", {
    errorMessage: "Erreur génération de l'avenant",
  });
  const send = useEdgeFunction<{ success: boolean }>("send-location-contract-email", {
    errorMessage: "Erreur envoi de l'avenant",
  });

  const refresh = () => {
    qc.invalidateQueries({ queryKey: key(orderItemId) });
    qc.invalidateQueries({ queryKey: ["order-items"] });
    qc.invalidateQueries({ queryKey: ["order-items-all"] });
  };

  return {
    prepare,
    create,
    generate,
    send,
    refresh,
  };
}
