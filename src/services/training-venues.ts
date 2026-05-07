import { supabase } from "@/integrations/supabase/client";
import type { TrainingVenue } from "@/types/training-venue";

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
