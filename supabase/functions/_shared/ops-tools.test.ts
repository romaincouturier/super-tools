/**
 * Tests des outils MCP repris d'agent-chat : validation des entrées, champs
 * écrits, filtre de ligne appliqué, et aucune écriture ni journal quand
 * l'entrée est refusée ou qu'aucune ligne ne correspond.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const env: Record<string, string> = { SUPABASE_URL: "https://proj.test", SUPABASE_SERVICE_ROLE_KEY: "service-role" };

const {
  getBusinessHealth,
  addSupportNote,
  updateTicketStatus,
  addContentCard,
  updateQuoteStatus,
} = await (async () => {
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
  return import("./ops-tools.ts");
})();

const ID = "11111111-2222-3333-4444-555555555555";
const log = vi.fn(async () => {});

type Row = Record<string, unknown>;
type Call = { table: string; op: "update" | "insert"; payload: Row; filters: Array<[string, unknown]> };

/**
 * Fausse base : chaque table est une liste de lignes. Les filtres eq/is sont
 * réellement appliqués, un update ne touche que les lignes filtrées et rend
 * la ligne écrite (ou null si aucune ne correspond).
 */
function makeDb(tables: Record<string, Row[]> = {}) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const rows = tables[table] ?? [];
      const filters: Array<[string, unknown]> = [];
      let pending: { op: "update" | "insert"; payload: Row } | null = null;
      const matching = () => rows.filter((r) => filters.every(([k, v]) => r[k] === v));
      const run = (): { data: Row | null; error: null } => {
        if (pending?.op === "update") {
          calls.push({ table, op: "update", payload: pending.payload, filters: [...filters] });
          const hit = matching()[0];
          if (!hit) return { data: null, error: null };
          Object.assign(hit, pending.payload);
          return { data: { ...hit }, error: null };
        }
        if (pending?.op === "insert") {
          calls.push({ table, op: "insert", payload: pending.payload, filters: [] });
          return { data: { id: ID, ...pending.payload }, error: null };
        }
        const hit = matching()[0];
        return { data: hit ? { ...hit } : null, error: null };
      };
      const chain = {
        select: () => chain,
        eq(k: string, v: unknown) {
          filters.push([k, v]);
          return chain;
        },
        is(k: string, v: unknown) {
          filters.push([k, v]);
          return chain;
        },
        order: () => chain,
        limit: async () => ({ data: matching(), error: null }),
        maybeSingle: async () => run(),
        single: async () => run(),
        then(resolve: (v: { data: Row[]; error: null }) => void) {
          resolve({ data: matching(), error: null });
        },
        update(payload: Row) {
          pending = { op: "update", payload };
          return chain;
        },
        insert(payload: Row) {
          pending = { op: "insert", payload };
          return chain;
        },
      };
      return chain;
    },
  };
  return { db, calls };
}

const ticket = (over: Row = {}): Row => ({
  id: ID,
  ticket_number: "ST-2026-0001",
  title: "Bug",
  description: "d",
  status: "nouveau",
  resolution_notes: null,
  resolved_at: null,
  submitted_by_email: "a@b.fr",
  updated_at: "2026-11-01T10:00:00+00:00",
  ...over,
});

let fetchMock: ReturnType<typeof vi.fn>;
beforeEach(() => {
  log.mockClear();
  fetchMock = vi.fn(async () => new Response('{"success":true}', { status: 200 }));
  vi.stubGlobal("fetch", fetchMock);
  vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });
});
afterEach(() => vi.unstubAllGlobals());

describe("addSupportNote", () => {
  it("ajoute la note après les notes existantes, sur la seule ligne visée", async () => {
    const { db, calls } = makeDb({ support_tickets: [ticket({ resolution_notes: "ancienne" })] });
    await addSupportNote(db, { ticket_id: ID, content: "nouvelle" }, log);
    const notes = calls[0].payload.resolution_notes as string;
    expect(notes.startsWith("ancienne\n\n---\n\n")).toBe(true);
    expect(notes.endsWith("nouvelle")).toBe(true);
    expect(calls[0].filters).toEqual([["id", ID], ["updated_at", "2026-11-01T10:00:00+00:00"]]);
  });

  it("refuse un id invalide ou une note vide sans rien écrire", async () => {
    const { db, calls } = makeDb();
    await expect(addSupportNote(db, { ticket_id: "x", content: "a" }, log)).rejects.toThrow("UUID");
    await expect(addSupportNote(db, { ticket_id: ID, content: "  " }, log)).rejects.toThrow("obligatoire");
    expect(calls).toHaveLength(0);
  });

  it("n'écrase pas une écriture concurrente : abandonne si le ticket bouge à chaque essai", async () => {
    const row = ticket();
    const { db } = makeDb({ support_tickets: [row] });
    const realFrom = db.from.bind(db);
    db.from = (t: string) => {
      row.updated_at = `${Math.random()}`;
      return realFrom(t);
    };
    await expect(addSupportNote(db, { ticket_id: ID, content: "x" }, log)).rejects.toThrow("en même temps");
    expect(log).not.toHaveBeenCalled();
  });
});

