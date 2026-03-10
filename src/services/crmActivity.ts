import { supabase } from "@/integrations/supabase/client";
import type { CrmActivityType } from "@/types/crm";

/** Log a CRM activity entry for audit trail. */
export async function logCrmActivity(
  cardId: string,
  actionType: CrmActivityType,
  actorEmail: string,
  oldValue?: string | null,
  newValue?: string | null,
  metadata?: Record<string, unknown>
) {
  await supabase.from("crm_activity_log").insert([{
    card_id: cardId,
    action_type: actionType,
    old_value: oldValue ?? null,
    new_value: newValue ?? null,
    metadata: (metadata ?? null) as unknown as null,
    actor_email: actorEmail,
  }]);
}
