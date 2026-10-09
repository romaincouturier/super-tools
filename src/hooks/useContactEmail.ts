import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Repli unique si le paramètre général `contact_email` est vide ou illisible. */
export const DEFAULT_CONTACT_EMAIL = "contact@supertilt.fr";

/** Adresse de contact (Paramètres > Général), lisible sans session. */
export function useContactEmail(): string {
  const { data } = useQuery({
    queryKey: ["app-setting-public", "contact_email"],
    queryFn: async () => {
      const { data } = await supabase.rpc("get_app_setting_public", { p_key: "contact_email" });
      return String(data ?? "").replace(/\s+/g, "");
    },
    staleTime: 5 * 60_000,
    retry: false,
  });
  return data || DEFAULT_CONTACT_EMAIL;
}