describe("updateTicketStatus", () => {
  it("pose resolved_at et prévient le demandeur quand le ticket passe à resolu", async () => {
    const { db, calls } = makeDb({ support_tickets: [ticket()] });
    const out = JSON.parse(await updateTicketStatus(db, { ticket_id: ID, status: "resolu" }, log));
    expect(calls[0].payload).toMatchObject({ status: "resolu", resolved_at: expect.any(String) });
    expect(calls[0].filters[0]).toEqual(["id", ID]);
    expect(out.submitter_notified).toBe(true);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://proj.test/functions/v1/send-support-notification");
    expect(JSON.parse(init.body as string)).toMatchObject({ recipientEmail: "a@b.fr", ticketNumber: "ST-2026-0001" });
  });

  it("ne renvoie pas l'email à un ticket déjà résolu", async () => {
    const { db } = makeDb({ support_tickets: [ticket({ status: "resolu", resolved_at: "x" })] });
    await updateTicketStatus(db, { ticket_id: ID, status: "resolu" }, log);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("efface resolved_at quand le ticket quitte resolu", async () => {
    const { db, calls } = makeDb({ support_tickets: [ticket({ status: "resolu", resolved_at: "x" })] });
    await updateTicketStatus(db, { ticket_id: ID, status: "qualification" }, log);
    expect(calls[0].payload).toMatchObject({ status: "qualification", resolved_at: null });
  });

  it("accepte boite_a_idees", async () => {
    const { db, calls } = makeDb({ support_tickets: [ticket()] });
    await updateTicketStatus(db, { ticket_id: ID, status: "boite_a_idees" }, log);
    expect(calls[0].payload).toMatchObject({ status: "boite_a_idees" });
  });

  it("ajoute resolution_notes aux notes existantes au lieu de les remplacer", async () => {
    const { db, calls } = makeDb({ support_tickets: [ticket({ resolution_notes: "historique" })] });
    await updateTicketStatus(db, { ticket_id: ID, status: "resolu", resolution_notes: "corrigé" }, log);
    const notes = calls[0].payload.resolution_notes as string;
    expect(notes.startsWith("historique\n\n---\n\n")).toBe(true);
    expect(notes.endsWith("corrigé")).toBe(true);
  });

  it("refuse un statut inconnu", async () => {
    const { db, calls } = makeDb();
    await expect(updateTicketStatus(db, { ticket_id: ID, status: "ferme" }, log)).rejects.toThrow("invalide");
    expect(calls).toHaveLength(0);
  });

  it("ne journalise rien pour un ticket inexistant", async () => {
    const { db } = makeDb({ support_tickets: [] });
    await expect(updateTicketStatus(db, { ticket_id: ID, status: "resolu" }, log)).rejects.toThrow("introuvable");
    expect(log).not.toHaveBeenCalled();
  });
});

describe("addContentCard", () => {
  const columns = (): Row[] => [
    { id: "c0", name: "Brouillons" },
    { id: "c1", name: "Idées" },
    { id: "c2", name: "Brouillons validés" },
  ];

  it("range la carte en fin de colonne Idées par défaut", async () => {
    const { db, calls } = makeDb({
      content_columns: columns(),
      content_cards: [{ column_id: "c1", display_order: 4 }],
    });
    await addContentCard(db, { title: "Article" }, log, ID);
    expect(calls[0].payload).toMatchObject({ column_id: "c1", title: "Article", created_by: ID, display_order: 5 });
  });

  it("préfère le nom exact au nom partiel", async () => {
    const { db, calls } = makeDb({ content_columns: columns(), content_cards: [] });
    await addContentCard(db, { title: "Article", column: "brouillons" }, log, ID);
    expect(calls[0].payload).toMatchObject({ column_id: "c0", display_order: 0 });
  });

  it("refuse un nom partiel ambigu sans rien écrire", async () => {
    const { db, calls } = makeDb({ content_columns: columns(), content_cards: [] });
    await expect(addContentCard(db, { title: "A", column: "brouil" }, log, ID)).rejects.toThrow("ambiguë");
    expect(calls).toHaveLength(0);
  });

  it("refuse une colonne inexistante sans rien écrire", async () => {
    const { db, calls } = makeDb({ content_columns: columns(), content_cards: [] });
    await expect(addContentCard(db, { title: "A", column: "zzz" }, log, ID)).rejects.toThrow("Colonne introuvable");
    expect(calls).toHaveLength(0);
  });
});

describe("updateQuoteStatus", () => {
  it("change le statut de la seule ligne visée", async () => {
    const { db, calls } = makeDb({ quotes: [{ id: ID, status: "sent" }] });
    await updateQuoteStatus(db, { quote_id: ID, status: "signed" }, log);
    expect(calls[0]).toMatchObject({ table: "quotes", payload: { status: "signed" }, filters: [["id", ID]] });
  });

  it("refuse de sortir un devis signé de son statut", async () => {
    const { db, calls } = makeDb({ quotes: [{ id: ID, status: "signed" }] });
    await expect(updateQuoteStatus(db, { quote_id: ID, status: "draft" }, log)).rejects.toThrow("signé");
    expect(calls).toHaveLength(0);
  });

  it("refuse un statut inconnu", async () => {
    const { db, calls } = makeDb();
    await expect(updateQuoteStatus(db, { quote_id: ID, status: "paid" }, log)).rejects.toThrow("invalide");
    expect(calls).toHaveLength(0);
  });

  it("ne journalise rien pour un devis inexistant", async () => {
    const { db } = makeDb({ quotes: [] });
    await expect(updateQuoteStatus(db, { quote_id: ID, status: "sent" }, log)).rejects.toThrow("introuvable");
    expect(log).not.toHaveBeenCalled();
  });
});

describe("getBusinessHealth", () => {
  it("appelle business-health-score en appel interne et rend le corps", async () => {
    fetchMock.mockResolvedValueOnce(new Response('{"report":"ok"}', { status: 200 }));
    expect(await getBusinessHealth(log)).toBe('{"report":"ok"}');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://proj.test/functions/v1/business-health-score");
    expect((init.headers as Record<string, string>)["x-internal-secret"]).toBe("service-role");
  });

  it("remonte une erreur quand la fonction refuse", async () => {
    fetchMock.mockResolvedValueOnce(new Response("Non authentifié", { status: 401 }));
    await expect(getBusinessHealth(log)).rejects.toThrow("401");
  });
});
