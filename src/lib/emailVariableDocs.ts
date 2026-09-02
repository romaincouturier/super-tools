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
