import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { uncoveredTypes, activeCount } from "@/lib/handicapPartners";

/**
 * Réseau de partenaires du champ du handicap (indicateur 26).
 *
 * Le réseau vivait dans un classeur externe : invisible depuis l'application,
 * absent des sauvegardes, et impossible à présenter en audit sans sortir de
 * SuperTools.
 */

export interface HandicapPartner {
  id: string;
  organisation: string;
  handicap_type: string;
  address: string | null;
  phone: string | null;
  email: string | null;
  url: string | null;
  notes: string | null;
  last_contact_date: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export type HandicapPartnerInput = Omit<
  HandicapPartner,
  "id" | "created_at" | "updated_at"
>;

export function useHandicapPartners() {
  const [partners, setPartners] = useState<HandicapPartner[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchPartners = useCallback(async () => {
    const { data, error } = await supabase
      .from("handicap_partners")
      .select("*")
      .order("is_active", { ascending: false })
      .order("organisation", { ascending: true });

    if (error) {
      console.error("Error fetching handicap partners:", error);
      toastError(toast, "Impossible de charger les partenaires handicap");
      return;
    }
    setPartners((data || []) as unknown as HandicapPartner[]);
  }, [toast]);

  useEffect(() => {
    setLoading(true);
    fetchPartners().finally(() => setLoading(false));
  }, [fetchPartners]);

  const save = useCallback(
    async (input: HandicapPartnerInput, id?: string) => {
      const payload = { ...input, organisation: input.organisation.trim() };
      const { error } = id
        ? await supabase.from("handicap_partners").update(payload).eq("id", id)
        : await supabase.from("handicap_partners").insert(payload);

      if (error) {
        // L'index unique sur l'organisme évite deux fiches pour le même acteur.
        const duplicate = (error as { code?: string }).code === "23505";
        toastError(
          toast,
          duplicate ? "Cet organisme figure déjà dans le réseau" : "Enregistrement impossible",
        );
        return false;
      }
      toast({ title: id ? "Partenaire mis à jour" : "Partenaire ajouté" });
      await fetchPartners();
      return true;
    },
    [toast, fetchPartners],
  );

  const remove = useCallback(
    async (id: string) => {
      const { error } = await supabase.from("handicap_partners").delete().eq("id", id);
      if (error) {
        toastError(toast, "Suppression impossible");
        return;
      }
      toast({ title: "Partenaire retiré du réseau" });
      await fetchPartners();
    },
    [toast, fetchPartners],
  );

  const uncovered = useMemo(() => uncoveredTypes(partners), [partners]);
  const active = useMemo(() => activeCount(partners), [partners]);

  return { partners, loading, save, remove, uncovered, active, refresh: fetchPartners };
}
