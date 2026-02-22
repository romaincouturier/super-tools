import { supabase } from "@/integrations/supabase/client";
import { emailTemplateRepository } from "@/infrastructure/supabase/email-template.repository";

// Re-export domain types for backward compatibility
export type { EmailTemplate, AddressMode } from "@/domain/entities/email-template";

// --- CRUD (delegated to repository) ---

export const fetchEmailTemplates = () => emailTemplateRepository.findAll();

export const updateEmailTemplate = (id: string, updates: { subject: string; content: string }) =>
  emailTemplateRepository.update(id, updates);

export const createEmailTemplate = (params: {
  templateType: string;
  templateName: string;
  subject: string;
  content: string;
}) => emailTemplateRepository.create(params);

// --- AI (edge function, stays here as it's not a repository concern) ---

export async function improveEmailWithAI(params: {
  subject: string;
  content: string;
  templateType: string;
  templateName: string;
}): Promise<{ subject: string; content: string }> {
  const { data, error } = await supabase.functions.invoke("improve-email-content", {
    body: params,
  });
  if (error) throw error;
  if (data.error) throw new Error(data.error);
  return { subject: data.subject, content: data.content };
}
