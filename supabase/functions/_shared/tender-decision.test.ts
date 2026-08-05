import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildTenderDescriptionHtml,
  escapeHtml,
  listPendingTenders,
  safeUrl,
  TENDER_NO_GO_REASONS,
  tenderGo,
  tenderNoGo,
  todayParis,
  type TenderRow,
} from "./tender-decision.ts";

// Faux client Supabase : enregistre les appels et rend un résultat par table.
// Le contrat testé est celui du builder PostgREST, pas celui du réseau.
type Op = { method: string; args: unknown[] };
type Resolver = (ops: Op[]) => { data: unknown; error?: { message: string } | null; count?: number };

function makeSupabase(config: Record<string, Resolver>) {
  const writes: Array<{ table: string; method: string; payload: unknown }> = [];

  const client = {
    from(table: string) {
      const ops: Op[] = [];
      let single = false;
      const builder: Record<string | symbol, unknown> = new Proxy({}, {
        get(_target, prop) {
          if (prop === "then") {
            return (onOk: (v: unknown) => unknown, onErr?: (e: unknown) => unknown) => {
              const resolver = config[table];
              const res = resolver
                ? resolver(ops)
                : { data: null, error: null, count: 0 };
              const data = single && Array.isArray(res.data) ? (res.data[0] ?? null) : res.data;
              return Promise.resolve({ ...res, data, error: res.error ?? null }).then(onOk, onErr);
            };
          }
          return (...args: unknown[]) => {
            ops.push({ method: String(prop), args });
            if (prop === "insert" || prop === "update") {
              writes.push({ table, method: String(prop), payload: args[0] });
            }
            if (prop === "single" || prop === "maybeSingle") single = true;
            return builder;
          };
        },
      }) as Record<string | symbol, unknown>;
      return builder;
    },
  };

  return { client, writes };
}

const TENDER: TenderRow = {
  id: "t1",
  source: "boamp",
  source_ref: "25-1234",
  objet: "Prestations de facilitation graphique",
  acheteur: "Communauté Urbaine de Dunkerque",
  nature: "APPEL_OFFRE",
  type_marche: "SERVICES",
  code_departement: ["59"],
  cpv_codes: ["79822500"],
  dateparution: "2026-08-01",
  datelimitereponse: "2026-09-15T12:00:00+02:00",
  decision: {
    montant: 120000,
    contact_email: "achats@dunkerque.fr",
    url_dce: "https://www.marches-publics.gouv.fr/?page=entreprise.EntrepriseAvisDetail&id=42",
    criteres: [{ libelle: "Prix", poids: 40 }, { libelle: "Valeur technique", poids: 60 }],
  },
  matched_on: ["facilitation graphique"],
  status: "to_review",
  url_avis: "https://boamp.fr/avis/25-1234",
  crm_card_id: null,
};

