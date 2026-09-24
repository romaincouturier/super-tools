/**
 * Facture Pennylane en BROUILLON : activités d'une mission, prolongation de location.
 *
 * Même périmètre fermé que les devis (`pennylane-quotes.ts`) : un seul chemin
 * d'écriture, `POST /customer_invoices` avec `draft: true`. Aucune validation
 * ni envoi au client : la facture se finalise dans Pennylane.
 *
 * Les lignes et les contrôles (dates, montants, taux de TVA) sont ceux des
 * devis : `buildQuotePayload` produit le même format `invoice_lines`, déjà
 * éprouvé sur les devis SuperTools. Le payload est volontairement minimal :
 * pas de champ propre aux devis (pdf_description, special_mention).
 */
import {
  buildQuotePayload,
  resolveCustomer,
  todayParis,
  type CustomerInput,
  type QuoteLineInput,
} from "./pennylane-quotes.ts";
import { getPennylaneToken, pennylaneErrorMessage, pennylaneFetch } from "./pennylane.ts";

type Supabase = Parameters<typeof getPennylaneToken>[0];

export const INVOICE_PAYMENT_DAYS = 30;

export type InvoiceActivity = {
  id: string;
  description: string;
  activity_date: string;
  duration: number;
  duration_type: "hours" | "days";
  billable_amount: number | null;
};

/** Échéance à J+30 d'une date YYYY-MM-DD, calculée en UTC pour ne pas glisser d'un jour. */
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function frDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

function durationLabel(a: InvoiceActivity): string {
  const n = String(a.duration).replace(".", ",");
  if (a.duration_type === "days") return `${n} jour${a.duration > 1 ? "s" : ""}`;
  return `${n} h`;
}

/** Payload brouillon `POST /customer_invoices`, échéance à J+30. */
export function buildDraftInvoicePayload(
  lines: QuoteLineInput[],
  customerId: number,
  date = todayParis(),
): Record<string, unknown> {
  const quote = buildQuotePayload({ date, deadline: addDays(date, INVOICE_PAYMENT_DAYS), lines }, customerId);
  return {
    customer_id: quote.customer_id,
    date: quote.date,
    deadline: quote.deadline,
    currency: quote.currency,
    invoice_lines: quote.invoice_lines,
    draft: true,
  };
}

function missionLines(activities: InvoiceActivity[], vatRate: string): QuoteLineInput[] {
  if (activities.length === 0) throw new Error("Aucune activité à facturer");
  const missing = activities.filter((a) => !a.billable_amount || a.billable_amount <= 0);
  if (missing.length > 0) {
    throw new Error(
      `Montant facturable manquant sur : ${missing.map((a) => a.description || a.activity_date).join(", ")}`,
    );
  }
  return activities.map((a) => ({
    label: a.description.trim() || `Activité du ${frDate(a.activity_date)}`,
    description: `${frDate(a.activity_date)} · ${durationLabel(a)}`,
    quantity: 1,
    unit_price: a.billable_amount as number,
    vat_rate: vatRate,
  }));
}

/** Une ligne par activité : libellé = description, détail = date et durée. */
export function buildMissionInvoicePayload(
  activities: InvoiceActivity[],
  customerId: number,
  vatRate: string,
  date = todayParis(),
): Record<string, unknown> {
  return buildDraftInvoicePayload(missionLines(activities, vatRate), customerId, date);
}

function pick(data: unknown, keys: string[]): unknown {
  const root = (data ?? {}) as Record<string, unknown>;
  const body = (root.customer_invoice ?? root.invoice ?? root.data ?? root) as Record<string, unknown>;
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null) return body[key];
  }
  return undefined;
}

export type CreatedInvoice = {
  id: unknown;
  number: unknown;
  pdfUrl: unknown;
  customerId: number;
  customerCreated: boolean;
};

/**
 * Crée le brouillon. Le POST n'est JAMAIS rejoué : il n'est pas idempotent, un
 * second essai après timeout laisserait deux brouillons. La fiche client est
 * retrouvée par email, ou créée ; une fiche existante n'est jamais modifiée.
 */
export async function createDraftInvoice(
  supabase: Supabase,
  lines: QuoteLineInput[],
  customer: CustomerInput,
): Promise<CreatedInvoice> {
  // Validé sur un client fictif avant toute écriture : une ligne invalide ne
  // doit pas laisser une fiche client créée pour rien.
  buildDraftInvoicePayload(lines, 1);

  const token = await getPennylaneToken(supabase);
  const resolved = await resolveCustomer(token, { customer, deadline: "", lines: [] });
  const payload = buildDraftInvoicePayload(lines, resolved.id);

  const res = await pennylaneFetch(token, "POST", "customer_invoices", { body: payload });
  if (!res.ok) throw new Error(pennylaneErrorMessage(res, "Création de la facture refusée"));

  return {
    id: pick(res.data, ["id"]),
    number: pick(res.data, ["invoice_number", "number"]),
    pdfUrl: pick(res.data, ["public_file_url", "file_url", "pdf_url"]),
    customerId: resolved.id,
    customerCreated: resolved.created,
  };
}

export async function createMissionDraftInvoice(
  supabase: Supabase,
  activities: InvoiceActivity[],
  customer: CustomerInput,
  vatRate: string,
): Promise<CreatedInvoice> {
  return await createDraftInvoice(supabase, missionLines(activities, vatRate), customer);
}
