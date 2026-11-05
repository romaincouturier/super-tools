/**
 * Human-readable documentation for the variables usable in email templates.
 * Used by the settings screen so a non-technical user understands each placeholder.
 */

export interface VariableDoc {
  /** Short human label */
  label: string;
  /** What the value contains and where it comes from */
  description: string;
  /** Example value used in the preview */
  sample: string;
  /** true when the value is HTML/a block (not a simple word) */
  isBlock?: boolean;
  /** true when the variable is meant to be used as a condition {{#var}}...{{/var}} */
  isCondition?: boolean;
}

export const VARIABLE_DOCS: Record<string, VariableDoc> = {
  // Personnes
  first_name: { label: "Prénom du destinataire", description: "Prénom de la personne qui reçoit le mail (participant, contact, apprenant).", sample: "Sophie" },
  recipient_name: { label: "Nom du destinataire", description: "Nom complet de la personne qui reçoit le mail.", sample: "Sophie Bergaglio" },
  participant_name: { label: "Nom du participant", description: "Nom complet du participant concerné par la formation.", sample: "Sophie Bergaglio" },
  client_name: { label: "Nom du client", description: "Nom du client ou de l'entreprise cliente.", sample: "Acme SAS" },
  sponsor_first_name: { label: "Prénom du commanditaire", description: "Prénom du responsable côté entreprise qui a commandé la formation.", sample: "Claire" },
  financeur_name: { label: "Nom du financeur", description: "Organisme qui finance la formation (OPCO, entreprise, particulier).", sample: "OPCO Atlas" },
  sender_email: { label: "Email de l'expéditeur", description: "Adresse d'envoi configurée dans les paramètres.", sample: "contact@supertilt.fr" },
  greeting: { label: "Formule d'appel", description: "Salutation calculée automatiquement selon le tutoiement/vouvoiement et le prénom.", sample: "Bonjour Sophie" },
  date_reclamation: { label: "Date de la réclamation", description: "Date à laquelle la réclamation a été enregistrée, en toutes lettres.", sample: "5 novembre 2026" },

  // Formation
  training_name: { label: "Nom de la formation", description: "Intitulé de la session de formation.", sample: "Facilitation graphique - niveau 1" },
  formation_name: { label: "Nom de la formation", description: "Intitulé de la formation (même valeur que training_name selon le modèle).", sample: "Facilitation graphique - niveau 1" },
  progression: { label: "Progression e-learning", description: "Pourcentage du parcours e-learning déjà réalisé par l'apprenant, sans le signe %.", sample: "45" },
  non_demarre: { label: "Si e-learning non démarré", description: "Condition vraie quand l'apprenant n'a encore ouvert aucune leçon.", sample: "", isCondition: true },
  en_cours: { label: "Si e-learning commencé", description: "Condition vraie quand l'apprenant a déjà commencé le parcours.", sample: "1", isCondition: true },
  forgot_password_link: { label: "Lien « mot de passe oublié »", description: "Lien vers la page de connexion préremplie, pour réinitialiser son mot de passe.", sample: "<a href=\"#\">Mot de passe oublié ?</a>", isBlock: true },
  access_button: { label: "Bouton d'accès à l'espace apprenant", description: "Bouton personnel qui ouvre l'espace apprenant (création du mot de passe si besoin).", sample: "<p><a href=\"#\">Accéder à ma formation</a></p>", isBlock: true },
  training_date: { label: "Date de la formation", description: "Date principale de la session, déjà formatée en français.", sample: "12 mars 2026" },
  training_dates: { label: "Dates de la formation", description: "Toutes les dates de la session, formatées et séparées par des virgules.", sample: "12 et 13 mars 2026" },
  training_schedule: { label: "Horaires détaillés", description: "Programme jour par jour avec les horaires (bloc de plusieurs lignes).", sample: "Jeudi 12 mars : 9h00 - 12h30 / 14h00 - 17h30", isBlock: true },
  training_location: { label: "Lieu de la formation", description: "Adresse ou modalité (visio) du lieu de formation.", sample: "12 rue de Paris, 75011 Paris" },
  location: { label: "Lieu", description: "Lieu de l'évènement ou de la session.", sample: "Paris 11e" },
  session_date: { label: "Date de la session", description: "Date de la session concernée, formatée en français.", sample: "12 mars 2026" },
  start_date: { label: "Date de début", description: "Date de début de la formation ou de la période.", sample: "12 mars 2026" },
  end_date: { label: "Date de fin", description: "Date de fin de la formation ou de la période.", sample: "13 mars 2026" },
  deadline_date: { label: "Date limite", description: "Échéance à respecter par le destinataire.", sample: "5 mars 2026" },
  days_until: { label: "Nombre de jours restants", description: "Nombre de jours avant l'échéance ou le démarrage.", sample: "7" },
  format_specific_content: { label: "Paragraphe selon le format", description: "Texte inséré automatiquement selon le format (présentiel, visio, e-learning).", sample: "La formation se déroule en visioconférence.", isBlock: true },
  prereq_list: { label: "Liste des prérequis", description: "Liste à puces des prérequis manquants.", sample: "- Installer Zoom\n- Prévoir des feutres", isBlock: true },
  participants_list: { label: "Liste des participants", description: "Liste des participants inscrits à la session.", sample: "- Sophie Bergaglio\n- Marc Dupont", isBlock: true },
  accessibility_needs: { label: "Besoins d'accessibilité", description: "Besoins signalés par le participant lors de son inscription.", sample: "Salle accessible PMR", isBlock: true },
  booking_items: { label: "Créneaux réservés", description: "Liste des créneaux de coaching réservés.", sample: "- Mardi 10 mars à 14h00", isBlock: true },
  survey_stats: { label: "Statistiques du questionnaire", description: "Synthèse des réponses au recueil des besoins.", sample: "8 réponses sur 10", isBlock: true },
  calendar_section: { label: "Bloc agenda", description: "Bloc HTML avec les liens d'ajout à l'agenda. Généré automatiquement.", sample: "", isBlock: true },
  extra_html: { label: "Contenu additionnel", description: "Bloc HTML complémentaire ajouté par la fonction d'envoi.", sample: "", isBlock: true },
  devis_description: { label: "Description du devis", description: "Récapitulatif du devis (formation, formule, montant).", sample: "Facilitation graphique - niveau 1, 2 jours, 1 200 EUR", isBlock: true },

  // Live / évènements
  live_title: { label: "Titre du live", description: "Intitulé de la classe virtuelle.", sample: "Live #32 : les bases du lettrage" },
  live_date: { label: "Date du live", description: "Date de la classe virtuelle.", sample: "12 mars 2026" },
  live_time: { label: "Heure du live", description: "Heure de début de la classe virtuelle.", sample: "18h00" },
  meeting_url: { label: "Lien de la visio", description: "URL de connexion à la visioconférence.", sample: "https://meet.google.com/abc-defg-hij" },
  mission_title: { label: "Titre de la mission", description: "Intitulé de la mission concernée.", sample: "Refonte du parcours client" },
  entity_name: { label: "Nom de l'élément", description: "Nom de l'objet concerné (formation, mission, évènement).", sample: "Facilitation graphique - niveau 1" },
  entity_type: { label: "Type d'élément", description: "Type de l'objet concerné (formation, mission, évènement).", sample: "formation" },
  ai_summary: { label: "Synthèse IA", description: "Résumé généré automatiquement par l'IA.", sample: "Les participants souhaitent travailler sur la prise de notes visuelle.", isBlock: true },

  // Liens
  access_link: { label: "Lien d'accès", description: "Lien personnel d'accès à la plateforme ou à la formation. Unique par destinataire.", sample: "https://academy.supertilt.fr/acces/exemple" },
  evaluation_link: { label: "Lien d'évaluation", description: "Lien vers le questionnaire d'évaluation à chaud ou à froid.", sample: "https://academy.supertilt.fr/evaluation/exemple" },
  questionnaire_link: { label: "Lien du questionnaire", description: "Lien vers le recueil des besoins.", sample: "https://academy.supertilt.fr/questionnaire/exemple" },
  signature_link: { label: "Lien de signature", description: "Lien vers la feuille d'émargement à signer.", sample: "https://academy.supertilt.fr/emargement/exemple" },
  deliverables_link: { label: "Lien des livrables", description: "Lien vers la page des livrables partagés.", sample: "https://academy.supertilt.fr/livrables/exemple" },
  programme_link: { label: "Lien du programme", description: "Lien vers le programme détaillé de la formation.", sample: "https://academy.supertilt.fr/programme/exemple" },
  supports_url: { label: "Lien des supports", description: "Lien vers les supports de formation.", sample: "https://academy.supertilt.fr/supports/exemple" },
  elearning_url: { label: "Lien du contenu e-learning", description: "Lien personnel vers le contenu en ligne rattaché à la formation.", sample: "https://academy.supertilt.fr/formation-support/exemple" },
  elearning_button: { label: "Bouton du contenu e-learning", description: "Bouton cliquable menant au contenu en ligne, mis en forme automatiquement.", sample: "Accéder au contenu en ligne", isBlock: true },
  google_review_link: { label: "Lien avis Google", description: "Lien pour déposer un avis Google.", sample: "https://g.page/r/exemple/review" },
  financeur_url: { label: "Lien du financeur", description: "Page d'information de l'organisme financeur.", sample: "https://www.opco-atlas.fr" },
  site_url: { label: "Site web", description: "Adresse du site public.", sample: "https://supertilt.fr" },
  website_url: { label: "Site web", description: "Adresse du site public.", sample: "https://supertilt.fr" },
  blog_url: { label: "Lien du blog", description: "Adresse du blog.", sample: "https://supertilt.fr/blog" },
  youtube_url: { label: "Chaîne YouTube", description: "Adresse de la chaîne YouTube.", sample: "https://youtube.com/@supertilt" },

  // Conditions
  no_date: { label: "Dates non fixées ?", description: "Condition : vraie lorsqu'aucune date réelle de session n'est définie, y compris pour une formation e-learning sur une période sans planning précis. À utiliser sous la forme {{#no_date}}...{{/no_date}}.", sample: "oui", isCondition: true },
  has_certificates: { label: "Certificats joints ?", description: "Condition : vraie si des certificats sont joints au mail. À utiliser sous la forme {{#has_certificates}}...{{/has_certificates}}.", sample: "oui", isCondition: true },
  has_invoice: { label: "Facture jointe ?", description: "Condition : vraie si une facture est jointe. À utiliser sous la forme {{#has_invoice}}...{{/has_invoice}}.", sample: "oui", isCondition: true },
  has_sheets: { label: "Feuilles jointes ?", description: "Condition : vraie si des feuilles d'émargement sont jointes.", sample: "oui", isCondition: true },

  // Modèles éditables (emails automatiques)
  signer_name: { label: "Nom du signataire", description: "Nom de la personne qui a signé (ou doit signer) le document.", sample: "Claire Martin" },
  trainer_first_name: { label: "Prénom du formateur", description: "Prénom du formateur destinataire du mail.", sample: "Romain" },
  trainer_name: { label: "Nom du formateur", description: "Nom complet du formateur concerné.", sample: "Romain Couturier" },
  learner_name: { label: "Nom de l'apprenant", description: "Nom de l'apprenant concerné par la notification e-learning.", sample: "Sophie Bergaglio" },
  learner_email: { label: "Email de l'apprenant", description: "Adresse email de l'apprenant concerné.", sample: "sophie@example.com" },
  participant_email: { label: "Email du participant", description: "Adresse email du participant à qui le document a été envoyé.", sample: "sophie@example.com" },
  author_name: { label: "Auteur du commentaire", description: "Nom de la personne qui a écrit le commentaire.", sample: "Claire Martin" },
  author_subject: { label: "Auteur (objet du mail)", description: "Nom de l'auteur, tel qu'affiché dans l'objet du mail.", sample: "Claire" },
  commenter_name: { label: "Auteur du commentaire", description: "Nom de la personne qui a commenté dans la communauté.", sample: "Claire Martin" },
  sender_name: { label: "Expéditeur", description: "Nom de la personne qui partage ou envoie l'information.", sample: "Romain Couturier" },
  respondent: { label: "Répondant", description: "Nom ou adresse de la personne qui a répondu au sondage.", sample: "Claire Martin" },
  contact_email: { label: "Email de contact", description: "Adresse de contact de l'organisme.", sample: "contact@supertilt.fr" },
  masked_email: { label: "Adresse masquée", description: "Nouvelle adresse de connexion, partiellement masquée.", sample: "s***@example.com" },
  new_email: { label: "Nouvelle adresse", description: "Nouvelle adresse de connexion de l'espace apprenant.", sample: "sophie@example.com" },
  course_title: { label: "Titre du cours e-learning", description: "Nom du cours e-learning concerné.", sample: "Facilitation graphique" },
  lesson_title: { label: "Titre de la leçon", description: "Nom de la leçon e-learning concernée.", sample: "Les bases du lettrage" },
  card_title: { label: "Titre du contenu", description: "Titre de la carte du kanban éditorial.", sample: "Article : les métaphores en facilitation" },
  page_title: { label: "Titre de la page", description: "Titre de la page de mission commentée.", sample: "Compte rendu du séminaire" },
  item_title: { label: "Titre du contenu de veille", description: "Titre du contenu de veille sur lequel la personne est taguée.", sample: "Étude sur le multitâche" },
  event_title: { label: "Titre de l'événement", description: "Nom de l'événement concerné.", sample: "Salon de la formation" },
  survey_title: { label: "Titre du sondage", description: "Nom du sondage auquel une réponse a été reçue.", sample: "Bilan de la journée" },
  game_name: { label: "Nom du jeu", description: "Nom du jeu pédagogique loué.", sample: "Echo" },
  contrat_reference: { label: "Référence du contrat", description: "Référence du contrat de location.", sample: "LOC-2026-012" },
  form_label: { label: "Nom du formulaire", description: "Nom du formulaire en erreur.", sample: "Inscription formation" },
  action_short: { label: "Action (court)", description: "Intitulé court de l'action à faire, pour l'objet du mail.", sample: "Relancer le client" },
  ticket_number: { label: "Numéro du ticket", description: "Numéro du ticket support.", sample: "ST-2026-0042" },
  ticket_title: { label: "Titre du ticket", description: "Titre du ticket support.", sample: "Lien de connexion expiré" },
  ticket_description: { label: "Description du ticket", description: "Texte de la demande support.", sample: "Le lien reçu ne fonctionne plus." },
  resolution_notes: { label: "Notes de résolution", description: "Explication de la résolution du ticket.", sample: "Le lien a été renvoyé." },
  status_label: { label: "Statut", description: "Statut du ticket support.", sample: "Résolu" },
  module_prefix: { label: "Préfixe du module", description: "Préfixe ajouté à l'objet selon le module du ticket, s'il existe.", sample: "[LMS] " },
  room_ref: { label: "Salle", description: "Salle ou espace à réserver.", sample: "la salle Confluence" },
  note: { label: "Note", description: "Remarque facultative ajoutée au devis.", sample: "Livraison sous 5 jours" },
  date: { label: "Date", description: "Date du récapitulatif.", sample: "02/11/2026" },
  date_line: { label: "Date de la session", description: "Dates de la session, si elles sont connues.", sample: "12 et 13 mars 2026" },
  period_label: { label: "Demi-journée", description: "Matin ou après-midi de la session.", sample: "Matin" },
  time_range: { label: "Horaire", description: "Horaires de la demi-journée.", sample: "9h00 - 12h30" },
  expires_at: { label: "Date d'expiration", description: "Date jusqu'à laquelle le lien reste valable.", sample: "15/11/2026" },
  days_remaining: { label: "Jours restants", description: "Nombre de jours avant le début de la session.", sample: "7" },
  count: { label: "Nombre", description: "Nombre d'éléments concernés.", sample: "3" },
  total_count: { label: "Total", description: "Nombre total d'émargements attendus.", sample: "8" },
  signed_count: { label: "Émargements reçus", description: "Nombre d'émargements déjà reçus.", sample: "6" },
  signatures_sent: { label: "Demandes envoyées", description: "Nombre de demandes d'émargement envoyées.", sample: "8" },
  alert_count: { label: "Nombre d'alertes", description: "Nombre d'alertes du récapitulatif.", sample: "4" },
  archived_count: { label: "Tickets archivés", description: "Nombre de tickets archivés par la purge.", sample: "12" },
  attempt_count: { label: "Tentatives", description: "Nombre de tentatives de connexion échouées.", sample: "10" },
  certificate_count: { label: "Nombre de certificats", description: "Nombre de certificats contenus dans l'archive.", sample: "5" },
  plural_s: { label: "Marque du pluriel", description: "Vaut « s » quand le nombre est supérieur à 1, vide sinon.", sample: "s" },
  verb: { label: "Verbe accordé", description: "Verbe accordé au nombre (nécessite / nécessitent).", sample: "nécessitent" },
  training_url: { label: "Lien de la formation", description: "Adresse de la fiche formation.", sample: "https://supertools.app/formations/123" },
  contact_link: { label: "Lien de contact", description: "Lien vers l'adresse de contact de l'organisme.", sample: "contact@supertilt.fr" },
  action_box: { label: "Encadré de l'action", description: "Encadré avec le détail de l'action à faire.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  alert_sections: { label: "Sections d'alertes", description: "Liste des alertes du jour, regroupées par type.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  app_link: { label: "Lien de l'application", description: "Lien vers l'application SuperTools.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  attempt_details: { label: "Détail des tentatives", description: "Tableau des tentatives de connexion suspectes.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  card_box: { label: "Encadré du contenu", description: "Encadré résumant la carte du kanban éditorial.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  card_button: { label: "Bouton du contenu", description: "Bouton qui ouvre la carte du kanban éditorial.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  changes_table: { label: "Tableau des modifications", description: "Tableau des champs modifiés sur l'événement.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  comment_block: { label: "Bloc commentaire", description: "Commentaire mis en forme, avec son auteur.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  comment_quote: { label: "Citation du commentaire", description: "Texte du commentaire, mis en citation.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  community_button: { label: "Bouton communauté", description: "Bouton qui ouvre la communauté du cours.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  contact_button: { label: "Bouton de contact", description: "Bouton pour contacter les membres du groupe.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  conventions_table: { label: "Tableau des conventions", description: "Tableau des formations dont la convention manque.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  credentials: { label: "Identifiants", description: "Bloc avec l'adresse de connexion du collaborateur.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  deposits_preview: { label: "Aperçu des dépôts", description: "Aperçu des travaux déposés par l'apprenant.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  details_list: { label: "Détails du document", description: "Liste des informations du document signé.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  discussion_button: { label: "Bouton discussion", description: "Bouton qui ouvre la discussion.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  download_button: { label: "Bouton de téléchargement", description: "Bouton pour télécharger le document signé.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  error_details: { label: "Détail de l'erreur", description: "Détail technique de l'erreur du formulaire.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  evaluation_button: { label: "Bouton d'évaluation", description: "Bouton qui ouvre le questionnaire d'évaluation.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  event_button: { label: "Bouton de l'événement", description: "Bouton qui ouvre la fiche de l'événement.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  event_details: { label: "Détails de l'événement", description: "Date, lieu et informations pratiques de l'événement.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  external_link: { label: "Lien externe", description: "Lien vers le contenu à relire, hors SuperTools.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  feedback_button: { label: "Bouton du retour", description: "Bouton qui ouvre le retour du formateur.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  images_preview: { label: "Aperçu des images", description: "Images jointes à l'événement partagé.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  items_list: { label: "Liste des articles", description: "Tableau des jeux et quantités du devis.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  login_button: { label: "Bouton de connexion", description: "Bouton qui ouvre la page de connexion.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  login_link: { label: "Lien de connexion", description: "Lien vers la page de connexion de l'espace apprenant.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  members_list: { label: "Liste des membres", description: "Membres du groupe de pratique.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  message_button: { label: "Bouton message", description: "Bouton qui ouvre le message dans l'espace apprenant.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  modules_list: { label: "Liste des modules", description: "Modules SuperTools ouverts au collaborateur.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  open_button: { label: "Bouton d'ouverture", description: "Bouton qui ouvre l'élément concerné.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  opportunity_block: { label: "Bloc opportunité", description: "Encadré de l'opportunité CRM liée au devis.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  post_quote: { label: "Citation de la publication", description: "Texte de la publication, mis en citation.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  purge_summary: { label: "Résumé de la purge", description: "Résumé chiffré de la purge des tickets.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  reply_button: { label: "Bouton répondre", description: "Bouton pour répondre au commentaire.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  reset_button: { label: "Bouton de réinitialisation", description: "Bouton pour définir un nouveau mot de passe.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  resources_links: { label: "Liens des ressources", description: "Liens vers les ressources de la formation.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  results_button: { label: "Bouton des résultats", description: "Bouton qui ouvre les résultats du sondage.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  schedule_list: { label: "Planning", description: "Liste des dates et horaires à réserver.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  session_table: { label: "Tableau de la session", description: "Tableau récapitulatif de la session complète.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  signature_button: { label: "Bouton de signature", description: "Bouton qui ouvre la page de signature.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  status_block: { label: "Bloc de statut", description: "Liste des participants et de leur émargement.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  support_button: { label: "Bouton support", description: "Bouton qui ouvre le module support.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  ticket_box: { label: "Encadré du ticket", description: "Encadré résumant le ticket support.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  ticket_button: { label: "Bouton du ticket", description: "Bouton qui ouvre le ticket support.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  ticket_details: { label: "Détails du ticket", description: "Informations complètes du ticket support.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  tickets_button: { label: "Bouton des tickets", description: "Bouton qui ouvre la liste des tickets.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  tickets_table: { label: "Tableau des tickets", description: "Tableau des tickets archivés.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  training_button: { label: "Bouton de la formation", description: "Bouton qui ouvre la fiche formation.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  training_table: { label: "Tableau des formations", description: "Tableau des formations concernées.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  user_summary: { label: "Résumé par utilisateur", description: "Répartition des tickets par utilisateur.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  watch_link: { label: "Lien du contenu de veille", description: "Lien vers le contenu de veille.", sample: "<p><a href=\\\"#\\\">Ouvrir</a></p>", isBlock: true },
  all_signed: { label: "Tous émargés ?", description: "Condition vraie quand tous les participants ont émargé. À utiliser sous la forme {{#all_signed}}...{{/all_signed}}.", sample: "oui", isCondition: true },
  some_pending: { label: "Émargements en attente ?", description: "Condition vraie quand des émargements manquent encore. À utiliser sous la forme {{#some_pending}}...{{/some_pending}}.", sample: "oui", isCondition: true },
  is_today: { label: "Aujourd'hui ?", description: "Condition vraie quand l'événement a lieu aujourd'hui. À utiliser sous la forme {{#is_today}}...{{/is_today}}.", sample: "oui", isCondition: true },
  is_tomorrow: { label: "Demain ?", description: "Condition vraie quand l'événement a lieu demain. À utiliser sous la forme {{#is_tomorrow}}...{{/is_tomorrow}}.", sample: "oui", isCondition: true },
  platform_changed: { label: "Compte existant sans mot de passe ?", description: "Condition vraie quand l'apprenant avait déjà un compte mais n'a jamais créé de mot de passe (ancienne plateforme). À utiliser sous la forme {{#platform_changed}}...{{/platform_changed}}.", sample: "oui", isCondition: true },
  password_set: { label: "Mot de passe défini ?", description: "Condition vraie quand l'apprenant a déjà un mot de passe. À utiliser sous la forme {{#password_set}}...{{/password_set}}.", sample: "oui", isCondition: true },
  no_password: { label: "Sans mot de passe ?", description: "Condition vraie quand l'apprenant doit encore créer son mot de passe. À utiliser sous la forme {{#no_password}}...{{/no_password}}.", sample: "oui", isCondition: true },
};

/** Heuristic fallback for a variable that has no explicit documentation. */
export function guessVariableDoc(variable: string): VariableDoc {
  const v = variable.toLowerCase();
  const isCondition = v.startsWith("has_") || v.startsWith("is_");
  if (v.endsWith("_link") || v.endsWith("_url")) {
    return { label: "Lien", description: "URL insérée automatiquement lors de l'envoi.", sample: "https://academy.supertilt.fr/exemple" };
  }
  if (v.includes("email")) return { label: "Adresse email", description: "Adresse email insérée automatiquement.", sample: "sophie.exemple@gmail.com" };
  if (v.includes("date")) return { label: "Date", description: "Date formatée en français.", sample: "12 mars 2026" };
  if (v.includes("time") || v.includes("heure")) return { label: "Heure", description: "Heure formatée en français.", sample: "09h00" };
  if (v.includes("phone")) return { label: "Téléphone", description: "Numéro de téléphone.", sample: "06 12 34 56 78" };
  if (v.includes("price") || v.includes("amount") || v.includes("montant")) {
    return { label: "Montant", description: "Montant en euros.", sample: "1 200 EUR" };
  }
  if (v.includes("count") || v.includes("number") || v.startsWith("nb_")) {
    return { label: "Nombre", description: "Valeur numérique calculée automatiquement.", sample: "3" };
  }
  if (v.includes("list")) return { label: "Liste", description: "Liste générée automatiquement (plusieurs lignes).", sample: "- Élément 1\n- Élément 2", isBlock: true };
  if (v.includes("name")) return { label: "Nom", description: "Nom inséré automatiquement lors de l'envoi.", sample: "Sophie Bergaglio" };
  if (isCondition) {
    return { label: "Condition", description: "Condition vraie ou fausse. À utiliser sous la forme {{#" + variable + "}}...{{/" + variable + "}}.", sample: "oui", isCondition: true };
  }
  return { label: variable, description: "Valeur remplacée automatiquement lors de l'envoi.", sample: `Exemple ${variable}` };
}

export function getVariableDoc(variable: string): VariableDoc {
  return VARIABLE_DOCS[variable] ?? guessVariableDoc(variable);
}

/** Short explanation of the template syntax, shown to non-technical users. */
export const TEMPLATE_SYNTAX_HELP: { title: string; detail: string; example: string }[] = [
  {
    title: "Variable",
    detail: "Le texte entre doubles accolades est remplacé par la vraie valeur au moment de l'envoi.",
    example: "Bonjour {{first_name}},",
  },
  {
    title: "Bloc conditionnel",
    detail: "Le texte entre {{#variable}} et {{/variable}} n'apparaît que si la variable a une valeur.",
    example: "{{#has_invoice}}Vous trouverez la facture en pièce jointe.{{/has_invoice}}",
  },
  {
    title: "Paragraphes",
    detail: "Une ligne vide crée un nouveau paragraphe. Un simple retour à la ligne crée un retour chariot dans le même paragraphe.",
    example: "Première ligne\nSuite du paragraphe\n\nNouveau paragraphe",
  },
  {
    title: "Mise en gras",
    detail: "Encadrez un mot de deux astérisques pour le mettre en gras.",
    example: "La formation démarre le **12 mars**.",
  },
];
