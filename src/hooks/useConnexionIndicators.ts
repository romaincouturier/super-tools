import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ConnexionIndicators = {
  window_days: number;
  provisioned_accounts: number;
  activated_accounts: number;
  activation_rate: number | null;
  successful_logins: number;
  failed_logins: number;
  first_try_rate: number | null;
  links_sent: number;
  links_expired_unused: number;
  resolutions: number;
  resolutions_throttled: number;
};

export type DormantAccount = {
  email: string;
  created_at: string;
  last_sign_in_at: string | null;
};

/** Indicateurs de la refonte de connexion (chapitre 20 de la spécification). */
export function useConnexionIndicators(days = 30) {
  return useQuery({
    queryKey: ["connexion-indicators", days],
    queryFn: async (): Promise<ConnexionIndicators> => {
      const { data, error } = await supabase.rpc("connexion_indicators", { p_days: days });
      if (error) throw error;
      return data as unknown as ConnexionIndicators;
    },
    staleTime: 5 * 60 * 1000,
  });
}

/** Comptes apprenants sans usage depuis N années, signalés pour suppression (RG-23). */
export function useDormantLearnerAccounts(years = 3) {
  return useQuery({
    queryKey: ["dormant-learner-accounts", years],
    queryFn: async (): Promise<DormantAccount[]> => {
      const { data, error } = await supabase.rpc("list_dormant_learner_accounts", { p_years: years });
      if (error) throw error;
      return (data ?? []) as DormantAccount[];
    },
    staleTime: 30 * 60 * 1000,
  });
}
