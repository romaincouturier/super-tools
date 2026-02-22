import type { Training, Schedule, Participant, ScheduledAction } from "../entities/training";

export interface ITrainingRepository {
  findById(id: string): Promise<Training>;
  updateField(trainingId: string, updates: Record<string, unknown>): Promise<void>;

  findSchedules(trainingId: string): Promise<Schedule[]>;
  findParticipants(trainingId: string): Promise<Participant[]>;

  findScheduledActions(trainingId: string): Promise<ScheduledAction[]>;
  saveScheduledActions(
    trainingId: string,
    userId: string,
    actions: ScheduledAction[],
  ): Promise<void>;
  toggleActionComplete(actionId: string, completed: boolean): Promise<void>;
  deleteAction(actionId: string): Promise<void>;

  findAssignedUserName(userId: string): Promise<string | null>;
  findThankYouSentDate(trainingId: string): Promise<string | null>;
  logActivity(params: {
    actionType: string;
    recipientEmail: string;
    details?: Record<string, unknown>;
    userId?: string;
  }): Promise<void>;
}
