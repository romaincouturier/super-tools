import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { readyGroups, depositPreviewHtml, type PendingDeposit } from "./digest.ts";

const base = (id: string, at: string, email = "anna@x.fr", course = "c1"): PendingDeposit => ({
  id, course_id: course, lesson_id: null, learner_email: email, comment: null,
  file_url: null, file_mime: null, file_name: null, trainer_notify_requested_at: at,
});

Deno.test("2 publications à 3 minutes d'écart = 1 seul groupe", () => {
  const now = Date.parse("2026-10-03T12:20:00Z");
  const g = readyGroups([base("a", "2026-10-03T12:00:00Z"), base("b", "2026-10-03T12:03:00Z")], now);
  assertEquals(g.length, 1);
  assertEquals(g[0].deposits.map((d) => d.id), ["a", "b"]);
});

Deno.test("groupe pas prêt tant que la dernière publication a moins de 5 min", () => {
  const now = Date.parse("2026-10-03T12:06:00Z");
  assertEquals(readyGroups([base("a", "2026-10-03T12:00:00Z"), base("b", "2026-10-03T12:03:00Z")], now).length, 0);
});

Deno.test("apprenants ou formations différents = groupes distincts", () => {
  const now = Date.parse("2026-10-03T13:00:00Z");
  const g = readyGroups([
    base("a", "2026-10-03T12:00:00Z"),
    base("b", "2026-10-03T12:00:00Z", "autre@x.fr"),
    base("c", "2026-10-03T12:00:00Z", "anna@x.fr", "c2"),
  ], now);
  assertEquals(g.length, 3);
});

Deno.test("le texte de l'apprenant est échappé", () => {
  const html = depositPreviewHtml({
    deposit: { ...base("a", "2026-10-03T12:00:00Z"), comment: "<script>x</script>\nl'idée" },
    lessonTitle: null, viewUrl: "https://v", likeUrl: "https://l",
  });
  assert(!html.includes("<script>"));
  assert(html.includes("l&#39;idée"));
});
