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
  CUSTOMER_PAGE_SIZE,
  findCustomersByEmail,
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
 * Deux formes coexistent chez Pennylane, toutes deux relevées dans les factures
 * SuperTilt : `FR_` + le taux en centièmes de point (FR_200 pour 20 %, FR_100,
 * FR_055, FR_021, FR_000) et `exempt` pour l'exonération — c'est cette
 * dernière, et non FR_000, que portent les factures de formation exonérées au
 * titre de l'art. 261-4-4 du CGI (F-2026-116, F-2026-141).
 *
 * On vérifie la FORME et non une liste figée : la liste exacte appartient à
 * Pennylane, qui refuse lui-même une valeur inconnue en 422 avec le nom du
 * champ. Une allowlist recopiée ici divergerait en silence (règle [052]).
 */
const VAT_EXEMPT = "exempt";
const VAT_RATE_RE = /^FR_\d{3}$/;

function isValidVatRate(value: string): boolean {
  return value === VAT_EXEMPT || VAT_RATE_RE.test(value);
}

export type QuoteLineInput = {
  label: string;
  description?: string;
  quantity: number;
  unit?: string;
  unit_price: number;
  vat_rate: string;
};

export type CustomerInput = {
  type: "individual" | "company";
  /** Particulier : prénom et nom. Société : raison sociale dans `name`. */
  first_name?: string;
  last_name?: string;
  name?: string;
  email: string;
  phone?: string;
  address?: string;
  postal_code?: string;
  city?: string;
  country_alpha2?: string;
  /** SIREN ou SIRET, pour une société. */
  reg_no?: string;
};

