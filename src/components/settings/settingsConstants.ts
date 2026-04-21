// Shared types, default templates, and settings registry for the Settings page

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
    sendingInfo: "📤 Envoyé automatiquement aux participants, J-X avant la formation (configurable)",
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
    sendingInfo: "📤 Envoyé automatiquement aux participants qui n'ont pas complété le questionnaire, 3 jours après l'envoi initial",
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
    sendingInfo: "📤 Envoyé automatiquement aux participants chaque demi-journée de formation (matin/après-midi) pour les formats présentiel",
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
    sendingInfo: "✋ Envoyé manuellement depuis la fiche formation (bouton « Envoyer remerciements »). Contient le lien d'évaluation et les supports",
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
    sendingInfo: "📤 Envoyé automatiquement au commanditaire, J+X jours ouvrables après la fin de la formation (configurable)",
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
    sendingInfo: "📤 Envoyé automatiquement au commanditaire, J+X jours ouvrables après la formation (configurable)",
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
  // MISSION EMAILS
  mission_google_review: {
    name: "Demande d'avis Google (Mission)",
    timing: "mission_after",
    sendingInfo: "📤 Envoyé automatiquement au contact de la mission, J+X jours après la fin de mission (configurable)",
    delayKey: "delay_mission_google_review_days",
    subject: {
      tu: "🌟 Ton avis sur notre collaboration \"{{mission_title}}\"",
      vous: "🌟 Votre avis sur notre collaboration \"{{mission_title}}\"",
    },
    content: {
      tu: `Bonjour {{first_name}},

Notre collaboration sur "{{mission_title}}" touche à sa fin, et je tenais à te remercier pour ta confiance.

Pour continuer à améliorer nos services et partager des retours d'expérience, ton avis serait très précieux. Pourrais-tu nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Laisser un avis : {{google_review_link}}

Ton retour est essentiel pour nous permettre de progresser et d'aider d'autres organisations à découvrir nos services.

Merci infiniment pour ton soutien !

À bientôt,`,
      vous: `Bonjour {{first_name}},

Notre collaboration sur "{{mission_title}}" touche à sa fin, et je tenais à vous remercier pour votre confiance.

Pour continuer à améliorer nos services et partager des retours d'expérience, votre avis serait très précieux. Pourriez-vous nous accorder 1 minute pour laisser un commentaire sur notre page Google ?

👉 Laisser un avis : {{google_review_link}}

Votre retour est essentiel pour nous permettre de progresser et d'aider d'autres organisations à découvrir nos services.

Merci infiniment pour votre soutien !

À bientôt,`,
    },
    variables: ["first_name", "mission_title", "google_review_link"],
  },
  mission_video_testimonial: {
    name: "Demande de témoignage vidéo (Mission)",
    timing: "mission_after",
    sendingInfo: "📤 Envoyé automatiquement au contact de la mission, J+X jours après l'avis Google mission (configurable)",
    delayKey: "delay_mission_video_testimonial_days",
    subject: {
      tu: "🎥 Partager ton expérience sur \"{{mission_title}}\"",
      vous: "🎥 Partager votre expérience sur \"{{mission_title}}\"",
    },
    content: {
      tu: `Bonjour {{first_name}},

Je me permets de te contacter pour te proposer de partager ton retour d'expérience sur notre collaboration "{{mission_title}}".

Ce témoignage pourrait prendre la forme d'une courte interview en visioconférence (10 minutes maximum) ou d'un texte qui sera publié sur {{site_url}}.

Ton retour serait précieux pour inspirer d'autres organisations et valoriser ton analyse.

Si tu es partant(e), réponds simplement à cet email pour que nous puissions convenir d'un moment ensemble.

Merci d'avance pour ton temps !

Bonne journée,`,
      vous: `Bonjour {{first_name}},

Je me permets de vous contacter pour vous proposer de partager votre retour d'expérience sur notre collaboration "{{mission_title}}".

Ce témoignage pourrait prendre la forme d'une courte interview en visioconférence (10 minutes maximum) ou d'un texte qui sera publié sur {{site_url}}.

Votre retour serait précieux pour inspirer d'autres organisations et valoriser votre analyse.

Si vous êtes partant(e), répondez simplement à cet email pour que nous puissions convenir d'un moment ensemble.

Merci d'avance pour votre temps !

Bonne journée,`,
    },
    variables: ["first_name", "mission_title", "site_url"],
  },
  cold_evaluation: {
    name: "Évaluation à froid commanditaire",
    timing: "after",
    sendingInfo: "📤 Envoyé automatiquement au commanditaire, J+X jours ouvrables après la formation (configurable)",
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
    sendingInfo: "📤 Envoyé automatiquement aux participants n'ayant pas complété l'évaluation, J+X jours ouvrables après le mail de remerciement (configurable)",
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
    sendingInfo: "📤 Envoyé automatiquement aux participants n'ayant pas complété l'évaluation, J+X jours ouvrables après le mail de remerciement (configurable)",
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
    sendingInfo: "📤 Envoyé automatiquement (à soi-même comme rappel) pour contacter le financeur, J+X jours ouvrables après la formation (configurable)",
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
  follow_up_news: {
    name: "Prise de nouvelles informelle",
    timing: "after",
    sendingInfo: "📤 Envoyé automatiquement au commanditaire, J+X jours ouvrables après la formation (configurable)",
    delayKey: "delay_follow_up_news_days",
    subject: {
      tu: "{{first_name}}, des nouvelles depuis la formation ?",
      vous: "{{first_name}}, des nouvelles depuis la formation ?",
    },
    content: {
      tu: `Salut {{first_name}},

Ça fait environ un mois que tu as suivi la formation "{{training_name}}" et je voulais prendre de tes nouvelles !

Tu as réussi à mettre des choses en pratique depuis ? Je serais curieux de savoir ce qui a le mieux marché pour toi.

N'hésite pas à me répondre, même en deux mots !`,
      vous: `Bonjour {{first_name}},

Cela fait environ un mois que vous avez suivi la formation "{{training_name}}" et je souhaitais prendre de vos nouvelles !

Avez-vous eu l'occasion de mettre des choses en pratique depuis ? Je serais curieux de savoir ce qui a le mieux fonctionné pour vous.

N'hésitez pas à me répondre, même en quelques mots !`,
    },
    variables: ["first_name", "training_name"],
  },
  training_documents: {
    name: "Envoi des documents de formation",
    timing: "manual",
    sendingInfo: "✋ Envoyé manuellement depuis la fiche formation (bouton « Envoyer documents »). Inclut facture, émargements et certificats en PJ",
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
{{#has_certificates}}
- Les certificats de réalisation
{{/has_certificates}}

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
{{#has_certificates}}
- Les certificats de réalisation
{{/has_certificates}}

N'hésitez pas à me contacter si vous avez des questions.

Bonne réception.`,
    },
    variables: ["greeting", "training_name", "training_dates", "has_invoice", "has_sheets", "has_certificates"],
  },
  micro_devis: {
    name: "Envoi de micro-devis",
    timing: "manual",
    sendingInfo: "✋ Envoyé manuellement depuis le CRM ou la fiche formation lors de la génération d'un devis",
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
    sendingInfo: "✋ Envoyé manuellement depuis la fiche formation (bouton « Envoyer convention »). Contient la convention PDF et le lien de signature en ligne",
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
    sendingInfo: "✋ Envoyé manuellement depuis la fiche formation pour les formats e-learning. Contient le lien d'accès à la plateforme",
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
    sendingInfo: "📤 Envoyé automatiquement au commanditaire si la convention n'est pas signée, J+X jours ouvrés après l'envoi (configurable)",
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
  certificate: {
    name: "Envoi du certificat de réalisation",
    timing: "after",
    sendingInfo: "📤 Envoyé automatiquement au participant après qu'il a complété son évaluation de satisfaction",
    subject: {
      tu: "Ton certificat de réalisation pour la formation {{training_name}}",
      vous: "Votre certificat de réalisation pour la formation {{training_name}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je te remercie pour ton évaluation.

Tu trouveras en pièce jointe ton certificat de réalisation pour la formation "{{training_name}}".

Je te souhaite de bien exploiter tout ce que tu as vu pendant la formation !

{{#website_url}}
Si tu souhaites aller plus loin, je t'invite à te rendre régulièrement sur {{website_url}}.
{{/website_url}}

Bonne continuation et à bientôt !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Je vous remercie pour votre évaluation.

Vous trouverez en pièce jointe votre certificat de réalisation pour la formation "{{training_name}}".

Je vous souhaite de bien exploiter tout ce que vous avez vu pendant la formation !

{{#website_url}}
Si vous souhaitez aller plus loin, je vous invite à vous rendre régulièrement sur {{website_url}}.
{{/website_url}}

Bonne continuation et à bientôt !`,
    },
    variables: ["first_name", "training_name", "website_url"],
  },
  certificate_sponsor: {
    name: "Envoi du certificat au commanditaire",
    timing: "manual",
    sendingInfo: "✋ Envoyé manuellement depuis la fiche formation au commanditaire avec les certificats des participants en PJ",
    subject: {
      tu: "Certificat de réalisation - {{training_name}} - {{participant_name}}",
      vous: "Certificat de réalisation - {{training_name}} - {{participant_name}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu trouveras en pièce jointe le certificat de réalisation de {{participant_name}} pour la formation "{{training_name}}".

Bonne réception et à bientôt !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Veuillez trouver en pièce jointe le certificat de réalisation de {{participant_name}} pour la formation "{{training_name}}".

Bonne réception et à bientôt !`,
    },
    variables: ["first_name", "training_name", "participant_name"],
  },
  accessibility_needs: {
    name: "Besoins d'accessibilité",
    timing: "manual",
    sendingInfo: "📤 Envoyé automatiquement au formateur lorsqu'un participant signale un besoin spécifique dans le questionnaire de recueil des besoins",
    subject: {
      tu: "Tes besoins spécifiques pour la formation \"{{training_name}}\"",
      vous: "Vos besoins spécifiques pour la formation \"{{training_name}}\"",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci d'avoir pris le temps de remplir le formulaire de recueil des besoins pour notre formation à venir. Je suis soucieux de proposer un environnement d'apprentissage adapté à chacun de mes participants.

J'ai bien pris en compte ton besoin spécifique :
"{{accessibility_needs}}"

Je souhaite t'offrir la meilleure expérience possible lors de cette formation et m'adapter au mieux à tes besoins.

Pourrais-tu m'indiquer les adaptations nécessaires que je pourrais mettre en place pour te permettre de suivre la formation dans les meilleures conditions ?

Dans l'attente de ton retour, je reste à ta disposition pour toute question ou information complémentaire.`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci d'avoir pris le temps de remplir le formulaire de recueil des besoins pour notre formation à venir. Je suis soucieux de proposer un environnement d'apprentissage adapté à chacun de mes participants.

J'ai bien pris en compte votre besoin spécifique :
"{{accessibility_needs}}"

Je souhaite vous offrir la meilleure expérience possible lors de cette formation et m'adapter au mieux à vos besoins.

Pourriez-vous m'indiquer les adaptations nécessaires que je pourrais mettre en place pour vous permettre de suivre la formation dans les meilleures conditions ?

Dans l'attente de votre retour, je reste à votre disposition pour toute question ou information complémentaire.`,
    },
    variables: ["first_name", "training_name", "accessibility_needs"],
  },
  mission_deliverables: {
    name: "Envoi des livrables de mission",
    timing: "manual",
    sendingInfo: "✋ Envoyé manuellement depuis la fiche mission lors du partage des livrables au client",
    subject: {
      tu: "Vos livrables sont disponibles - {{mission_title}}",
      vous: "Vos livrables sont disponibles - {{mission_title}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont prêts pour toi.

Tu peux les consulter et les télécharger à tout moment en cliquant ci-dessous :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésite pas à revenir vers moi si tu as la moindre question.

À très bientôt !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont disponibles.

Vous pouvez les consulter et les télécharger à tout moment en cliquant ci-dessous :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésitez pas à revenir vers moi si vous avez la moindre question.

Cordialement,`,
    },
    variables: ["first_name", "mission_title", "deliverables_link"],
  },
  // ── New templates (previously hardcoded in edge functions) ──
  welcome: {
    name: "Convocation / Confirmation d'inscription",
    timing: "before",
    sendingInfo: "✋ Envoyé manuellement depuis la fiche formation (bouton « Envoyer convocations »). Contient les infos pratiques (date, horaires, lieu)",
    subject: {
      tu: "{{training_name}} – {{training_date}} – Confirmation d'inscription",
      vous: "{{training_name}} – {{training_date}} – Confirmation d'inscription",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Nous avons le plaisir de te confirmer ton inscription à la formation "{{training_name}}".

Informations pratiques :
- Date : {{training_date}}
- Horaires :
{{training_schedule}}
- Lieu : {{training_location}}

Nous restons à ta disposition pour toute question.

À très bientôt !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Nous avons le plaisir de vous confirmer votre inscription à la formation "{{training_name}}".

Informations pratiques :
- Date : {{training_date}}
- Horaires :
{{training_schedule}}
- Lieu : {{training_location}}

Nous restons à votre disposition pour toute question.

À très bientôt !`,
    },
    variables: ["first_name", "training_name", "training_date", "training_schedule", "training_location"],
  },
  reminder: {
    name: "Rappel formation imminente",
    timing: "before",
    sendingInfo: "📤 Envoyé automatiquement aux participants le jour de la formation à 07h00",
    delayKey: "delay_reminder_days",
    subject: {
      tu: "Rappel : Formation {{training_name}} – {{training_date}}",
      vous: "Rappel : Formation {{training_name}} – {{training_date}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Ta formation "{{training_name}}" approche !

Pour rappel :
- Date : {{training_date}}
- Horaires :
{{training_schedule}}
- Lieu : {{training_location}}

N'hésite pas à me contacter si tu as des questions.

À très bientôt !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Votre formation "{{training_name}}" approche !

Pour rappel :
- Date : {{training_date}}
- Horaires :
{{training_schedule}}
- Lieu : {{training_location}}

N'hésitez pas à me contacter si vous avez des questions.

À très bientôt !`,
    },
    variables: ["first_name", "training_name", "training_date", "training_schedule", "training_location"],
  },
  trainer_summary: {
    name: "Synthèse pré-formation (formateur)",
    timing: "before",
    sendingInfo: "📤 Envoyé automatiquement au formateur J-1 avant la formation. Contient la synthèse IA des besoins des participants",
    delayKey: "delay_trainer_summary_days",
    subject: {
      tu: "☀️ Demain c'est le grand jour ! Synthèse pré-formation – {{training_name}}",
      vous: "☀️ Synthèse pré-formation – {{training_name}}",
    },
    content: {
      tu: `Salut {{first_name}} 👋

Ta formation "{{training_name}}" pour {{client_name}} a lieu demain {{training_date}} !

📍 Lieu : {{training_location}}
{{#training_schedule}}
🕐 Horaires :
{{training_schedule}}
{{/training_schedule}}

🎯 Synthèse des besoins des participants

{{survey_stats}}

{{ai_summary}}

Bonne préparation et bonne formation demain ! 🚀`,
      vous: `Bonjour {{first_name}},

Votre formation "{{training_name}}" pour {{client_name}} a lieu demain {{training_date}}.

📍 Lieu : {{training_location}}
{{#training_schedule}}
🕐 Horaires :
{{training_schedule}}
{{/training_schedule}}

🎯 Synthèse des besoins des participants

{{survey_stats}}

{{ai_summary}}

Bonne préparation et bonne formation demain !`,
    },
    variables: ["first_name", "training_name", "client_name", "training_date", "training_location", "training_schedule", "survey_stats", "ai_summary"],
  },
  live_reminder: {
    name: "Rappel de live collectif",
    timing: "during",
    sendingInfo: "📤 Envoyé automatiquement aux participants le jour d'un live collectif à 07h00. Contient le lien de connexion",
    subject: {
      tu: "📺 Rappel : Live \"{{live_title}}\" aujourd'hui – {{training_name}}",
      vous: "📺 Rappel : Live \"{{live_title}}\" aujourd'hui – {{training_name}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Pour rappel, tu as un live collectif prévu aujourd'hui dans le cadre de la formation "{{training_name}}" :
- {{live_title}}
- 📅 {{live_date}} à {{live_time}}

{{#meeting_url}}
<p><a href="{{meeting_url}}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Rejoindre le live</a></p>
{{/meeting_url}}

Ta présence est importante pour profiter pleinement de ce moment d'échange.

À tout à l'heure !`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Pour rappel, vous avez un live collectif prévu aujourd'hui dans le cadre de la formation "{{training_name}}" :
- {{live_title}}
- 📅 {{live_date}} à {{live_time}}

{{#meeting_url}}
<p><a href="{{meeting_url}}" style="display: inline-block; background-color: #e6bc00; color: #1a1a1a; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">Rejoindre le live</a></p>
{{/meeting_url}}

Votre présence est importante pour profiter pleinement de ce moment d'échange.

À tout à l'heure !`,
    },
    variables: ["first_name", "training_name", "live_title", "live_date", "live_time", "meeting_url"],
  },
  prerequis_warning: {
    name: "Alerte prérequis non validés",
    timing: "before",
    sendingInfo: "📤 Envoyé automatiquement au participant lorsqu'il indique dans le questionnaire ne pas valider certains prérequis de la formation",
    subject: {
      tu: "Prérequis de la formation \"{{training_name}}\" - Faisons le point",
      vous: "Prérequis de la formation \"{{training_name}}\" - Faisons le point",
    },
    content: {
      tu: `Bonjour {{first_name}},

Merci d'avoir complété le questionnaire de recueil des besoins pour la formation "{{training_name}}".

J'ai bien noté que certains prérequis de la formation ne sont pas entièrement validés de ton côté :

{{prereq_list}}

Pas d'inquiétude ! Ces prérequis sont là pour t'aider à tirer le meilleur parti de la formation, mais ils ne sont pas forcément bloquants.

Pourrais-tu me répondre en m'expliquant ce qui te manque ?

Ensemble, nous verrons comment adapter la formation à ta situation ou, si nécessaire, comment te préparer au mieux avant la session.

Je reste à ta disposition pour en discuter.`,
      vous: `Bonjour {{first_name}},

Merci d'avoir complété le questionnaire de recueil des besoins pour la formation "{{training_name}}".

J'ai bien noté que certains prérequis de la formation ne sont pas entièrement validés de votre côté :

{{prereq_list}}

Pas d'inquiétude ! Ces prérequis sont là pour vous aider à tirer le meilleur parti de la formation, mais ils ne sont pas forcément bloquants.

Pourriez-vous me répondre en m'expliquant ce qui vous manque ?

Ensemble, nous verrons comment adapter la formation à votre situation ou, si nécessaire, comment vous préparer au mieux avant la session.

Je reste à votre disposition pour en discuter.`,
    },
    variables: ["first_name", "training_name", "prereq_list"],
  },
  questionnaire_confirmation: {
    name: "Confirmation questionnaire complété",
    timing: "before",
    sendingInfo: "📤 Envoyé automatiquement au participant juste après qu'il a complété le questionnaire de recueil des besoins",
    subject: {
      tu: "Questionnaire complété - {{training_name}}",
      vous: "Questionnaire complété - {{training_name}}",
    },
    content: {
      tu: `Bonjour {{first_name}},

Merci d'avoir rempli le formulaire de recueil des besoins pour la formation.

{{format_specific_content}}

{{calendar_section}}

Tu peux aussi flâner sur notre <a href="{{youtube_url}}">chaîne YouTube</a> et notre <a href="{{blog_url}}">blog</a> sur lesquels tu trouveras des éléments en rapport avec le programme.

Si tu as la moindre question, je reste à ta disposition par mail <a href="mailto:{{sender_email}}">{{sender_email}}</a>

À très vite,`,
      vous: `Bonjour {{first_name}},

Merci d'avoir rempli le formulaire de recueil des besoins pour la formation.

{{format_specific_content}}

{{calendar_section}}

Vous pouvez aussi consulter notre <a href="{{youtube_url}}">chaîne YouTube</a> et notre <a href="{{blog_url}}">blog</a> sur lesquels vous trouverez des éléments en rapport avec le programme.

Si vous avez la moindre question, je reste à votre disposition par mail <a href="mailto:{{sender_email}}">{{sender_email}}</a>

À très vite,`,
    },
    variables: ["first_name", "training_name", "format_specific_content", "calendar_section", "youtube_url", "blog_url", "sender_email"],
  },
  booking_reminder: {
    name: "Rappel réservation logistique",
    timing: "before",
    sendingInfo: "📤 Envoyé automatiquement chaque lundi au formateur tant que les réservations logistiques (hôtel, train, restaurant, salle) ne sont pas confirmées",
    subject: {
      tu: "Rappel : Réservation pour {{entity_type}} \"{{entity_name}}\"",
      vous: "Rappel : Réservation pour {{entity_type}} \"{{entity_name}}\"",
    },
    content: {
      tu: `Bonjour {{first_name}},

Ceci est un rappel automatique concernant {{entity_type}} "{{entity_name}}" prévue le {{start_date}} à {{location}} pour {{client_name}}.

⚠️ À réserver : {{booking_items}}
{{entity_type}} a lieu dans {{days_until}} jour(s).

{{extra_html}}

Merci de procéder à la réservation dès que possible et de cocher les cases correspondantes dans l'interface de gestion.

Ce rappel sera envoyé chaque lundi jusqu'à ce que les réservations soient confirmées.`,
      vous: `Bonjour {{first_name}},

Ceci est un rappel automatique concernant {{entity_type}} "{{entity_name}}" prévue le {{start_date}} à {{location}} pour {{client_name}}.

⚠️ À réserver : {{booking_items}}
{{entity_type}} a lieu dans {{days_until}} jour(s).

{{extra_html}}

Merci de procéder à la réservation dès que possible et de cocher les cases correspondantes dans l'interface de gestion.

Ce rappel sera envoyé chaque lundi jusqu'à ce que les réservations soient confirmées.`,
    },
    variables: ["first_name", "entity_type", "entity_name", "start_date", "location", "client_name", "booking_items", "days_until", "extra_html"],
  },
  sponsor_notification: {
    name: "Notification convocations au commanditaire",
    timing: "manual",
    sendingInfo: "📤 Envoyé automatiquement au commanditaire juste après l'envoi des convocations aux participants. Liste les participants convoqués",
    subject: {
      tu: "Convocations envoyées - {{training_name}}",
      vous: "Convocations envoyées - {{training_name}}",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Nous avons le plaisir de t'informer que les convocations à la formation "{{training_name}}" ont été envoyées aux participants suivants :

{{participants_list}}

Chaque participant a reçu un email contenant toutes les informations pratiques relatives à la formation.

Nous restons à ta disposition pour toute question.`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Nous avons le plaisir de vous informer que les convocations à la formation "{{training_name}}" ont été envoyées aux participants suivants :

{{participants_list}}

Chaque participant a reçu un email contenant toutes les informations pratiques relatives à la formation.

Nous restons à votre disposition pour toute question.

Bien cordialement,`,
    },
    variables: ["first_name", "training_name", "participants_list"],
  },
};

// Centralized settings registry: single source of truth for keys, defaults, and descriptions
export const SETTINGS_REGISTRY: Record<string, { default: string; description: string }> = {
  sender_email: { default: "", description: "Adresse email de l'expéditeur pour tous les envois" },
  sender_name: { default: "", description: "Nom de l'expéditeur pour tous les envois" },
  evaluation_notification_email: { default: "", description: "Email qui reçoit les notifications de nouvelles évaluations" },
  
  bcc_email: { default: "", description: "Adresse email en copie cachée (BCC) pour tous les envois" },
  bcc_enabled: { default: "true", description: "Activer ou désactiver l'envoi en copie cachée (BCC)" },
  google_my_business_url: { default: "https://g.page/r/CWJ0W_P6C-BJEAE/review", description: "URL de la fiche Google My Business pour les demandes d'avis" },
  supertilt_site_url: { default: "https://supertilt.fr", description: "URL du site SuperTilt pour les liens formations" },
  newsletter_tool_url: { default: "", description: "URL de l'outil de newsletter (ex: Brevo, Mailchimp)" },
  website_url: { default: "https://www.supertilt.fr", description: "URL du site web principal" },
  youtube_url: { default: "https://www.youtube.com/@supertilt", description: "URL de la chaîne YouTube" },
  blog_url: { default: "https://supertilt.fr/blog/", description: "URL du blog" },
  tva_rate: { default: "20", description: "Taux de TVA par défaut en pourcentage (ex: 20 pour 20%)" },
  working_days: { default: JSON.stringify([false, true, true, true, true, true, false]), description: "Jours ouvrables pour l'envoi des emails (tableau de 7 booléens : dim, lun, mar, mer, jeu, ven, sam)" },
  delay_needs_survey_days: { default: "7", description: "Délai avant formation pour envoyer le questionnaire de besoins (en jours)" },
  delay_reminder_days: { default: "7", description: "Délai avant formation pour envoyer le rappel logistique (en jours)" },
  delay_trainer_summary_days: { default: "1", description: "Délai avant formation pour envoyer la synthèse au formateur (en jours)" },
  delay_google_review_days: { default: "1", description: "Délai après formation pour demander un avis Google (en jours ouvrables)" },
  delay_video_testimonial_days: { default: "3", description: "Délai après formation pour demander un témoignage vidéo (en jours ouvrables)" },
  delay_mission_google_review_days: { default: "2", description: "Délai après mission pour demander un avis Google (en jours)" },
  delay_mission_video_testimonial_days: { default: "4", description: "Délai après mission pour demander un témoignage vidéo (en jours après l'avis Google)" },
  delay_cold_evaluation_days: { default: "10", description: "Délai après formation pour envoyer l'évaluation à froid (en jours ouvrables)" },
  delay_cold_evaluation_funder_days: { default: "15", description: "Délai après formation pour rappeler de contacter le financeur (en jours ouvrables)" },
  delay_evaluation_reminder_1_days: { default: "2", description: "Délai pour la 1ère relance d'évaluation (en jours ouvrables après le mail de remerciement)" },
  delay_evaluation_reminder_2_days: { default: "5", description: "Délai pour la 2ème relance d'évaluation (en jours ouvrables après le mail de remerciement)" },
  delay_convention_reminder_1_days: { default: "3", description: "Délai en jours ouvrés pour la 1ère relance convention de formation" },
  delay_convention_reminder_2_days: { default: "7", description: "Délai en jours ouvrés pour la 2ème relance convention de formation" },
  delay_follow_up_news_days: { default: "30", description: "Délai après formation pour envoyer un message informel de prise de nouvelles (en jours ouvrables)" },
  can_delete_evaluations_emails: { default: "", description: "Emails des utilisateurs autorisés à supprimer des évaluations (séparés par des virgules)" },
  reglement_interieur_url: { default: "", description: "URL du règlement intérieur des formations (PDF uploadé)" },
  slack_crm_channel: { default: "general", description: "Nom du canal Slack pour les notifications CRM (ex: crm, general)" },
  crm_inbound_email: { default: "", description: "Adresse email dédiée CRM — les emails reçus à cette adresse créent automatiquement une opportunité" },
  openai_api_key: { default: "", description: "Clé API OpenAI utilisée pour l'OCR, les embeddings RAG et les analyses automatiques" },
  insee_api_key: { default: "", description: "Clé API INSEE SIRENE pour la recherche d'entreprises par SIREN" },
  google_search_api_key: { default: "", description: "Clé API Google Custom Search pour la recherche de SIREN par nom d'entreprise (fallback)" },
  google_search_engine_id: { default: "", description: "ID du moteur de recherche personnalisé Google (cx) pour la recherche de SIREN" },
  woocommerce_store_url: { default: "", description: "URL de la boutique WooCommerce (ex: https://www.supertilt.fr)" },
  woocommerce_consumer_key: { default: "", description: "Clé API WooCommerce (Consumer Key, commence par ck_)" },
  woocommerce_consumer_secret: { default: "", description: "Secret API WooCommerce (Consumer Secret, commence par cs_)" },
  woocommerce_cart_base_url: { default: "", description: "URL de base du panier WooCommerce pour les accès e-learning (ex: https://supertilt.fr/commande/?add-to-cart=)" },
  app_url: { default: "https://super-tools.lovable.app", description: "URL principale de l'application SuperTools (utilisée dans tous les emails)" },
  google_maps_api_key: { default: "AIzaSyBFw0Qbyq9zTFTd-tUY6dZWTgaQzuU17R8", description: "Clé API Google Maps pour les cartes intégrées" },
  qualiopi_certificate_path: { default: "certificat-qualiopi/Certificat QUALIOPI v3.pdf", description: "Chemin du certificat Qualiopi dans le storage (bucket/fichier)" },
  backup_enabled: { default: "false", description: "Activer les sauvegardes automatiques quotidiennes vers Google Drive" },
  backup_gdrive_folder_id: { default: "", description: "ID du dossier Google Drive pour les sauvegardes" },
  stripe_secret_key: { default: "", description: "Clé secrète Stripe (sk_live_... ou sk_test_...) pour la facturation" },
  stripe_webhook_secret: { default: "", description: "Secret du webhook Stripe (whsec_...) pour valider les événements" },
  convention_default_price_ht: { default: "1250", description: "Prix HT par défaut pour les conventions si aucun prix n'est défini" },
  elearning_default_duration: { default: "7", description: "Durée par défaut en jours pour les formations e-learning" },
  elearning_horaires_text: { default: "Formation accessible en ligne à votre rythme", description: "Texte horaires affiché sur les conventions e-learning" },
  elearning_lieu_text: { default: "En ligne (plateforme e-learning)", description: "Texte lieu affiché sur les conventions e-learning" },
  convention_default_horaires: { default: "9h00-17h00", description: "Horaires par défaut si aucun planning n'est défini" },
  convention_moyen_pedagogique: { default: "SuperTilt", description: "Moyen pédagogique affiché sur la convention" },
  convention_frais_default: { default: "0", description: "Montant des frais par défaut sur la convention" },
  convention_affiche_frais: { default: "Non", description: "Afficher les frais sur la convention (Oui/Non)" },
  wp_statistics_api_token: { default: "", description: "Token API WP-Statistics pour récupérer les statistiques du site WordPress" },
};

export const SETTINGS_DEFAULTS = Object.fromEntries(
  Object.entries(SETTINGS_REGISTRY).map(([k, v]) => [k, v.default])
);
