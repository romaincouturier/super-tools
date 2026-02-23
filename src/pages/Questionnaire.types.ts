export type SaveStatus = "idle" | "saving" | "saved" | "error";

export type QuestionnaireRecord = {
  id: string;
  training_id: string;
  participant_id: string;
  token: string;
  etat: string;
  email: string | null;
  prenom: string | null;
  nom: string | null;
  societe: string | null;
  fonction: string | null;
  experience_sujet: string | null;
  experience_details: string | null;
  lecture_programme: string | null;
  prerequis_validation: string | null;
  prerequis_details: string | null;
  competences_actuelles: string | null;
  competences_visees: string | null;
  lien_mission: string | null;
  niveau_actuel: number | null;
  niveau_motivation: number | null;
  modalites_preferences: Record<string, string> | null;
  contraintes_orga: string | null;
  besoins_accessibilite: string | null;
  necessite_amenagement: boolean | null;
  commentaires_libres: string | null;
  consentement_rgpd: boolean;
  date_premiere_ouverture: string | null;
  date_derniere_sauvegarde: string | null;
  date_soumission: string | null;
  date_consentement_rgpd: string | null;
};

export type TrainingRecord = {
  training_name: string;
  start_date: string;
  end_date: string | null;
  prerequisites: string[] | null;
  program_file_url: string | null;
  format_formation: string | null;
  location: string | null;
};

export type ScheduleRecord = {
  day_date: string;
  start_time: string;
  end_time: string;
};
