import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCrmMutation, CRM_QUERY_KEY } from "./useCrmMutation";

export interface ServiceTypeColors {
  formation: string;
  mission: string;
  default: string;
}

export const useCrmSettings = () => {
  return useQuery({
    queryKey: [CRM_QUERY_KEY, "settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("crm_settings" as "crm_cards")
        .select("*")
        .in("setting_key" as "title", ["service_type_colors"]) as unknown as {
          data: { setting_key: string; setting_value: unknown }[] | null;
          error: Error | null;
        };

      if (error) throw error;

      const settings: Record<string, unknown> = {};
      (data || []).forEach((row) => {
        settings[row.setting_key] = row.setting_value;
      });

      return {
        serviceTypeColors: (settings.service_type_colors || {
          formation: "#3b82f6",
          mission: "#8b5cf6",
          default: "#6b7280",
        }) as ServiceTypeColors,
      };
    },
  });
};

export const useUpdateCrmSettings = () =>
  useCrmMutation(
    async ({ key, value }: { key: string; value: unknown }) => {
      const { error } = await (
        supabase as unknown as {
          from: (table: string) => {
            upsert: (
              data: Record<string, unknown>,
              options: { onConflict: string }
            ) => Promise<{ error: Error | null }>;
          };
        }
      )
        .from("crm_settings")
        .upsert(
          {
            setting_key: key,
            setting_value: value,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "setting_key" }
        );
      if (error) throw error;
    },
    {
      successMessage: "Param\u00e8tres enregistr\u00e9s",
      invalidateKey: [CRM_QUERY_KEY, "settings"],
    }
  );
