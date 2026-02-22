// EmailTemplate domain entity — single source of truth

export interface EmailTemplate {
  id: string;
  template_type: string;
  template_name: string;
  subject: string;
  html_content: string;
  is_default: boolean;
}

export type AddressMode = "tu" | "vous";
