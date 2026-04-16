export type LogisticsEntityType = "mission" | "training";

export interface LogisticsChecklistItem {
  id: string;
  entity_type: LogisticsEntityType;
  entity_id: string;
  label: string;
  position: number;
  is_done: boolean;
  due_date: string | null;
  notify_days_before: number | null;
  /**
   * Optional legacy column the item is mirrored to (e.g. 'train_booked').
   * When set, toggling `is_done` updates the matching boolean on
   * missions/trainings via a DB trigger so the existing alert system
   * keeps working during the transition.
   */
  legacy_field: string | null;
  created_at: string;
  updated_at: string;
  done_at: string | null;
}

export interface LogisticsTemplateItem {
  label: string;
  legacy_field?: string;
  due_date?: string;
  notify_days_before?: number;
}

/** Set of templates indexed by composite key, e.g. "training.inter.presentiel". */
export type LogisticsTemplates = Record<string, LogisticsTemplateItem[]>;
