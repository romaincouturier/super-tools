import { crmRepository } from "@/infrastructure/supabase/crm.repository";
import type { CrmActivityType } from "@/types/crm";

// --- Board Data Fetching (delegated to repository) ---

export const fetchBoardData = () => crmRepository.fetchBoardData();

// --- Card Details Fetching (delegated to repository) ---

export const fetchCardDetails = (cardId: string) => crmRepository.fetchCardDetails(cardId);

// --- Activity Logging (delegated to repository) ---

export const logCrmActivity = (
  cardId: string,
  actionType: CrmActivityType,
  actorEmail: string,
  oldValue?: string | null,
  newValue?: string | null,
  metadata?: Record<string, unknown>,
) => crmRepository.logActivity(cardId, actionType, actorEmail, oldValue, newValue, metadata);
