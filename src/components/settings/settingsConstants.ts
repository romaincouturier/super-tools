// Shared types and constants for the Settings page

export interface EmailTemplate {
  id: string;
  template_type: string;
  template_name: string;
  subject: string;
  html_content: string;
  is_default: boolean;
}

export type AddressMode = "tu" | "vous";

// Template configuration with timing info
export interface TemplateConfig {
  name: string;
  timing: "before" | "during" | "after" | "manual" | "mission_after";
  sendingInfo: string; // Human-readable description of when/how the email is sent
  delayKey?: string; // Key in app_settings for delay
  subject: { tu: string; vous: string };
  content: { tu: string; vous: string };
  variables: string[];
}

export const DEFAULT_TEMPLATES: Record<string, TemplateConfig> = {
  // BEFORE TRAINING
  needs_survey: {
    name: "Questionnaire de recueil des besoins",
    timing: "before",
    sendingInfo: "Envoye automatiquement aux participants, J-X avant la formation (configurable)",
    delayKey: "delay_needs_survey_days",
    subject: {
      tu: "Prepare ta formation \"{{training_name}}\"",
      vous: "Preparez votre formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu es inscrit(e) a la formation "{{training_name}}" qui aura lieu le {{training_date}}.

Afin de personnaliser au mieux cette formation, je t'invite a remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre tes attentes et d'adapter le contenu de la formation a tes besoins specifiques.

Je te remercie de le completer avant le {{deadline_date}}.

A tres bientot !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Vous etes inscrit(e) a la formation "{{training_name}}" qui aura lieu le {{training_date}}.

Afin de personnaliser au mieux cette formation, je vous invite a remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre vos attentes et d'adapter le contenu de la formation a vos besoins specifiques.

Je vous remercie de le completer avant le {{deadline_date}}.

A tres bientot !`,
    },
    variables: ["first_name", "training_name", "training_date", "questionnaire_link", "deadline_date"],
  },
  needs_survey_reminder: {
    name: "Rappel questionnaire besoins",
    timing: "before",
    sendingInfo: "Envoye automatiquement aux participants qui n'ont pas complete le questionnaire, 3 jours apres l'envoi initial",
    subject: {
      tu: "Rappel : Prepare ta formation \"{{training_name}}\"",
      vous: "Rappel : Preparez votre formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de te relancer concernant le questionnaire de preparation pour la formation "{{training_name}}".

Ton retour m'est precieux pour adapter au mieux le contenu a tes besoins.

{{questionnaire_link}}

Merci d'avance pour ta participation !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de vous relancer concernant le questionnaire de preparation pour la formation "{{training_name}}".

Votre retour m'est precieux pour adapter au mieux le contenu a vos besoins.

{{questionnaire_link}}

Merci d'avance pour votre participation !`,
    },
    variables: ["first_name", "training_name", "questionnaire_link"],
  },
};
