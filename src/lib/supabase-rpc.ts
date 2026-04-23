/**
 * Typed wrappers for Supabase RPC functions.
 *
 * Each function mirrors a `SECURITY DEFINER` RPC in the database
 * and provides compile-time type-checking on both params and return values.
 *
 * Usage:
 *   import { rpc } from "@/lib/supabase-rpc";
 *   const training = await rpc.getTrainingPublicInfo(trainingId);
 */
import { supabase } from "@/integrations/supabase/client";

// ─── Helper ──────────────────────────────────────────────────────────

type RpcResult<T> = { data: T | null; error: Error | null };

type RpcFn = (fn: string, params: Record<string, unknown>) => Promise<{ data: unknown; error: Error | null }>;

async function call<T>(fnName: string, params: Record<string, unknown>): Promise<RpcResult<T>> {
  const { data, error } = await (supabase.rpc as unknown as RpcFn)(fnName, params);
  return { data: data as T | null, error };
}

async function callVoid(fnName: string, params: Record<string, unknown>): Promise<{ error: Error | null }> {
  const { error } = await (supabase.rpc as unknown as RpcFn)(fnName, params);
  return { error };
}

// ─── Public read types ───────────────────────────────────────────────

export interface TrainingPublicInfo {
  training_name: string;
  start_date: string | null;
  end_date: string | null;
  prerequisites: string[] | null;
  program_file_url: string | null;
  format_formation: string | null;
  location: string | null;
  objectives: string[] | null;
  session_type: string | null;
}

export interface TrainingSummaryInfo extends TrainingPublicInfo {
  id: string;
  client_name: string | null;
  supports_url: string | null;
  supports_type: string | null;
  supports_lms_course_id: string | null;
  trainer_id: string | null;
  session_format: string | null;
  specific_instructions: string | null;
}

export interface ParticipantPublicInfo {
  first_name: string | null;
  last_name: string | null;
  email: string;
}

export interface SchedulePublicInfo {
  day_date: string;
  start_time: string;
  end_time: string;
}

export interface ScheduleForDate {
  start_time: string;
  end_time: string;
}

export interface TrainerPublicInfo {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
  photo_url: string | null;
  linkedin_url: string | null;
  cv_url: string | null;
}

export interface ParticipantListItem {
  first_name: string;
  last_name: string;
}

export interface PreviousTrainerEvaluation {
  points_forts: string | null;
  axes_amelioration: string | null;
  commentaires: string | null;
}

export interface PublicContact {
  email: string;
  name: string;
}

// ─── Signature / attendance types ────────────────────────────────────

export interface AttendanceByToken {
  id: string;
  training_id: string;
  participant_id: string;
  schedule_date: string;
  period: string;
  token: string;
  signature_data: string | null;
  signed_at: string | null;
  email_opened_at: string | null;
  email_sent_at: string | null;
}

export interface ConventionSignatureByToken {
  id: string;
  token: string;
  recipient_email: string;
  recipient_name: string | null;
  client_name: string;
  formation_name: string;
  pdf_url: string;
  status: string;
  signed_at: string | null;
  email_opened_at: string | null;
  created_at: string;
  expires_at: string | null;
}

export interface DevisSignatureByToken {
  id: string;
  token: string;
  recipient_email: string;
  recipient_name: string | null;
  client_name: string;
  formation_name: string;
  devis_type: string;
  pdf_url: string;
  status: string;
  signed_at: string | null;
  email_opened_at: string | null;
  created_at: string;
  expires_at: string | null;
}

// ─── Evaluation / questionnaire types ────────────────────────────────

export interface TrainerEvaluationByToken {
  id: string;
  training_id: string;
  trainer_email: string | null;
  trainer_name: string | null;
  satisfaction_globale: number | null;
  points_forts: string | null;
  axes_amelioration: string | null;
  commentaires: string | null;
  status: string;
  date_submitted: string | null;
  trainings: {
    training_name: string;
    start_date: string;
    end_date: string | null;
    location: string | null;
  } | null;
}

export interface ReclamationByToken {
  id: string;
  token: string;
  client_name: string | null;
  client_email: string | null;
  canal: string | null;
  nature: string | null;
  problem_type: string | null;
  attendu_initial: string | null;
  resultat_constate: string | null;
  description: string | null;
  severity: string | null;
  status: string;
  date_reclamation: string | null;
}

