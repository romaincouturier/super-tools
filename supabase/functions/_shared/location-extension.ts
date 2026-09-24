/**
 * Prolongation de location : règles pures partagées par la création de la
 * prolongation (facture Pennylane) et la génération de l'avenant PDF.
 */
import type { QuoteLineInput } from "./pennylane-quotes.ts";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 86_400_000;

export function frDate(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

export function daysBetween(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Début proposé d'une nouvelle prolongation : fin de la dernière prolongation,
 * sinon fin connue de la location, sinon date de commande + durée du contrat.
 */
export function suggestedExtensionStart(input: {
  lastExtensionEnd: string | null;
  locationEndDate: string | null;
  orderDate: string | null;
  durationDays: number | null;
}): string | null {
  if (input.lastExtensionEnd) return input.lastExtensionEnd;
  if (input.locationEndDate) return input.locationEndDate;
  if (input.orderDate && input.durationDays) return addDays(input.orderDate.slice(0, 10), input.durationDays);
  return null;
}

/** LOC-2026-001 → LOC-2026-001-P1, LOC-2026-001-P2… */
export function extensionReference(parentReference: string, sequence: number): string {
  return `${parentReference}-P${sequence}`;
}

export function validateExtensionPeriod(start: string, end: string): void {
  if (!DATE_RE.test(start)) throw new Error(`Date de début invalide (${start || "vide"})`);
  if (!DATE_RE.test(end)) throw new Error(`Date de fin invalide (${end || "vide"})`);
  if (end <= start) throw new Error("La date de fin doit être postérieure à la date de début");
}

export function extensionInvoiceLine(input: {
  gameTitle: string;
  reference: string;
  start: string;
  end: string;
  amountHt: number;
  vatRate: string;
}): QuoteLineInput {
  return {
    label: `Prolongation de location : ${input.gameTitle}`,
    description: `Du ${frDate(input.start)} au ${frDate(input.end)} · avenant ${input.reference}`,
    quantity: 1,
    unit_price: input.amountHt,
    vat_rate: input.vatRate,
  };
}
