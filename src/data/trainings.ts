import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

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

// --- Training CRUD ---

export interface Training {
  id: string;
  start_date: string;
  end_date: string | null;
  training_name: string;
  location: string;
  client_name: string;
  client_address: string | null;
  sold_price_ht: number | null;
  evaluation_link: string;
  program_file_url: string | null;
  prerequisites: string[];
  objectives: string[];
  format_formation: string | null;
  created_at: string;
  sponsor_first_name: string | null;
  sponsor_last_name: string | null;
  sponsor_email: string | null;
  sponsor_formal_address: boolean;
  participants_formal_address: boolean;
  invoice_file_url: string | null;
  attendance_sheets_urls: string[];
  supports_url: string | null;
  trainer_name: string;
  train_booked: boolean;
  hotel_booked: boolean;
  restaurant_booked: boolean;
  room_rental_booked: boolean;
  convention_file_url?: string | null;
  signed_convention_urls?: string[];
  elearning_duration?: number | null;
  notes?: string | null;
  assigned_to?: string | null;
}

export interface Schedule {
  id: string;
  day_date: string;
  start_time: string;
  end_time: string;
}

export interface Participant {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  company: string | null;
  needs_survey_status: string;
  needs_survey_sent_at: string | null;
  added_at: string;
  sponsor_first_name?: string | null;
  sponsor_last_name?: string | null;
  sponsor_email?: string | null;
  invoice_file_url?: string | null;
  payment_mode?: string;
  sold_price_ht?: number | null;
}

export interface ScheduledAction {
  id: string;
  description: string;
  dueDate: Date;
  assignedEmail: string;
  assignedName: string;
  completed: boolean;
}

export async function fetchTraining(id: string): Promise<Training> {
  const { data, error } = await supabase
    .from("trainings")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return data as Training;
}

export async function fetchTrainingSchedules(trainingId: string): Promise<Schedule[]> {
  const { data, error } = await supabase
    .from("training_schedules")
    .select("*")
    .eq("training_id", trainingId)
    .order("day_date", { ascending: true });

  if (error) throw error;
  return (data || []) as Schedule[];
}

export async function fetchTrainingParticipants(trainingId: string): Promise<Participant[]> {
  const { data, error } = await supabase
    .from("training_participants")
    .select("*")
    .eq("training_id", trainingId)
    .order("added_at", { ascending: true });

  if (error) throw error;
  return (data || []) as Participant[];
}

export async function updateTrainingField(
  trainingId: string,
  updates: Record<string, unknown>
): Promise<void> {
  const { error } = await supabase
    .from("trainings")
    .update(updates)
    .eq("id", trainingId);

  if (error) throw error;
}

export async function fetchAssignedUserName(userId: string): Promise<string | null> {
  const { data } = await supabase
    .from("profiles")
    .select("first_name, last_name, email")
    .eq("user_id", userId)
    .maybeSingle();

  if (!data) return null;
  const name = [data.first_name, data.last_name].filter(Boolean).join(" ");
  return name || data.email.split("@")[0];
}

// --- Scheduled Actions ---

export async function fetchScheduledActions(trainingId: string): Promise<ScheduledAction[]> {
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

export async function saveScheduledActions(
  trainingId: string,
  userId: string,
  actions: ScheduledAction[]
): Promise<void> {
  // Get current actions from DB
  const { data: existingActions } = await supabase
    .from("training_actions")
    .select("id")
    .eq("training_id", trainingId);

  const existingIds = new Set((existingActions || []).map((a) => a.id));
  const newIds = new Set(actions.map((a) => a.id));

  // Delete removed actions
  const toDelete = [...existingIds].filter((id) => !newIds.has(id));
  if (toDelete.length > 0) {
    await supabase.from("training_actions").delete().in("id", toDelete);
  }

  // Upsert actions
  for (const action of actions) {
    if (!action.description || !action.dueDate || !action.assignedEmail) continue;

    const isExistingAction = existingIds.has(action.id);

    if (isExistingAction) {
      await supabase
        .from("training_actions")
        .update({
          description: action.description,
          due_date: format(action.dueDate, "yyyy-MM-dd"),
          assigned_user_email: action.assignedEmail,
          assigned_user_name: action.assignedName || null,
        })
        .eq("id", action.id);
    } else {
      await supabase.from("training_actions").insert({
        training_id: trainingId,
        description: action.description,
        due_date: format(action.dueDate, "yyyy-MM-dd"),
        assigned_user_email: action.assignedEmail,
        assigned_user_name: action.assignedName || null,
        created_by: userId,
      });
    }
  }
}

export async function toggleActionComplete(
  actionId: string,
  completed: boolean
): Promise<void> {
  const { error } = await supabase
    .from("training_actions")
    .update({
      status: completed ? "completed" : "pending",
      completed_at: completed ? new Date().toISOString() : null,
    })
    .eq("id", actionId);

  if (error) throw error;
}

export async function deleteAction(actionId: string): Promise<void> {
  const { error } = await supabase
    .from("training_actions")
    .delete()
    .eq("id", actionId);

  if (error) throw error;
}

// --- Activity Logs ---

export async function fetchThankYouSentDate(trainingId: string): Promise<string | null> {
  const { data } = await supabase
    .from("activity_logs")
    .select("created_at, details")
    .eq("action_type", "thank_you_email_sent")
    .order("created_at", { ascending: false })
    .limit(20);

  if (!data) return null;

  const match = data.find((log) => {
    const details = log.details as { training_id?: string } | null;
    return details?.training_id === trainingId;
  });

  return match?.created_at ?? null;
}

export async function logActivity(params: {
  actionType: string;
  recipientEmail: string;
  details?: Record<string, unknown>;
  userId?: string;
}): Promise<void> {
  await (supabase as any).from("activity_logs").insert({
    action_type: params.actionType,
    recipient_email: params.recipientEmail,
    details: params.details ?? null,
    user_id: params.userId ?? null,
  });
}
