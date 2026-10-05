/**
 * Default texts for automatic emails that used to be hardcoded.
 * Single source of truth: imported by edge functions (fallback) and by the
 * settings screen (Paramètres > Emails). Pure data, no imports.
 * Variables in UPPER-free snake_case; `blocks` are protected HTML injected
 * server-side (buttons, tables, quotes) and listed in `variables` too.
 */
export interface EditableEmailDefault {
  name: string;
  audience: "client" | "internal";
  sendingInfo: string;
  subject: { tu: string; vous: string };
  content: { tu: string; vous: string };
  variables: string[];
}

const same = (s: string) => ({ tu: s, vous: s });

export const EDITABLE_EMAIL_DEFAULTS: Record<string, EditableEmailDefault> = {
  elearning_erratum: {
    name: "Erratum lien e-learning",
    audience: "client",
    sendingInfo: "📤 Envoyé manuellement pour corriger un lien e-learning erroné",
    subject: {
      tu: "Erratum : le bon lien pour reprendre {{training_name}}",
      vous: "Erratum : le bon lien pour reprendre {{training_name}}",
    },
    content: {
      tu: `Bonjour {{first_name}},

Je reviens vers toi suite au message que je t'ai adressé ce matin au sujet de la formation en ligne « {{training_name}} ».

Le lien qu'il contenait était erroné : il renvoyait vers une page de commande, alors que ton inscription est bien enregistrée et réglée. Toutes mes excuses pour la confusion. Ce message annule et remplace le précédent.

Toute ta formation se trouve dans ton espace apprenant SuperTilt. Pour y accéder, c'est très simple :
- Clique sur le bouton ci-dessous
- Crée ton mot de passe (ou connecte-toi si tu as déjà un compte)
- Tu arrives directement sur ton tableau de bord, avec ta formation

{{access_button}}

Ce lien est personnel. S'il ne fonctionne plus, rends-toi sur la page de connexion : nous t'en enverrons un nouveau en quelques secondes.

Le rythme reste totalement libre, tu avances à ta convenance. Si le moindre point te freine, réponds simplement à ce mail.

À très vite,`,
      vous: `Bonjour {{first_name}},

Je reviens vers vous suite au message que je vous ai adressé ce matin au sujet de la formation en ligne « {{training_name}} ».

Le lien qu'il contenait était erroné : il renvoyait vers une page de commande, alors que votre inscription est bien enregistrée et réglée. Toutes mes excuses pour la confusion. Ce message annule et remplace le précédent.

Toute votre formation se trouve dans votre espace apprenant SuperTilt. Pour y accéder, c'est très simple :
- Cliquez sur le bouton ci-dessous
- Créez votre mot de passe (ou connectez-vous si vous avez déjà un compte)
- Vous arrivez directement sur votre tableau de bord, avec votre formation

{{access_button}}

Ce lien est personnel. S'il ne fonctionne plus, rendez-vous sur la page de connexion : nous vous en enverrons un nouveau en quelques secondes.

Le rythme reste totalement libre, vous avancez à votre convenance. Si le moindre point vous freine, répondez simplement à ce mail.

À très vite,`,
    },
    variables: ["first_name", "training_name", "access_button"],
  },

  lms_message_notification: {
    name: "Nouveau message formateur (e-learning)",
    audience: "client",
    sendingInfo: "📤 Envoyé à l'apprenant quand son formateur lui écrit dans l'espace e-learning",
    subject: {
      tu: "Nouveau message dans ton espace — {{course_title}}",
      vous: "Nouveau message dans votre espace — {{course_title}}",
    },
    content: {
      tu: `Bonjour,

Tu as reçu un nouveau message de ton formateur concernant ton e-learning **{{course_title}}**.

{{message_button}}

Si tu ne souhaites plus recevoir ces notifications, contacte ton formateur.`,
      vous: `Bonjour,

Vous avez reçu un nouveau message de votre formateur concernant votre e-learning **{{course_title}}**.

{{message_button}}

Si vous ne souhaitez plus recevoir ces notifications, contactez votre formateur.`,
    },
    variables: ["course_title", "message_button"],
  },

  deposit_feedback_notification: {
    name: "Retour disponible sur un dépôt",
    audience: "client",
    sendingInfo: "📤 Envoyé à l'apprenant quand un retour est publié sur son travail déposé",
    subject: {
      tu: "Un retour SuperTilt est disponible sur ton travail",
      vous: "Un retour SuperTilt est disponible sur votre travail",
    },
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Un retour SuperTilt est disponible sur le travail que tu as déposé dans la formation **{{course_title}}**.

Tu peux le consulter en cliquant sur le bouton ci-dessous.

{{feedback_button}}

À bientôt,
L'équipe SuperTilt`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Un retour SuperTilt est disponible sur le travail que vous avez déposé dans la formation **{{course_title}}**.

Vous pouvez le consulter en cliquant sur le bouton ci-dessous.

{{feedback_button}}

À bientôt,
L'équipe SuperTilt`,
    },
    variables: ["first_name", "course_title", "feedback_button"],
  },

  coached_formula_request: {
    name: "Demande de formule coachée",
    audience: "internal",
    sendingInfo: "🔔 Envoyé à l'équipe quand un apprenant demande la formule coachée",
    subject: same("Demande de formule coachée — {{learner_email}}"),
    content: same(`Bonjour,

L'apprenant **{{learner_email}}** souhaite passer à la formule coachée.

**Formation :** {{training_name}}
**E-Learning :** {{course_title}}

Merci de le contacter pour lui proposer une formule coachée adaptée.`),
    variables: ["learner_email", "training_name", "course_title"],
  },

  lms_comment_notification: {
    name: "Nouveau commentaire e-learning",
    audience: "internal",
    sendingInfo: "🔔 Envoyé à l'équipe quand un apprenant commente une leçon",
    subject: same("💬 Nouveau commentaire e-learning — {{course_title}}"),
    content: same(`Un apprenant a laissé un commentaire sur une leçon e-learning :

**Apprenant :** {{learner_name}}
**Cours :** {{course_title}}
**Leçon :** {{lesson_title}}

{{comment_block}}

{{community_button}}`),
    variables: ["learner_name", "course_title", "lesson_title", "comment_block", "community_button"],
  },

  learner_access: {
    name: "Accès à l'espace apprenant",
    audience: "client",
    sendingInfo: "📤 Envoyé à l'apprenant quand son compte est créé ou qu'il redemande son accès",
    subject: {
      tu: "{{#password_set}}Accéder à ton espace SuperTools{{/password_set}}{{#no_password}}Crée ton mot de passe SuperTools{{/no_password}}",
      vous: "{{#password_set}}Accéder à votre espace SuperTools{{/password_set}}{{#no_password}}Créez votre mot de passe SuperTools{{/no_password}}",
    },
    content: {
      tu: `Bonjour,

Ton espace apprenant{{#training_name}} pour la formation « {{training_name}} »{{/training_name}} est prêt.{{#no_password}} Crée ton mot de passe pour y accéder.{{/no_password}}{{#password_set}} Connecte-toi avec ton adresse et ton mot de passe.{{/password_set}}

{{access_button}}`,
      vous: `Bonjour,

Votre espace apprenant{{#training_name}} pour la formation « {{training_name}} »{{/training_name}} est prêt.{{#no_password}} Créez votre mot de passe pour y accéder.{{/no_password}}{{#password_set}} Connectez-vous avec votre adresse et votre mot de passe.{{/password_set}}

{{access_button}}`,
    },
    variables: ["training_name", "password_set", "no_password", "access_button"],
  },

  password_reset: {
    name: "Réinitialisation du mot de passe",
    audience: "client",
    sendingInfo: "📤 Envoyé quand un utilisateur demande à réinitialiser son mot de passe",
    subject: same("Réinitialisation de votre mot de passe SuperTools"),
    content: same(`Bonjour,

Vous avez demandé à réinitialiser votre mot de passe SuperTools.

Cliquez sur le bouton ci-dessous pour définir un nouveau mot de passe :

{{reset_button}}

Ce lien expire dans 1 heure.

Si vous n'avez pas demandé cette réinitialisation, ignorez cet email.`),
    variables: ["reset_button"],
  },

  session_start_signature: {
    name: "Émargement automatique (début de session)",
    audience: "client",
    sendingInfo: "📤 Envoyé automatiquement aux participants au démarrage de chaque demi-journée",
    subject: same("✍️ Émargement – {{training_name}} – {{session_date}} {{period_label}}"),
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer ta présence pour la formation **{{training_name}}**.

📍 **Lieu :** {{location}}
📅 **Date :** {{session_date}}
🕐 **Horaire :** {{period_label}} ({{time_range}})

{{signature_button}}

Cette signature électronique a valeur légale conformément au règlement européen eIDAS.`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer votre présence pour la formation **{{training_name}}**.

📍 **Lieu :** {{location}}
📅 **Date :** {{session_date}}
🕐 **Horaire :** {{period_label}} ({{time_range}})

{{signature_button}}

Cette signature électronique a valeur légale conformément au règlement européen eIDAS.`,
    },
    variables: ["first_name", "training_name", "location", "session_date", "period_label", "time_range", "signature_button"],
  },

  session_start_signature_live: {
    name: "Émargement automatique (live)",
    audience: "client",
    sendingInfo: "📤 Envoyé automatiquement aux participants au démarrage d'un live",
    subject: same("✍️ Émargement – {{training_name}} – {{session_date}}"),
    content: {
      tu: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer ta présence pour la formation **{{training_name}}**.

📺 **Live :** {{live_title}}
📅 **Date :** {{session_date}} à {{live_time}}

{{signature_button}}

Cette signature électronique a valeur légale conformément au règlement européen eIDAS.`,
      vous: `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Merci de bien vouloir signer votre présence pour la formation **{{training_name}}**.

📺 **Live :** {{live_title}}
📅 **Date :** {{session_date}} à {{live_time}}

{{signature_button}}

Cette signature électronique a valeur légale conformément au règlement européen eIDAS.`,
    },
    variables: ["first_name", "training_name", "live_title", "session_date", "live_time", "signature_button"],
  },

  session_start_trainer: {
    name: "Début de session (formateur)",
    audience: "internal",
    sendingInfo: "🔔 Envoyé au formateur quand une demi-journée démarre et que les émargements sont partis",
    subject: same("📋 Début de session – {{training_name}} – {{session_date}} {{period_label}}"),
    content: same(`Bonjour {{trainer_first_name}},

La session **{{period_label}}** de la formation **{{training_name}}** vient de démarrer.

📍 **Lieu :** {{location}}
📅 **Date :** {{session_date}}
🕐 **Horaire :** {{period_label}} ({{time_range}})
👥 **Participants :** {{signatures_sent}} demande(s) d'émargement envoyée(s)

Les participants ont reçu leur lien de signature électronique par email.`),
    variables: ["trainer_first_name", "training_name", "location", "session_date", "period_label", "time_range", "signatures_sent"],
  },

  group_matching: {
    name: "Groupe de pratique constitué",
    audience: "client",
    sendingInfo: "📤 Envoyé à chaque membre quand un groupe de pratique entre pairs est formé",
    subject: same("Votre groupe est formé 🎉"),
    content: same(`Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle : votre groupe est constitué !

{{post_quote}}

**Membres du groupe :**

{{members_list}}

On vous laisse vous organiser pour trouver des créneaux ensemble. Vous pouvez vous retrouver via WhatsApp, par téléphone ou en visio (Jitsi, Google Meet, etc.).

On vous invite à publier vos travaux sur la communauté.

{{contact_button}}

À très bientôt,
L'équipe SuperTilt`),
    variables: ["first_name", "post_quote", "members_list", "contact_button"],
  },

  practice_comment_admin: {
    name: "Commentaire communauté (équipe)",
    audience: "internal",
    sendingInfo: "🔔 Envoyé à l'équipe quand un commentaire est posté dans la communauté",
    subject: same("💬 Nouveau commentaire dans la communauté"),
    content: same(`Bonjour,

**{{commenter_name}}** a posté un commentaire dans la communauté :

{{comment_quote}}

{{discussion_button}}`),
    variables: ["commenter_name", "comment_quote", "discussion_button"],
  },

  practice_comment_owner: {
    name: "Commentaire sur votre publication",
    audience: "client",
    sendingInfo: "📤 Envoyé à l'auteur d'une publication quand quelqu'un la commente (si la notification est activée)",
    subject: same("💬 Nouveau commentaire sur votre publication"),
    content: same(`Bonjour,

**{{commenter_name}}** a commenté votre publication dans la communauté :

{{comment_quote}}

{{discussion_button}}

À bientôt,
L'équipe SuperTilt`),
    variables: ["commenter_name", "comment_quote", "discussion_button"],
  },

  convention_signature_confirmation: {
    name: "Confirmation de signature de convention",
    audience: "client",
    sendingInfo: "📤 Envoyé au signataire juste après la signature électronique d'une convention",
    subject: same("Confirmation de signature - Convention {{formation_name}}"),
    content: same(`Bonjour {{signer_name}},

Nous confirmons la bonne réception de votre signature électronique pour la convention de formation suivante :

{{details_list}}

Vous pouvez consulter la convention signée en cliquant sur le lien ci-dessous :

{{download_button}}`),
    variables: ["signer_name", "formation_name", "details_list", "download_button"],
  },

  devis_signature_confirmation: {
    name: "Confirmation de signature de devis",
    audience: "client",
    sendingInfo: "📤 Envoyé au signataire juste après la signature électronique d'un devis",
    subject: same("Confirmation de signature - Devis \"{{formation_name}}\""),
    content: same(`Bonjour {{signer_name}},

Nous confirmons la bonne réception de votre signature électronique pour le devis suivant :

{{details_list}}

Vous pouvez consulter le devis signé en cliquant sur le lien ci-dessous :

{{download_button}}

{{opportunity_block}}`),
    variables: ["signer_name", "formation_name", "details_list", "download_button", "opportunity_block"],
  },

  location_signature_confirmation: {
    name: "Confirmation de signature de contrat de location",
    audience: "client",
    sendingInfo: "📤 Envoyé au signataire juste après la signature électronique d'un contrat de location",
    subject: same("Confirmation de signature — Contrat {{contrat_reference}}"),
    content: same(`Bonjour {{signer_name}},

Nous confirmons la bonne réception de votre signature électronique pour le contrat de location suivant :

{{details_list}}

{{download_button}}`),
    variables: ["signer_name", "contrat_reference", "details_list", "download_button"],
  },
};
