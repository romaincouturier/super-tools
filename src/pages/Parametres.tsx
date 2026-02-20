import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Settings, Mail, Save, RotateCcw, Sparkles, Cog, ExternalLink, Shield, Database, Users, Key, Tag, Upload, FileText, Trash2 } from "lucide-react";
import { Separator } from "@/components/ui/separator";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import UserAccessManager from "@/components/settings/UserAccessManager";
import TrainerManager from "@/components/settings/TrainerManager";
import PageTemplateManager from "@/components/missions/PageTemplateManager";
import BackupManager from "@/components/settings/BackupManager";
import { ApiKeyManager } from "@/components/settings/ApiKeyManager";
import CrmTagManager from "@/components/settings/CrmTagManager";
import CrmColorSettings from "@/components/settings/CrmColorSettings";
import GoogleDriveConnect from "@/components/GoogleDriveConnect";
import GoogleCalendarConnect from "@/components/GoogleCalendarConnect";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import ArenaKeySettings from "@/components/settings/ArenaKeySettings";

interface EmailTemplate {
  id: string;
  template_type: string;
  template_name: string;
  subject: string;
  html_content: string;
  is_default: boolean;
}

type AddressMode = "tu" | "vous";

// Template configuration with timing info
interface TemplateConfig {
  name: string;
  timing: "before" | "during" | "after" | "manual";
  delayKey?: string; // Key in app_settings for delay
  subject: { tu: string; vous: string };
  content: { tu: string; vous: string };
  variables: string[];
}

