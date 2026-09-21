/**
 * Création de devis Pennylane en BROUILLON, depuis SuperTools.
 *
 * Périmètre volontairement fermé : ce module ne connaît qu'un seul chemin
 * d'écriture, `POST /quotes`. Aucun envoi au client, aucune validation, aucune
 * transformation en facture (`customer_invoices/create_from_quote`) n'est
 * atteignable d'ici — le chemin est en dur, pas paramétrable.
 *
 * La construction du payload est une fonction pure (`buildQuotePayload`) pour
 * être testée sans réseau : c'est la seule partie où une erreur passerait
 * inaperçue, l'appel HTTP se contentant de remonter le refus de Pennylane.
 */
import {
  getPennylaneToken,
  pennylaneErrorMessage,
  pennylaneFetch,
} from "./pennylane.ts";

// deno-lint-ignore no-explicit-any
type Supabase = any;
type AuditFn = (label: string) => Promise<void>;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Pennylane nomme ses taux `FR_` + le taux en centièmes de point : FR_200 pour
 * 20 %, FR_100 pour 10 %, FR_055 pour 5,5 %, FR_021 pour 2,1 %, FR_000 pour 0 %.
 * On vérifie la FORME et non une liste figée : la liste exacte appartient à
 * Pennylane, qui refuse lui-même une valeur inconnue en 422 avec le nom du
 * champ. Une allowlist recopiée ici divergerait en silence (règle [052]).
 */
const VAT_RATE_RE = /^FR_\d{3}$/;

export type QuoteLineInput = {
  label: string;
  description?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  vat_rate: string;
};

export type CreateQuoteInput = {
  customer_id: number;
  date?: string;
  deadline: string;
  currency?: string;
  pdf_description?: string;
  special_mention?: string;
  external_reference?: string;
  lines: QuoteLineInput[];
  crm_card_id?: string;
};

