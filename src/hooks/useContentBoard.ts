import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface ContentBoardUser {
  id: string;
  email: string;
  displayName: string | null;
}

export function useContentBoardUsers(): ContentBoardUser[] {
  const { data = [] } = useQuery({
    queryKey: ["content-board-users"],
    queryFn: async () => {
      const [{ data: access }, { data: admins }] = await Promise.all([
        supabase.from("user_module_access").select("user_id").eq("module", "contenu"),
        supabase.from("profiles").select("user_id").eq("is_admin", true),
      ]);
      const userIds = new Set<string>();
      access?.forEach((a) => userIds.add(a.user_id));
      admins?.forEach((a) => userIds.add(a.user_id));
      if (userIds.size === 0) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("user_id, email, display_name")
        .in("user_id", Array.from(userIds));
      return (profiles || []).map((p) => ({
        id: p.user_id,
        email: p.email,
        displayName: p.display_name,
      }));
    },
    staleTime: 60_000,
  });
  return data;
}
