import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildCustomerRequest, buildQuotePayload, createDraftQuote, todayParis } from "./pennylane-quotes.ts";

const LINE = {
  label: "Atelier de facilitation graphique",
  description: "Journée animée sur site",
  quantity: 2,
  unit: "day",
  unit_price: 1450,
  vat_rate: "FR_200",
};

const INPUT = {
  customer_id: 4271,
  date: "2026-09-21",
  deadline: "2026-10-21",
  lines: [LINE],
};

describe("buildQuotePayload", () => {
  it("construit le payload attendu par POST /quotes", () => {
    const payload = buildQuotePayload({
      ...INPUT,
      pdf_description: "Contexte / Enjeux / Dispositif",
      special_mention: "Exonération de TVA, art. 261-4-4 du CGI",
      external_reference: "CRM-118",
    }, 4271);

    expect(payload).toEqual({
      customer_id: 4271,
      date: "2026-09-21",
      deadline: "2026-10-21",
      currency: "EUR",
      pdf_description: "Contexte / Enjeux / Dispositif",
      special_mention: "Exonération de TVA, art. 261-4-4 du CGI",
      external_reference: "CRM-118",
      invoice_lines: [{
        label: "Atelier de facilitation graphique",
        description: "Journée animée sur site",
        quantity: 2,
        unit: "day",
        raw_currency_unit_price: "1450.00",
        vat_rate: "FR_200",
      }],
    });
  });

  it("omet les champs facultatifs non fournis plutôt que d'envoyer des vides", () => {
    const payload = buildQuotePayload({
      ...INPUT,
      lines: [{ label: "Forfait", quantity: 1, unit_price: 900, vat_rate: "FR_200" }],
    }, 4271) as Record<string, unknown>;
    expect(payload).not.toHaveProperty("pdf_description");
    expect(payload).not.toHaveProperty("special_mention");
    expect(payload).not.toHaveProperty("external_reference");
    const line = (payload.invoice_lines as Array<Record<string, unknown>>)[0];
    expect(line).not.toHaveProperty("unit");
    expect(line).not.toHaveProperty("description");
  });

  it("date par défaut = aujourd'hui à Paris", () => {
    const payload = buildQuotePayload({ ...INPUT, date: undefined }, 4271) as Record<string, unknown>;
    expect(payload.date).toBe(todayParis());
  });

  it("refuse une deadline antérieure à la date du devis", () => {
    expect(() => buildQuotePayload({ ...INPUT, deadline: "2026-09-01" }, 4271))
      .toThrow(/antérieure/);
  });

  it("refuse un format de date non ISO", () => {
    expect(() => buildQuotePayload({ ...INPUT, deadline: "21/10/2026" }, 4271))
      .toThrow(/YYYY-MM-DD/);
  });

  it("refuse un taux de TVA hors forme FR_XXX", () => {
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, vat_rate: "20" }] }, 4271))
      .toThrow(/vat_rate invalide/);
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, vat_rate: "" }] }, 4271))
      .toThrow(/vat_rate invalide/);
  });

  // Les factures de formation SuperTilt (F-2026-116 AKTO, F-2026-141 Lopvet)
  // portent vat_rate "exempt", pas FR_000 : le garde-fou doit l'accepter tel
  // quel, sinon aucun devis de formation exonérée ne peut être créé.
  it("accepte exempt (exonération formation) et FR_000", () => {
    for (const rate of ["exempt", "FR_000"]) {
      const payload = buildQuotePayload({ ...INPUT, lines: [{ ...LINE, vat_rate: rate }] }, 4271) as Record<string, unknown>;
      expect((payload.invoice_lines as Array<Record<string, unknown>>)[0].vat_rate).toBe(rate);
    }
  });

  it("refuse une variante approximative de l'exonération", () => {
    for (const rate of ["EXEMPT", "exonere", "exempté"]) {
      expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, vat_rate: rate }] }, 4271))
        .toThrow(/vat_rate invalide/);
    }
  });

  it("refuse un devis sans ligne, une quantité nulle, un prix négatif, un label vide", () => {
    expect(() => buildQuotePayload({ ...INPUT, lines: [] }, 4271)).toThrow(/lines est requis/);
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, quantity: 0 }] }, 4271)).toThrow(/quantity/);
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, unit_price: -1 }] }, 4271)).toThrow(/unit_price/);
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, label: "  " }] }, 4271)).toThrow(/label est requis/);
  });

  it("refuse un identifiant client invalide", () => {
    expect(() => buildQuotePayload(INPUT, 0)).toThrow(/Identifiant client/);
    expect(() => buildQuotePayload(INPUT, 4271.5)).toThrow(/Identifiant client/);
  });
});

