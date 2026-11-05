import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";
import postgres from "postgres";

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated;
    CREATE TABLE public.support_tickets (ticket_number text UNIQUE, title text);
    GRANT SELECT, INSERT ON public.support_tickets TO authenticated;
    ALTER TABLE public.support_tickets ENABLE ROW LEVEL SECURITY;
    CREATE POLICY own_tickets ON public.support_tickets FOR SELECT TO authenticated USING (title = 'learner');
    CREATE POLICY create_tickets ON public.support_tickets FOR INSERT TO authenticated WITH CHECK (true);`);
  await db.exec(readFileSync("drizzle/migrations/0030_support_ticket_number_atomic.sql", "utf8"));
  await db.exec(`CREATE TRIGGER trg_support_ticket_number BEFORE INSERT ON public.support_tickets
    FOR EACH ROW WHEN (NEW.ticket_number IS NULL OR NEW.ticket_number = '')
    EXECUTE FUNCTION public.generate_ticket_number();`);
});
afterAll(async () => { await db?.close(); });
beforeEach(async () => { await db.exec("RESET ROLE; TRUNCATE support_tickets"); });

describe("Numéros de tickets de support", () => {
  it("alloue trente numéros différents dans une insertion groupée", async () => {
    await db.exec("INSERT INTO support_tickets SELECT '', 'learner' FROM generate_series(1,30)");
    const result = await db.query<{ total: number; distinct_numbers: number }>(
      "SELECT count(*)::int total, count(DISTINCT ticket_number)::int distinct_numbers FROM support_tickets");
    expect(result.rows[0]).toEqual({ total: 30, distinct_numbers: 30 });
  });
  it("calcule le prochain numéro sur tous les tickets malgré la RLS apprenant", async () => {
    await db.exec(`INSERT INTO support_tickets VALUES
      ('ST-' || to_char(now() AT TIME ZONE 'Europe/Paris', 'YYYY') || '-0263','staff');
      SET ROLE authenticated; INSERT INTO support_tickets VALUES ('','learner');`);
    const result = await db.query<{ ticket_number: string }>("SELECT ticket_number FROM support_tickets");
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].ticket_number).toMatch(/^ST-\d{4}-0264$/);
  });
  it("conserve les tickets existants après une transaction annulée", async () => {
    await db.exec("INSERT INTO support_tickets VALUES ('','learner')");
    await db.exec("BEGIN; INSERT INTO support_tickets VALUES ('','learner'); ROLLBACK;");
    await db.exec("INSERT INTO support_tickets VALUES ('','learner')");
    const result = await db.query<{ total: number; distinct_numbers: number }>(
      "SELECT count(*)::int total, count(DISTINCT ticket_number)::int distinct_numbers FROM support_tickets");
    expect(result.rows[0]).toEqual({ total: 2, distinct_numbers: 2 });
  });
});

describe.skipIf(!process.env.SUPPORT_TEST_PG_PORT)("Concurrence sur Postgres local isolé", () => {
  it("alloue trente numéros distincts sur trente transactions concurrentes", async () => {
    const sql = postgres({ host: "127.0.0.1", port: Number(process.env.SUPPORT_TEST_PG_PORT),
      user: "lovable", database: "postgres", max: 20 });
    try {
      await sql.unsafe(readFileSync("drizzle/migrations/0030_support_ticket_number_atomic.sql", "utf8"));
      const numbers = await Promise.all(Array.from({ length: 30 }, (_, i) => sql.begin(async tx => {
        const [ticket] = await tx<{ ticket_number: string }[]>`
          INSERT INTO support_tickets(ticket_number,title) VALUES ('',${`concurrency ${i}`}) RETURNING ticket_number`;
        await tx`SELECT pg_sleep(0.02)`;
        return ticket.ticket_number;
      })));
      expect(numbers).toHaveLength(30);
      expect(new Set(numbers).size).toBe(30);
    } finally { await sql.end(); }
  });
});