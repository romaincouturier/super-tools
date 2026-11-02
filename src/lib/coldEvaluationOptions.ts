// Answer options of the participant cold evaluation (Kirkpatrick levels 3-4).
// Values must match the CHECK constraints of participant_cold_evaluations.

export const MISE_EN_PRATIQUE = [
  { value: "oui", label: "Oui, régulièrement" },
  { value: "partiellement", label: "En partie" },
  { value: "non", label: "Pas encore" },
];

export const FREQUENCE_UTILISATION = [
  { value: "quotidienne", label: "Tous les jours ou presque" },
  { value: "hebdomadaire", label: "Chaque semaine" },
  { value: "ponctuelle", label: "De temps en temps" },
  { value: "jamais", label: "Jamais" },
];

export const OBJECTIFS_ATTEINTS = [
  { value: "oui", label: "Oui" },
  { value: "partiellement", label: "Partiellement" },
  { value: "non", label: "Non" },
];

export const FREINS = [
  { value: "temps", label: "Manque de temps" },
  { value: "occasions", label: "Peu d'occasions de pratiquer" },
  { value: "soutien", label: "Manque de soutien de mon manager ou de mon équipe" },
  { value: "outils", label: "Manque d'outils ou de moyens" },
  { value: "confiance", label: "Pas encore assez à l'aise" },
  { value: "contenu", label: "Contenu peu adapté à ma situation" },
  { value: "autre", label: "Autre" },
];

export const BESOINS = [
  { value: "acces_elearning", label: "Revoir le parcours en ligne" },
  { value: "seance_suivi", label: "Une séance de suivi individuel" },
  { value: "ressources", label: "Des ressources complémentaires" },
  { value: "formation_complementaire", label: "Une formation pour aller plus loin" },
  { value: "aucun", label: "Rien pour le moment" },
];

export const RECOMMANDATION = [
  { value: "oui", label: "Oui" },
  { value: "peut_etre", label: "Peut-être" },
  { value: "non", label: "Non" },
];

export const labelOf = (options: { value: string; label: string }[], value: string | null | undefined) =>
  options.find((o) => o.value === value)?.label || value || "";
