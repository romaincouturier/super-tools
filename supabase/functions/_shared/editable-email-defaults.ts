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

  attendance_signed_trainer: {
    name: "Émargement reçu (formateur)",
    audience: "internal",
    sendingInfo: "🔔 Envoyé au formateur après chaque signature d'émargement d'un participant",
    subject: same("{{#all_signed}}🎉 Tous les émargements reçus{{/all_signed}}{{#some_pending}}✍️ {{signed_count}}/{{total_count}} émargements reçus{{/some_pending}} – {{training_name}} – {{session_date}} {{period_label}}"),
    content: same(`Bonjour {{trainer_first_name}},

**{{participant_name}}** vient de signer sa feuille d'émargement pour la formation **{{training_name}}**.

📅 **Date :** {{session_date}} – {{period_label}}

{{status_block}}`),
    variables: ["trainer_first_name", "participant_name", "training_name", "session_date", "period_label", "all_signed", "some_pending", "signed_count", "total_count", "status_block"],
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

  event_reminder: {
    name: "Rappel d'évènement (veille et jour J)",
    audience: "internal",
    sendingInfo: "⏰ Envoyé automatiquement la veille et le jour d'un évènement à son organisateur",
    subject: same("📅 {{#is_today}}Aujourd'hui{{/is_today}}{{#is_tomorrow}}Demain{{/is_tomorrow}} : {{event_title}}"),
    content: same(`Bonjour{{#first_name}} {{first_name}}{{/first_name}},

**{{#is_today}}C'est aujourd'hui !{{/is_today}}{{#is_tomorrow}}C'est demain !{{/is_tomorrow}}** Voici le récapitulatif de ton évènement :

{{event_details}}

{{open_button}}`),
    variables: ["first_name", "event_title", "is_today", "is_tomorrow", "event_details", "open_button"],
  },

  event_share: {
    name: "Partage d'évènement",
    audience: "internal",
    sendingInfo: "📤 Envoyé quand un évènement est partagé depuis SuperTools",
    subject: same("📌 Événement partagé : {{event_title}}"),
    content: same(`Bonjour{{#recipient_name}} {{recipient_name}}{{/recipient_name}},

{{sender_name}} souhaite partager un événement avec toi :

{{event_details}}

{{images_preview}}

{{event_button}}

Cet email a été envoyé depuis SuperTools.`),
    variables: ["recipient_name", "sender_name", "event_title", "event_details", "images_preview", "event_button"],
  },

  event_update: {
    name: "Modification d'un évènement partagé",
    audience: "internal",
    sendingInfo: "📤 Envoyé aux destinataires d'un partage quand l'évènement est modifié",
    subject: same("🔄 Événement modifié : {{event_title}}"),
    content: same(`Bonjour{{#recipient_name}} {{recipient_name}}{{/recipient_name}},

{{sender_name}} a modifié l'événement **{{event_title}}** qui avait été partagé avec toi. Voici ce qui a changé :

{{changes_table}}

{{event_button}}

Cet email a été envoyé depuis SuperTools.`),
    variables: ["recipient_name", "sender_name", "event_title", "changes_table", "event_button"],
  },

  venue_booking_request: {
    name: "Demande de réservation de salle",
    audience: "client",
    sendingInfo: "📤 Envoyé manuellement au lieu de formation depuis la fiche session",
    subject: same("Demande de réservation de salle — {{training_name}}"),
    content: {
      tu: `Bonjour,

Je me permets de te contacter afin de te soumettre une demande de réservation de salle pour une session de formation.

Nous souhaiterions réserver {{room_ref}} pour la formation **{{training_name}}** aux dates et horaires suivants :

{{schedule_list}}

Est-ce possible ? Merci beaucoup et bonne journée.`,
      vous: `Bonjour,

Je me permets de vous contacter afin de vous soumettre une demande de réservation de salle pour une session de formation.

Nous souhaiterions réserver {{room_ref}} pour la formation **{{training_name}}** aux dates et horaires suivants :

{{schedule_list}}

Est-ce possible ? Merci beaucoup et bonne journée.`,
    },
    variables: ["training_name", "room_ref", "schedule_list"],
  },

  participant_list_reminder: {
    name: "Alerte formation sans participant",
    audience: "internal",
    sendingInfo: "⏰ Envoyé au formateur tous les 2 jours ouvrés tant qu'aucun participant n'est inscrit",
    subject: same("⚠️ Alerte : aucun participant pour « {{training_name}} » (J-{{days_remaining}})"),
    content: same(`Bonjour {{trainer_first_name}},

Petit rappel amical 😊 — la formation **« {{training_name}} »** pour **{{client_name}}** démarre le **{{start_date}}** (dans {{days_remaining}} jours) et **aucun participant n'est encore inscrit**.

Il serait bon de :
- 🔍 Relancer le client pour obtenir la liste des participants
- 📋 Vérifier si la formation est toujours maintenue
- ❌ Envisager une annulation si aucun retour ne vient

{{training_table}}

Ce message est envoyé automatiquement tous les 2 jours ouvrés tant qu'aucun participant n'est ajouté.

Bonne journée ! 🚀`),
    variables: ["trainer_first_name", "training_name", "client_name", "start_date", "days_remaining", "training_table"],
  },

  game_devis: {
    name: "Envoi du devis jeux",
    audience: "client",
    sendingInfo: "📤 Envoyé au commanditaire avec le PDF du devis jeux en pièce jointe",
    subject: same("Votre devis jeux — {{client_name}}"),
    content: same(`Bonjour {{recipient_name}},

Veuillez trouver ci-joint votre devis pour les jeux suivants :

{{items_list}}

{{#note}}*{{note}}*{{/note}}

N'hésitez pas à nous contacter pour toute question.

À très bientôt,`),
    variables: ["recipient_name", "client_name", "items_list", "note"],
  },

  trainer_evaluation_request: {
    name: "Demande de retour au formateur",
    audience: "client",
    sendingInfo: "📤 Envoyé au formateur à la fin de la session pour recueillir son retour",
    subject: same("Votre retour – {{training_name}}{{#client_name}} ({{client_name}}){{/client_name}}{{#date_line}} – {{date_line}}{{/date_line}}"),
    content: same(`Bonjour {{trainer_name}},

La formation « **{{training_name}}** »{{#client_name}} pour **{{client_name}}**{{/client_name}}{{#date_line}} ({{date_line}}){{/date_line}} est maintenant terminée.

Merci de prendre quelques minutes pour donner votre retour sur cette session en cliquant sur le lien ci-dessous :

{{evaluation_button}}

Ce formulaire prend environ 2 minutes.

Merci,
L'équipe SuperTilt`),
    variables: ["trainer_name", "training_name", "client_name", "date_line", "evaluation_button"],
  },

  mission_page_comment: {
    name: "Nouveau commentaire sur une page de mission",
    audience: "client",
    sendingInfo: "📤 Envoyé au consultant et aux participants du fil quand un commentaire est publié",
    subject: same("Nouveau commentaire sur « {{page_title}} » - {{mission_title}}"),
    content: same(`**{{author_name}}** a commenté la page « {{page_title}} » de la mission « {{mission_title}} ».

{{comment_block}}

{{reply_button}}`),
    variables: ["author_name", "page_title", "mission_title", "comment_block", "reply_button"],
  },

  certificate_participant: {
    name: "Certificat de réalisation (participant)",
    audience: "client",
    sendingInfo: "📤 Envoyé au participant avec son certificat en pièce jointe",
    subject: {
      tu: "Ton certificat de réalisation pour la formation {{training_name}}",
      vous: "Ton certificat de réalisation pour la formation {{training_name}}",
    },
    content: same(`Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu trouveras en pièce jointe ton certificat de réalisation pour la formation {{training_name}}.

Je te souhaite de bien exploiter tout ce que tu as vu pendant la formation !

{{resources_links}}

Bonne continuation et à bientôt !`),
    variables: ["first_name", "training_name", "resources_links"],
  },

  certificate_admin_copy: {
    name: "Copie du certificat (interne)",
    audience: "internal",
    sendingInfo: "📤 Copie envoyée en interne à chaque envoi de certificat",
    subject: same("[Copie] Certificat envoyé à {{participant_name}} - {{training_name}}"),
    content: same(`**Certificat envoyé**

Le certificat de formation a été envoyé à **{{participant_name}}** ({{participant_email}}).

**Formation :** {{training_name}}

Une copie du certificat est jointe à cet email.`),
    variables: ["participant_name", "participant_email", "training_name"],
  },

  certificate_sponsor_single: {
    name: "Certificat au commanditaire (un participant)",
    audience: "client",
    sendingInfo: "📤 Envoyé au commanditaire avec le certificat en pièce jointe",
    subject: same("Certificat de réalisation - Formation {{training_name}}"),
    content: same(`Bonjour,

Veuillez trouver ci-joint le certificat de réalisation pour la formation **{{training_name}}**.

Cordialement,`),
    variables: ["training_name"],
  },

  certificate_sponsor_zip: {
    name: "Certificats au commanditaire (archive)",
    audience: "client",
    sendingInfo: "📤 Envoyé au commanditaire avec l'archive ZIP des certificats",
    subject: same("Certificats de réalisation - Formation {{training_name}}"),
    content: same(`Bonjour,

Veuillez trouver ci-joint l'ensemble des certificats de réalisation pour la formation **{{training_name}}**.

Cette archive contient {{certificate_count}} certificat(s).

Cordialement,`),
    variables: ["training_name", "certificate_count"],
  },

  form_error_alert: {
    name: "Erreur de chargement d'un formulaire",
    audience: "internal",
    sendingInfo: "🚨 Envoyé en interne quand un participant n'arrive pas à ouvrir un formulaire",
    subject: same("🚨 Erreur formulaire {{form_label}}"),
    content: same(`**🚨 Erreur de chargement de formulaire**

Un participant a rencontré une erreur en tentant d'accéder à un formulaire public.

{{error_details}}

Cela peut indiquer :
- Un lien invalide ou expiré envoyé au participant
- Un participant supprimé de la formation
- Un problème technique temporaire

Cet email a été envoyé automatiquement par SuperTools.`),
    variables: ["form_label", "error_details"],
  },

  security_alert_unauthorized: {
    name: "Alerte sécurité : email inconnu",
    audience: "internal",
    sendingInfo: "🚫 Envoyé quand quelqu'un tente de se connecter avec un email inconnu (max 1 par heure)",
    subject: same("🚫 Alerte sécurité SuperTools - Tentative de connexion non autorisée"),
    content: same(`**🚫 Tentative de connexion non autorisée**

**Une tentative de connexion a été détectée avec un email qui n'existe pas dans le système.**

{{attempt_details}}

Cet email **n'appartient à aucun utilisateur enregistré** dans SuperTools. Cela peut indiquer :
- Une tentative d'intrusion par un tiers
- Un utilisateur qui utilise un mauvais email

Si les tentatives persistent depuis la même IP, pensez à bloquer cette adresse.

Cet email a été envoyé automatiquement par le système de sécurité SuperTools.
L'adresse IP a été partiellement masquée pour votre sécurité.
Les alertes pour un même email inconnu sont limitées à une par heure.

--
**SuperTools**
Supertilt`),
    variables: ["attempt_details"],
  },

  security_alert_bruteforce: {
    name: "Alerte sécurité : échecs de connexion répétés",
    audience: "internal",
    sendingInfo: "⚠️ Envoyé quand un compte cumule des échecs de connexion en 15 minutes",
    subject: same("⚠️ Alerte sécurité SuperTools - Tentatives de connexion suspectes"),
    content: same(`**⚠️ Alerte Sécurité**

**{{attempt_count}} tentatives de connexion échouées détectées**

{{attempt_details}}

Si ce n'était pas vous, nous vous recommandons de :
- Changer votre mot de passe immédiatement
- Vérifier qu'aucune activité suspecte n'a eu lieu sur votre compte

Cet email a été envoyé automatiquement par le système de sécurité SuperTools.
L'adresse IP a été partiellement masquée pour votre sécurité.

--
**SuperTools**
Supertilt`),
    variables: ["attempt_count", "attempt_details"],
  },

  support_purge_summary: {
    name: "Synthèse de purge des tickets support",
    audience: "internal",
    sendingInfo: "🧹 Envoyé chaque semaine après l'archivage des tickets résolus",
    subject: same("🧹 Purge support — {{archived_count}} ticket(s) archivé(s)"),
    content: same(`Synthèse hebdomadaire de la purge des tickets support — {{date}}.

{{purge_summary}}

{{tickets_table}}

{{user_summary}}

{{support_button}}`),
    variables: ["date", "archived_count", "purge_summary", "tickets_table", "user_summary", "support_button"],
  },

  convention_missing_alert: {
    name: "Alerte conventions manquantes",
    audience: "internal",
    sendingInfo: "🚨 Contrôle quotidien à 6h00 des conventions des formations à venir",
    subject: same("🚨 URGENT — {{count}} convention{{plural_s}} manquante{{plural_s}} pour des formations à venir"),
    content: same(`{{count}} formation{{plural_s}} à venir {{verb}} une action sur la convention :

{{conventions_table}}

Ce contrôle est effectué automatiquement chaque jour à 6h00.`),
    variables: ["count", "plural_s", "verb", "conventions_table"],
  },

  session_full_notification: {
    name: "Session complète",
    audience: "internal",
    sendingInfo: "🎉 Envoyé au responsable communication quand une session atteint sa capacité maximale",
    subject: same("🎉 Session complète — {{training_name}} ({{start_date}})"),
    content: same(`Bonjour{{#first_name}} {{first_name}}{{/first_name}},

La formation **{{training_name}}** a atteint son nombre maximum de participants.

{{session_table}}

Tu peux maintenant préparer la communication pour cette session.`),
    variables: ["first_name", "training_name", "start_date", "session_table"],
  },

  survey_response_notification: {
    name: "Nouvelle réponse à un sondage de mission",
    audience: "internal",
    sendingInfo: "📝 Envoyé au responsable quand quelqu'un répond à un sondage de mission",
    subject: same("📝 Nouvelle réponse au sondage « {{survey_title}} »"),
    content: same(`Bonjour,

**{{respondent}}** vient de répondre à votre sondage **« {{survey_title}} »**.

{{results_button}}

À bientôt,
L'équipe SuperTilt`),
    variables: ["respondent", "survey_title", "results_button"],
  },

  watch_tag_notification: {
    name: "Tag sur un élément de veille",
    audience: "internal",
    sendingInfo: "🏷️ Envoyé quand un collaborateur est tagué sur un élément de veille",
    subject: same("Tu es tagué sur « {{item_title}} »"),
    content: same(`Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Tu as été tagué(e) sur un élément de veille : **{{item_title}}**.

{{watch_link}}`),
    variables: ["first_name", "item_title", "watch_link"],
  },

  action_reminder: {
    name: "Rappel d'action à réaliser",
    audience: "internal",
    sendingInfo: "🔔 Envoyé à la personne assignée à une action de formation",
    subject: same("🔔 Rappel : {{action_short}}"),
    content: same(`Bonjour{{#recipient_name}} {{recipient_name}}{{/recipient_name}},

Tu as une action à réaliser dans le cadre de la formation **{{training_name}}** :

{{action_box}}

Merci de traiter cette action dès que possible.

{{training_button}}`),
    variables: ["recipient_name", "training_name", "action_short", "action_box", "training_button"],
  },

  content_review_requested: {
    name: "Contenu : demande de relecture",
    audience: "internal",
    sendingInfo: "🔍 Envoyé au relecteur quand une relecture de contenu lui est demandée",
    subject: same("🔍 Nouvelle demande de relecture : {{card_title}}"),
    content: same(`Bonjour,

Tu as reçu une demande de relecture pour le contenu :

{{card_box}}

{{external_link}}

{{card_button}}`),
    variables: ["card_title", "card_box", "external_link", "card_button"],
  },

  content_review_reminder: {
    name: "Contenu : rappel de relecture",
    audience: "internal",
    sendingInfo: "🔔 Envoyé au relecteur quand une relecture est toujours en attente",
    subject: same("🔔 Rappel — relecture attendue : {{card_title}}"),
    content: same(`Bonjour,

Petit rappel courtois : une relecture est toujours en attente sur :

{{card_box}}

Si tu es disponible, merci de traiter cette relecture dès que possible. Si ce n'est pas le bon moment, un simple retour (même bref) nous aide à nous organiser.

{{card_button}}`),
    variables: ["card_title", "card_box", "card_button"],
  },

  content_comment_added: {
    name: "Contenu : nouveau commentaire",
    audience: "internal",
    sendingInfo: "💬 Envoyé quand un commentaire est ajouté sur une relecture",
    subject: same("💬 Nouveau commentaire sur : {{card_title}}"),
    content: same(`Bonjour,

Un nouveau commentaire a été ajouté sur la relecture :

{{card_box}}

{{card_button}}`),
    variables: ["card_title", "card_box", "card_button"],
  },

  content_review_status_changed: {
    name: "Contenu : statut de relecture modifié",
    audience: "internal",
    sendingInfo: "✅ Envoyé quand le statut d'une relecture change",
    subject: same("✅ Statut de relecture modifié : {{card_title}}"),
    content: same(`Bonjour,

Le statut de la relecture a été mis à jour pour :

{{card_box}}

{{card_button}}`),
    variables: ["card_title", "card_box", "card_button"],
  },

  content_mention: {
    name: "Contenu : mention dans un commentaire",
    audience: "internal",
    sendingInfo: "💬 Envoyé quand quelqu'un est mentionné dans un commentaire de contenu",
    subject: same("💬 {{author_subject}} vous a mentionné — {{card_title}}"),
    content: same(`Bonjour,

**{{author_name}}** vous a mentionné dans un commentaire sur :

{{card_box}}

{{comment_quote}}

{{card_button}}`),
    variables: ["author_name", "author_subject", "card_title", "card_box", "comment_quote", "card_button"],
  },

  deposit_trainer_notification: {
    name: "Publication communauté (formateur)",
    audience: "internal",
    sendingInfo: "📚 Envoyé au formateur quand un apprenant publie un travail (regroupé sur 5 min)",
    subject: same("Nouvelle publication communauté — {{course_title}}"),
    content: same(`Bonjour{{#first_name}} {{first_name}}{{/first_name}},

**{{learner_name}}** vient de publier un travail dans la communauté de la formation **{{course_title}}**.

{{deposits_preview}}

« J'aime » enregistre votre réaction directement, sans vous reconnecter.

Bonne lecture,
L'équipe SuperTilt`),
    variables: ["first_name", "learner_name", "course_title", "deposits_preview"],
  },

  deposit_trainer_notification_multi: {
    name: "Publications communauté groupées (formateur)",
    audience: "internal",
    sendingInfo: "📚 Envoyé au formateur quand un apprenant publie plusieurs travaux en 5 min",
    subject: same("{{count}} nouvelles publications communauté — {{course_title}}"),
    content: same(`Bonjour{{#first_name}} {{first_name}}{{/first_name}},

**{{learner_name}}** vient de publier **{{count}} travaux** dans la communauté de la formation **{{course_title}}**.

{{deposits_preview}}

« J'aime » enregistre votre réaction directement, sans vous reconnecter.

Bonne lecture,
L'équipe SuperTilt`),
    variables: ["first_name", "learner_name", "course_title", "count", "deposits_preview"],
  },

  onboard_collaborator: {
    name: "Bienvenue collaborateur",
    audience: "internal",
    sendingInfo: "👋 Envoyé à un nouveau collaborateur avec ses identifiants temporaires",
    subject: same("Bienvenue sur SuperTools - Vos identifiants de connexion"),
    content: same(`**Bienvenue sur SuperTools !**

SuperTools est l'outil interne de Supertilt pour gérer les formations, évaluations et contenus marketing.

{{app_link}}

**Vos identifiants de connexion**

{{credentials}}

**Vos accès**

Vous avez accès aux modules suivants :

{{modules_list}}

{{login_button}}

Le nouveau mot de passe doit respecter les critères suivants :
- Au moins 8 caractères
- Au moins une lettre majuscule
- Au moins une lettre minuscule
- Au moins un chiffre
- Au moins un caractère spécial (!@#$%^&*)

À bientôt sur SuperTools !

--
**{{sender_name}}**
Supertilt`),
    variables: ["sender_name", "app_link", "credentials", "modules_list", "login_button"],
  },

  learner_email_changed: {
    name: "Nouvelle adresse de connexion apprenant",
    audience: "client",
    sendingInfo: "📤 Envoyé à la nouvelle adresse quand l'email d'un apprenant est modifié",
    subject: same("Votre nouvelle adresse de connexion"),
    content: same(`Bonjour,

L'adresse de votre espace apprenant est désormais **{{new_email}}**. Vos formations et votre progression sont inchangées.

{{login_link}}

Vous n'avez pas de mot de passe à créer : indiquez votre adresse, nous vous enverrons un lien de connexion.`),
    variables: ["new_email", "login_link"],
  },

  learner_email_changed_notice: {
    name: "Alerte changement d'adresse apprenant",
    audience: "client",
    sendingInfo: "📤 Envoyé à l'ancienne adresse quand l'email d'un apprenant est modifié",
    subject: same("L'adresse de votre compte a été modifiée"),
    content: same(`Bonjour,

L'adresse de connexion de votre espace apprenant a été remplacée par **{{masked_email}}**. Les liens envoyés à cette ancienne adresse ne fonctionnent plus.

Si vous n'êtes pas à l'origine de ce changement, écrivez-nous immédiatement à {{contact_link}}.`),
    variables: ["masked_email", "contact_email", "contact_link"],
  },

  support_new_ticket: {
    name: "Support : nouveau ticket",
    audience: "internal",
    sendingInfo: "🎫 Envoyé en interne à chaque nouveau ticket de support",
    subject: same("🎫 Nouveau ticket {{ticket_number}} — {{ticket_title}}"),
    content: same(`Un nouveau ticket de support a été soumis.

{{ticket_box}}

{{ticket_details}}

{{ticket_button}}`),
    variables: ["ticket_number", "ticket_title", "ticket_box", "ticket_details", "ticket_button"],
  },

  support_new_ticket_copy: {
    name: "Support : copie du signalement",
    audience: "internal",
    sendingInfo: "🎫 Envoyé à la personne qui crée un ticket, pour son suivi",
    subject: same("{{ticket_number}} — Confirmation de votre signalement « {{ticket_title}} »"),
    content: same(`Bonjour,

Nous avons bien reçu votre signalement. Vous trouverez ci-dessous une copie des informations transmises pour votre suivi.

{{ticket_box}}

{{ticket_details}}

Vous pouvez retrouver l'ensemble de vos signalements dans l'onglet « Mes tickets » de l'assistant Supertilt.

{{tickets_button}}`),
    variables: ["ticket_number", "ticket_title", "ticket_box", "ticket_details", "tickets_button"],
  },

  support_discussion_request: {
    name: "Support : proposition d'échange",
    audience: "internal",
    sendingInfo: "🎫 Envoyé pour proposer un échange de vive voix sur un ticket",
    subject: same("{{ticket_number}} — Échangeons de vive voix sur ta demande « {{ticket_title}} »"),
    content: same(`Bonjour,

Merci pour ta demande de support. Pour bien comprendre ton besoin et te proposer la meilleure solution, j'aimerais qu'on prenne quelques minutes pour en discuter de vive voix.

{{ticket_box}}

{{ticket_description}}

Peux-tu me proposer un créneau qui te convient cette semaine ? Un simple mail en réponse avec 2 ou 3 disponibilités me permettra de bloquer un temps d'échange rapidement.

À très vite,

{{ticket_button}}`),
    variables: ["ticket_number", "ticket_title", "ticket_box", "ticket_description", "ticket_button"],
  },

  support_ticket_resolved: {
    name: "Support : ticket traité",
    audience: "internal",
    sendingInfo: "✅ Envoyé à la personne qui a créé le ticket quand il est résolu",
    subject: same("{{#module_prefix}}{{module_prefix}}{{/module_prefix}}{{ticket_number}} — Votre demande \"{{ticket_title}}\" a été traitée"),
    content: same(`Bonjour,

Votre demande de support a été traitée et son statut est maintenant : **{{status_label}}**.

{{ticket_box}}

{{resolution_notes}}

Si vous avez des questions, n'hésitez pas à créer un nouveau ticket de support.

{{ticket_button}}`),
    variables: ["module_prefix", "ticket_number", "ticket_title", "status_label", "ticket_box", "resolution_notes", "ticket_button"],
  },

  logistics_digest: {
    name: "Récapitulatif quotidien des alertes",
    audience: "internal",
    sendingInfo: "🔔 Envoyé chaque jour ouvré à chaque collaborateur ayant des alertes",
    subject: same("🔔 {{alert_count}} alerte{{plural_s}} — Récapitulatif quotidien"),
    content: same(`Bonjour {{first_name}},

{{alert_sections}}`),
    variables: ["first_name", "alert_count", "plural_s", "alert_sections"],
  },
};
