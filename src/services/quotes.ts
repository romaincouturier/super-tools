/**
 * Quote service — centralizes all Supabase DB calls for the quotes domain.
 */
import { supabase } from "@/integrations/supabase/client";
import type {
  Quote,
  QuoteSettings,
  CreateQuoteInput,
  UpdateQuoteInput,
  UpdateQuoteSettingsInput,
} from "@/types/quotes";

// The generated Database type doesn't cover all tables; bypass table-name checking.
const db = () => supabase as unknown as { from: (table: string) => ReturnType<typeof supabase.from> };

function throwIfError<T>(result: { data: T; error: { message: string } | null }): T {
  if (result.error) throw result.error;
  return result.data;
}

// ── Settings (singleton) ──────────────────────────────────────────

export async function fetchQuoteSettings(): Promise<QuoteSettings> {
  const result = await db()
    .from("quote_settings")
    .select("*")
    .limit(1)
    .single();
  return throwIfError(result) as QuoteSettings;
}

export async function updateQuoteSettings(
  updates: UpdateQuoteSettingsInput
): Promise<QuoteSettings> {
  // Get the existing row first
  const current = await fetchQuoteSettings();
  const result = await db()
    .from("quote_settings")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", current.id)
    .select()
    .single();
  return throwIfError(result) as QuoteSettings;
}

// ── Quotes CRUD ───────────────────────────────────────────────────

export async function fetchQuotesByCard(cardId: string): Promise<Quote[]> {
  const result = await db()
    .from("quotes")
    .select("*")
    .eq("crm_card_id", cardId)
    .order("created_at", { ascending: false });
  return (throwIfError(result) || []) as Quote[];
}

export async function fetchQuote(id: string): Promise<Quote> {
  const result = await db().from("quotes").select("*").eq("id", id).single();
  return throwIfError(result) as Quote;
}

export async function createQuote(input: CreateQuoteInput): Promise<Quote> {
  // Get settings for auto-numbering
  const settings = await fetchQuoteSettings();
  const year = new Date().getFullYear();
  const seq = String(settings.next_sequence_number).padStart(4, "0");
  const quoteNumber = `${settings.quote_prefix}-${year}-${seq}`;

  // Calculate expiry
  const issueDate = new Date();
  const expiryDate =
    input.expiry_date ||
    new Date(
      issueDate.getTime() + settings.default_validity_days * 86400000
    ).toISOString().split("T")[0];

  const result = await db()
    .from("quotes")
    .insert({
      crm_card_id: input.crm_card_id,
      quote_number: quoteNumber,
      issue_date: issueDate.toISOString().split("T")[0],
      expiry_date: expiryDate,
      sale_type: input.sale_type || settings.default_sale_type,
      client_company: input.client_company,
      client_address: input.client_address,
      client_zip: input.client_zip,
      client_city: input.client_city,
      client_vat_number: input.client_vat_number || null,
      client_siren: input.client_siren || null,
      client_email: input.client_email || null,
      rights_transfer_enabled: settings.rights_transfer_enabled,
      rights_transfer_rate: settings.rights_transfer_rate,
    })
    .select()
    .single();

  const quote = throwIfError(result) as Quote;

  // Increment sequence number
  await db()
    .from("quote_settings")
    .update({
      next_sequence_number: settings.next_sequence_number + 1,
      updated_at: new Date().toISOString(),
    })
    .eq("id", settings.id);

  return quote;
}

export async function updateQuote(
  id: string,
  updates: UpdateQuoteInput
): Promise<Quote> {
  const result = await db()
    .from("quotes")
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  return throwIfError(result) as Quote;
}

export async function deleteQuote(id: string): Promise<void> {
  const result = await db().from("quotes").delete().eq("id", id);
  throwIfError(result);
}

// ── SIREN API (reuses existing search-siren edge function) ────────

export interface SirenResult {
  siren: string;
  denomination: string;
  address: string;
  zip: string;
  city: string;
  vatNumber: string;
}

export async function lookupSiren(siren: string): Promise<SirenResult> {
  const cleanSiren = siren.replace(/\s/g, "");
  if (!/^\d{9}$/.test(cleanSiren)) {
    throw new Error("Le SIREN doit contenir exactement 9 chiffres.");
  }

  // Use the existing search-siren edge function (same as MicroDevis)
  // It handles INSEE API auth, maintenance detection, and siege address lookup
  const { data, error } = await supabase.functions.invoke("search-siren", {
    body: { siren: cleanSiren },
  });

  if (error) throw error;
  if (data?.error) throw new Error(data.error);

  // Compute VAT number: FR + key + SIREN
  const sirenNum = parseInt(cleanSiren, 10);
  const key = (12 + 3 * (sirenNum % 97)) % 97;
  const vatNumber = `FR${String(key).padStart(2, "0")}${cleanSiren}`;

  return {
    siren: cleanSiren,
    denomination: data.nomClient || "",
    address: data.adresse || "",
    zip: data.codePostal || "",
    city: data.ville || "",
    vatNumber,
  };
}
