export interface AttendanceTrainer {
  id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
}

interface TrainingTrainer {
  trainer_id?: string | null;
  trainer_name?: string | null;
  trainers?: AttendanceTrainer | null;
}

const normalizeName = (name: string) => name.trim().replace(/\s+/g, " ").toLocaleLowerCase("fr-FR");

export function selectAttendanceTrainer(training: TrainingTrainer, trainers: AttendanceTrainer[]): AttendanceTrainer | null {
  if (training.trainer_id) {
    return training.trainers || trainers.find(t => t.id === training.trainer_id) || null;
  }
  const name = normalizeName(training.trainer_name || "Romain Couturier");
  const matches = trainers.filter(t => normalizeName(`${t.first_name || ""} ${t.last_name || ""}`) === name);
  return matches.length === 1 ? matches[0] : null;
}

export async function resolveAttendanceTrainer(supabase: any, training: TrainingTrainer): Promise<AttendanceTrainer | null> {
  if (training.trainer_id && training.trainers) return training.trainers;
  const { data, error } = await supabase.from("trainers").select("id, email, first_name, last_name");
  if (error) throw new Error(`Impossible de retrouver le formateur : ${error.message}`);
  return selectAttendanceTrainer(training, data || []);
}