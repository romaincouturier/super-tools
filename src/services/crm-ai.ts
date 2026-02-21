import { supabase } from "@/integrations/supabase/client";

interface CardContext {
  title: string;
  description: string;
  company: string;
  first_name: string;
  last_name: string;
  service_type: string | null;
  estimated_value: number;
  comments: Array<{ content: string }>;
  brief_questions: Array<{ id: string; question: string; answered: boolean }>;
}

export async function analyzeExchanges(cardData: CardContext): Promise<string> {
  const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
    body: { action: "analyze_exchanges", card_data: cardData },
  });
  if (error) throw error;
  return data.result;
}

export async function generateQuoteDescription(cardData: CardContext): Promise<string> {
  const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
    body: { action: "generate_quote_description", card_data: cardData },
  });
  if (error) throw error;
  return data.result;
}

export async function suggestNextAction(
  cardData: CardContext & {
    confidence_score: number | null;
    current_next_action: string;
    days_in_pipeline: number | null;
    activities?: Array<unknown>;
  }
): Promise<string> {
  const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
    body: { action: "suggest_next_action", card_data: cardData },
  });
  if (error) throw error;
  return data.result;
}

export async function improveEmailSubject(params: {
  subject: string;
  company: string;
  first_name: string;
  context: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
    body: { action: "improve_email_subject", card_data: params },
  });
  if (error) throw error;
  return data.result;
}

export async function improveEmailBody(params: {
  body: string;
  subject: string;
  company: string;
  first_name: string;
  context: string;
}): Promise<string> {
  const { data, error } = await supabase.functions.invoke("crm-ai-assist", {
    body: { action: "improve_email_body", card_data: params },
  });
  if (error) throw error;
  return data.result;
}
