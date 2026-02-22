import { supabase } from "@/integrations/supabase/client";
import type { EmailTemplate } from "@/domain/entities/email-template";
import type { IEmailTemplateRepository } from "@/domain/repositories/email-template.repository";

export class SupabaseEmailTemplateRepository implements IEmailTemplateRepository {
  async findAll(): Promise<EmailTemplate[]> {
    const { data, error } = await supabase.from("email_templates").select("*");
    if (error) throw error;
    return (data || []) as EmailTemplate[];
  }

  async update(id: string, updates: { subject: string; content: string }): Promise<void> {
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

  async create(params: {
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
}

export const emailTemplateRepository = new SupabaseEmailTemplateRepository();
