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

  // Formation
  training_name: { label: "Nom de la formation", description: "Intitulé de la session de formation.", sample: "Facilitation graphique - niveau 1" },
  formation_name: { label: "Nom de la formation", description: "Intitulé de la formation (même valeur que training_name selon le modèle).", sample: "Facilitation graphique - niveau 1" },
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
  access_link: { label: "Lien d'accès", description: "Lien personnel d'accès à la plateforme ou à la formation. Unique par destinataire.", sample: "https://super-tools.lovable.app/acces/exemple" },
  evaluation_link: { label: "Lien d'évaluation", description: "Lien vers le questionnaire d'évaluation à chaud ou à froid.", sample: "https://super-tools.lovable.app/evaluation/exemple" },
  questionnaire_link: { label: "Lien du questionnaire", description: "Lien vers le recueil des besoins.", sample: "https://super-tools.lovable.app/questionnaire/exemple" },
  signature_link: { label: "Lien de signature", description: "Lien vers la feuille d'émargement à signer.", sample: "https://super-tools.lovable.app/emargement/exemple" },
  deliverables_link: { label: "Lien des livrables", description: "Lien vers la page des livrables partagés.", sample: "https://super-tools.lovable.app/livrables/exemple" },
  programme_link: { label: "Lien du programme", description: "Lien vers le programme détaillé de la formation.", sample: "https://super-tools.lovable.app/programme/exemple" },
  supports_url: { label: "Lien des supports", description: "Lien vers les supports de formation.", sample: "https://super-tools.lovable.app/supports/exemple" },
  elearning_url: { label: "Lien du contenu e-learning", description: "Lien personnel vers le contenu en ligne rattaché à la formation.", sample: "https://super-tools.lovable.app/formation-support/exemple" },
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
  // E-learning et communauté
  course_title: { label: "Titre du cours e-learning", description: "Intitulé du cours e-learning concerné.", sample: "Sketchnoting - les bases" },
  lesson_title: { label: "Titre de la leçon", description: "Intitulé de la leçon e-learning concernée.", sample: "Dessiner un personnage en 30 secondes" },
  learner_name: { label: "Nom de l'apprenant", description: "Nom complet de l'apprenant concerné.", sample: "Sophie Bergaglio" },
  learner_email: { label: "Email de l'apprenant", description: "Adresse email de l'apprenant concerné.", sample: "sophie@acme.fr" },
  access_button: { label: "Bouton d'accès à l'espace", description: "Bouton qui ouvre l'espace apprenant, avec un lien personnel.", sample: "[Accéder à ma formation]", isBlock: true },
  message_button: { label: "Bouton vers le message", description: "Bouton qui ouvre le message reçu dans l'espace apprenant.", sample: "[Lire le message]", isBlock: true },
  feedback_button: { label: "Bouton vers le retour", description: "Bouton qui ouvre le retour du formateur sur le travail déposé.", sample: "[Voir le retour]", isBlock: true },
  community_button: { label: "Bouton vers la communauté", description: "Bouton qui ouvre la discussion dans la communauté du cours.", sample: "[Voir dans la communauté]", isBlock: true },
  comment_block: { label: "Commentaire", description: "Texte du commentaire, mis en forme en encadré.", sample: "« Super exercice, merci ! »", isBlock: true },
  comment_quote: { label: "Citation du commentaire", description: "Extrait du commentaire, mis en forme en citation.", sample: "« J'adore cette approche »", isBlock: true },
  commenter_name: { label: "Auteur du commentaire", description: "Nom de la personne qui a commenté.", sample: "Claire Martin" },
  discussion_button: { label: "Bouton vers la discussion", description: "Bouton qui ouvre la discussion où le commentaire a été posté.", sample: "[Voir la discussion]", isBlock: true },
  deposits_preview: { label: "Aperçu des travaux déposés", description: "Vignettes et titres des travaux publiés par l'apprenant.", sample: "Carte mentale - module 2", isBlock: true },
  post_quote: { label: "Message du groupe", description: "Message de présentation du groupe, mis en forme en citation.", sample: "« On se retrouve jeudi ? »", isBlock: true },
  members_list: { label: "Membres du groupe", description: "Liste des membres du groupe avec leur email.", sample: "Sophie, Claire, Marc", isBlock: true },
  contact_button: { label: "Bouton de contact", description: "Bouton qui ouvre la page de contact du groupe.", sample: "[Contacter le groupe]", isBlock: true },
  password_set: { label: "Mot de passe déjà créé", description: "Vrai quand l'apprenant a déjà un mot de passe : affiche le texte entre {{#password_set}} et {{/password_set}}.", sample: "oui", isCondition: true },
  no_password: { label: "Pas encore de mot de passe", description: "Vrai quand l'apprenant doit encore créer son mot de passe.", sample: "oui", isCondition: true },
  reset_button: { label: "Bouton de réinitialisation", description: "Bouton qui ouvre la page de choix d'un nouveau mot de passe (lien valable 1 heure).", sample: "[Définir un nouveau mot de passe]", isBlock: true },
  new_email: { label: "Nouvelle adresse", description: "Nouvelle adresse de connexion de l'espace apprenant.", sample: "sophie.b@acme.fr" },
  masked_email: { label: "Nouvelle adresse masquée", description: "Nouvelle adresse de connexion, partiellement masquée pour l'avis envoyé à l'ancienne adresse.", sample: "so***@acme.fr" },
  login_link: { label: "Lien de connexion", description: "Lien vers la page de connexion de l'espace apprenant.", sample: "https://app.supertilt.fr/connexion", isBlock: true },
  contact_email: { label: "Email de contact", description: "Adresse à laquelle écrire en cas de problème.", sample: "contact@supertilt.fr" },
  contact_link: { label: "Lien de contact", description: "Lien mailto vers l'adresse de contact.", sample: "contact@supertilt.fr", isBlock: true },

  // Émargement et sessions
  period_label: { label: "Demi-journée", description: "Matin ou après-midi de la session concernée.", sample: "Matin" },
  time_range: { label: "Plage horaire", description: "Heures de début et de fin de la demi-journée.", sample: "9h00 - 12h30" },
  signature_button: { label: "Bouton de signature", description: "Bouton qui ouvre la page d'émargement électronique.", sample: "[Signer ma présence]", isBlock: true },
  trainer_first_name: { label: "Prénom du formateur", description: "Prénom du formateur de la session.", sample: "Romain" },
  trainer_name: { label: "Nom du formateur", description: "Nom complet du formateur.", sample: "Romain Couturier" },
  all_signed: { label: "Tous ont signé", description: "Vrai quand tous les participants ont émargé pour cette demi-journée.", sample: "oui", isCondition: true },
  some_pending: { label: "Signatures en attente", description: "Vrai quand des participants n'ont pas encore émargé.", sample: "oui", isCondition: true },
  signed_count: { label: "Nombre de signatures", description: "Nombre de participants ayant émargé.", sample: "7" },
  total_count: { label: "Nombre attendu", description: "Nombre total de participants attendus.", sample: "9" },
  status_block: { label: "État des émargements", description: "Récapitulatif des participants ayant signé ou non.", sample: "7 signés, 2 en attente", isBlock: true },
  signatures_sent: { label: "Demandes envoyées", description: "Nombre de demandes d'émargement envoyées aux participants.", sample: "9" },
  session_table: { label: "Tableau de la session", description: "Récapitulatif de la session (dates, lieu, participants).", sample: "12 mars 2026 - Paris - 12 participants", isBlock: true },
  days_remaining: { label: "Jours restants", description: "Nombre de jours avant le début de la formation.", sample: "10" },
  training_table: { label: "Tableau de la formation", description: "Récapitulatif de la formation (dates, lieu, client).", sample: "12 mars 2026 - Paris - Acme SAS", isBlock: true },
  room_ref: { label: "Salle demandée", description: "Nom ou référence de la salle à réserver.", sample: "la salle Montmartre" },
  schedule_list: { label: "Dates et horaires", description: "Liste des dates et horaires de la réservation.", sample: "12 mars 2026 : 9h00 - 17h30", isBlock: true },
  resources_links: { label: "Ressources de la formation", description: "Liens vers les supports et ressources de la formation.", sample: "Supports de cours, fiches mémo", isBlock: true },
  participant_email: { label: "Email du participant", description: "Adresse email du participant concerné.", sample: "sophie@acme.fr" },
  certificate_count: { label: "Nombre de certificats", description: "Nombre de certificats contenus dans l'archive.", sample: "12" },
  date_line: { label: "Dates (ligne)", description: "Dates de la formation sur une ligne ; vide quand elles sont inconnues.", sample: "12 et 13 mars 2026" },
  evaluation_button: { label: "Bouton d'évaluation", description: "Bouton qui ouvre le formulaire d'évaluation.", sample: "[Donner mon retour]", isBlock: true },
  training_button: { label: "Bouton vers la formation", description: "Bouton qui ouvre la fiche de la formation dans SuperTools.", sample: "[Voir la formation]", isBlock: true },
  training_url: { label: "Lien de la formation", description: "Adresse de la fiche de la formation dans SuperTools.", sample: "https://app.supertilt.fr/formations/123" },
  action_short: { label: "Action (résumé)", description: "Intitulé court de l'action à réaliser.", sample: "Envoyer la convention" },
  action_box: { label: "Action à réaliser", description: "Détail de l'action à réaliser, mis en forme en encadré.", sample: "Envoyer la convention signée avant le 10 mars", isBlock: true },

  // Signatures, devis et documents
  signer_name: { label: "Nom du signataire", description: "Nom de la personne qui a signé le document.", sample: "Claire Martin" },
  details_list: { label: "Détail du document", description: "Liste des informations du document signé (formation, dates, montant).", sample: "Formation : Facilitation graphique", isBlock: true },
  download_button: { label: "Bouton de téléchargement", description: "Bouton qui télécharge le document signé.", sample: "[Télécharger le document]", isBlock: true },
  opportunity_block: { label: "Encadré opportunité", description: "Informations sur l'opportunité commerciale liée au devis.", sample: "Opportunité : Acme - Facilitation", isBlock: true },
  contrat_reference: { label: "Référence du contrat", description: "Numéro du contrat de location signé.", sample: "LOC-2026-014" },
  items_list: { label: "Jeux du devis", description: "Liste des jeux figurant sur le devis.", sample: "Pictodico x2, Echo x1", isBlock: true },
  note: { label: "Note", description: "Note facultative ajoutée au devis ; le texte entre {{#note}} et {{/note}} n'apparaît que si elle existe.", sample: "Livraison sous 5 jours" },

  // Évènements
  event_title: { label: "Titre de l'évènement", description: "Intitulé de l'évènement.", sample: "Salon Learning Technologies" },
  event_details: { label: "Détail de l'évènement", description: "Date, heure et lieu de l'évènement, mis en forme.", sample: "12 mars 2026 - 14h00 - Paris", isBlock: true },
  event_button: { label: "Bouton vers l'évènement", description: "Bouton qui ouvre l'évènement dans SuperTools.", sample: "[Voir l'évènement]", isBlock: true },
  open_button: { label: "Bouton d'ouverture", description: "Bouton qui ouvre l'élément concerné dans SuperTools.", sample: "[Ouvrir]", isBlock: true },
  is_today: { label: "C'est aujourd'hui", description: "Vrai quand l'évènement a lieu aujourd'hui.", sample: "oui", isCondition: true },
  is_tomorrow: { label: "C'est demain", description: "Vrai quand l'évènement a lieu demain.", sample: "oui", isCondition: true },
  images_preview: { label: "Aperçu des images", description: "Vignettes des images jointes à l'évènement.", sample: "3 images", isBlock: true },
  changes_table: { label: "Tableau des changements", description: "Liste des champs modifiés avec ancienne et nouvelle valeur.", sample: "Date : 12 mars → 14 mars", isBlock: true },
  sender_name: { label: "Nom de l'expéditeur", description: "Nom de la personne qui envoie ou partage.", sample: "Romain Couturier" },

  // Contenus, missions et veille
  card_title: { label: "Titre du contenu", description: "Titre de la carte de contenu concernée.", sample: "Article : 5 astuces de facilitation" },
  card_box: { label: "Encadré du contenu", description: "Résumé de la carte de contenu, mis en forme en encadré.", sample: "Article : 5 astuces de facilitation", isBlock: true },
  card_button: { label: "Bouton vers le contenu", description: "Bouton qui ouvre la carte de contenu.", sample: "[Ouvrir le contenu]", isBlock: true },
  external_link: { label: "Lien externe", description: "Lien vers le document à relire (Google Docs, Canva…), s'il existe.", sample: "https://docs.google.com/…", isBlock: true },
  author_name: { label: "Auteur", description: "Nom de la personne à l'origine du commentaire ou de la mention.", sample: "Claire Martin" },
  author_subject: { label: "Auteur (objet)", description: "Nom de l'auteur, tel qu'affiché dans l'objet du mail.", sample: "Claire" },
  page_title: { label: "Titre de la page", description: "Titre de la page de mission commentée.", sample: "Compte rendu atelier 1" },
  reply_button: { label: "Bouton de réponse", description: "Bouton qui ouvre la page pour répondre.", sample: "[Répondre]", isBlock: true },
  item_title: { label: "Titre de l'élément de veille", description: "Titre de l'élément de veille concerné.", sample: "Rapport IA et formation 2026" },
  watch_link: { label: "Lien vers la veille", description: "Lien vers l'élément de veille dans SuperTools.", sample: "[Voir l'élément]", isBlock: true },
  respondent: { label: "Répondant", description: "Nom ou email de la personne qui a répondu.", sample: "Sophie Bergaglio" },
  survey_title: { label: "Titre du sondage", description: "Intitulé du sondage.", sample: "Besoins en facilitation 2026" },
  results_button: { label: "Bouton des résultats", description: "Bouton qui ouvre les résultats du sondage.", sample: "[Voir les résultats]", isBlock: true },

  // Équipe et accès
  app_link: { label: "Lien vers l'application", description: "Lien vers SuperTools.", sample: "https://app.supertilt.fr", isBlock: true },
  credentials: { label: "Identifiants", description: "Email de connexion et mot de passe provisoire.", sample: "Email : claire@supertilt.fr", isBlock: true },
  modules_list: { label: "Modules accessibles", description: "Liste des modules auxquels le collaborateur a accès.", sample: "CRM, Formations, Missions", isBlock: true },
  login_button: { label: "Bouton de connexion", description: "Bouton qui ouvre la page de connexion.", sample: "[Se connecter]", isBlock: true },

  // Support
  ticket_number: { label: "Numéro du ticket", description: "Numéro du ticket de support.", sample: "ST-2026-0042" },
  ticket_title: { label: "Titre du ticket", description: "Intitulé du ticket de support.", sample: "Le bouton Exporter ne répond pas" },
  ticket_box: { label: "Encadré du ticket", description: "Résumé du ticket (type, priorité, module), mis en forme en encadré.", sample: "Bug - priorité haute - CRM", isBlock: true },
  ticket_details: { label: "Détail du ticket", description: "Description complète et pièces jointes du ticket.", sample: "Depuis ce matin, l'export échoue…", isBlock: true },
  ticket_description: { label: "Description du ticket", description: "Description du ticket telle que saisie.", sample: "Depuis ce matin, l'export échoue…", isBlock: true },
  ticket_button: { label: "Bouton vers le ticket", description: "Bouton qui ouvre le ticket dans SuperTools.", sample: "[Voir le ticket]", isBlock: true },
  tickets_button: { label: "Bouton vers mes tickets", description: "Bouton qui ouvre la liste des tickets de l'utilisateur.", sample: "[Mes tickets]", isBlock: true },
  module_prefix: { label: "Préfixe du module", description: "Nom du module concerné suivi d'un séparateur ; vide si aucun module.", sample: "CRM · " },
  status_label: { label: "Statut du ticket", description: "Statut du ticket en toutes lettres.", sample: "Résolu" },
  resolution_notes: { label: "Notes de résolution", description: "Explication de la résolution, mise en forme en encadré.", sample: "Corrigé dans la version du 12 mars.", isBlock: true },
  date: { label: "Date", description: "Date du jour du récapitulatif, formatée en français.", sample: "9 octobre 2026" },
  archived_count: { label: "Tickets archivés", description: "Nombre de tickets archivés par la purge.", sample: "14" },
  purge_summary: { label: "Synthèse de la purge", description: "Résumé chiffré de la purge hebdomadaire.", sample: "14 tickets archivés", isBlock: true },
  tickets_table: { label: "Tableau des tickets", description: "Liste des tickets archivés.", sample: "ST-2026-0042 - Export…", isBlock: true },
  user_summary: { label: "Synthèse par utilisateur", description: "Nombre de tickets archivés par auteur.", sample: "Claire : 5", isBlock: true },
  support_button: { label: "Bouton vers le support", description: "Bouton qui ouvre le module support.", sample: "[Ouvrir le support]", isBlock: true },

  // Alertes et récapitulatifs
  count: { label: "Nombre", description: "Nombre d'éléments concernés par le mail.", sample: "3" },
  plural_s: { label: "Marque du pluriel", description: "« s » quand le nombre dépasse 1, vide sinon.", sample: "s" },
  verb: { label: "Verbe accordé", description: "Verbe accordé au nombre (« nécessite » ou « nécessitent »).", sample: "nécessitent" },
  conventions_table: { label: "Tableau des conventions", description: "Liste des formations dont la convention manque.", sample: "Acme - 12 mars 2026", isBlock: true },
  alert_count: { label: "Nombre d'alertes", description: "Nombre d'alertes du récapitulatif.", sample: "4" },
  alert_sections: { label: "Alertes", description: "Alertes regroupées par catégorie (logistique, documents…).", sample: "Train non réservé : Acme - 12 mars", isBlock: true },
  form_label: { label: "Formulaire concerné", description: "Nom du formulaire public en erreur.", sample: "Évaluation à chaud" },
  error_details: { label: "Détail de l'erreur", description: "Informations techniques sur l'erreur (lien, message).", sample: "Token expiré", isBlock: true },
  attempt_details: { label: "Détail de la tentative", description: "Email, adresse IP et date de la tentative de connexion.", sample: "inconnu@ex.fr - 12 mars 2026 09:12", isBlock: true },
  attempt_count: { label: "Nombre de tentatives", description: "Nombre de tentatives de connexion échouées.", sample: "12" },
};

/** Heuristic fallback for a variable that has no explicit documentation. */
export function guessVariableDoc(variable: string): VariableDoc {
  const v = variable.toLowerCase();
  const isCondition = v.startsWith("has_") || v.startsWith("is_");
  if (v.endsWith("_link") || v.endsWith("_url")) {
    return { label: "Lien", description: "URL insérée automatiquement lors de l'envoi.", sample: "https://super-tools.lovable.app/exemple" };
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
