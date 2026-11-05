export type TrainingSortField = "date" | "title" | "client" | "location" | "participant_count";
export type TrainingSortOrder = "asc" | "desc";
export type TrainingTab = "upcoming" | "ongoing" | "past" | "permanent";
export interface TrainingSort { field: TrainingSortField; order: TrainingSortOrder }

export const DEFAULT_TRAINING_SORTS: Record<TrainingTab, TrainingSort> = {
  upcoming: { field: "date", order: "asc" },
  ongoing: { field: "date", order: "asc" },
  past: { field: "date", order: "desc" },
  permanent: { field: "title", order: "asc" },
};

interface SortableTraining {
  start_date: string | null;
  created_at: string;
  training_name: string | null;
  client_name: string | null;
  location: string | null;
  participant_count?: number;
}

export function sortTrainings<T extends SortableTraining>(trainings: T[], sort: TrainingSort): T[] {
  return [...trainings].sort((a, b) => {
    let comparison: number;
    if (sort.field === "participant_count") {
      comparison = (a.participant_count ?? 0) - (b.participant_count ?? 0);
    } else if (sort.field === "date") {
      comparison = (a.start_date ?? "").localeCompare(b.start_date ?? "")
        || a.created_at.localeCompare(b.created_at);
    } else {
      const key = sort.field === "title" ? "training_name" : sort.field === "client" ? "client_name" : "location";
      comparison = (a[key] ?? "").localeCompare(b[key] ?? "", "fr", { sensitivity: "base" });
    }
    return sort.order === "asc" ? comparison : -comparison;
  });
}