export interface SponsorEvaluationByToken {
  id: string;
  training_id: string;
  participant_id: string | null;
  token: string;
  etat: string;
  sponsor_email: string | null;
  sponsor_name: string | null;
  company: string | null;
  training_name: string | null;
  training_start_date: string | null;
  training_end_date: string | null;
  satisfaction_globale: number | null;
  attentes_satisfaites: string | null;
  objectifs_atteints: string | null;
  impact_competences: string | null;
  description_impact: string | null;
  organisation_satisfaisante: boolean | null;
  communication_satisfaisante: boolean | null;
  recommandation: string | null;
  message_recommandation: string | null;
  consent_publication: boolean | null;
  points_forts: string | null;
  axes_amelioration: string | null;
  commentaires_libres: string | null;
  date_premiere_ouverture: string | null;
  date_soumission: string | null;
}

// ─── Mission types ───────────────────────────────────────────────────

export interface MissionPublicSummary {
  id: string;
  title: string;
  description: string | null;
  client_name: string | null;
  status: string;
  start_date: string | null;
  end_date: string | null;
  initial_amount: number | null;
  daily_rate: number | null;
  total_days: number | null;
  emoji: string | null;
  location: string | null;
}

export interface MissionActivityPublic {
  id: string;
  description: string;
  activity_date: string;
  duration_type: string;
  duration: number;
  billable_amount: number | null;
  invoice_url: string | null;
  invoice_number: string | null;
  is_billed: boolean;
  notes: string | null;
}

export interface MissionDocumentPublic {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  is_deliverable: boolean;
}

export interface MissionActionPublic {
  id: string;
  title: string;
  status: string;
  position: number;
}

export interface MissionMediaPublic {
  id: string;
  file_name: string;
  file_url: string;
  file_size: number | null;
  file_type: string;
  is_deliverable: boolean;
}

// ─── DB utilities ────────────────────────────────────────────────────

export interface DbSize {
  total_size_bytes: number;
  table_sizes: Record<string, number>;
}

// ─── RPC wrappers ────────────────────────────────────────────────────

