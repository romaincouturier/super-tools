import { trainingRepository } from "@/infrastructure/supabase/training.repository";

// Re-export domain types for backward compatibility
export type { Training, Schedule, Participant, ScheduledAction } from "@/domain/entities/training";

// Re-export existing service functions so consumers have one import
export {
  generateConvention,
  sendConventionEmail,
  sendConventionReminder,
  generateCertificates,
  sendTrainingDocuments,
  sendThankYouEmail,
  fetchDocumentsSentInfo,
  fetchConventionSignatureStatus,
  fetchPrograms,
  insertParticipant,
  updateParticipant,
  deleteParticipant,
} from "@/services/formations";

// --- Training CRUD (delegated to repository) ---

export const fetchTraining = (id: string) => trainingRepository.findById(id);

export const fetchTrainingSchedules = (trainingId: string) =>
  trainingRepository.findSchedules(trainingId);

export const fetchTrainingParticipants = (trainingId: string) =>
  trainingRepository.findParticipants(trainingId);

export const updateTrainingField = (trainingId: string, updates: Record<string, unknown>) =>
  trainingRepository.updateField(trainingId, updates);

export const fetchAssignedUserName = (userId: string) =>
  trainingRepository.findAssignedUserName(userId);

// --- Scheduled Actions (delegated to repository) ---

export const fetchScheduledActions = (trainingId: string) =>
  trainingRepository.findScheduledActions(trainingId);

export const saveScheduledActions = (
  trainingId: string,
  userId: string,
  actions: Parameters<typeof trainingRepository.saveScheduledActions>[2],
) => trainingRepository.saveScheduledActions(trainingId, userId, actions);

export const toggleActionComplete = (actionId: string, completed: boolean) =>
  trainingRepository.toggleActionComplete(actionId, completed);

export const deleteAction = (actionId: string) => trainingRepository.deleteAction(actionId);

// --- Activity Logs (delegated to repository) ---

export const fetchThankYouSentDate = (trainingId: string) =>
  trainingRepository.findThankYouSentDate(trainingId);

export const logActivity = (params: {
  actionType: string;
  recipientEmail: string;
  details?: Record<string, unknown>;
  userId?: string;
}) => trainingRepository.logActivity(params);
