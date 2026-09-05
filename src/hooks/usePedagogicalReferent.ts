import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { toastError } from "@/lib/toastError";
import { todayAsISO } from "@/lib/dateFormatters";

/**
 * Référent pédagogique d'une session et seuil qui le rend obligatoire
 * (indicateur 19).
 */

export interface PedagogicalReferentState {
  name: string;
  email: string;
  designatedAt: string | null;
}

const EMPTY: PedagogicalReferentState = { name: "", email: "", designatedAt: null };

export function usePedagogicalReferent(trainingId: string) {
  const [referent, setReferent] = useState<PedagogicalReferentState>(EMPTY);
  const [threshold, setThreshold] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [training, setting] = await Promise.all([
        supabase
          .from("trainings")
          .select("pedagogical_referent_name, pedagogical_referent_email, pedagogical_referent_designated_at")
          .eq("id", trainingId)
          .maybeSingle(),
        supabase
          .from("app_settings")
          .select("setting_value")
          .eq("setting_key", "distance_intervenant_threshold")
          .maybeSingle(),
      ]);

      if (training.data) {
        setReferent({
          name: training.data.pedagogical_referent_name || "",
          email: training.data.pedagogical_referent_email || "",
          designatedAt: training.data.pedagogical_referent_designated_at,
        });
      }
      setThreshold(setting.data?.setting_value?.trim() || "");
      setLoading(false);
    };
    load();
  }, [trainingId]);

  const save = useCallback(async () => {
    setSaving(true);
    const name = referent.name.trim();
    // La date de désignation date un fait : elle se pose au premier
    // enregistrement et disparaît si le référent est retiré.
    const designatedAt = name ? (referent.designatedAt ?? todayAsISO()) : null;

    const { error } = await supabase
      .from("trainings")
      .update({
        pedagogical_referent_name: name || null,
        pedagogical_referent_email: referent.email.trim() || null,
        pedagogical_referent_designated_at: designatedAt,
      })
      .eq("id", trainingId);

    setSaving(false);
    if (error) {
      toastError(toast, "Impossible d'enregistrer le référent pédagogique");
      return;
    }
    setReferent((prev) => ({ ...prev, designatedAt }));
    toast({ title: name ? "Référent pédagogique enregistré" : "Référent pédagogique retiré" });
  }, [referent, trainingId, toast]);

  return { referent, setReferent, threshold, loading, saving, save };
}
