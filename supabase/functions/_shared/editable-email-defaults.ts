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
};