// ── createDraftQuote ────────────────────────────────────────────────────────

const CARD_ID = "3f1c2a64-5b7e-4d21-9a08-1e2f3c4d5b6a";

function makeSupabase(options: { token?: string | null; crmError?: string } = {}) {
  const inserts: Array<{ table: string; payload: unknown }> = [];
  const client = {
    from(table: string) {
      if (table === "app_settings") {
        return {
          select: () => ({
            eq: () => ({
              maybeSingle: () =>
                Promise.resolve({
                  data: options.token === null ? null : { setting_value: options.token ?? "tok_live" },
                }),
            }),
          }),
        };
      }
      return {
        insert: (payload: unknown) => {
          inserts.push({ table, payload });
          return Promise.resolve({
            error: options.crmError ? { message: options.crmError } : null,
          });
        },
      };
    },
  };
  return { client, inserts };
}

type Reply = { ok: boolean; status: number; body: unknown };

/**
 * Route les appels par `METHOD chemin`. Par défaut, aucun client ne porte
 * l'email cherché : la liste est vide et complète, donc le tool crée la fiche.
 */
function mockFetch(routes: Record<string, Reply | Reply[]>) {
  const calls: Array<{ key: string; url: string; init: RequestInit; body: unknown }> = [];
  const defaults: Record<string, Reply> = {
    "GET customers": { ok: true, status: 200, body: { items: [], has_more: false } },
  };

  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    const u = new URL(String(url));
    const key = `${init.method} ${u.pathname.replace("/api/external/v2/", "")}`;
    calls.push({
      key,
      url: String(url),
      init,
      body: init.body ? JSON.parse(String(init.body)) : undefined,
    });

    let reply = routes[key] ?? defaults[key];
    if (Array.isArray(reply)) {
      const seen = calls.filter((c) => c.key === key).length - 1;
      reply = reply[Math.min(seen, reply.length - 1)];
    }
    if (!reply) throw new Error(`Appel non prévu par le test : ${key}`);

    return Promise.resolve({
      ok: reply.ok,
      status: reply.status,
      text: () => Promise.resolve(JSON.stringify(reply.body)),
    } as Response);
  });
  return calls;
}

