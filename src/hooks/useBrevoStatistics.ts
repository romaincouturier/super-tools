import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface BrevoCampaign {
  id: number;
  name: string;
  subject: string;
  sentDate: string;
  sent: number;
  delivered: number;
  uniqueViews: number;
  uniqueClicks: number;
  unsubscriptions: number;
  hardBounces: number;
  softBounces: number;
}

export interface BrevoOverview {
  contactsCount: number | null;
  campaigns: BrevoCampaign[];
}

async function fetchBrevoOverview(limit: number): Promise<BrevoOverview> {
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const url = `${supabaseUrl}/functions/v1/brevo-statistics`;

  const { data: session } = await supabase.auth.getSession();
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${session.session?.access_token ?? ""}`,
      "apikey": import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    },
    body: JSON.stringify({ limit }),
  });

  if (!response.ok) {
    const err = await response.json().catch(() => ({ error: "Unknown error" }));
    throw new Error(err.error || `HTTP ${response.status}`);
  }

  return response.json();
}

export function useBrevoOverview(limit = 100) {
  return useQuery({
    queryKey: ["brevo-statistics", limit],
    queryFn: () => fetchBrevoOverview(limit),
    staleTime: 5 * 60 * 1000,
    retry: false,
  });
}
