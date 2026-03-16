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
  const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
    body: { action, card_data: cardData },
  });

  if (error) throw error;

  return (data as { result: string }).result;
}
