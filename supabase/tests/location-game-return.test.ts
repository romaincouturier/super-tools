import { beforeAll, afterAll, beforeEach, describe, it, expect } from "vitest";
import { PGlite } from "@electric-sql/pglite";
import { readFileSync } from "node:fs";

let db: PGlite;
beforeAll(async () => {
  db = await PGlite.create();
  await db.exec(`CREATE TABLE public.order_items (
    id int PRIMARY KEY, kanban_status text, contrat_reference text, location_end_date date
  );`);
  await db.exec(readFileSync("drizzle/migrations/0027_location_game_return.sql", "utf8"));
  await db.exec(`CREATE TRIGGER trg_guard_location_processed BEFORE UPDATE OF kanban_status ON order_items
    FOR EACH ROW EXECUTE FUNCTION guard_location_processed();`);
});
afterAll(async () => { await db?.close(); });
beforeEach(async () => {
  await db.exec(`TRUNCATE order_items; INSERT INTO order_items VALUES (1,'location_active','TEST',current_date+30,NULL);`);
});

describe("Retour du jeu loué", () => {
  it("clôture avant échéance lorsque le retour est confirmé sans changer la date contractuelle", async () => {
    await db.exec(`UPDATE order_items SET location_returned_at=now(),kanban_status='processed' WHERE id=1`);
    const result = await db.query<{kanban_status: string; returned: boolean; deadline_unchanged: boolean}>(
      `SELECT kanban_status,location_returned_at IS NOT NULL AS returned,location_end_date=current_date+30 AS deadline_unchanged FROM order_items WHERE id=1`);
    expect(result.rows[0]).toEqual({ kanban_status: "processed", returned: true, deadline_unchanged: true });
  });
  it("refuse toujours une clôture anticipée sans retour et conserve la carte", async () => {
    await expect(db.exec(`UPDATE order_items SET kanban_status='processed' WHERE id=1`)).rejects.toThrow(/confirmez le retour/);
    expect((await db.query("SELECT kanban_status FROM order_items WHERE id=1")).rows[0].kanban_status).toBe("location_active");
  });
  it("permet un retour reçu même sans échéance renseignée", async () => {
    await db.exec(`UPDATE order_items SET location_end_date=NULL WHERE id=1;
      UPDATE order_items SET location_returned_at=now(),kanban_status='processed' WHERE id=1`);
    expect((await db.query("SELECT kanban_status FROM order_items WHERE id=1")).rows[0].kanban_status).toBe("processed");
  });
});