export const rpc = {
  // --- Training public ---
  getTrainingPublicInfo: (trainingId: string) =>
    call<TrainingPublicInfo>("get_training_public_info", { p_training_id: trainingId }),

  getTrainingSummaryInfo: (trainingId: string) =>
    call<TrainingSummaryInfo>("get_training_summary_info", { p_training_id: trainingId }),

  getTrainingSchedulesPublic: (trainingId: string) =>
    call<SchedulePublicInfo[]>("get_training_schedules_public", { p_training_id: trainingId }),

  getTrainingScheduleForDate: (trainingId: string, dayDate: string) =>
    call<ScheduleForDate>("get_training_schedule_for_date", { p_training_id: trainingId, p_day_date: dayDate }),

  getTrainingParticipantsList: (trainingId: string) =>
    call<ParticipantListItem[]>("get_training_participants_list", { p_training_id: trainingId }),

  getTrainerPublic: (trainerId: string) =>
    call<TrainerPublicInfo>("get_trainer_public", { p_trainer_id: trainerId }),

  getParticipantPublicInfo: (participantId: string) =>
    call<ParticipantPublicInfo>("get_participant_public_info", { p_participant_id: participantId }),

  getAppSettingPublic: (key: string) =>
    call<string>("get_app_setting_public", { p_key: key }),

  getPublicContact: () =>
    call<PublicContact>("get_public_contact", {}),

  // --- Questionnaire ---
  getQuestionnaireByToken: (token: string) =>
    call<Record<string, unknown>[]>("get_questionnaire_by_token", { p_token: token }),

  updateQuestionnaireByToken: (token: string, data: Record<string, unknown>) =>
    callVoid("update_questionnaire_by_token", { p_token: token, p_data: data }),

  insertQuestionnaireEvent: (questionnaireId: string, typeEvenement: string, metadata?: Record<string, unknown>) =>
    callVoid("insert_questionnaire_event", {
      p_questionnaire_id: questionnaireId,
      p_type_evenement: typeEvenement,
      p_metadata: metadata ?? {},
    }),

  updateParticipantAfterQuestionnaire: (token: string, company?: string) =>
    callVoid("update_participant_after_questionnaire", { p_token: token, p_company: company }),

  // --- Evaluation ---
  getEvaluationByToken: (token: string) =>
    call<Record<string, unknown>[]>("get_evaluation_by_token", { p_token: token }),

  updateEvaluationByToken: (token: string, data: Record<string, unknown>) =>
    callVoid("update_evaluation_by_token", { p_token: token, p_data: data }),

  // --- Trainer evaluation ---
  getTrainerEvaluationByToken: (token: string) =>
    call<TrainerEvaluationByToken>("get_trainer_evaluation_by_token", { p_token: token }),

  updateTrainerEvaluationByToken: (token: string, data: Record<string, unknown>) =>
    callVoid("update_trainer_evaluation_by_token", { p_token: token, p_data: data }),

  getPreviousTrainerEvaluations: (trainerEmail: string, excludeId: string) =>
    call<PreviousTrainerEvaluation[]>("get_previous_trainer_evaluations", {
      p_trainer_email: trainerEmail,
      p_exclude_id: excludeId,
    }),

  // --- Sponsor evaluation ---
  getSponsorEvaluationByToken: (token: string) =>
    call<SponsorEvaluationByToken>("get_sponsor_evaluation_by_token", { p_token: token }),

  updateSponsorEvaluationByToken: (token: string, data: Record<string, unknown>) =>
    callVoid("update_sponsor_evaluation_by_token", { p_token: token, p_data: data }),

  // --- Stakeholder appreciation ---
  getStakeholderAppreciationByToken: (token: string) =>
    call<Record<string, unknown>>("get_stakeholder_appreciation_by_token", { p_token: token }),

  updateStakeholderAppreciationByToken: (token: string, data: Record<string, unknown>) =>
    callVoid("update_stakeholder_appreciation_by_token", { p_token: token, p_data: data }),

  // --- Reclamation ---
  getReclamationByToken: (token: string) =>
    call<ReclamationByToken>("get_reclamation_by_token", { p_token: token }),

  updateReclamationByToken: (token: string, data: Record<string, unknown>) =>
    callVoid("update_reclamation_by_token", { p_token: token, p_data: data }),

  // --- Attendance signatures ---
  getAttendanceByToken: (token: string) =>
    call<AttendanceByToken>("get_attendance_by_token", { p_token: token }),

  markAttendanceOpened: (token: string, timestamp: string) =>
    callVoid("mark_attendance_opened", { p_token: token, p_timestamp: timestamp }),

  // --- Convention signatures ---
  getConventionSignatureByToken: (token: string) =>
    call<ConventionSignatureByToken>("get_convention_signature_by_token", { p_token: token }),

  markConventionOpened: (token: string, timestamp: string) =>
    callVoid("mark_convention_opened", { p_token: token, p_timestamp: timestamp }),

  // --- Devis signatures ---
  getDevisSignatureByToken: (token: string) =>
    call<DevisSignatureByToken>("get_devis_signature_by_token", { p_token: token }),

  markDevisOpened: (token: string, timestamp: string) =>
    callVoid("mark_devis_opened", { p_token: token, p_timestamp: timestamp }),

  // --- Mission public ---
  getMissionPublicSummary: (missionId: string) =>
    call<MissionPublicSummary>("get_mission_public_summary", { p_mission_id: missionId }),

  getMissionActivitiesPublic: (missionId: string) =>
    call<MissionActivityPublic[]>("get_mission_activities_public", { p_mission_id: missionId }),

  getMissionDocumentsPublic: (missionId: string) =>
    call<MissionDocumentPublic[]>("get_mission_documents_public", { p_mission_id: missionId }),

  getMissionActionsPublic: (missionId: string) =>
    call<MissionActionPublic[]>("get_mission_actions_public", { p_mission_id: missionId }),

  getMissionMediaPublic: (missionId: string) =>
    call<MissionMediaPublic[]>("get_mission_media_public", { p_mission_id: missionId }),

  // --- DB utilities ---
  getDbSize: () =>
    call<DbSize>("get_db_size", {}),

  // --- Rate limiting ---
  checkFormulairRateLimit: (ipAddress: string, maxRequests: number, windowSeconds: number) =>
    call<boolean>("check_formulaire_rate_limit", {
      p_ip_address: ipAddress,
      p_max_requests: maxRequests,
      p_window_seconds: windowSeconds,
    }),
};
