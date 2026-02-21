export interface TemplateConfig {
  name: string;
  timing: "before" | "during" | "after" | "manual";
  delayKey?: string;
  subject: { tu: string; vous: string };
  content: { tu: string; vous: string };
  variables: string[];
}

export const DEFAULT_TEMPLATES: Record<string, TemplateConfig> = {
  // BEFORE TRAINING
  needs_survey: {
    name: "Questionnaire de recueil des besoins",
    timing: "before",
    delayKey: "delay_needs_survey_days",
    subject: {
      tu: 'Prépare ta formation "{{training_name}}"',
      vous: 'Préparez votre formation "{{training_name}}"',
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
      tu: 'Rappel : Prépare ta formation "{{training_name}}"',
      vous: 'Rappel : Préparez votre formation "{{training_name}}"',
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
  convention_reminder: {
    name: "Relance convention de formation",
    timing: "before",
    delayKey: "delay_convention_reminder_1_days",
    subject: {
      tu: 'Rappel : convention de formation "{{training_name}}"',
      vous: 'Rappel : convention de formation "{{training_name}}"',
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
      tu: '🌟 Ton avis sur la formation "{{training_name}}"',
      vous: '🌟 Votre avis sur la formation "{{training_name}}"',
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
      tu: '🎥 Partager ton expérience sur la formation "{{training_name}}"',
      vous: '🎥 Partager votre expérience sur la formation "{{training_name}}"',
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
      tu: '💡 Évaluation à froid de la formation "{{training_name}}" 💡',
      vous: '💡 Évaluation à froid de la formation "{{training_name}}" 💡',
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
      tu: '📝 Petit rappel : ton avis compte pour "{{training_name}}"',
      vous: '📝 Petit rappel : votre avis compte pour "{{training_name}}"',
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
      tu: '🙏 Dernière relance : ta contribution pour "{{training_name}}"',
      vous: '🙏 Dernière relance : votre contribution pour "{{training_name}}"',
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
      tu: '📋 Prendre contact avec {{financeur_name}} pour formation "{{training_name}}"',
      vous: '📋 Prendre contact avec {{financeur_name}} pour formation "{{training_name}}"',
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
      tu: 'Documents de la formation "{{training_name}}"',
      vous: 'Documents de la formation "{{training_name}}"',
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
      tu: 'Votre devis pour la formation "{{formation_name}}"',
      vous: 'Votre devis pour la formation "{{formation_name}}"',
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
      tu: 'Accès à ta formation e-learning "{{training_name}}"',
      vous: 'Accès à votre formation e-learning "{{training_name}}"',
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
};
