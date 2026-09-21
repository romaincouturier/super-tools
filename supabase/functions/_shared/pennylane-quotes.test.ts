import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { buildQuotePayload, createDraftQuote, todayParis } from "./pennylane-quotes.ts";

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
    });

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
    }) as Record<string, unknown>;
    expect(payload).not.toHaveProperty("pdf_description");
    expect(payload).not.toHaveProperty("special_mention");
    expect(payload).not.toHaveProperty("external_reference");
    const line = (payload.invoice_lines as Array<Record<string, unknown>>)[0];
    expect(line).not.toHaveProperty("unit");
    expect(line).not.toHaveProperty("description");
  });

  it("date par défaut = aujourd'hui à Paris", () => {
    const payload = buildQuotePayload({ ...INPUT, date: undefined }) as Record<string, unknown>;
    expect(payload.date).toBe(todayParis());
  });

  it("refuse une deadline antérieure à la date du devis", () => {
    expect(() => buildQuotePayload({ ...INPUT, deadline: "2026-09-01" }))
      .toThrow(/antérieure/);
  });

  it("refuse un format de date non ISO", () => {
    expect(() => buildQuotePayload({ ...INPUT, deadline: "21/10/2026" }))
      .toThrow(/YYYY-MM-DD/);
  });

  it("refuse un taux de TVA hors forme FR_XXX", () => {
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, vat_rate: "20" }] }))
      .toThrow(/vat_rate invalide/);
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, vat_rate: "" }] }))
      .toThrow(/vat_rate invalide/);
  });

  it("accepte FR_000 (exonération)", () => {
    const payload = buildQuotePayload({ ...INPUT, lines: [{ ...LINE, vat_rate: "FR_000" }] }) as Record<string, unknown>;
    expect((payload.invoice_lines as Array<Record<string, unknown>>)[0].vat_rate).toBe("FR_000");
  });

  it("refuse un devis sans ligne, une quantité nulle, un prix négatif, un label vide", () => {
    expect(() => buildQuotePayload({ ...INPUT, lines: [] })).toThrow(/lines est requis/);
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, quantity: 0 }] })).toThrow(/quantity/);
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, unit_price: -1 }] })).toThrow(/unit_price/);
    expect(() => buildQuotePayload({ ...INPUT, lines: [{ ...LINE, label: "  " }] })).toThrow(/label est requis/);
  });

  it("refuse un customer_id absent ou non entier", () => {
    expect(() => buildQuotePayload({ ...INPUT, customer_id: 0 })).toThrow(/customer_id/);
    expect(() => buildQuotePayload({ ...INPUT, customer_id: 4271.5 })).toThrow(/customer_id/);
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

function mockFetch(response: { ok: boolean; status: number; body: unknown }) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    calls.push({ url: String(url), init });
    return Promise.resolve({
      ok: response.ok,
      status: response.status,
      text: () => Promise.resolve(JSON.stringify(response.body)),
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
    const calls = mockFetch({ ok: true, status: 201, body: OK_BODY });
    const { client } = makeSupabase();

    const quote = await createDraftQuote(client, INPUT, audit, "romain@supertilt.fr");

    expect(calls).toHaveLength(1);
    expect(calls[0].url).toBe("https://app.pennylane.com/api/external/v2/quotes");
    expect(calls[0].init.method).toBe("POST");
    // Aucun chemin d'envoi, de validation ou de facturation n'est atteignable.
    expect(calls[0].url).not.toMatch(/send|finalize|validate|customer_invoices/);
    expect(quote.number).toBe("DEV-2026-0043");
    expect(quote.status).toBe("draft");
    expect(quote.pdfUrl).toBe("https://files.pennylane.com/tmp/devis.pdf");
    expect(audit).toHaveBeenCalledOnce();
  });

  it("n'appelle pas Pennylane quand le payload est invalide", async () => {
    const calls = mockFetch({ ok: true, status: 201, body: OK_BODY });
    const { client } = makeSupabase();

    await expect(
      createDraftQuote(client, { ...INPUT, lines: [{ ...LINE, vat_rate: "FR_2000" }] }, audit, "romain@supertilt.fr"),
    ).rejects.toThrow(/vat_rate invalide/);
    expect(calls).toHaveLength(0);
  });

  it("remonte le corps d'erreur Pennylane tel quel et ne rejoue pas l'appel", async () => {
    const calls = mockFetch({
      ok: false,
      status: 422,
      body: { message: "invoice_lines[0].vat_rate is invalid" },
    });
    const { client } = makeSupabase();

    await expect(createDraftQuote(client, INPUT, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/HTTP 422.*vat_rate is invalid/s);
    expect(calls).toHaveLength(1);
  });

  it("traduit un 403 en scope manquant", async () => {
    mockFetch({ ok: false, status: 403, body: { error: "forbidden" } });
    const { client } = makeSupabase();
    await expect(createDraftQuote(client, INPUT, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/quotes:all/);
  });

  it("échoue avant tout appel si le token n'est pas configuré", async () => {
    const calls = mockFetch({ ok: true, status: 201, body: OK_BODY });
    const { client } = makeSupabase({ token: null });
    await expect(createDraftQuote(client, INPUT, audit, "romain@supertilt.fr"))
      .rejects.toThrow(/Token API Pennylane non configuré/);
    expect(calls).toHaveLength(0);
  });

  it("dépose la référence du devis en commentaire sur la carte CRM", async () => {
    mockFetch({ ok: true, status: 201, body: OK_BODY });
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
    mockFetch({ ok: true, status: 201, body: OK_BODY });
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
    const calls = mockFetch({ ok: true, status: 201, body: OK_BODY });
    const { client } = makeSupabase();
    await expect(
      createDraftQuote(client, { ...INPUT, crm_card_id: "carte-118" }, audit, "romain@supertilt.fr"),
    ).rejects.toThrow(/UUID/);
    expect(calls).toHaveLength(0);
  });
});
