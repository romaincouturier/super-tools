import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { Training, Schedule, Participant, ScheduledAction } from "@/domain/entities/training";
import type { ITrainingRepository } from "@/domain/repositories/training.repository";

export class SupabaseTrainingRepository implements ITrainingRepository {
  async findById(id: string): Promise<Training> {
    const { data, error } = await supabase.from("trainings").select("*").eq("id", id).single();
    if (error) throw error;
    return data as Training;
  }

  async updateField(trainingId: string, updates: Record<string, unknown>): Promise<void> {
    const { error } = await supabase.from("trainings").update(updates).eq("id", trainingId);
    if (error) throw error;
  }

  async findSchedules(trainingId: string): Promise<Schedule[]> {
    const { data, error } = await supabase
      .from("training_schedules")
      .select("*")
      .eq("training_id", trainingId)
      .order("day_date", { ascending: true });
    if (error) throw error;
    return (data || []) as Schedule[];
  }

  async findParticipants(trainingId: string): Promise<Participant[]> {
    const { data, error } = await supabase
      .from("training_participants")
      .select("*")
      .eq("training_id", trainingId)
      .order("added_at", { ascending: true });
    if (error) throw error;
    return (data || []) as Participant[];
  }

  async findScheduledActions(trainingId: string): Promise<ScheduledAction[]> {
    const { data, error } = await supabase
      .from("training_actions")
      .select("*")
      .eq("training_id", trainingId)
      .order("due_date", { ascending: true });
    if (error) throw error;
    return (data || []).map((action) => ({
      id: action.id,
      description: action.description,
      dueDate: new Date(action.due_date),
      assignedEmail: action.assigned_user_email,
      assignedName: action.assigned_user_name || "",
      completed: action.status === "completed",
    }));
  }

  async saveScheduledActions(
    trainingId: string,
    userId: string,
    actions: ScheduledAction[],
  ): Promise<void> {
    const { data: existingActions } = await supabase
      .from("training_actions")
      .select("id, created_by")
      .eq("training_id", trainingId);

    const existingMap = new Map((existingActions || []).map((a) => [a.id, a.created_by]));
    const newIds = new Set(actions.map((a) => a.id));

    const toDelete = [...existingMap.keys()].filter((id) => !newIds.has(id));
    if (toDelete.length > 0) {
      await supabase.from("training_actions").delete().in("id", toDelete);
    }

    const validActions = actions.filter((a) => a.description && a.dueDate && a.assignedEmail);
    if (validActions.length === 0) return;

    const upsertData = validActions.map((action) => ({
      id: action.id,
      training_id: trainingId,
      description: action.description,
      due_date: format(action.dueDate, "yyyy-MM-dd"),
      assigned_user_email: action.assignedEmail,
      assigned_user_name: action.assignedName || null,
      created_by: existingMap.get(action.id) ?? userId,
    }));

    await supabase.from("training_actions").upsert(upsertData, { onConflict: "id" });
  }

  async toggleActionComplete(actionId: string, completed: boolean): Promise<void> {
    const { error } = await supabase
      .from("training_actions")
      .update({
        status: completed ? "completed" : "pending",
        completed_at: completed ? new Date().toISOString() : null,
      })
      .eq("id", actionId);
    if (error) throw error;
  }

  async deleteAction(actionId: string): Promise<void> {
    const { error } = await supabase.from("training_actions").delete().eq("id", actionId);
    if (error) throw error;
  }

  async findAssignedUserName(userId: string): Promise<string | null> {
    const { data } = await supabase
      .from("profiles")
      .select("first_name, last_name, email")
      .eq("user_id", userId)
      .maybeSingle();
    if (!data) return null;
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
    return name || data.email.split("@")[0];
  }

  async findThankYouSentDate(trainingId: string): Promise<string | null> {
    const { data } = await supabase
      .from("activity_logs")
      .select("created_at")
      .eq("action_type", "thank_you_email_sent")
      .contains("details", { training_id: trainingId })
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    return data?.created_at ?? null;
  }

  async logActivity(params: {
    actionType: string;
    recipientEmail: string;
    details?: Record<string, unknown>;
    userId?: string;
  }): Promise<void> {
    await supabase.from("activity_logs").insert({
      action_type: params.actionType,
      recipient_email: params.recipientEmail,
      details: params.details ?? null,
      user_id: params.userId ?? null,
    });
  }
}

// Singleton instance for direct usage
export const trainingRepository = new SupabaseTrainingRepository();
