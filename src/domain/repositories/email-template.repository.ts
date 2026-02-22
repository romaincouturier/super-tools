import type { EmailTemplate } from "../entities/email-template";

export interface IEmailTemplateRepository {
  findAll(): Promise<EmailTemplate[]>;
  update(id: string, updates: { subject: string; content: string }): Promise<void>;
  create(params: {
    templateType: string;
    templateName: string;
    subject: string;
    content: string;
  }): Promise<EmailTemplate>;
}
