import { supabase } from "@/integrations/supabase/client";
import type { TrainingVenue } from "@/types/training-venue";
import { logActivity } from "@/services/activityLog";

export async function fetchTrainingVenues(): Promise<TrainingVenue[]> {
  const { data, error } = await supabase
    .from("training_venues")
    .select("*")
    .order("name");
  if (error) throw error;
  return (data || []) as TrainingVenue[];
}

export async function createTrainingVenue(
  input: Omit<TrainingVenue, "id" | "created_at">
): Promise<TrainingVenue> {
  const { data, error } = await supabase
    .from("training_venues")
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  await logActivity({ actionType: "training_venue_created", recipientEmail: user?.email || "", userId: user?.id, details: { venue_id: data.id, access_instructions: input.access_instructions || null } });
  return data as TrainingVenue;
}

export async function sendVenueBookingRequest(trainingId: string): Promise<void> {
  const { data, error } = await supabase.functions.invoke("send-venue-booking-request", {
    body: { trainingId },
  });
  if (error) throw error;
  if (data && data.success === false) {
    throw new Error(data.error || "Impossible d'envoyer la demande de réservation.");
  }
}

export async function updateVenueAccess(input: { id: string; instructions: string }) {
  const { data: before, error: readError } = await supabase.from("training_venues").select("access_instructions").eq("id", input.id).single();
  if (readError) throw readError;
  const access_instructions = input.instructions.trim() || null;
  const { error } = await supabase.from("training_venues").update({ access_instructions }).eq("id", input.id);
  if (error) throw error;
  const { data: { user } } = await supabase.auth.getUser();
  await logActivity({ actionType: "venue_access_updated", recipientEmail: user?.email || "", userId: user?.id, details: { venue_id: input.id, before: before.access_instructions, after: access_instructions } });
}
