/**
 * Tests des outils MCP repris d'agent-chat : validation des entrées, champs
 * écrits, et aucune écriture quand l'entrée est refusée.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const env: Record<string, string> = { SUPABASE_URL: "https://proj.test", SUPABASE_SERVICE_ROLE_KEY: "service-role" };
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const {
  getBusinessHealth,
  addSupportNote,
  updateTicketStatus,
  addContentCard,
  updateMission,
  updateQuoteStatus,
} = await import("./ops-tools.ts");

const ID = "11111111-2222-3333-4444-555555555555";
const log = vi.fn(async () => {});

type Call = { table: string; op: string; payload?: unknown };

function makeDb(rows: Record<string, Record<string, unknown>> = {}, list: Array<Record<string, unknown>> = []) {
  const calls: Call[] = [];
  const db = {
    from(table: string) {
      const chain = {
        select: () => chain,
        eq: () => chain,
        order: async () => ({ data: list, error: null }),
        maybeSingle: async () => ({ data: rows[table] ?? null, error: null }),
        single: async () => ({ data: { id: ID, title: "t", column_id: "c1" }, error: null }),
        update(payload: unknown) {
          calls.push({ table, op: "update", payload });
          return { eq: async () => ({ error: null }) };
        },
        insert(payload: unknown) {
          calls.push({ table, op: "insert", payload });
          return chain;
        },
      };
      return chain;
    },
  };
  return { db, calls };
}

beforeEach(() => log.mockClear());

describe("addSupportNote", () => {
  it("ajoute la note après les notes existantes", async () => {
    const { db, calls } = makeDb({ support_tickets: { id: ID, resolution_notes: "ancienne" } });
    await addSupportNote(db, { ticket_id: ID, content: "nouvelle" }, log);
    const notes = (calls[0].payload as { resolution_notes: string }).resolution_notes;
    expect(notes.startsWith("ancienne\n\n---\n\n")).toBe(true);
    expect(notes.endsWith("nouvelle")).toBe(true);
  });

  it("refuse un id invalide ou une note vide sans rien écrire", async () => {
    const { db, calls } = makeDb();
    await expect(addSupportNote(db, { ticket_id: "x", content: "a" }, log)).rejects.toThrow("UUID");
    await expect(addSupportNote(db, { ticket_id: ID, content: "  " }, log)).rejects.toThrow("obligatoire");
    expect(calls).toHaveLength(0);
  });
});

describe("updateTicketStatus", () => {
  it("pose resolved_at quand le ticket passe à resolu", async () => {
    const { db, calls } = makeDb({ support_tickets: { id: ID } });
    await updateTicketStatus(db, { ticket_id: ID, status: "resolu" }, log);
    expect(calls[0].payload).toMatchObject({ status: "resolu", resolved_at: expect.any(String) });
  });

  it("refuse un statut inconnu", async () => {
    const { db, calls } = makeDb();
    await expect(updateTicketStatus(db, { ticket_id: ID, status: "ferme" }, log)).rejects.toThrow("invalide");
    expect(calls).toHaveLength(0);
  });
});

describe("addContentCard", () => {
  const columns = [{ id: "c0", name: "Brouillons" }, { id: "c1", name: "Idées" }];

  it("range la carte dans Idées par défaut", async () => {
    const { db, calls } = makeDb({}, columns);
    await addContentCard(db, { title: "Article" }, log, ID);
    expect(calls[0].payload).toMatchObject({ column_id: "c1", title: "Article", created_by: ID });
  });

  it("trouve la colonne demandée par nom partiel", async () => {
    const { db, calls } = makeDb({}, columns);
    await addContentCard(db, { title: "Article", column: "brouil" }, log, ID);
    expect(calls[0].payload).toMatchObject({ column_id: "c0" });
  });

  it("refuse une colonne inexistante sans rien écrire", async () => {
    const { db, calls } = makeDb({}, columns);
    await expect(addContentCard(db, { title: "A", column: "zzz" }, log, ID)).rejects.toThrow("Colonne introuvable");
    expect(calls).toHaveLength(0);
  });
});

describe("updateMission", () => {
  it("n'écrit que les champs autorisés", async () => {
    const { db, calls } = makeDb({ missions: { id: ID, title: "M", status: "in_progress" } });
    await updateMission(db, { mission_id: ID, status: "completed", initial_amount: 99999 }, log);
    expect(calls[0].payload).toMatchObject({ status: "completed" });
    expect(calls[0].payload).not.toHaveProperty("initial_amount");
  });

  it("refuse un appel sans champ modifiable ou avec un statut inconnu", async () => {
    const { db, calls } = makeDb({ missions: { id: ID } });
    await expect(updateMission(db, { mission_id: ID, daily_rate: 1 }, log)).rejects.toThrow("Aucun champ");
    await expect(updateMission(db, { mission_id: ID, status: "done" }, log)).rejects.toThrow("invalide");
    expect(calls).toHaveLength(0);
  });
});

describe("updateQuoteStatus", () => {
  it("change le statut", async () => {
    const { db, calls } = makeDb({ quotes: { id: ID } });
    await updateQuoteStatus(db, { quote_id: ID, status: "signed" }, log);
    expect(calls[0]).toMatchObject({ table: "quotes", payload: { status: "signed" } });
  });

  it("refuse un statut inconnu", async () => {
    const { db, calls } = makeDb();
    await expect(updateQuoteStatus(db, { quote_id: ID, status: "paid" }, log)).rejects.toThrow("invalide");
    expect(calls).toHaveLength(0);
  });
});

describe("getBusinessHealth", () => {
  it("appelle business-health-score en appel interne et rend le corps", async () => {
    const fetchMock = vi.fn(async () => new Response('{"report":"ok"}', { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await getBusinessHealth(log)).toBe('{"report":"ok"}');
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://proj.test/functions/v1/business-health-score");
    expect((init.headers as Record<string, string>)["x-internal-secret"]).toBe("service-role");
  });

  it("remonte une erreur quand la fonction refuse", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("Non authentifié", { status: 401 })));
    await expect(getBusinessHealth(log)).rejects.toThrow("401");
  });
});
