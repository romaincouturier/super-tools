import { useMemo } from "react";
import type {
  NetworkContact,
  NetworkAction,
  UserPositioning,
  CoolingThresholds,
  NetworkInteraction,
} from "@/types/reseau";
import { computeCoolingContacts, computeNetworkStats } from "@/lib/networkUtils";

export const useCoolingContacts = (
  contacts: NetworkContact[],
  positioning: UserPositioning | null,
) => {
  return useMemo(() => {
    const thresholds: CoolingThresholds = (positioning as any)?.cooling_thresholds || { hot: 14, warm: 30, cold: 60 };
    return computeCoolingContacts(contacts, thresholds);
  }, [contacts, positioning]);
};

export const useNetworkStats = (
  contacts: NetworkContact[],
  actions: (NetworkAction & { contact: NetworkContact | null })[],
  interactions: NetworkInteraction[],
) => {
  return useMemo(() => computeNetworkStats(contacts, actions, interactions), [contacts, actions, interactions]);
};