export type CreateQuoteInput = {
  customer_id?: number;
  customer?: CustomerInput;
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
export function buildQuotePayload(
  input: CreateQuoteInput,
  customerId: number,
): Record<string, unknown> {
  if (!Number.isInteger(customerId) || customerId <= 0) {
    throw new Error(`Identifiant client Pennylane invalide (${customerId})`);
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
    if (!isValidVatRate(vatRate)) {
      throw new Error(
        `ligne ${i + 1} (${label}) : vat_rate invalide (${vatRate || "vide"}). Valeurs attendues : "exempt" pour une formation exonérée (art. 261-4-4 du CGI), sinon FR_XXX — FR_200 (20 %), FR_100 (10 %), FR_055 (5,5 %), FR_021 (2,1 %).`,
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
    customer_id: customerId,
    date,
    deadline,
    currency: input.currency || "EUR",
    ...(input.pdf_description ? { pdf_description: input.pdf_description } : {}),
    ...(input.special_mention ? { special_mention: input.special_mention } : {}),
    ...(input.external_reference ? { external_reference: input.external_reference } : {}),
    invoice_lines: invoiceLines,
  };
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;

/**
 * Payload `POST /customers`. Le pays n'est envoyé que s'il est fourni : la
 * fiche client renvoyée par Pennylane porte `country`, mais l'API externe
 * attend `country_alpha2`, et une valeur par défaut posée sur le mauvais champ
 * ferait échouer toutes les créations plutôt que les seules où l'adresse
 * compte.
 */
export function buildCustomerPayload(customer: CustomerInput): Record<string, unknown> {
  const email = (customer.email || "").trim();
  if (!EMAIL_RE.test(email)) {
    throw new Error(`email client invalide (${email || "vide"}) : il sert à retrouver la fiche et à éviter un doublon`);
  }

  const common = {
    emails: [email],
    ...(customer.phone ? { phone: customer.phone.trim() } : {}),
    ...(customer.address ? { address: customer.address.trim() } : {}),
    ...(customer.postal_code ? { postal_code: customer.postal_code.trim() } : {}),
    ...(customer.city ? { city: customer.city.trim() } : {}),
    ...(customer.country_alpha2 ? { country_alpha2: customer.country_alpha2.trim().toUpperCase() } : {}),
  };

  if (customer.type === "individual") {
    const firstName = (customer.first_name || "").trim();
    const lastName = (customer.last_name || "").trim();
    if (!firstName || !lastName) {
      throw new Error("Un client particulier exige first_name et last_name");
    }
    return { customer_type: "individual", first_name: firstName, last_name: lastName, ...common };
  }

  const name = (customer.name || "").trim();
  if (!name) throw new Error("Un client société exige name (raison sociale)");
  return {
    customer_type: "company",
    name,
    ...(customer.reg_no ? { reg_no: customer.reg_no.replace(/\s+/g, "") } : {}),
    ...common,
  };
}

export type ResolvedCustomer = { id: number; created: boolean };

/**
 * Identifiant du client Pennylane : celui fourni, sinon la fiche portant cet
 * email, sinon une fiche créée.
 *
 * Ne met JAMAIS à jour une fiche existante — un devis ne doit pas réécrire
 * l'adresse ou le nom d'un client au passage. En cas de doute (plusieurs fiches
 * pour le même email, ou parcours tronqué avant d'avoir tout vu), l'appel
 * s'arrête : créer un doublon dans la comptabilité coûte plus cher que
 * demander l'identifiant.
 */
export async function resolveCustomer(
  token: string,
  input: CreateQuoteInput,
): Promise<ResolvedCustomer> {
  if (input.customer_id !== undefined) {
    if (!Number.isInteger(input.customer_id) || input.customer_id <= 0) {
      throw new Error(`customer_id doit être un entier positif (reçu : ${input.customer_id})`);
    }
    return { id: input.customer_id, created: false };
  }

  if (!input.customer) {
    throw new Error(
      "Fournir customer_id (identifiant Pennylane, via le connecteur Pennylane list_customers) ou customer (fiche à retrouver ou créer).",
    );
  }

  // Payload validé AVANT la recherche : inutile de parcourir les clients pour
  // échouer ensuite sur un prénom manquant.
  const payload = buildCustomerPayload(input.customer);
  const email = (input.customer.email || "").trim();

  const scan = await findCustomersByEmail(
    (cursor) =>
      pennylaneFetch(token, "GET", "customers", {
        query: { per_page: CUSTOMER_PAGE_SIZE, ...(cursor ? { cursor } : {}) },
      }),
    email,
  );
  if ("error" in scan) throw new Error(scan.error);

  if (scan.matches.length === 1) {
    const id = Number(scan.matches[0].id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new Error(`Fiche client trouvée pour ${email} mais son identifiant est illisible`);
    }
    return { id, created: false };
  }
  if (scan.matches.length > 1) {
    throw new Error(
      `${scan.matches.length} fiches clients portent l'email ${email} (${scan.matches.map((m) => m.name ?? m.id).join(", ")}). Passer customer_id pour lever l'ambiguïté.`,
    );
  }
  if (scan.truncated) {
    throw new Error(
      `Aucune fiche trouvée pour ${email}, mais le parcours des clients s'est arrêté au plafond (${scan.scanned} fiches lues) : impossible d'affirmer qu'elle n'existe pas. Passer customer_id.`,
    );
  }

  const res = await pennylaneFetch(token, "POST", "customers", { body: payload });
  if (!res.ok) throw new Error(pennylaneErrorMessage(res, "Création du client refusée"));

  const id = Number(pick(res.data, ["id"]));
  if (!Number.isInteger(id) || id <= 0) {
    throw new Error(`Client créé mais identifiant illisible dans la réponse Pennylane : ${res.raw}`);
  }
  return { id, created: true };
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
  customerId: number;
  customerCreated: boolean;
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
  const cardId = (input.crm_card_id || "").trim();
  if (cardId && !UUID_RE.test(cardId)) {
    throw new Error(`crm_card_id doit être un UUID de carte CRM SuperTools (reçu : ${cardId})`);
  }
  // Le devis est validé sur un identifiant client fictif avant toute écriture :
  // une ligne mal formée ne doit pas laisser derrière elle une fiche client
  // créée pour rien.
  buildQuotePayload(input, 1);

  const token = await getPennylaneToken(supabase);
  const customer = await resolveCustomer(token, input);
  const payload = buildQuotePayload(input, customer.id);

  const res = await pennylaneFetch(token, "POST", "quotes", { body: payload });
  if (!res.ok) {
    throw new Error(pennylaneErrorMessage(res, "Création du devis refusée"));
  }

  const quote: CreatedQuote = {
    customerId: customer.id,
    customerCreated: customer.created,
    id: pick(res.data, ["id"]),
    number: pick(res.data, ["quote_number", "number", "invoice_number"]),
    pdfUrl: pick(res.data, ["file_url", "public_file_url", "pdf_url"]),
    status: pick(res.data, ["status"]),
    crmComment: "ignoré",
    payload,
    response: res.data,
  };

  await audit(
    `create_quote → devis Pennylane ${quote.number ?? quote.id ?? "?"} (client ${customer.id}${customer.created ? " créé" : ""}, ${input.lines.length} ligne(s))`,
  );
  console.log(
    `[create_quote] devis brouillon créé id=${quote.id} numero=${quote.number} client=${customer.id}${customer.created ? " (créé)" : ""} carte_crm=${cardId || "-"}`,
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
