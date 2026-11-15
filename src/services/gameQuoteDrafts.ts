import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';

export interface GameQuoteDraft {
  id: string;
  order_number: string | null;
  devis_activity_log_id: string | null;
  billing_address: Record<string, string>;
  shipping_address: Record<string, string>;
  raw_order: Record<string, unknown>;
}

export async function fetchGameQuoteDrafts() {
  const { data, error } = await supabase.from('woocommerce_orders')
    .select('id,order_number,devis_activity_log_id,billing_address,shipping_address,raw_order')
    .eq('source', 'devis').eq('wc_status', 'draft').is('cancelled_at', null);
  if (error) throw error;
  return (data ?? []) as unknown as GameQuoteDraft[];
}

export async function sendGameQuoteDraft(quoteId: string) {
  const { data, error } = await supabase.functions.invoke('generate-game-devis', {
    body: { draftQuoteId: quoteId, confirmSend: true },
  });
  if (error) {
    let message = error.message;
    if (error instanceof FunctionsHttpError) {
      const body = await error.context.json().catch(() => null);
      message = body?.error ?? message;
    }
    throw new Error(message);
  }
  if (!data?.success) throw new Error(data?.error ?? 'Envoi non confirmé.');
  return data;
}