describe("createDraftQuote", () => {
  const audit = vi.fn(() => Promise.resolve());

  beforeEach(() => audit.mockClear());
  afterEach(() => vi.unstubAllGlobals());

  const OK_BODY = {
    id: 99120,
    quote_number: "DEV-2026-0043",
    status: "draft",
    file_url: "https://files.pennylane.com/tmp/devis.pdf",
  };

  it("appelle POST /quotes une seule fois et ne touche aucun endroit d'envoi", async () => {
    const calls = mockFetch({ "POST quotes": { ok: true, status: 201, body: OK_BODY } });
    const { client } = makeSupabase();

    const quote = await createDraftQuote(client, INPUT, audit, "romain@supertilt.fr");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://app.pennylane.com/api/external/v2/quotes");
    expect(calls[0].init.method).toBe("POST");
    // Aucun chemin d'envoi, de validation ou de facturation n'est atteignable.
    expect(calls[0].url).not.toMatch(/send|finalize|validate|customer_invoices/);
    expect(quote.customerCreated).toBe(false);
    expect(quote.number).toBe("DEV-2026-0043");
    expect(quote.status).toBe("draft");
    expect(quote.pdfUrl).toBe("https://files.pennylane.com/tmp/devis.pdf");
    expect(audit).toHaveBeenCalledOnce();
  });

  it("n'appelle pas Pennylane quand le payload est invalide", async () => {
    const calls = mockFetch({ "POST quotes": { ok: true, status: 201, body: OK_BODY } });
    const { client } = makeSupabase();

    await expect(
      createDraftQuote(client, { ...INPUT, lines: [{ ...LINE, vat_rate: "FR_2000" }] }, audit, "romain@supertilt.fr"),
    ).rejects.toThrow(/vat_rate invalide/);
    expect(calls).toHaveLength(0);
  });

  it("remonte le corps d'erreur Pennylane tel quel et ne rejoue pas l'appel", async () => {
    const calls = mockFetch({
      "POST quotes": { ok: false, status: 422, body: { message: "invoice_lines[0].vat_rate is invalid" } },
    });
    const { client } = makeSupabase();

    await expect(createDraftQuote(client, INPUT, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/HTTP 422.*vat_rate is invalid/s);
    expect(calls).toHaveLength(1);
  });

  it("traduit un 403 en scope manquant", async () => {
    mockFetch({ "POST quotes": { ok: false, status: 403, body: { error: "forbidden" } } });
    const { client } = makeSupabase();
    await expect(createDraftQuote(client, INPUT, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/quotes:all/);
  });

  it("échoue avant tout appel si le token n'est pas configuré", async () => {
    const calls = mockFetch({ "POST quotes": { ok: true, status: 201, body: OK_BODY } });
    const { client } = makeSupabase({ token: null });
    await expect(createDraftQuote(client, INPUT, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/Token API Pennylane non configuré/);
    expect(calls).toHaveLength(0);
  });

  it("dépose la référence du devis en commentaire sur la carte CRM", async () => {
    mockFetch({ "POST quotes": { ok: true, status: 201, body: OK_BODY } });
    const { client, inserts } = makeSupabase();

    const quote = await createDraftQuote(
      client,
      { ...INPUT, crm_card_id: CARD_ID },
      audit,
      "romain@supertilt.fr",
    );

    expect(quote.crmComment).toBe("écrit");
    expect(inserts).toHaveLength(1);
    expect(inserts[0].table).toBe("crm_comments");
    const payload = inserts[0].payload as Record<string, string>;
    expect(payload.card_id).toBe(CARD_ID);
    expect(payload.author_email).toBe("romain@supertilt.fr");
    expect(payload.content).toContain("DEV-2026-0043");
    expect(payload.content).toContain("https://files.pennylane.com/tmp/devis.pdf");
  });

  it("un échec d'écriture CRM est signalé mais n'annule pas le devis déjà créé", async () => {
    mockFetch({ "POST quotes": { ok: true, status: 201, body: OK_BODY } });
    const { client } = makeSupabase({ crmError: "card not found" });

    const quote = await createDraftQuote(
      client,
      { ...INPUT, crm_card_id: CARD_ID },
      audit,
      "romain@supertilt.fr",
    );

    expect(quote.number).toBe("DEV-2026-0043");
    expect(quote.crmComment).toMatch(/échec \(card not found\)/);
  });

  it("refuse un crm_card_id qui n'est pas un UUID, avant tout appel", async () => {
    const calls = mockFetch({ "POST quotes": { ok: true, status: 201, body: OK_BODY } });
    const { client } = makeSupabase();
    await expect(
      createDraftQuote(client, { ...INPUT, crm_card_id: "carte-118" }, audit, "romain@supertilt.fr"),
    ).rejects.toThrow(/UUID/);
    expect(calls).toHaveLength(0);
  });
});

// ── Résolution / création du client ─────────────────────────────────────────

const DELAVAL = {
  type: "individual" as const,
  first_name: "Béatrice",
  last_name: "Delaval",
  email: "beatrice.delaval@puy-de-dome.fr",
  address: "24 rue Saint-Esprit",
  postal_code: "63000",
  city: "Clermont-Ferrand",
};

const DEPARTEMENT = {
  type: "company" as const,
  name: "CONSEIL DEPARTEMENTAL DU PUY-DE-DOME",
  reg_no: "226 300 010",
  email: "beatrice.delaval@puy-de-dome.fr",
  address: "24 rue Saint-Esprit",
  postal_code: "63000",
  city: "Clermont-Ferrand",
};

const QUOTE_NO_ID = { ...INPUT, customer_id: undefined };

describe("buildCustomerRequest", () => {
  // L'API v2 n'a pas de POST /customers : le type est porté par l'endpoint,
  // et l'adresse est un objet billing_address imbriqué.
  it("vise individual_customers pour un particulier", () => {
    expect(buildCustomerRequest(DELAVAL)).toEqual({
      path: "individual_customers",
      body: {
        first_name: "Béatrice",
        last_name: "Delaval",
        emails: ["beatrice.delaval@puy-de-dome.fr"],
        billing_address: {
          address: "24 rue Saint-Esprit",
          postal_code: "63000",
          city: "Clermont-Ferrand",
          country: "FR",
        },
      },
    });
  });

  it("vise company_customers pour une société, SIREN sans espaces", () => {
    expect(buildCustomerRequest(DEPARTEMENT)).toEqual({
      path: "company_customers",
      body: {
        name: "CONSEIL DEPARTEMENTAL DU PUY-DE-DOME",
        reg_no: "226300010",
        emails: ["beatrice.delaval@puy-de-dome.fr"],
        billing_address: {
          address: "24 rue Saint-Esprit",
          postal_code: "63000",
          city: "Clermont-Ferrand",
          country: "FR",
        },
      },
    });
  });

  it("n'envoie aucun champ hors du corps documenté", () => {
    const { body } = buildCustomerRequest(DELAVAL);
    expect(body).not.toHaveProperty("phone");
    expect(body).not.toHaveProperty("customer_type");
    expect(body).not.toHaveProperty("address");
    expect(body).not.toHaveProperty("country_alpha2");
  });

  it("nomme précisément ce qui manque dans l'adresse de facturation", () => {
    expect(() => buildCustomerRequest({ ...DELAVAL, postal_code: "", city: "" }))
      .toThrow(/postal_code, city manquant/);
  });

  it("exige prénom et nom pour un particulier, raison sociale pour une société", () => {
    expect(() => buildCustomerRequest({ ...DELAVAL, first_name: "" })).toThrow(/first_name et last_name/);
    expect(() => buildCustomerRequest({ ...DEPARTEMENT, name: "" })).toThrow(/raison sociale/);
  });

  it("refuse un email inexploitable — c'est lui qui évite le doublon", () => {
    expect(() => buildCustomerRequest({ ...DELAVAL, email: "beatrice.delaval" })).toThrow(/email client invalide/);
  });
});

describe("createDraftQuote — résolution du client", () => {
  const audit = vi.fn(() => Promise.resolve());
  beforeEach(() => audit.mockClear());
  afterEach(() => vi.unstubAllGlobals());

  const OK_BODY = { id: 99120, quote_number: "DEV-2026-0043", status: "draft" };

  it("réutilise la fiche existante portant l'email, sans rien y modifier", async () => {
    const calls = mockFetch({
      "GET customers": {
        ok: true,
        status: 200,
        body: {
          items: [
            { id: 111, name: "Autre Personne", emails: ["autre@ailleurs.fr"] },
            { id: 222, name: "Béatrice Delaval", emails: ["BEATRICE.DELAVAL@puy-de-dome.fr"] },
          ],
          has_more: false,
        },
      },
      "POST quotes": { ok: true, status: 201, body: OK_BODY },
    });
    const { client } = makeSupabase();

    const quote = await createDraftQuote(
      client,
      { ...QUOTE_NO_ID, customer: DELAVAL },
      audit,
      "romain@supertilt.fr",
    );

    expect(quote.customerId).toBe(222);
    expect(quote.customerCreated).toBe(false);
    expect(calls.map((c) => c.key)).toEqual(["GET customers", "POST quotes"]);
    // Aucune écriture sur la fiche trouvée.
    expect(calls.some((c) => c.key.startsWith("PUT") || c.key.includes("_customers"))).toBe(false);
    expect((calls[1].body as Record<string, unknown>).customer_id).toBe(222);
  });

  it("crée la fiche quand aucune ne porte cet email, puis crée le devis", async () => {
    const calls = mockFetch({
      "GET customers": { ok: true, status: 200, body: { items: [{ id: 111, emails: ["autre@ailleurs.fr"] }], has_more: false } },
      "POST individual_customers": { ok: true, status: 201, body: { id: 777 } },
      "POST quotes": { ok: true, status: 201, body: OK_BODY },
    });
    const { client } = makeSupabase();

    const quote = await createDraftQuote(
      client,
      { ...QUOTE_NO_ID, customer: DELAVAL },
      audit,
      "romain@supertilt.fr",
    );

    expect(quote.customerId).toBe(777);
    expect(quote.customerCreated).toBe(true);
    expect(calls.map((c) => c.key)).toEqual(["GET customers", "POST individual_customers", "POST quotes"]);
    expect((calls[1].body as Record<string, unknown>).first_name).toBe("Béatrice");
  });

  it("parcourt les pages suivantes avant de conclure à l'absence", async () => {
    const calls = mockFetch({
      "GET customers": [
        { ok: true, status: 200, body: { items: [{ id: 1, emails: ["a@a.fr"] }], has_more: true, next_cursor: "c2" } },
        { ok: true, status: 200, body: { items: [{ id: 2, emails: [DELAVAL.email] }], has_more: false } },
      ],
      "POST quotes": { ok: true, status: 201, body: OK_BODY },
    });
    const { client } = makeSupabase();

    const quote = await createDraftQuote(client, { ...QUOTE_NO_ID, customer: DELAVAL }, audit, "romain@supertilt.fr");

    expect(quote.customerId).toBe(2);
    expect(quote.customerCreated).toBe(false);
    expect(calls.filter((c) => c.key === "GET customers")).toHaveLength(2);
    expect(calls[1].url).toContain("cursor=c2");
  });

  it("une page de clients en échec arrête tout : pas de fiche créée, pas de devis", async () => {
    const calls = mockFetch({
      "GET customers": [
        { ok: true, status: 200, body: { items: [], has_more: true, next_cursor: "c2" } },
        { ok: false, status: 500, body: { error: "boom" } },
      ],
      "POST individual_customers": { ok: true, status: 201, body: { id: 777 } },
      "POST quotes": { ok: true, status: 201, body: OK_BODY },
    });
    const { client } = makeSupabase();

    await expect(createDraftQuote(client, { ...QUOTE_NO_ID, customer: DELAVAL }, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/Lecture des clients \(page 2\).*HTTP 500/s);
    expect(calls.some((c) => c.key.startsWith("POST "))).toBe(false);
  });

  it("refuse de trancher quand deux fiches portent le même email", async () => {
    const calls = mockFetch({
      "GET customers": {
        ok: true,
        status: 200,
        body: {
          items: [
            { id: 1, name: "B. Delaval", emails: [DELAVAL.email] },
            { id: 2, name: "Béatrice Delaval", emails: [DELAVAL.email] },
          ],
          has_more: false,
        },
      },
    });
    const { client } = makeSupabase();

    await expect(createDraftQuote(client, { ...QUOTE_NO_ID, customer: DELAVAL }, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/2 fiches clients portent l'email/);
    expect(calls.every((c) => c.key === "GET customers")).toBe(true);
  });

  it("ne crée pas de fiche quand le devis lui-même est invalide", async () => {
    const calls = mockFetch({ "POST quotes": { ok: true, status: 201, body: OK_BODY } });
    const { client } = makeSupabase();

    await expect(createDraftQuote(
      client,
      { ...QUOTE_NO_ID, customer: DELAVAL, lines: [{ ...LINE, vat_rate: "aucune" }] },
      audit,
      "romain@supertilt.fr",
    )).rejects.toThrow(/vat_rate invalide/);
    expect(calls).toHaveLength(0);
  });

  it("exige customer_id ou customer", async () => {
    const calls = mockFetch({ "POST quotes": { ok: true, status: 201, body: OK_BODY } });
    const { client } = makeSupabase();

    await expect(createDraftQuote(client, QUOTE_NO_ID, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/customer_id .* ou customer/);
    expect(calls).toHaveLength(0);
  });
});