/** Date du jour à Paris — un devis daté en UTC bascule la veille en soirée. */
export function todayParis(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/**
 * Payload `POST /quotes`. Lève sur toute entrée invalide : mieux vaut refuser
 * avant l'appel que créer un brouillon faux dans la comptabilité.
 */
export function buildQuotePayload(input: CreateQuoteInput): Record<string, unknown> {
  if (!Number.isInteger(input.customer_id) || input.customer_id <= 0) {
    throw new Error(
      "customer_id doit être l'identifiant Pennylane du client (entier). Le retrouver avec le connecteur Pennylane (list_customers).",
    );
  }

  const date = (input.date || todayParis()).trim();
  const deadline = (input.deadline || "").trim();
  if (!DATE_RE.test(date)) throw new Error(`date invalide (${date}) : format attendu YYYY-MM-DD`);
  if (!DATE_RE.test(deadline)) {
    throw new Error(`deadline invalide (${deadline || "vide"}) : format attendu YYYY-MM-DD`);
  }
  if (deadline < date) {
    throw new Error(`deadline (${deadline}) antérieure à la date du devis (${date})`);
  }

  const lines = input.lines ?? [];
  if (lines.length === 0) throw new Error("lines est requis : un devis sans ligne n'a pas de montant");

  const invoiceLines = lines.map((line, i) => {
    const label = (line.label || "").trim();
    if (!label) throw new Error(`ligne ${i + 1} : label est requis`);
    if (!(typeof line.quantity === "number" && Number.isFinite(line.quantity) && line.quantity > 0)) {
      throw new Error(`ligne ${i + 1} (${label}) : quantity doit être un nombre strictement positif`);
    }
    if (!(typeof line.unit_price === "number" && Number.isFinite(line.unit_price) && line.unit_price >= 0)) {
      throw new Error(`ligne ${i + 1} (${label}) : unit_price doit être un nombre positif, en euros HT`);
    }
    const vatRate = (line.vat_rate || "").trim();
    if (!VAT_RATE_RE.test(vatRate)) {
      throw new Error(
        `ligne ${i + 1} (${label}) : vat_rate invalide (${vatRate || "vide"}). Forme attendue FR_XXX — FR_200 (20 %), FR_100 (10 %), FR_055 (5,5 %), FR_021 (2,1 %), FR_000 (0 % / exonéré).`,
      );
    }

    return {
      label,
      ...(line.description ? { description: line.description } : {}),
      quantity: line.quantity,
      ...(line.unit ? { unit: line.unit } : {}),
      // Pennylane attend le prix unitaire HT en chaîne, pour ne pas perdre de
      // décimale au passage en flottant.
      raw_currency_unit_price: line.unit_price.toFixed(2),
      vat_rate: vatRate,
    };
  });

  return {
    customer_id: input.customer_id,
    date,
    deadline,
    currency: input.currency || "EUR",
    ...(input.pdf_description ? { pdf_description: input.pdf_description } : {}),
    ...(input.special_mention ? { special_mention: input.special_mention } : {}),
    ...(input.external_reference ? { external_reference: input.external_reference } : {}),
    invoice_lines: invoiceLines,
  };
}

/** Lit une valeur quel que soit l'enrobage de la réponse ({ quote: {...} } ou l'objet nu). */
function pick(data: unknown, keys: string[]): unknown {
  const root = (data ?? {}) as Record<string, unknown>;
  const body = (root.quote ?? root.data ?? root) as Record<string, unknown>;
  for (const key of keys) {
    if (body[key] !== undefined && body[key] !== null) return body[key];
  }
  return undefined;
}

export type CreatedQuote = {
  id: unknown;
  number: unknown;
  pdfUrl: unknown;
  status: unknown;
  crmComment: "écrit" | "ignoré" | string;
  payload: Record<string, unknown>;
  response: unknown;
};

/**
 * Crée le devis en brouillon et, si une carte CRM est fournie, y dépose la
 * référence. L'appel de création n'est JAMAIS rejoué : un POST /quotes n'est
 * pas idempotent, et un second essai après timeout laisserait deux devis dans
 * la comptabilité. En cas d'échec réseau, l'appelant vérifie dans Pennylane
 * avant de relancer.
 */
export async function createDraftQuote(
  supabase: Supabase,
  input: CreateQuoteInput,
  audit: AuditFn,
  authorEmail: string,
): Promise<CreatedQuote> {
  const payload = buildQuotePayload(input);

  const cardId = (input.crm_card_id || "").trim();
  if (cardId && !UUID_RE.test(cardId)) {
    throw new Error(`crm_card_id doit être un UUID de carte CRM SuperTools (reçu : ${cardId})`);
  }

  const token = await getPennylaneToken(supabase);
  const res = await pennylaneFetch(token, "POST", "quotes", { body: payload });
  if (!res.ok) {
    throw new Error(pennylaneErrorMessage(res, "Création du devis refusée"));
  }

  const quote: CreatedQuote = {
    id: pick(res.data, ["id"]),
    number: pick(res.data, ["quote_number", "number", "invoice_number"]),
    pdfUrl: pick(res.data, ["file_url", "public_file_url", "pdf_url"]),
    status: pick(res.data, ["status"]),
    crmComment: "ignoré",
    payload,
    response: res.data,
  };

  await audit(
    `create_quote → devis Pennylane ${quote.number ?? quote.id ?? "?"} (client ${input.customer_id}, ${input.lines.length} ligne(s))`,
  );
  console.log(
    `[create_quote] devis brouillon créé id=${quote.id} numero=${quote.number} client=${input.customer_id} carte_crm=${cardId || "-"}`,
  );

  if (cardId) {
    const reference = [
      `Devis Pennylane ${quote.number ?? quote.id ?? ""} créé en brouillon.`,
      quote.pdfUrl ? `PDF (lien temporaire) : ${quote.pdfUrl}` : null,
      quote.id ? `https://app.pennylane.com/companies/quotes/${quote.id}` : null,
    ].filter(Boolean).join("\n");

    const { error } = await supabase.from("crm_comments").insert({
      card_id: cardId,
      author_email: authorEmail,
      content: reference,
    });
    // Le devis existe déjà : un échec CRM se signale, il n'annule rien.
    quote.crmComment = error ? `échec (${error.message})` : "écrit";
  }

  return quote;
}
