import { afterEach, describe, expect, it, vi } from "vitest";
import {
  addDays,
  buildMissionInvoicePayload,
  createMissionDraftInvoice,
  type InvoiceActivity,
} from "./pennylane-invoices.ts";

const ACTIVITIES: InvoiceActivity[] = [
  { id: "a1", description: "Atelier de cadrage", activity_date: "2026-09-02", duration: 1, duration_type: "days", billable_amount: 1450 },
  { id: "a2", description: "Restitution", activity_date: "2026-09-10", duration: 3.5, duration_type: "hours", billable_amount: 600 },
];

const CUSTOMER = {
  type: "company" as const,
  name: "Henry Schein",
  email: "compta@henryschein.fr",
  address: "1 rue de la Paix",
  postal_code: "75002",
  city: "Paris",
};

function supabaseWithToken() {
  return {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: { setting_value: "tok" } }) }),
      }),
    }),
  };
}

type Reply = { ok: boolean; status: number; body: unknown };

function mockFetch(routes: Record<string, Reply>) {
  const calls: Array<{ key: string; body: unknown }> = [];
  vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
    const key = `${init.method} ${new URL(String(url)).pathname.replace("/api/external/v2/", "")}`;
    calls.push({ key, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const reply = routes[key] ?? (key === "GET customers" ? { ok: true, status: 200, body: { items: [], has_more: false } } : null);
    if (!reply) throw new Error(`Appel non prévu : ${key}`);
    return Promise.resolve({ ok: reply.ok, status: reply.status, text: () => Promise.resolve(JSON.stringify(reply.body)) } as Response);
  });
  return calls;
}

describe("buildMissionInvoicePayload", () => {
  it("fait une ligne par activité, en brouillon, échéance à 30 jours", () => {
    const payload = buildMissionInvoicePayload(ACTIVITIES, 42, "FR_200", "2026-09-23");
    expect(payload).toMatchObject({ customer_id: 42, date: "2026-09-23", deadline: "2026-10-23", currency: "EUR", draft: true });
    expect(payload.invoice_lines).toEqual([
      { label: "Atelier de cadrage", description: "02/09/2026 · 1 jour", quantity: 1, raw_currency_unit_price: "1450.00", vat_rate: "FR_200" },
      { label: "Restitution", description: "10/09/2026 · 3,5 h", quantity: 1, raw_currency_unit_price: "600.00", vat_rate: "FR_200" },
    ]);
  });

  it("refuse une activité sans montant et un taux de TVA mal formé", () => {
    expect(() => buildMissionInvoicePayload([{ ...ACTIVITIES[0], billable_amount: null }], 42, "FR_200")).toThrow(/Montant facturable manquant/);
    expect(() => buildMissionInvoicePayload(ACTIVITIES, 42, "20")).toThrow(/vat_rate invalide/);
  });

  it("calcule l'échéance sans glisser d'un jour en fin de mois", () => {
    expect(addDays("2026-01-31", 30)).toBe("2026-03-02");
  });
});

describe("createMissionDraftInvoice", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("crée la fiche client absente puis un seul brouillon de facture", async () => {
    const calls = mockFetch({
      "POST company_customers": { ok: true, status: 201, body: { id: 777 } },
      "POST customer_invoices": { ok: true, status: 201, body: { id: 5501, invoice_number: null, public_file_url: "https://x/f.pdf" } },
    });

    const invoice = await createMissionDraftInvoice(supabaseWithToken(), ACTIVITIES, CUSTOMER, "exempt");

    expect(calls.map((c) => c.key)).toEqual(["GET customers", "POST company_customers", "POST customer_invoices"]);
    expect(calls[2].body).toMatchObject({ customer_id: 777, draft: true });
    expect(invoice).toMatchObject({ id: 5501, customerId: 777, customerCreated: true, pdfUrl: "https://x/f.pdf" });
  });

  it("n'appelle pas Pennylane si une ligne est invalide", async () => {
    const calls = mockFetch({});
    await expect(
      createMissionDraftInvoice(supabaseWithToken(), [{ ...ACTIVITIES[0], billable_amount: 0 }], CUSTOMER, "FR_200"),
    ).rejects.toThrow(/Montant facturable manquant/);
    expect(calls).toHaveLength(0);
  });

  it("remonte le refus de Pennylane avec son message", async () => {
    mockFetch({
      "POST company_customers": { ok: true, status: 201, body: { id: 777 } },
      "POST customer_invoices": { ok: false, status: 403, body: { error: "scope" } },
    });
    await expect(createMissionDraftInvoice(supabaseWithToken(), ACTIVITIES, CUSTOMER, "FR_200")).rejects.toThrow(
      /customer_invoices:all/,
    );
  });
});
