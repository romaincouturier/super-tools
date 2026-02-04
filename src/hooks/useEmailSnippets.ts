import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface EmailSnippet {
  id: string;
  name: string;
  content: string;
  category: string;
  position: number;
}

export const useEmailSnippets = () => {
  return useQuery({
    queryKey: ["email-snippets"],
    queryFn: async () => {
      // Use any to bypass TypeScript issues with generated types
      const { data, error } = await (supabase as any)
        .from("email_snippets")
        .select("*")
        .order("category")
        .order("position");

      if (error) throw error;
      return data as EmailSnippet[];
    },
  });
};