const DEFAULT_TEMPLATES: Record<string, TemplateConfig> = {
  // BEFORE TRAINING
  needs_survey: {
    name: "Questionnaire de recueil des besoins",
    timing: "before",
    delayKey: "delay_needs_survey_days",
    subject: {
      tu: "Prépare ta formation \"{{training_name}}\"",
      vous: "Préparez votre formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu es inscrit(e) à la formation "{{training_name}}" qui aura lieu le {{training_date}}.

Afin de personnaliser au mieux cette formation, je t'invite à remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre tes attentes et d'adapter le contenu de la formation à tes besoins spécifiques.

Je te remercie de le compléter avant le {{deadline_date}}.

À très bientôt !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Vous êtes inscrit(e) à la formation "{{training_name}}" qui aura lieu le {{training_date}}.

Afin de personnaliser au mieux cette formation, je vous invite à remplir ce court questionnaire de recueil des besoins :
{{questionnaire_link}}

Ce questionnaire me permettra de mieux comprendre vos attentes et d'adapter le contenu de la formation à vos besoins spécifiques.

Je vous remercie de le compléter avant le {{deadline_date}}.

À très bientôt !`,
    },
    variables: ["first_name", "training_name", "training_date", "questionnaire_link", "deadline_date"],
  },
  needs_survey_reminder: {
    name: "Rappel questionnaire besoins",
    timing: "before",
    subject: {
      tu: "Rappel : Prépare ta formation \"{{training_name}}\"",
      vous: "Rappel : Préparez votre formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de te relancer concernant le questionnaire de préparation pour la formation "{{training_name}}".

Ton retour m'est précieux pour adapter au mieux le contenu à tes besoins.

{{questionnaire_link}}

Merci d'avance pour ta participation !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de vous relancer concernant le questionnaire de préparation pour la formation "{{training_name}}".

Votre retour m'est précieux pour adapter au mieux le contenu à vos besoins.

{{questionnaire_link}}

Merci d'avance pour votre participation !`,
    },
    variables: ["first_name", "training_name", "questionnaire_link"],
  },
  // DURING TRAINING
  attendance_signature: {
    name: "Demande de signature d'émargement",
    timing: "during",
    subject: {
      tu: "Signature d'émargement - {{training_name}}",
      vous: "Signature d'émargement - {{training_name}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer ta feuille d'émargement pour la formation "{{training_name}}" du {{session_date}}.

{{signature_link}}

Cette signature atteste de ta présence à la formation.

Merci !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer votre feuille d'émargement pour la formation "{{training_name}}" du {{session_date}}.

{{signature_link}}

Cette signature atteste de votre présence à la formation.

Merci !`,
    },
    variables: ["first_name", "training_name", "session_date", "signature_link"],
  },
  // AFTER TRAINING (manual)
  thank_you: {
    name: "Email de remerciement",
    timing: "manual",
    subject: {
      tu: "Merci pour ta participation à la formation {{training_name}}",
      vous: "Merci pour votre participation à la formation {{training_name}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour ton énergie et ta participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que tu prennes quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Tu trouveras également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans tes présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment tu vas utiliser tout ce que nous avons vu ! N'hésite pas à me contacter si tu as des questions ou des besoins de compléments d'informations.

Je te souhaite une bonne journée`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Quelle belle journée de découverte visuelle nous avons partagé ! Merci pour votre énergie et votre participation pendant notre formation "{{training_name}}".

Pour finaliser cette formation, j'ai besoin que vous preniez quelques minutes pour compléter le questionnaire d'évaluation :
{{evaluation_link}}

{{#supports_url}}
Vous trouverez également tous les supports de la formation ici, pour continuer à pratiquer et intégrer ces techniques dans vos présentations :
{{supports_url}}
{{/supports_url}}

Je suis curieux de voir comment vous allez utiliser tout ce que nous avons vu ! N'hésitez pas à me contacter si vous avez des questions ou des besoins de compléments d'informations.

Je vous souhaite une bonne journée`,
    },
    variables: ["first_name", "training_name", "evaluation_link", "supports_url"],
  },
  google_review: {
    name: "Demande d'avis Google",
    timing: "after",
    delayKey: "delay_google_review_days",
    subject: {
      tu: "🌟 Ton avis sur la formation \"{{training_name}}\"",
      vous: "🌟 Votre avis sur la formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour {{first_name}},

J'espère que tout va bien pour toi !

Pour continuer d'améliorer nos formations et partager des retours d'expérience avec d'autres professionnels, ton avis serait précieux en tant que commanditaire de la formation. Pourrais-tu nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Clique ici pour laisser ton avis : {{google_review_link}}

Ton retour est essentiel pour nous permettre de progresser et d'aider d'autres organisations à découvrir nos formations.

Merci infiniment pour ton soutien et pour avoir participé à notre formation !

À bientôt,`,
      vous: `Bonjour {{first_name}},

J'espère que tout va bien pour vous !

Pour continuer d'améliorer nos formations et partager des retours d'expérience avec d'autres professionnels, votre avis serait précieux en tant que commanditaire de la formation. Pourriez-vous nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Cliquez ici pour laisser votre avis : {{google_review_link}}

Votre retour est essentiel pour nous permettre de progresser et d'aider d'autres organisations à découvrir nos formations.

Merci infiniment pour votre soutien et pour avoir participé à notre formation !

À bientôt,`,
    },
    variables: ["first_name", "training_name", "google_review_link"],
  },
  video_testimonial: {
    name: "Demande de témoignage vidéo",
    timing: "after",
    delayKey: "delay_video_testimonial_days",
    subject: {
      tu: "🎥 Partager ton expérience sur la formation \"{{training_name}}\"",
      vous: "🎥 Partager votre expérience sur la formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour {{first_name}},

Je me permets de te contacter pour te proposer de partager ton retour d'expérience sur la formation que nous avons organisée.

Ce témoignage pourrait être réalisé via une courte interview en visioconférence (10 minutes maximum) et serait précieux pour inspirer d'autres organisations et valoriser ton analyse.

Si tu es partant(e), il te suffit de cliquer sur le lien ci-dessous pour convenir d'un moment ensemble :

👉 Contacte-moi pour trouver un créneau : mailto:{{sender_email}}?subject=OK%20pour%20faire%20un%20t%C3%A9moignage%20Vid%C3%A9o&body=Salut%2C%0D%0A%0D%0AJe%20viens%20de%20recevoir%20ton%20mail%2C%20je%20suis%20partant%20pour%20faire%20un%20t%C3%A9moignage%20vid%C3%A9o%20%3A-)

Merci d'avance pour ton temps et ton retour ! Je reste à disposition pour toute question ou précision.

Bonne journée`,
      vous: `Bonjour {{first_name}},

Je me permets de vous contacter pour vous proposer de partager votre retour d'expérience sur la formation que nous avons organisée.

Ce témoignage pourrait être réalisé via une courte interview en visioconférence (10 minutes maximum) et serait précieux pour inspirer d'autres organisations et valoriser votre analyse.

Si vous êtes partant(e), il vous suffit de cliquer sur le lien ci-dessous pour convenir d'un moment ensemble :

👉 Contactez-moi pour trouver un créneau : mailto:{{sender_email}}?subject=OK%20pour%20faire%20un%20t%C3%A9moignage%20Vid%C3%A9o&body=Bonjour%2C%0D%0A%0D%0AJe%20viens%20de%20recevoir%20votre%20mail%2C%20je%20suis%20partant%20pour%20faire%20un%20t%C3%A9moignage%20vid%C3%A9o.

Merci d'avance pour votre temps et votre retour ! Je reste à disposition pour toute question ou précision.

Bonne journée`,
    },
    variables: ["first_name", "training_name"],
  },
  cold_evaluation: {
    name: "Évaluation à froid commanditaire",
    timing: "after",
    delayKey: "delay_cold_evaluation_days",
    subject: {
      tu: "💡 Évaluation à froid de la formation \"{{training_name}}\" 💡",
      vous: "💡 Évaluation à froid de la formation \"{{training_name}}\" 💡",
    },
    content: {
      tu: `Bonjour {{first_name}},

Comment vas-tu ?

Dans le cadre de mon processus qualité (Qualiopi), je propose désormais des évaluations à froid de mes formations.

Pourrais-tu prendre 2 minutes pour remplir ce questionnaire en ligne ?

👉 Remplir le questionnaire : https://forms.gle/Hm4TvAVUSvzuWeBJ6

Merci énormément pour ton soutien :-)

À bientôt

PS : on peut continuer à rester en contact sur LinkedIn (https://www.linkedin.com/in/romaincouturier/) et sur Instagram (https://www.instagram.com/supertilt.ledeclic/) pour d'autres contenus sur le sujet de la formation.`,
      vous: `Bonjour {{first_name}},

Comment allez-vous ?

Dans le cadre de mon processus qualité (Qualiopi), je propose désormais des évaluations à froid de mes formations.

Pourriez-vous prendre 2 minutes pour remplir ce questionnaire en ligne ?

👉 Remplir le questionnaire : https://forms.gle/Hm4TvAVUSvzuWeBJ6

Merci infiniment pour votre soutien.

À bientôt,

PS : nous pouvons continuer à rester en contact sur LinkedIn (https://www.linkedin.com/in/romaincouturier/) et sur Instagram (https://www.instagram.com/supertilt.ledeclic/) pour d'autres contenus sur le sujet de la formation.`,
    },
    variables: ["first_name", "training_name"],
  },
  evaluation_reminder_1: {
    name: "Relance évaluation - 1ère",
    timing: "after",
    delayKey: "delay_evaluation_reminder_1_days",
    subject: {
      tu: "📝 Petit rappel : ton avis compte pour \"{{training_name}}\"",
      vous: "📝 Petit rappel : votre avis compte pour \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

J'espère que tu vas bien et que tu as pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "{{training_name}}" !

Je me permets de te relancer car je n'ai pas encore reçu ton évaluation. Ton retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
{{evaluation_link}}

Un grand merci d'avance pour ta contribution !

Belle journée à toi`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

J'espère que vous allez bien et que vous avez pu commencer à mettre en pratique ce que nous avons vu ensemble lors de la formation "{{training_name}}" !

Je me permets de vous relancer car je n'ai pas encore reçu votre évaluation. Votre retour est vraiment précieux pour moi : il m'aide à améliorer continuellement mes formations et à mieux répondre aux attentes des futurs participants.

Cela ne prend que 2-3 minutes :
{{evaluation_link}}

Un grand merci d'avance pour votre contribution !

Belle journée à vous`,
    },
    variables: ["first_name", "training_name", "evaluation_link"],
  },
  evaluation_reminder_2: {
    name: "Relance évaluation - 2ème",
    timing: "after",
    delayKey: "delay_evaluation_reminder_2_days",
    subject: {
      tu: "🙏 Dernière relance : ta contribution pour \"{{training_name}}\"",
      vous: "🙏 Dernière relance : votre contribution pour \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je reviens vers toi une dernière fois concernant l'évaluation de la formation "{{training_name}}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Ton avis, même bref, a un vrai impact !

Si tu as 2 minutes, voici le lien :
{{evaluation_link}}

Je te remercie sincèrement pour ton aide et te souhaite une excellente continuation dans tes projets !

À bientôt`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je reviens vers vous une dernière fois concernant l'évaluation de la formation "{{training_name}}".

En tant qu'organisme certifié Qualiopi, la collecte de ces retours est essentielle pour maintenir notre certification et garantir la qualité de nos formations. Votre avis, même bref, a un vrai impact !

Si vous avez 2 minutes, voici le lien :
{{evaluation_link}}

Je vous remercie sincèrement pour votre aide et vous souhaite une excellente continuation dans vos projets !

À bientôt`,
    },
    variables: ["first_name", "training_name", "evaluation_link"],
  },
  funder_reminder: {
    name: "Évaluation à froid financeur",
    timing: "after",
    delayKey: "delay_funder_reminder_days",
    subject: {
      tu: "📋 Prendre contact avec {{financeur_name}} pour formation \"{{training_name}}\"",
      vous: "📋 Prendre contact avec {{financeur_name}} pour formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour,

Il faut que tu prennes contact avec {{financeur_name}}, à cette adresse : {{financeur_url}}

Voici le message type à envoyer :

---

Bonjour,

Comment allez-vous ?

Dans le cadre de mon processus qualité (Qualiopi), je propose désormais des évaluations à froid de mes formations pour les financeurs.

Pouvez-vous prendre 2 minutes pour remplir ce questionnaire en ligne sur la formation "{{training_name}}" ?

👉 Remplir le questionnaire : https://forms.gle/Hm4TvAVUSvzuWeBJ6

Merci énormément pour votre soutien :-)

À bientôt

PS : on peut continuer à rester en contact sur LinkedIn (https://www.linkedin.com/in/romaincouturier/) et sur Instagram (https://www.instagram.com/supertilt.ledeclic/) pour d'autres contenus sur le sujet de la formation.`,
      vous: `Bonjour,

Il faut prendre contact avec {{financeur_name}}, à cette adresse : {{financeur_url}}

Voici le message type à envoyer :

---

Bonjour,

Comment allez-vous ?

Dans le cadre de mon processus qualité (Qualiopi), je propose désormais des évaluations à froid de mes formations pour les financeurs.

Pouvez-vous prendre 2 minutes pour remplir ce questionnaire en ligne sur la formation "{{training_name}}" ?

👉 Remplir le questionnaire : https://forms.gle/Hm4TvAVUSvzuWeBJ6

Merci énormément pour votre soutien.

À bientôt,

PS : on peut continuer à rester en contact sur LinkedIn (https://www.linkedin.com/in/romaincouturier/) et sur Instagram (https://www.instagram.com/supertilt.ledeclic/) pour d'autres contenus sur le sujet de la formation.`,
    },
    variables: ["financeur_name", "financeur_url", "training_name"],
  },
  training_documents: {
    name: "Envoi des documents de formation",
    timing: "manual",
    subject: {
      tu: "Documents de la formation \"{{training_name}}\"",
      vous: "Documents de la formation \"{{training_name}}\"",
    },
    content: {
      tu: `{{greeting}},

Voici les documents relatifs à la formation "{{training_name}}" qui s'est déroulée {{training_dates}}.

{{#has_invoice}}
- La facture
{{/has_invoice}}
{{#has_sheets}}
- Les feuilles d'émargement signées
{{/has_sheets}}

N'hésite pas à me contacter si tu as des questions.

Bonne réception.`,
      vous: `{{greeting}},

Veuillez trouver ci-joint les documents relatifs à la formation "{{training_name}}" qui s'est déroulée {{training_dates}}.

{{#has_invoice}}
- La facture
{{/has_invoice}}
{{#has_sheets}}
- Les feuilles d'émargement signées
{{/has_sheets}}

N'hésitez pas à me contacter si vous avez des questions.

Bonne réception.`,
    },
    variables: ["greeting", "training_name", "training_dates", "has_invoice", "has_sheets"],
  },
  micro_devis: {
    name: "Envoi de micro-devis",
    timing: "manual",
    subject: {
      tu: "Votre devis pour la formation \"{{formation_name}}\"",
      vous: "Votre devis pour la formation \"{{formation_name}}\"",
    },
    content: {
      tu: `Bonjour {{recipient_name}},

Merci pour votre demande concernant la formation "{{formation_name}}".

Vous trouverez en pièces jointes :

{{devis_description}}

{{#programme_link}}
Le programme de la formation est disponible en consultation et téléchargement ici : {{programme_link}}
{{/programme_link}}

N'hésitez pas à revenir vers nous si vous avez la moindre question. Nous sommes à votre disposition pour vous accompagner dans votre projet de formation.

À très bientôt,`,
      vous: `Bonjour {{recipient_name}},

Merci pour votre demande concernant la formation "{{formation_name}}".

Vous trouverez en pièces jointes :

{{devis_description}}

{{#programme_link}}
Le programme de la formation est disponible en consultation et téléchargement ici : {{programme_link}}
{{/programme_link}}

N'hésitez pas à revenir vers nous si vous avez la moindre question. Nous sommes à votre disposition pour vous accompagner dans votre projet de formation.

À très bientôt,`,
    },
    variables: ["recipient_name", "formation_name", "devis_description", "programme_link"],
  },
  convention: {
    name: "Envoi de convention de formation",
    timing: "manual",
    subject: {
      tu: "Convention de formation - {{training_name}}",
      vous: "Convention de formation - {{training_name}}",
    },
    content: {
      tu: `Bonjour {{first_name}},

Merci pour ta confiance !

Tu trouveras ci-joint la convention de formation pour <strong>{{training_name}}</strong> qui se déroulera du <strong>{{start_date}}</strong> au <strong>{{end_date}}</strong>.

{{#signature_link}}
<p style="margin: 20px 0;"><a href="{{signature_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">✍️ Signer la convention en ligne</a></p>

Tu peux aussi la retourner signée par email à {{sender_email}}
{{/signature_link}}

Je reste disponible si tu as la moindre question.

À très bientôt,`,
      vous: `Bonjour {{first_name}},

Merci pour votre confiance.

Vous trouverez ci-joint la convention de formation pour <strong>{{training_name}}</strong> qui se déroulera du <strong>{{start_date}}</strong> au <strong>{{end_date}}</strong>.

{{#signature_link}}
<p style="margin: 20px 0;"><a href="{{signature_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">✍️ Signer la convention en ligne</a></p>

Vous pouvez également la retourner signée par email à {{sender_email}}
{{/signature_link}}

Je reste à votre disposition pour toute question.

Cordialement,`,
    },
    variables: ["first_name", "training_name", "start_date", "end_date", "signature_link"],
  },
  elearning_access: {
    name: "Email d'accès e-learning",
    timing: "manual",
    subject: {
      tu: "Accès à ta formation e-learning \"{{training_name}}\"",
      vous: "Accès à votre formation e-learning \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu es inscrit(e) à la formation e-learning "<strong>{{training_name}}</strong>".

Tu peux accéder à la formation en ligne à l'adresse suivante :
<p style="margin: 20px 0;"><a href="{{access_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">🎓 Accéder à la formation</a></p>

La formation est accessible du <strong>{{start_date}}</strong> au <strong>{{end_date}}</strong>.

Si tu as la moindre question, n'hésite pas à me contacter.

Bonne formation !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Vous êtes inscrit(e) à la formation e-learning "<strong>{{training_name}}</strong>".

Vous pouvez accéder à la formation en ligne à l'adresse suivante :
<p style="margin: 20px 0;"><a href="{{access_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">🎓 Accéder à la formation</a></p>

La formation est accessible du <strong>{{start_date}}</strong> au <strong>{{end_date}}</strong>.

Si vous avez la moindre question, n'hésitez pas à me contacter.

Bonne formation !`,
    },
    variables: ["first_name", "training_name", "access_link", "start_date", "end_date"],
  },
  convention_reminder: {
    name: "Relance convention de formation",
    timing: "before",
    delayKey: "delay_convention_reminder_1_days",
    subject: {
      tu: "Rappel : convention de formation \"{{training_name}}\"",
      vous: "Rappel : convention de formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de te relancer au sujet de la convention de formation pour "{{training_name}}" prévue le {{training_date}}.

Peux-tu nous retourner la convention signée dès que possible afin que nous puissions finaliser l'inscription ?

{{#signature_link}}
<p style="margin: 20px 0;"><a href="{{signature_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">✍️ Signer la convention en ligne</a></p>
{{/signature_link}}

N'hésite pas si tu as des questions !

À bientôt,`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je me permets de vous relancer au sujet de la convention de formation pour "{{training_name}}" prévue le {{training_date}}.

Pourriez-vous nous retourner la convention signée dès que possible afin que nous puissions finaliser l'inscription ?

{{#signature_link}}
<p style="margin: 20px 0;"><a href="{{signature_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">✍️ Signer la convention en ligne</a></p>
{{/signature_link}}

Je reste à votre disposition pour toute question.

Cordialement,`,
    },
    variables: ["first_name", "training_name", "training_date", "signature_link"],
  },
};
const Parametres = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [improving, setImproving] = useState<string | null>(null);
  const [templates, setTemplates] = useState<Record<string, Record<AddressMode, EmailTemplate | null>>>({});
  const [editedTemplates, setEditedTemplates] = useState<Record<string, Record<AddressMode, { subject: string; content: string }>>>({});
  const [activeMode, setActiveMode] = useState<Record<string, AddressMode>>({});
  
  // General settings
  const [senderEmail, setSenderEmail] = useState("");
  const [senderName, setSenderName] = useState("");
  const [evaluationNotificationEmail, setEvaluationNotificationEmail] = useState("");
  const [bccEnabled, setBccEnabled] = useState(true);
  const [bccEmail, setBccEmail] = useState("");
  const [googleMyBusinessUrl, setGoogleMyBusinessUrl] = useState("https://g.page/r/CWJ0W_P6C-BJEAE/review");
  const [supertiltSiteUrl, setSupertiltSiteUrl] = useState("https://supertilt.fr");
  const [websiteUrl, setWebsiteUrl] = useState("https://www.supertilt.fr");
  const [youtubeUrl, setYoutubeUrl] = useState("https://www.youtube.com/@supertilt");
  const [blogUrl, setBlogUrl] = useState("https://supertilt.fr/blog/");
  const [newsletterToolUrl, setNewsletterToolUrl] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [tvaRate, setTvaRate] = useState("20");
  
  // Working days configuration (Monday to Friday by default)
  const [workingDays, setWorkingDays] = useState<boolean[]>([false, true, true, true, true, true, false]); // Sun, Mon, Tue, Wed, Thu, Fri, Sat
  
  // Email scheduling delays
  const [delayNeedsSurvey, setDelayNeedsSurvey] = useState("7");
  const [delayReminder, setDelayReminder] = useState("7");
  const [delayTrainerSummary, setDelayTrainerSummary] = useState("1");
  
  const [delayGoogleReview, setDelayGoogleReview] = useState("1");
  const [delayVideoTestimonial, setDelayVideoTestimonial] = useState("3");
  const [delayColdEvaluation, setDelayColdEvaluation] = useState("10");
  const [delayColdEvaluationFunder, setDelayColdEvaluationFunder] = useState("15");
  const [delayEvaluationReminder1, setDelayEvaluationReminder1] = useState("2");
  const [delayEvaluationReminder2, setDelayEvaluationReminder2] = useState("5");
  const [delayConventionReminder1, setDelayConventionReminder1] = useState("3");
  const [delayConventionReminder2, setDelayConventionReminder2] = useState("7");

  // Permissions
  const [canDeleteEvaluationsEmails, setCanDeleteEvaluationsEmails] = useState("");

  // Règlement intérieur
  const [reglementInterieurUrl, setReglementInterieurUrl] = useState<string | null>(null);
  const [uploadingReglement, setUploadingReglement] = useState(false);


  // Module access check (isAdmin comes from profiles table)
  const { hasAccess, isAdmin, loading: accessLoading } = useModuleAccess();
  
  const navigate = useNavigate();
  const { toast } = useToast();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      await Promise.all([fetchTemplates(), fetchSettings()]);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

    return () => subscription.unsubscribe();
  }, [navigate]);

  const fetchSettings = async () => {
    const { data, error } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [
        "sender_email", "sender_name", "evaluation_notification_email",
        "bcc_email", "bcc_enabled", "working_days", "google_my_business_url", "supertilt_site_url", "newsletter_tool_url",
        "website_url", "youtube_url", "blog_url",
        "tva_rate",
        "delay_needs_survey_days", "delay_reminder_days", "delay_trainer_summary_days",
        "delay_google_review_days", "delay_video_testimonial_days",
        "delay_cold_evaluation_days", "delay_cold_evaluation_funder_days",
        "delay_evaluation_reminder_1_days", "delay_evaluation_reminder_2_days",
        "delay_convention_reminder_1_days", "delay_convention_reminder_2_days",
        "can_delete_evaluations_emails",
        "reglement_interieur_url"
      ]);
    
    if (error) {
      console.error("Error fetching settings:", error);
      return;
    }
    
    data?.forEach((setting) => {
      switch (setting.setting_key) {
        case "sender_email":
          setSenderEmail(setting.setting_value || "");
          break;
        case "sender_name":
          setSenderName(setting.setting_value || "");
          break;
        case "evaluation_notification_email":
          setEvaluationNotificationEmail(setting.setting_value || "");
          break;
        case "bcc_email":
          setBccEmail(setting.setting_value || "");
          break;
        case "bcc_enabled":
          setBccEnabled(setting.setting_value === "true");
          break;
        case "google_my_business_url":
          setGoogleMyBusinessUrl(setting.setting_value || "https://g.page/r/CWJ0W_P6C-BJEAE/review");
          break;
        case "supertilt_site_url":
          setSupertiltSiteUrl(setting.setting_value || "https://supertilt.fr");
          break;
        case "newsletter_tool_url":
          setNewsletterToolUrl(setting.setting_value || "");
          break;
        case "website_url":
          setWebsiteUrl(setting.setting_value || "https://www.supertilt.fr");
          break;
        case "youtube_url":
          setYoutubeUrl(setting.setting_value || "https://www.youtube.com/@supertilt");
          break;
        case "blog_url":
          setBlogUrl(setting.setting_value || "https://supertilt.fr/blog/");
          break;
        case "tva_rate":
          setTvaRate(setting.setting_value || "20");
          break;
        case "working_days":
          try {
            const days = JSON.parse(setting.setting_value || "[false,true,true,true,true,true,false]");
            if (Array.isArray(days) && days.length === 7) {
              setWorkingDays(days);
            }
          } catch {
            // Keep default
          }
          break;
        case "delay_needs_survey_days":
          setDelayNeedsSurvey(setting.setting_value || "7");
          break;
        case "delay_reminder_days":
          setDelayReminder(setting.setting_value || "7");
          break;
        case "delay_trainer_summary_days":
          setDelayTrainerSummary(setting.setting_value || "1");
          break;
        case "delay_google_review_days":
          setDelayGoogleReview(setting.setting_value || "1");
          break;
        case "delay_video_testimonial_days":
          setDelayVideoTestimonial(setting.setting_value || "3");
          break;
        case "delay_cold_evaluation_days":
          setDelayColdEvaluation(setting.setting_value || "10");
          break;
        case "delay_cold_evaluation_funder_days":
          setDelayColdEvaluationFunder(setting.setting_value || "15");
          break;
        case "delay_evaluation_reminder_1_days":
          setDelayEvaluationReminder1(setting.setting_value || "2");
          break;
        case "delay_evaluation_reminder_2_days":
          setDelayEvaluationReminder2(setting.setting_value || "5");
          break;
        case "delay_convention_reminder_1_days":
          setDelayConventionReminder1(setting.setting_value || "3");
          break;
        case "delay_convention_reminder_2_days":
          setDelayConventionReminder2(setting.setting_value || "7");
          break;
        case "can_delete_evaluations_emails":
          setCanDeleteEvaluationsEmails(setting.setting_value || "");
          break;
        case "reglement_interieur_url":
          setReglementInterieurUrl(setting.setting_value || null);
          break;
      }
    });
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      const settingsToSave = [
        { setting_key: "sender_email", setting_value: senderEmail, description: "Adresse email de l'expéditeur pour tous les envois" },
        { setting_key: "sender_name", setting_value: senderName, description: "Nom de l'expéditeur pour tous les envois" },
        { setting_key: "evaluation_notification_email", setting_value: evaluationNotificationEmail, description: "Email qui reçoit les notifications de nouvelles évaluations" },
        { setting_key: "bcc_email", setting_value: bccEmail, description: "Adresse email en copie cachée (BCC) pour tous les envois" },
        { setting_key: "bcc_enabled", setting_value: bccEnabled.toString(), description: "Activer ou désactiver l'envoi en copie cachée (BCC)" },
        { setting_key: "google_my_business_url", setting_value: googleMyBusinessUrl, description: "URL de la fiche Google My Business pour les demandes d'avis" },
        { setting_key: "supertilt_site_url", setting_value: supertiltSiteUrl, description: "URL du site SuperTilt pour les liens formations" },
        { setting_key: "newsletter_tool_url", setting_value: newsletterToolUrl, description: "URL de l'outil de newsletter (ex: Brevo, Mailchimp)" },
        { setting_key: "website_url", setting_value: websiteUrl, description: "URL du site web principal" },
        { setting_key: "youtube_url", setting_value: youtubeUrl, description: "URL de la chaîne YouTube" },
        { setting_key: "blog_url", setting_value: blogUrl, description: "URL du blog" },
        { setting_key: "tva_rate", setting_value: tvaRate, description: "Taux de TVA par défaut en pourcentage (ex: 20 pour 20%)" },
        { setting_key: "working_days", setting_value: JSON.stringify(workingDays), description: "Jours ouvrables pour l'envoi des emails (tableau de 7 booléens : dim, lun, mar, mer, jeu, ven, sam)" },
        { setting_key: "delay_needs_survey_days", setting_value: delayNeedsSurvey, description: "Délai avant formation pour envoyer le questionnaire de besoins (en jours)" },
        { setting_key: "delay_reminder_days", setting_value: delayReminder, description: "Délai avant formation pour envoyer le rappel logistique (en jours)" },
        { setting_key: "delay_trainer_summary_days", setting_value: delayTrainerSummary, description: "Délai avant formation pour envoyer la synthèse au formateur (en jours)" },
        
        { setting_key: "delay_google_review_days", setting_value: delayGoogleReview, description: "Délai après formation pour demander un avis Google (en jours ouvrables)" },
        { setting_key: "delay_video_testimonial_days", setting_value: delayVideoTestimonial, description: "Délai après formation pour demander un témoignage vidéo (en jours ouvrables)" },
        { setting_key: "delay_cold_evaluation_days", setting_value: delayColdEvaluation, description: "Délai après formation pour envoyer l'évaluation à froid (en jours ouvrables)" },
        { setting_key: "delay_cold_evaluation_funder_days", setting_value: delayColdEvaluationFunder, description: "Délai après formation pour rappeler de contacter le financeur (en jours ouvrables)" },
        { setting_key: "delay_evaluation_reminder_1_days", setting_value: delayEvaluationReminder1, description: "Délai pour la 1ère relance d'évaluation (en jours ouvrables après le mail de remerciement)" },
        { setting_key: "delay_evaluation_reminder_2_days", setting_value: delayEvaluationReminder2, description: "Délai pour la 2ème relance d'évaluation (en jours ouvrables après le mail de remerciement)" },
        { setting_key: "delay_convention_reminder_1_days", setting_value: delayConventionReminder1, description: "Délai en jours ouvrés pour la 1ère relance convention de formation" },
        { setting_key: "delay_convention_reminder_2_days", setting_value: delayConventionReminder2, description: "Délai en jours ouvrés pour la 2ème relance convention de formation" },
        { setting_key: "can_delete_evaluations_emails", setting_value: canDeleteEvaluationsEmails, description: "Emails des utilisateurs autorisés à supprimer des évaluations (séparés par des virgules)" },
        { setting_key: "reglement_interieur_url", setting_value: reglementInterieurUrl || "", description: "URL du règlement intérieur des formations (PDF uploadé)" },
      ];

      for (const setting of settingsToSave) {
        await supabase
          .from("app_settings")
          .upsert(setting, { onConflict: "setting_key" });
      }

      toast({
        title: "Paramètres enregistrés",
        description: "Les paramètres généraux ont été mis à jour.",
      });
    } catch (error) {
      console.error("Save settings error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer les paramètres.",
        variant: "destructive",
      });
    } finally {
      setSavingSettings(false);
    }
  };

  const fetchTemplates = async () => {
    const { data, error } = await supabase
      .from("email_templates")
      .select("*");

    if (error) {
      console.error("Error fetching templates:", error);
      return;
    }

    const templatesMap: Record<string, Record<AddressMode, EmailTemplate | null>> = {};
    const editedMap: Record<string, Record<AddressMode, { subject: string; content: string }>> = {};
    const modeMap: Record<string, AddressMode> = {};
    
    // Group templates by base type and mode
    data?.forEach((t) => {
      const isVous = t.template_type.endsWith("_vous");
      const isTu = t.template_type.endsWith("_tu");
      const mode: AddressMode = isVous ? "vous" : isTu ? "tu" : "vous";
      const baseType = isVous ? t.template_type.replace("_vous", "") : isTu ? t.template_type.replace("_tu", "") : t.template_type;
      
      if (!templatesMap[baseType]) {
        templatesMap[baseType] = { tu: null, vous: null };
      }
      if (!editedMap[baseType]) {
        editedMap[baseType] = {
          tu: { subject: "", content: "" },
          vous: { subject: "", content: "" },
        };
      }
      
      templatesMap[baseType][mode] = t;
      editedMap[baseType][mode] = { subject: t.subject, content: t.html_content };
    });

    // Initialize with defaults for any missing templates
    Object.keys(DEFAULT_TEMPLATES).forEach((type) => {
      if (!templatesMap[type]) {
        templatesMap[type] = { tu: null, vous: null };
      }
      if (!editedMap[type]) {
        editedMap[type] = {
          tu: { subject: DEFAULT_TEMPLATES[type].subject.tu, content: DEFAULT_TEMPLATES[type].content.tu },
          vous: { subject: DEFAULT_TEMPLATES[type].subject.vous, content: DEFAULT_TEMPLATES[type].content.vous },
        };
      } else {
        // Fill in missing modes with defaults
        if (!editedMap[type].tu.subject) {
          editedMap[type].tu = { subject: DEFAULT_TEMPLATES[type].subject.tu, content: DEFAULT_TEMPLATES[type].content.tu };
        }
        if (!editedMap[type].vous.subject) {
          editedMap[type].vous = { subject: DEFAULT_TEMPLATES[type].subject.vous, content: DEFAULT_TEMPLATES[type].content.vous };
        }
      }
      modeMap[type] = "vous"; // Default to vous
    });

    setTemplates(templatesMap);
    setEditedTemplates(editedMap);
    setActiveMode(modeMap);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  const handleSaveTemplate = async (templateType: string, mode: AddressMode) => {
    const saveKey = `${templateType}_${mode}`;
    setSaving(saveKey);
    
    try {
      const edited = editedTemplates[templateType]?.[mode];
      const existing = templates[templateType]?.[mode];
      const templateTypeWithMode = `${templateType}_${mode}`;

      if (existing) {
        // Update existing
        const { error } = await supabase
          .from("email_templates")
          .update({
            subject: edited.subject,
            html_content: edited.content,
            updated_at: new Date().toISOString(),
          })
          .eq("id", existing.id);

        if (error) throw error;
      } else {
        // Create new
        const { data, error } = await supabase
          .from("email_templates")
          .insert({
            template_type: templateTypeWithMode,
            template_name: `${DEFAULT_TEMPLATES[templateType].name} (${mode === "tu" ? "tutoiement" : "vouvoiement"})`,
            subject: edited.subject,
            html_content: edited.content,
            is_default: false,
          })
          .select()
          .single();

        if (error) throw error;
        
        setTemplates((prev) => ({
          ...prev,
          [templateType]: {
            ...prev[templateType],
            [mode]: data,
          },
        }));
      }

      toast({
        title: "Template enregistré",
        description: `Le modèle d'email (${mode === "tu" ? "tutoiement" : "vouvoiement"}) a été mis à jour avec succès.`,
      });
    } catch (error: any) {
      console.error("Save error:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'enregistrer le template.",
        variant: "destructive",
      });
    } finally {
      setSaving(null);
    }
  };

  const handleResetTemplate = (templateType: string, mode: AddressMode) => {
    const defaultTemplate = DEFAULT_TEMPLATES[templateType];
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [mode]: {
          subject: defaultTemplate.subject[mode],
          content: defaultTemplate.content[mode],
        },
      },
    }));
    
    toast({
      title: "Template réinitialisé",
      description: "Les valeurs par défaut ont été restaurées. N'oubliez pas d'enregistrer.",
    });
  };

  const updateTemplate = (templateType: string, mode: AddressMode, field: "subject" | "content", value: string) => {
    setEditedTemplates((prev) => ({
      ...prev,
      [templateType]: {
        ...prev[templateType],
        [mode]: {
          ...prev[templateType]?.[mode],
          [field]: value,
        },
      },
    }));
  };

  const handleImproveWithAI = async (templateType: string, mode: AddressMode) => {
    const improveKey = `${templateType}_${mode}`;
    setImproving(improveKey);
    
    try {
      const edited = editedTemplates[templateType]?.[mode];
      const templateName = DEFAULT_TEMPLATES[templateType].name;

      const { data, error } = await supabase.functions.invoke("improve-email-content", {
        body: {
          subject: edited.subject,
          content: edited.content,
          templateType,
          templateName,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      setEditedTemplates((prev) => ({
        ...prev,
        [templateType]: {
          ...prev[templateType],
          [mode]: {
            subject: data.subject,
            content: data.content,
          },
        },
      }));

      toast({
        title: "Contenu amélioré",
        description: "L'IA a proposé des améliorations. Vérifiez et enregistrez si satisfait.",
      });
    } catch (error: any) {
      console.error("AI improvement error:", error);
      toast({
        title: "Erreur",
        description: error.message || "Impossible d'améliorer le contenu avec l'IA.",
        variant: "destructive",
      });
    } finally {
      setImproving(null);
    }
  };

  const renderTemplateEditor = (type: string, defaultTemplate: TemplateConfig, currentMode: AddressMode, saveKey: string) => (
    <>
      {/* Tu/Vous tabs */}
      <div className="flex items-center gap-2 mb-4">
        <span className="text-sm text-muted-foreground">Version :</span>
        <Tabs
          value={currentMode}
          onValueChange={(v) => setActiveMode((prev) => ({ ...prev, [type]: v as AddressMode }))}
        >
          <TabsList className="h-8">
            <TabsTrigger value="tu" className="text-xs px-3 h-7">
              Tutoiement
            </TabsTrigger>
            <TabsTrigger value="vous" className="text-xs px-3 h-7">
              Vouvoiement
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* Subject */}
      <div className="space-y-2">
        <Label>Objet de l'email</Label>
        <Input
          value={editedTemplates[type]?.[currentMode]?.subject || ""}
          onChange={(e) => updateTemplate(type, currentMode, "subject", e.target.value)}
          placeholder="Objet du mail..."
        />
      </div>

      {/* Content */}
      <div className="space-y-2">
        <Label>Contenu de l'email</Label>
        <Textarea
          value={editedTemplates[type]?.[currentMode]?.content || ""}
          onChange={(e) => updateTemplate(type, currentMode, "content", e.target.value)}
          placeholder="Contenu du mail..."
          className="min-h-[200px] font-mono text-sm"
        />
      </div>

      {/* Variables */}
      <div className="space-y-2">
        <Label className="text-muted-foreground">Variables disponibles</Label>
        <div className="flex flex-wrap gap-2">
          {defaultTemplate.variables.map((variable) => (
            <code
              key={variable}
              className="px-2 py-1 bg-muted rounded text-xs"
            >
              {`{{${variable}}}`}
            </code>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-2 pt-2">
        <Button
          onClick={() => handleSaveTemplate(type, currentMode)}
          disabled={saving === saveKey || improving === saveKey}
        >
          {saving === saveKey ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 mr-2" />
          )}
          Enregistrer
        </Button>
        <Button
          variant="secondary"
          onClick={() => handleImproveWithAI(type, currentMode)}
          disabled={improving === saveKey || saving === saveKey}
        >
          {improving === saveKey ? (
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
          ) : (
            <Sparkles className="h-4 w-4 mr-2" />
          )}
          Améliorer avec l'IA
        </Button>
        <Button
          variant="outline"
          onClick={() => handleResetTemplate(type, currentMode)}
          disabled={saving === saveKey || improving === saveKey}
        >
          <RotateCcw className="h-4 w-4 mr-2" />
          Réinitialiser
        </Button>
      </div>
    </>
  );

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  // Check access to parametres module (admins always have access)
  if (!isAdmin && !hasAccess("parametres")) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader />
        <main className="max-w-6xl mx-auto p-6">
          <div className="flex items-center gap-4 mb-6">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Settings className="h-6 w-6 text-primary" />
              </div>
              <h1 className="text-2xl font-bold">Paramètres</h1>
            </div>
          </div>
          <Card>
            <CardContent className="py-10 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-xl font-semibold mb-2">Accès refusé</h2>
              <p className="text-muted-foreground">
                Vous n'avez pas les droits pour accéder aux paramètres généraux.
              </p>
              <Button className="mt-6" onClick={() => navigate("/")}>
                Retour au tableau de bord
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader />

      {/* Main content */}
      <main className="max-w-6xl mx-auto p-6">
        {/* Back button and title */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate("/")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10">
              <Settings className="h-6 w-6 text-primary" />
            </div>
            <h1 className="text-2xl font-bold">Paramètres</h1>
          </div>
        </div>

        <Tabs defaultValue="general" className="space-y-6">
          <TabsList className="flex flex-wrap h-auto gap-1">
            <TabsTrigger value="general" className="flex items-center gap-2">
              <Cog className="h-4 w-4" />
              Général
            </TabsTrigger>
            <TabsTrigger value="trainers" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Formateurs
            </TabsTrigger>
            <TabsTrigger value="crm" className="flex items-center gap-2">
              <Tag className="h-4 w-4" />
              CRM
            </TabsTrigger>
            <TabsTrigger value="emails" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Modèles d'emails
            </TabsTrigger>
            {isAdmin && (
              <TabsTrigger value="access" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                Accès utilisateurs
              </TabsTrigger>
            )}
            {isAdmin && (
              <TabsTrigger value="integrations" className="flex items-center gap-2">
                <Key className="h-4 w-4" />
                Intégrations
              </TabsTrigger>
            )}
            <TabsTrigger value="arena" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4" />
              AI Arena
            </TabsTrigger>
          </TabsList>

          <TabsContent value="general">
            <Card>
              <CardHeader>
                <CardTitle>Paramètres généraux</CardTitle>
                <CardDescription>
                  Configuration globale de l'application.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-8">
                {/* Sender Identity */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Identité de l'expéditeur</h3>
                  <p className="text-sm text-muted-foreground">
                    Nom et email utilisés comme expéditeur pour tous les emails envoyés par l'application.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-lg">
                    <div className="space-y-2">
                      <Label htmlFor="sender-name">Nom de l'expéditeur</Label>
                      <Input
                        id="sender-name"
                        value={senderName}
                        onChange={(e) => setSenderName(e.target.value)}
                        placeholder="Romain Couturier"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="sender-email">Email de l'expéditeur</Label>
                      <Input
                        id="sender-email"
                        type="email"
                        value={senderEmail}
                        onChange={(e) => setSenderEmail(e.target.value)}
                        placeholder="romain@supertilt.fr"
                      />
                    </div>
                  </div>
                  <div className="space-y-2 max-w-lg">
                    <Label htmlFor="evaluation-notification-email">Email de notification des évaluations</Label>
                    <Input
                      id="evaluation-notification-email"
                      type="email"
                      value={evaluationNotificationEmail}
                      onChange={(e) => setEvaluationNotificationEmail(e.target.value)}
                      placeholder="email@exemple.com"
                    />
                    <p className="text-xs text-muted-foreground">
                      Reçoit un email à chaque soumission d'évaluation par un participant (avis, consentement publication).
                    </p>
                  </div>
                </div>

                <Separator />

                {/* BCC Settings */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Copie cachée des emails</h3>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="bcc-toggle" className="text-base">Activer le BCC</Label>
                      <p className="text-sm text-muted-foreground">
                        Ajouter automatiquement un destinataire en copie cachée sur tous les emails envoyés.
                      </p>
                    </div>
                    <Switch
                      id="bcc-toggle"
                      checked={bccEnabled}
                      onCheckedChange={setBccEnabled}
                    />
                  </div>
                  
                  {bccEnabled && (
                    <div className="space-y-2 pl-0 pt-2">
                      <Label htmlFor="bcc-email">Adresse email BCC</Label>
                      <Input
                        id="bcc-email"
                        type="email"
                        value={bccEmail}
                        onChange={(e) => setBccEmail(e.target.value)}
                        placeholder="email@exemple.com"
                        className="max-w-md"
                      />
                    </div>
                  )}
                </div>

                <Separator />

                {/* Google My Business URL */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Fiche Google My Business</h3>
                  <p className="text-sm text-muted-foreground">
                    URL de votre fiche Google pour les demandes d'avis. Cette URL sera utilisée dans les emails de demande d'avis Google.
                  </p>
                  
                  <div className="space-y-2">
                    <Label htmlFor="google-my-business-url">URL de la fiche Google</Label>
                    <div className="flex gap-2 max-w-lg">
                      <Input
                        id="google-my-business-url"
                        type="url"
                        value={googleMyBusinessUrl}
                        onChange={(e) => setGoogleMyBusinessUrl(e.target.value)}
                        placeholder="https://g.page/r/XXXXXXXXX/review"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => googleMyBusinessUrl && window.open(googleMyBusinessUrl, "_blank")}
                        disabled={!googleMyBusinessUrl}
                        title="Ouvrir le lien"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Utilisez la variable <code className="px-1 bg-muted rounded">{`{{google_review_link}}`}</code> dans vos templates d'emails.
                    </p>
                  </div>
                </div>

                <Separator />

                {/* SuperTilt Site URL */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Site SuperTilt</h3>
                  <p className="text-sm text-muted-foreground">
                    URL du site SuperTilt. Ce lien sera accessible depuis les formulaires de création/édition de formation.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="supertilt-site-url">URL du site</Label>
                    <div className="flex gap-2 max-w-lg">
                      <Input
                        id="supertilt-site-url"
                        type="url"
                        value={supertiltSiteUrl}
                        onChange={(e) => setSupertiltSiteUrl(e.target.value)}
                        placeholder="https://supertilt.fr"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => supertiltSiteUrl && window.open(supertiltSiteUrl, "_blank")}
                        disabled={!supertiltSiteUrl}
                        title="Ouvrir le site"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Website, YouTube, Blog URLs */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Liens publics</h3>
                  <p className="text-sm text-muted-foreground">
                    URLs utilisées dans les emails envoyés aux participants (certificats, évaluations, etc.).
                  </p>
                  <div className="space-y-3 max-w-lg">
                    <div className="space-y-2">
                      <Label htmlFor="website-url">Site web</Label>
                      <Input
                        id="website-url"
                        type="url"
                        value={websiteUrl}
                        onChange={(e) => setWebsiteUrl(e.target.value)}
                        placeholder="https://www.supertilt.fr"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="youtube-url">Chaîne YouTube</Label>
                      <Input
                        id="youtube-url"
                        type="url"
                        value={youtubeUrl}
                        onChange={(e) => setYoutubeUrl(e.target.value)}
                        placeholder="https://www.youtube.com/@supertilt"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="blog-url">Blog</Label>
                      <Input
                        id="blog-url"
                        type="url"
                        value={blogUrl}
                        onChange={(e) => setBlogUrl(e.target.value)}
                        placeholder="https://supertilt.fr/blog/"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Newsletter Tool URL */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Outil de newsletter</h3>
                  <p className="text-sm text-muted-foreground">
                    URL de votre outil de newsletter (ex: Brevo, Mailchimp). Un bouton « Préparer la newsletter » apparaîtra dans la section newsletter de la gestion de contenu.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="newsletter-tool-url">URL de l'outil</Label>
                    <div className="flex gap-2 max-w-lg">
                      <Input
                        id="newsletter-tool-url"
                        type="url"
                        value={newsletterToolUrl}
                        onChange={(e) => setNewsletterToolUrl(e.target.value)}
                        placeholder="https://app.brevo.com"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        onClick={() => newsletterToolUrl && window.open(newsletterToolUrl, "_blank")}
                        disabled={!newsletterToolUrl}
                        title="Ouvrir l'outil"
                      >
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* TVA Rate */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Taux de TVA</h3>
                  <p className="text-sm text-muted-foreground">
                    Taux de TVA par défaut appliqué dans les conventions de formation.
                  </p>
                  <div className="space-y-2">
                    <Label htmlFor="tva-rate">Taux de TVA (%)</Label>
                    <Input
                      id="tva-rate"
                      type="number"
                      min="0"
                      step="0.1"
                      value={tvaRate}
                      onChange={(e) => setTvaRate(e.target.value)}
                      placeholder="20"
                      className="max-w-[120px]"
                    />
                  </div>
                </div>

                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Jours ouvrables</h3>
                  <p className="text-sm text-muted-foreground">
                    Les emails automatisés (pré et post-formation) seront envoyés uniquement les jours ouvrables sélectionnés.
                  </p>
                  
                  <div className="flex flex-wrap gap-4">
                    {["Dim", "Lun", "Mar", "Mer", "Jeu", "Ven", "Sam"].map((day, index) => (
                      <div key={day} className="flex items-center gap-2">
                        <Checkbox
                          id={`working-day-${index}`}
                          checked={workingDays[index]}
                          onCheckedChange={(checked) => {
                            const newDays = [...workingDays];
                            newDays[index] = checked === true;
                            setWorkingDays(newDays);
                          }}
                        />
                        <Label 
                          htmlFor={`working-day-${index}`}
                          className="text-sm cursor-pointer"
                        >
                          {day}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Délais des emails avant formation</h3>
                  <p className="text-sm text-muted-foreground">
                    Configurez les délais d'envoi des emails automatiques avant la date de formation (J-X).
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delay-needs-survey">Questionnaire de besoins</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J -</span>
                        <Input
                          id="delay-needs-survey"
                          type="number"
                          min="1"
                          max="30"
                          value={delayNeedsSurvey}
                          onChange={(e) => setDelayNeedsSurvey(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-reminder">Rappel logistique</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J -</span>
                        <Input
                          id="delay-reminder"
                          type="number"
                          min="1"
                          max="30"
                          value={delayReminder}
                          onChange={(e) => setDelayReminder(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-trainer-summary">Synthèse formateur</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J -</span>
                        <Input
                          id="delay-trainer-summary"
                          type="number"
                          min="1"
                          max="30"
                          value={delayTrainerSummary}
                          onChange={(e) => setDelayTrainerSummary(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Convention reminder delays */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Relances convention de formation</h3>
                  <p className="text-sm text-muted-foreground">
                    Configurez les délais de relance pour la récupération de la convention de formation signée (en jours ouvrés après l'envoi).
                  </p>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delay-convention-reminder-1">1ère relance</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-convention-reminder-1"
                          type="number"
                          min="1"
                          max="30"
                          value={delayConventionReminder1}
                          onChange={(e) => setDelayConventionReminder1(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours ouvrés</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="delay-convention-reminder-2">2ème relance</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-convention-reminder-2"
                          type="number"
                          min="1"
                          max="30"
                          value={delayConventionReminder2}
                          onChange={(e) => setDelayConventionReminder2(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours ouvrés</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Email scheduling delays - After training */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Délais des emails après formation</h3>
                  <p className="text-sm text-muted-foreground">
                    Configurez les délais d'envoi des emails automatiques après la date de fin de formation (J+X).
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delay-google-review">Avis Google</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-google-review"
                          type="number"
                          min="1"
                          max="60"
                          value={delayGoogleReview}
                          onChange={(e) => setDelayGoogleReview(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-video-testimonial">Témoignage vidéo</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-video-testimonial"
                          type="number"
                          min="1"
                          max="60"
                          value={delayVideoTestimonial}
                          onChange={(e) => setDelayVideoTestimonial(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-cold-evaluation">Évaluation à froid commanditaire</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-cold-evaluation"
                          type="number"
                          min="1"
                          max="90"
                          value={delayColdEvaluation}
                          onChange={(e) => setDelayColdEvaluation(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-cold-evaluation-funder">Évaluation à froid financeur</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-cold-evaluation-funder"
                          type="number"
                          min="1"
                          max="120"
                          value={delayColdEvaluationFunder}
                          onChange={(e) => setDelayColdEvaluationFunder(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Uniquement si le financeur est différent du commanditaire
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Evaluation reminder delays */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Relances pour collecte des évaluations</h3>
                  <p className="text-sm text-muted-foreground">
                    Ces relances sont envoyées uniquement aux participants n'ayant pas encore soumis leur évaluation.
                  </p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="delay-evaluation-reminder-1">1ère relance</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-evaluation-reminder-1"
                          type="number"
                          min="1"
                          max="30"
                          value={delayEvaluationReminder1}
                          onChange={(e) => setDelayEvaluationReminder1(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours ouvrables</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Relance amicale rappelant l'importance de l'évaluation
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label htmlFor="delay-evaluation-reminder-2">2ème relance</Label>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-muted-foreground">J +</span>
                        <Input
                          id="delay-evaluation-reminder-2"
                          type="number"
                          min="1"
                          max="30"
                          value={delayEvaluationReminder2}
                          onChange={(e) => setDelayEvaluationReminder2(e.target.value)}
                          className="w-20"
                        />
                        <span className="text-sm text-muted-foreground">jours ouvrables</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        Dernière relance mentionnant l'importance pour Qualiopi
                      </p>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Règlement intérieur */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Règlement intérieur des formations</h3>
                  <p className="text-sm text-muted-foreground">
                    Uploadez le règlement intérieur de vos formations (PDF). Il sera consultable depuis la page de synthèse de chaque formation.
                  </p>

                  {reglementInterieurUrl ? (
                    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30 max-w-lg">
                      <FileText className="h-5 w-5 text-primary shrink-0" />
                      <span className="text-sm font-medium truncate flex-1">Règlement intérieur</span>
                      <Button
                        variant="outline"
                        size="sm"
                        asChild
                      >
                        <a href={reglementInterieurUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
                          Consulter
                        </a>
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => setReglementInterieurUrl(null)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <Label htmlFor="reglement-upload" className="sr-only">Règlement intérieur (PDF)</Label>
                      <div className="flex items-center gap-2 max-w-lg">
                        <Button
                          variant="outline"
                          disabled={uploadingReglement}
                          onClick={() => document.getElementById("reglement-upload")?.click()}
                        >
                          {uploadingReglement ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Upload className="h-4 w-4 mr-2" />
                          )}
                          Choisir un fichier PDF
                        </Button>
                        <input
                          id="reglement-upload"
                          type="file"
                          accept=".pdf"
                          className="hidden"
                          onChange={async (e) => {
                            const file = e.target.files?.[0];
                            if (!file) return;
                            if (file.type !== "application/pdf") {
                              toast({ title: "Format invalide", description: "Seuls les fichiers PDF sont acceptés.", variant: "destructive" });
                              return;
                            }
                            setUploadingReglement(true);
                            try {
                              const ext = file.name.split(".").pop();
                              const filePath = `reglement-interieur/reglement-interieur-${Date.now()}.${ext}`;
                              const { error: uploadError } = await supabase.storage
                                .from("training-documents")
                                .upload(filePath, file, { upsert: true });
                              if (uploadError) throw uploadError;
                              const { data: urlData } = supabase.storage
                                .from("training-documents")
                                .getPublicUrl(filePath);
                              setReglementInterieurUrl(urlData.publicUrl);
                              toast({ title: "Fichier uploadé" });
                            } catch (err) {
                              console.error("Upload error:", err);
                              toast({ title: "Erreur d'upload", description: "Impossible d'uploader le fichier.", variant: "destructive" });
                            } finally {
                              setUploadingReglement(false);
                              e.target.value = "";
                            }
                          }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Permissions */}
                <div className="space-y-4">
                  <h3 className="text-sm font-medium">Droits et permissions</h3>
                  <p className="text-sm text-muted-foreground">
                    Configurez les permissions spécifiques pour certaines actions sensibles.
                  </p>

                  <div className="space-y-2">
                    <Label htmlFor="can-delete-evaluations">Suppression des évaluations</Label>
                    <Textarea
                      id="can-delete-evaluations"
                      value={canDeleteEvaluationsEmails}
                      onChange={(e) => setCanDeleteEvaluationsEmails(e.target.value)}
                      placeholder="email1@exemple.com, email2@exemple.com"
                      className="max-w-lg"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Adresses email des utilisateurs autorisés à supprimer des évaluations, séparées par des virgules.
                      L'administrateur a toujours ce droit.
                    </p>
                  </div>
                </div>

                <Button
                  onClick={handleSaveSettings}
                  disabled={savingSettings}
                >
                  {savingSettings ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Enregistrer
                </Button>
              </CardContent>
            </Card>

            {/* Mission Page Templates */}
            <div className="mt-6">
              <PageTemplateManager />
            </div>
          </TabsContent>

          <TabsContent value="trainers">
            <TrainerManager />
          </TabsContent>

          <TabsContent value="crm" className="space-y-6">
            <CrmColorSettings />
            <CrmTagManager />
          </TabsContent>

          <TabsContent value="emails">
            <Card>
              <CardHeader>
                <CardTitle>Personnalisation des emails</CardTitle>
                <CardDescription>
                  Modifiez le contenu des emails automatiques envoyés par l'application.
                  Utilisez les variables entre doubles accolades (ex: {"{{first_name}}"}) pour insérer des données dynamiques.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Before Training Emails */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    📅 Avant la formation
                  </h3>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(DEFAULT_TEMPLATES)
                      .filter(([, t]) => t.timing === "before")
                      .map(([type, defaultTemplate]) => {
                        const currentMode = activeMode[type] || "vous";
                        const saveKey = `${type}_${currentMode}`;
                        const isCustomized = templates[type]?.tu || templates[type]?.vous;
                        
                        // Map delayKey to actual delay value
                        const getDelayValue = (key?: string): string | null => {
                          if (!key) return null;
                          const delayMap: Record<string, string> = {
                            delay_needs_survey_days: delayNeedsSurvey,
                            delay_reminder_days: delayReminder,
                            delay_trainer_summary_days: delayTrainerSummary,
                          };
                          return delayMap[key] || null;
                        };
                        
                        const delayValue = getDelayValue(defaultTemplate.delayKey);
                        const timingLabel = delayValue ? `J-${delayValue}` : null;
                        
                        return (
                          <AccordionItem key={type} value={type}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{defaultTemplate.name}</span>
                                {timingLabel && (
                                  <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded font-medium">
                                    {timingLabel}
                                  </span>
                                )}
                                {isCustomized && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    Personnalisé
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              {renderTemplateEditor(type, defaultTemplate, currentMode, saveKey)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                  </Accordion>
                </div>

                <Separator />

                {/* After Training Emails */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    ✅ Après la formation
                  </h3>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(DEFAULT_TEMPLATES)
                      .filter(([, t]) => t.timing === "after")
                      .map(([type, defaultTemplate]) => {
                        const currentMode = activeMode[type] || "vous";
                        const saveKey = `${type}_${currentMode}`;
                        const isCustomized = templates[type]?.tu || templates[type]?.vous;
                        
                        // Map delayKey to actual delay value for "after" emails
                        const getDelayValue = (key?: string): string | null => {
                          if (!key) return null;
                          const delayMap: Record<string, string> = {
                            delay_google_review_days: delayGoogleReview,
                            delay_video_testimonial_days: delayVideoTestimonial,
                            delay_cold_evaluation_days: delayColdEvaluation,
                            delay_funder_reminder_days: delayColdEvaluationFunder,
                            delay_evaluation_reminder_1_days: delayEvaluationReminder1,
                            delay_evaluation_reminder_2_days: delayEvaluationReminder2,
                          };
                          return delayMap[key] || null;
                        };
                        
                        const delayValue = getDelayValue(defaultTemplate.delayKey);
                        const timingLabel = delayValue ? `J+${delayValue}` : null;
                        
                        return (
                          <AccordionItem key={type} value={type}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{defaultTemplate.name}</span>
                                {timingLabel && (
                                  <span className="text-xs bg-accent text-accent-foreground px-2 py-0.5 rounded font-medium">
                                    {timingLabel}
                                  </span>
                                )}
                                {isCustomized && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    Personnalisé
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              {renderTemplateEditor(type, defaultTemplate, currentMode, saveKey)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                  </Accordion>
                </div>

                <Separator />

                {/* During Training Emails */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    🎯 Pendant la formation
                  </h3>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(DEFAULT_TEMPLATES)
                      .filter(([, t]) => t.timing === "during")
                      .map(([type, defaultTemplate]) => {
                        const currentMode = activeMode[type] || "vous";
                        const saveKey = `${type}_${currentMode}`;
                        const isCustomized = templates[type]?.tu || templates[type]?.vous;
                        
                        return (
                          <AccordionItem key={type} value={type}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{defaultTemplate.name}</span>
                                {isCustomized && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    Personnalisé
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              {renderTemplateEditor(type, defaultTemplate, currentMode, saveKey)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                  </Accordion>
                </div>

                <Separator />

                {/* Manual Emails */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                    ✋ Envoi manuel
                  </h3>
                  <Accordion type="single" collapsible className="w-full">
                    {Object.entries(DEFAULT_TEMPLATES)
                      .filter(([, t]) => t.timing === "manual")
                      .map(([type, defaultTemplate]) => {
                        const currentMode = activeMode[type] || "vous";
                        const saveKey = `${type}_${currentMode}`;
                        const isCustomized = templates[type]?.tu || templates[type]?.vous;
                        
                        return (
                          <AccordionItem key={type} value={type}>
                            <AccordionTrigger className="text-left">
                              <div className="flex items-center gap-3">
                                <Mail className="h-4 w-4 text-muted-foreground" />
                                <span>{defaultTemplate.name}</span>
                                {isCustomized && (
                                  <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
                                    Personnalisé
                                  </span>
                                )}
                              </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-4 pt-4">
                              {renderTemplateEditor(type, defaultTemplate, currentMode, saveKey)}
                            </AccordionContent>
                          </AccordionItem>
                        );
                      })}
                  </Accordion>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {isAdmin && (
            <TabsContent value="access">
              <UserAccessManager />
            </TabsContent>
          )}

          {isAdmin && (
            <TabsContent value="integrations" className="space-y-6">
              <ApiKeyManager />
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Connexions Google</CardTitle>
                  <CardDescription>Connectez vos services Google pour enrichir les fonctionnalités.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Google Drive</p>
                      <p className="text-xs text-muted-foreground">Stockage de fichiers et pièces jointes</p>
                    </div>
                    <GoogleDriveConnect />
                  </div>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">Google Calendar</p>
                      <p className="text-xs text-muted-foreground">Agenda utilisé par le coach commercial pour contextualiser les recommandations</p>
                    </div>
                    <GoogleCalendarConnect />
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          )}

          <TabsContent value="arena">
            <ArenaKeySettings />
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
};

export default Parametres;
