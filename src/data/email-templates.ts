import { supabase } from "@/integrations/supabase/client";

export interface EmailTemplate {
  id: string;
  template_type: string;
  template_name: string;
  subject: string;
  html_content: string;
  is_default: boolean;
}

export type AddressMode = "tu" | "vous";

/** Fetch all email templates */
export async function fetchEmailTemplates(): Promise<EmailTemplate[]> {
  const { data, error } = await supabase
    .from("email_templates")
    .select("*");

  if (error) throw error;
  return (data || []) as EmailTemplate[];
}

/** Update an existing email template */
export async function updateEmailTemplate(
  id: string,
  updates: { subject: string; content: string }
): Promise<void> {
  const { error } = await supabase
    .from("email_templates")
    .update({
      subject: updates.subject,
      html_content: updates.content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw error;
}

/** Create a new email template */
export async function createEmailTemplate(params: {
  templateType: string;
  templateName: string;
  subject: string;
  content: string;
}): Promise<EmailTemplate> {
  const { data, error } = await supabase
    .from("email_templates")
    .insert({
      template_type: params.templateType,
      template_name: params.templateName,
      subject: params.subject,
      html_content: params.content,
      is_default: false,
    })
    .select()
    .single();

  if (error) throw error;
  return data as EmailTemplate;
}

/** Improve email content with AI */
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
