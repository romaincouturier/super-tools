import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface CrmEmailTemplate {
  id: string;
  template_type: string;
  template_name: string;
  subject: string;
  html_content: string;
  is_default: boolean;
}

const QUERY_KEY = "crm-email-templates";

export const useCrmEmailTemplates = () => {
  return useQuery({
    queryKey: [QUERY_KEY],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_templates")
        .select("*")
        .like("template_type", "crm_%")
        .order("template_name");

      if (error) throw error;
      return data as CrmEmailTemplate[];
    },
  });
};

export const useCreateCrmTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (template: { template_name: string; subject: string; html_content: string }) => {
      // Generate a slug from the name for template_type
      const slug = template.template_name
        .toLowerCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "");
      const { data, error } = await supabase
        .from("email_templates")
        .insert({
          template_type: `crm_${slug}`,
          template_name: template.template_name,
          subject: template.subject,
          html_content: template.html_content,
          is_default: false,
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

export const useUpdateCrmTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: Partial<Pick<CrmEmailTemplate, "template_name" | "subject" | "html_content">> }) => {
      const { data, error } = await supabase
        .from("email_templates")
        .update(updates)
        .eq("id", id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

export const useDeleteCrmTemplate = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("email_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [QUERY_KEY] });
    },
  });
};

/**
 * Replace template variables in a string.
 *
 * Supported syntax:
 *   {{variable}}              — replaced by value, or empty string if absent
 *   {{variable||fallback}}    — replaced by value, or fallback if absent
 *   {{variable? text {{variable}}}} — conditional block, included only if variable has a value
 */
export function replaceCrmVariables(
  template: string,
  variables: Record<string, string | undefined | null>
): string {
  let result = template;

  // 1. Conditional blocks: {{var? ...content...}}
  result = result.replace(/\{\{(\w+)\?\s*(.*?)\}\}/g, (_match, varName, content) => {
    const value = variables[varName];
    if (!value) return "";
    // Replace inner {{var}} references within the conditional block
    return content.replace(/\{\{(\w+)\}\}/g, (_m: string, innerVar: string) => variables[innerVar] || "");
  });

  // 2. Fallback syntax: {{var||fallback}}
  result = result.replace(/\{\{(\w+)\|\|(.*?)\}\}/g, (_match, varName, fallback) => {
    return variables[varName] || fallback;
  });

  // 3. Simple replacement: {{var}}
  result = result.replace(/\{\{(\w+)\}\}/g, (_match, varName) => {
    return variables[varName] || "";
  });

  return result;
}
