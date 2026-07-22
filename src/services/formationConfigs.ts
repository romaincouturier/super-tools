import { db, throwIfError } from "@/lib/supabase-helpers";
import type { FormationConfig } from "@/components/formations/TrainingNameCombobox";

export async function createFormationConfig(input: {
  formation_name: string;
  duree_heures: number;
  prix: number;
  programme_url: string | null;
}): Promise<FormationConfig> {
  const result = await db()
    .from("formation_configs")
    .insert({ ...input, is_default: false, is_active: true })
    .select()
    .single();
  return throwIfError(result) as unknown as FormationConfig;
}
