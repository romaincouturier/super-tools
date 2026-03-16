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
      const { data, error } = await supabase
        .from("email_snippets")
        .select("*")
        .order("category")
        .order("position");

      if (error) throw error;
      return data as EmailSnippet[];
    },
  });
};