describe("escapeHtml / safeUrl", () => {
  it("échappe le contenu externe", () => {
    expect(escapeHtml('<img src=x onerror="alert(1)">')).toBe(
      "&lt;img src=x onerror=&quot;alert(1)&quot;&gt;",
    );
  });

  it("n'accepte que http(s)", () => {
    expect(safeUrl("https://boamp.fr/a")).toBe("https://boamp.fr/a");
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("pas une url")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe("buildTenderDescriptionHtml", () => {
  it("reprend acheteur, échéance, montant, critères et liens", () => {
    const html = buildTenderDescriptionHtml(TENDER);
    expect(html).toContain("Communauté Urbaine de Dunkerque");
    expect(html).toContain("15/09/2026");
    expect(html).toContain("Retirer le DCE");
    expect(html).toContain("Prix 40%, Valeur technique 60%");
    expect(html).toContain("https://boamp.fr/avis/25-1234");
  });

  it("n'écrit pas de balise venue de l'avis", () => {
    const html = buildTenderDescriptionHtml({
      ...TENDER,
      acheteur: "<script>alert(1)</script>",
      decision: { url_dce: "javascript:alert(1)" },
      url_avis: null,
      datelimitereponse: null,
    });
    expect(html).not.toContain("<script>");
    expect(html).not.toContain("javascript:");
  });

  it("reste vide plutôt que d'inventer quand l'avis est nu", () => {
    expect(
      buildTenderDescriptionHtml({
        ...TENDER,
        acheteur: null,
        datelimitereponse: null,
        decision: {},
        url_avis: null,
      }),
    ).toBe("");
  });
});

describe("todayParis", () => {
  it("rend une date ISO courte", () => {
    expect(todayParis()).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe("listPendingTenders", () => {
  it("filtre comme l'écran CRM et plafonne à 100", async () => {
    const { client } = makeSupabase({
      tender_opportunities: (ops) =>
        ops.some((o) => o.method === "eq")
          ? { data: [], error: null }
          : { data: [TENDER], error: null, count: 1 },
      crm_cards: () => ({ data: [], error: null }),
    });

    const res = await listPendingTenders(client, { limit: 500 });
    expect(res.total).toBe(1);
    expect(res.truncated).toBe(false);
    expect(res.items[0].id).toBe("t1");
  });

  it("signale la troncature quand le total dépasse la page", async () => {
    const { client } = makeSupabase({
      tender_opportunities: (ops) =>
        ops.some((o) => o.method === "eq")
          ? { data: [], error: null }
          : { data: [TENDER], error: null, count: 42 },
      crm_cards: () => ({ data: [], error: null }),
    });
    const res = await listPendingTenders(client, { limit: 1 });
    expect(res.truncated).toBe(true);
    expect(res.total).toBe(42);
  });

  it("attache l'historique CRM et le titulaire sortant du même acheteur", async () => {
    const { client } = makeSupabase({
      tender_opportunities: (ops) =>
        ops.some((o) => o.method === "eq")
          ? {
            data: [{
              id: "a1",
              objet: "Marché précédent",
              acheteur: TENDER.acheteur,
              decision: { titulaire: "Agence Concurrente", montant: 95000 },
              dateparution: "2023-05-02",
              url_avis: null,
            }],
            error: null,
          }
          : { data: [TENDER], error: null, count: 1 },
      crm_cards: () => ({
        data: [{
          id: "c1",
          title: "Atelier 2024",
          company: TENDER.acheteur,
          sales_status: "WON",
          estimated_value: 8000,
          created_at: "2024-02-02",
        }],
        error: null,
      }),
    });

    const res = await listPendingTenders(client);
    expect(res.items[0].buyer_history[0].title).toBe("Atelier 2024");
    expect(res.items[0].buyer_awards[0].titulaire).toBe("Agence Concurrente");
  });

  it("remonte l'erreur de lecture au lieu de rendre une file vide", async () => {
    const { client } = makeSupabase({
      tender_opportunities: () => ({ data: null, error: { message: "boom" } }),
    });
    await expect(listPendingTenders(client)).rejects.toThrow("boom");
  });
});

describe("tenderNoGo", () => {
  it("écrit le motif sur la ligne existante, sans rien créer", async () => {
    const { client, writes } = makeSupabase({
      tender_opportunities: () => ({ data: [{ id: "t1" }], error: null }),
    });

    const res = await tenderNoGo(client, {
      id: "t1",
      reason: "criteres_prix",
      detail: "70 % prix",
      actorEmail: "romain@supertilt.fr",
    });

    expect(res).toEqual({ id: "t1", status: "no_go", reason: "criteres_prix" });
    expect(writes).toHaveLength(1);
    expect(writes[0]).toMatchObject({ table: "tender_opportunities", method: "update" });
    expect(writes[0].payload).toMatchObject({
      status: "no_go",
      no_go_reason: "criteres_prix",
      no_go_detail: "70 % prix",
      reviewed_by: "romain@supertilt.fr",
    });
  });

  it("refuse un motif hors liste", async () => {
    const { client, writes } = makeSupabase({});
    await expect(
      tenderNoGo(client, { id: "t1", reason: "pas_envie", actorEmail: "a@b.fr" }),
    ).rejects.toThrow(/Motif de No Go invalide/);
    expect(writes).toHaveLength(0);
  });

  it("accepte les neuf motifs de la liste fermée", () => {
    expect(TENDER_NO_GO_REASONS).toHaveLength(9);
  });

  it("échoue si l'avis n'existe pas", async () => {
    const { client } = makeSupabase({
      tender_opportunities: () => ({ data: [], error: null }),
    });
    await expect(
      tenderNoGo(client, { id: "inconnu", reason: "autre", actorEmail: "a@b.fr" }),
    ).rejects.toThrow(/introuvable/);
  });
});

describe("tenderGo", () => {
  function goSupabase(overrides: Partial<Record<string, Resolver>> = {}, tender = TENDER) {
    return makeSupabase({
      tender_opportunities: (ops) =>
        ops.some((o) => o.method === "update")
          ? { data: [{ id: tender.id }], error: null }
          : { data: [tender], error: null },
      crm_columns: () => ({
        data: [
          { id: "col-quali", name: "Qualification" },
          { id: "col-entrant", name: "Entrant" },
        ],
        error: null,
      }),
      crm_cards: (ops) =>
        ops.some((o) => o.method === "insert")
          ? { data: [{ id: "card-1" }], error: null }
          : { data: [{ position: 4 }], error: null },
      crm_activity_log: () => ({ data: null, error: null }),
      crm_tags: () => ({ data: [{ id: "tag-1" }], error: null }),
      crm_card_tags: () => ({ data: null, error: null }),
      ...overrides,
    } as Record<string, Resolver>);
  }

  let notify: ReturnType<typeof vi.fn>;
  beforeEach(() => {
    notify = vi.fn();
  });

  it("crée la carte dans « Entrant » avec la prochaine action et la date limite", async () => {
    const { client, writes } = goSupabase();
    const res = await tenderGo(client, {
      tenderId: "t1",
      serviceType: "facilitation",
      estimatedValue: 120000,
      actorEmail: "romain@supertilt.fr",
      notify,
    });

    expect(res).toMatchObject({ card_id: "card-1", column: "Entrant", tagged: true });

    const cardInsert = writes.find((w) => w.table === "crm_cards")!.payload as Record<string, unknown>;
    expect(cardInsert).toMatchObject({
      column_id: "col-entrant",
      position: 5,
      status_operational: "WAITING",
      waiting_next_action_text: "Retirer le DCE et décider de candidater",
      expected_close_date: "2026-09-15",
      acquisition_source: "marche_public",
      company: TENDER.acheteur,
      estimated_value: 120000,
    });

    expect(writes.some((w) => w.table === "crm_activity_log")).toBe(true);
    expect(writes.some((w) => w.table === "crm_card_tags")).toBe(true);
    expect(notify).toHaveBeenCalledOnce();
  });

  it("marque l'avis en go avec l'identifiant de carte", async () => {
    const { client, writes } = goSupabase();
    await tenderGo(client, { tenderId: "t1", actorEmail: "romain@supertilt.fr" });
    const update = writes.find((w) => w.table === "tender_opportunities" && w.method === "update")!;
    expect(update.payload).toMatchObject({ status: "go", crm_card_id: "card-1" });
  });

  it("refuse un second Go sur un avis déjà promu", async () => {
    const { client, writes } = goSupabase({}, { ...TENDER, crm_card_id: "card-existante" });
    await expect(
      tenderGo(client, { tenderId: "t1", actorEmail: "romain@supertilt.fr" }),
    ).rejects.toThrow(/déjà une carte/);
    expect(writes).toHaveLength(0);
  });

  it("prend la première colonne quand « Entrant » n'existe pas", async () => {
    const { client } = goSupabase({
      crm_columns: () => ({ data: [{ id: "col-x", name: "Pipe" }], error: null }),
    });
    const res = await tenderGo(client, { tenderId: "t1", actorEmail: "a@b.fr" });
    expect(res.column).toBe("Pipe");
  });

  it("n'invente pas de succès si la carte ne s'insère pas", async () => {
    const { client } = goSupabase({
      crm_cards: (ops) =>
        ops.some((o) => o.method === "insert")
          ? { data: null, error: { message: "colonne inconnue" } }
          : { data: [], error: null },
    });
    await expect(
      tenderGo(client, { tenderId: "t1", actorEmail: "a@b.fr" }),
    ).rejects.toThrow(/Création de la carte CRM impossible/);
  });

  it("dit de ne pas relancer quand la carte existe mais l'avis n'a pas pu être marqué", async () => {
    const { client } = goSupabase({
      tender_opportunities: (ops) =>
        ops.some((o) => o.method === "update")
          ? { data: null, error: { message: "verrou" } }
          : { data: [TENDER], error: null },
    });
    await expect(
      tenderGo(client, { tenderId: "t1", actorEmail: "a@b.fr" }),
    ).rejects.toThrow(/Ne pas relancer un Go/);
  });

  it("échoue proprement sur un avis introuvable", async () => {
    const { client } = goSupabase({
      tender_opportunities: () => ({ data: [], error: null }),
    });
    await expect(
      tenderGo(client, { tenderId: "zzz", actorEmail: "a@b.fr" }),
    ).rejects.toThrow(/introuvable/);
  });
});
