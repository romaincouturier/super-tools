import { assertEquals, assertRejects } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { addTrainingParticipant, buildParticipantRequest } from "./participant-tools.ts";

const TID = "11111111-1111-1111-1111-111111111111";

function fakeDb(training: Record<string, unknown> | null, existing: unknown[] = [], formulas: unknown[] = []) {
  const q = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, { select: self, eq: self, ilike: self, order: () => Promise.resolve({ data: formulas, error: null }) });
    chain.maybeSingle = () => Promise.resolve({ data: training, error: null });
    chain.limit = () => Promise.resolve({ data: table === "training_participants" ? existing : [], error: null });
    return chain;
  };
  return { from: q };
}

const inter = { id: TID, training_name: "Facilitation", start_date: "2099-01-10", end_date: "2099-01-11", format_formation: "inter-entreprises", session_type: "inter", is_free: false, catalog_id: "c", client_name: null, is_cancelled: false };
const noop = async () => {};

Deno.test("preview writes nothing and normalizes email", async () => {
  let called = false;
  const out = JSON.parse(await addTrainingParticipant(fakeDb(inter), { training_id: TID, email: " Emma@Ex.fr ", sponsor_same_as_participant: true }, noop, async () => { called = true; return {}; }));
  assertEquals(out.preview, true);
  assertEquals(out.participant.email, "emma@ex.fr");
  assertEquals(out.participant.sponsorEmail, "emma@ex.fr");
  assertEquals(out.participant.source, "manual");
  assertEquals(called, false);
});

Deno.test("rejects duplicate, bad email, cancelled, unknown formula", async () => {
  await assertRejects(() => buildParticipantRequest(fakeDb(inter, [{ id: "x" }]), { training_id: TID, email: "a@b.fr" }), Error, "déjà inscrit");
  await assertRejects(() => buildParticipantRequest(fakeDb(inter), { training_id: TID, email: "nope" }), Error, "email invalide");
  await assertRejects(() => buildParticipantRequest(fakeDb({ ...inter, is_cancelled: true }), { training_id: TID, email: "a@b.fr" }), Error, "annulée");
  await assertRejects(() => buildParticipantRequest(fakeDb(inter), { training_id: TID, email: "a@b.fr", formula_name: "X" }), Error, "Formule inconnue");
});

Deno.test("free training drops price/BPF; intra prefills company; formula coaching deadline", async () => {
  const free = await buildParticipantRequest(fakeDb({ ...inter, is_free: true }), { training_id: TID, email: "a@b.fr", sold_price_ht: 100, type_stagiaire_bpf: "apprenti" });
  assertEquals(free.body.soldPriceHt, null);
  assertEquals(free.body.typeStagiaireBpf, null);
  const intra = await buildParticipantRequest(fakeDb({ ...inter, session_type: "intra", format_formation: "intra-entreprise", client_name: "ACME" }), { training_id: TID, email: "a@b.fr" });
  assertEquals(intra.body.company, "ACME");
  assertEquals(intra.body.isInterEntreprise, false);
  const f = await buildParticipantRequest(fakeDb(inter, [], [{ id: "f1", name: "Premium", coaching_sessions_count: 2 }]), { training_id: TID, email: "a@b.fr" });
  assertEquals(f.body.formulaId, "f1");
  assertEquals(f.body.coachingSessionsTotal, 2);
});
