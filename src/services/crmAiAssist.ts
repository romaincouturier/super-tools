import { supabase } from "@/integrations/supabase/client";

/**
 * Invoke the crm-ai-assist edge function with a given action and card data.
 * Returns the `result` string from the function response.
 *
 * Throws on network / function errors so callers can handle as needed.
 */
export async function crmAiAssist(
  action: string,
  cardData: Record<string, unknown>,
): Promise<string> {
  // Récupère (et rafraîchit si besoin) la session : sans token valide,
  // l'edge function répond 401 "Non autorisé".
  let { data: sessionData } = await supabase.auth.getSession();
  if (!sessionData.session?.access_token) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    sessionData = refreshed?.session ? { session: refreshed.session } : sessionData;
  }
  const token = sessionData.session?.access_token;
  if (!token) {
    throw new Error("Session expirée : reconnecte-toi pour utiliser l'assistant IA.");
  }

  const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
    body: { action, card_data: cardData },
    headers: { Authorization: `Bearer ${token}` },
  });

  if (error) throw error;

  return (data as { result: string }).result;
}
