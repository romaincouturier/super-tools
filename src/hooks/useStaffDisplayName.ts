import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/** Display name stored on staff replies (profile first/last name, email prefix fallback). */
export function useStaffDisplayName(userId: string | undefined, email: string) {
  return useQuery({
    queryKey: ["staff_display_name", userId],
    enabled: !!userId,
    queryFn: async () => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data } = await (supabase as any)
        .from("profiles")
        .select("first_name, last_name")
        .eq("user_id", userId)
        .maybeSingle();
      const name = [data?.first_name, data?.last_name].filter(Boolean).join(" ").trim();
      return name || (email ? email.split("@")[0] : null);
    },
  });
}
