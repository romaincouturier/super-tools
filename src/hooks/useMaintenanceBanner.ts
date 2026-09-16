import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export const DEFAULT_MAINTENANCE_MESSAGE =
  "Nous faisons évoluer notre plateforme. Pendant cette phase de tests et de migration, " +
  "vous pourriez rencontrer ponctuellement quelques difficultés d'accès. Nous faisons au " +
  "mieux pour que cette période soit la plus courte et la plus discrète possible. " +
  "Merci pour votre patience et votre compréhension.";

/** Un réglage absent ou illisible ne doit jamais afficher le bandeau. */
export function isBannerEnabled(value: unknown): boolean {
  return String(value ?? "").trim().toLowerCase() === "true";
}

/** Un texte vide retombe sur le message par défaut. */
export function bannerMessage(value: unknown): string {
  const text = String(value ?? "").trim();
  return text.length > 0 ? text : DEFAULT_MAINTENANCE_MESSAGE;
}

/**
 * Bandeau d'information des écrans de connexion.
 * Lu sans session, par la fonction publique à liste blanche. En cas d'échec,
 * rien ne s'affiche : une panne de lecture ne doit pas inquiéter l'apprenant.
 */
export function useMaintenanceBanner() {
  return useQuery({
    queryKey: ["maintenance-banner"],
    queryFn: async (): Promise<{ enabled: boolean; message: string }> => {
      const [enabled, message] = await Promise.all([
        supabase.rpc("get_app_setting_public", { p_key: "maintenance_banner_enabled" }),
        supabase.rpc("get_app_setting_public", { p_key: "maintenance_banner_message" }),
      ]);
      return {
        enabled: isBannerEnabled(enabled.data),
        message: bannerMessage(message.data),
      };
    },
    staleTime: 60_000,
    retry: false,
  });
}
