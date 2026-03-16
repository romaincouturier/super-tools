/**
 * Training service — centralizes Supabase DB calls for trainings domain.
 * Eliminates scattered `supabase.from("trainings")` calls across components.
 */
import { supabase } from "@/integrations/supabase/client";

// The generated Database type doesn't cover all tables; bypass table-name checking.
const db = () => supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> };

function throwIfError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw result.error;
  return result.data;
}

/** Fetch a single training by ID */
export async function getTraining(id: string) {
  const result = await db().from("trainings").select("*").eq("id", id).single();
  return throwIfError(result);
}

/** Fetch all trainings ordered by start_date */
export async function fetchAllTrainings() {
  const result = await db().from("trainings").select("*").order("start_date", { ascending: true });
  return throwIfError(result) || [];
}

/** Fetch training names (id + training_name) for select pickers */
export async function fetchTrainingNames(): Promise<{ id: string; training_name: string }[]> {
  const result = await db()
    .from("trainings")
    .select("id, training_name")
    .order("start_date", { ascending: false });
  return (throwIfError(result) || []) as { id: string; training_name: string }[];
}

/** Update a training record */
export async function updateTraining(id: string, updates: Record<string, unknown>) {
  const result = await db().from("trainings").update(updates).eq("id", id);
  throwIfError(result);
}

/** Fetch upcoming trainings (start_date >= today) */
export async function fetchUpcomingTrainings(fromDate: string) {
  const result = await db()
    .from("trainings")
    .select("id, training_name, start_date, end_date, location")
    .gte("start_date", fromDate)
    .order("start_date", { ascending: true })
    .limit(20);
  return (throwIfError(result) || []);
}

/** Fetch training schedules for a training */
export async function fetchSchedules(trainingId: string) {
  const result = await db()
    .from("training_schedules")
    .select("*")
    .eq("training_id", trainingId)
    .order("day_date", { ascending: true });
  return throwIfError(result) || [];
}

/** Fetch training participants */
export async function fetchParticipants(trainingId: string) {
  const result = await db()
    .from("training_participants")
    .select("*")
    .eq("training_id", trainingId)
    .order("added_at", { ascending: true });
  return throwIfError(result) || [];
}

/** Delete a training and all cascaded related data */
export async function deleteTraining(id: string) {
  const result = await db().from("trainings").delete().eq("id", id);
  throwIfError(result);
}

/** Fetch inter/e-learning trainings for CRM linking */
export async function fetchLinkableTrainings(fromDate: string) {
  const result = await db()
    .from("trainings")
    .select("id, training_name, start_date, client_name, format_formation")
    .in("format_formation", ["inter-entreprises", "e_learning"])
    .gte("start_date", fromDate)
    .order("start_date", { ascending: true });
  return (throwIfError(result) || []);
}
