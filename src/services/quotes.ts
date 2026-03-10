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

const db = () => supabase as any;

function throwIfError<T>(result: { data: T; error: any }): T {
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

// ── SIREN API ─────────────────────────────────────────────────────

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

  const response = await fetch(
    `https://api.insee.fr/entreprises/sirene/V3.11/siren/${cleanSiren}`,
    {
      headers: {
        Accept: "application/json",
      },
    }
  );

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error("SIREN introuvable dans la base INSEE.");
    }
    throw new Error(`Erreur API INSEE (${response.status})`);
  }

  const data = await response.json();
  const unit = data.uniteLegale;
  const periods = unit.periodesUniteLegale?.[0];
  const denomination =
    periods?.denominationUniteLegale ||
    `${periods?.prenomUsuelUniteLegale || ""} ${periods?.nomUniteLegale || ""}`.trim();

  // Get the siege address
  const adresse = unit.adresseEtablissement || {};
  const numero = adresse.numeroVoieEtablissement || "";
  const typeVoie = adresse.typeVoieEtablissement || "";
  const libelle = adresse.libelleVoieEtablissement || "";
  const addressLine = `${numero} ${typeVoie} ${libelle}`.trim();
  const zip = adresse.codePostalEtablissement || "";
  const city = adresse.libelleCommuneEtablissement || "";

  // Compute VAT number: FR + key + SIREN
  const sirenNum = parseInt(cleanSiren, 10);
  const key = (12 + 3 * (sirenNum % 97)) % 97;
  const vatNumber = `FR${String(key).padStart(2, "0")}${cleanSiren}`;

  return {
    siren: cleanSiren,
    denomination,
    address: addressLine,
    zip,
    city,
    vatNumber,
  };
}
