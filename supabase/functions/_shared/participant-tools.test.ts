import { it, expect } from "vitest";
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

it("preview writes nothing and normalizes email", async () => {
  let called = false;
  const out = JSON.parse(await addTrainingParticipant(fakeDb(inter), { training_id: TID, email: " Emma@Ex.fr ", sponsor_same_as_participant: true }, noop, async () => { called = true; return {}; }));
  expect(out.preview).toEqual(true);
  expect(out.participant.email).toEqual("emma@ex.fr");
  expect(out.participant.sponsorEmail).toEqual("emma@ex.fr");
  expect(out.participant.source).toEqual("manual");
  expect(called).toEqual(false);
});

it("rejects duplicate, bad email, cancelled, unknown formula", async () => {
  await expect(buildParticipantRequest(fakeDb(inter, [{ id: "x" }]), { training_id: TID, email: "a@b.fr" })).rejects.toThrow("déjà inscrit");
  await expect(buildParticipantRequest(fakeDb(inter), { training_id: TID, email: "nope" })).rejects.toThrow("email invalide");
  await expect(buildParticipantRequest(fakeDb({ ...inter, is_cancelled: true }), { training_id: TID, email: "a@b.fr" })).rejects.toThrow("annulée");
  await expect(buildParticipantRequest(fakeDb(inter), { training_id: TID, email: "a@b.fr", formula_name: "X" })).rejects.toThrow("Formule inconnue");
});

it("free training drops price/BPF; intra prefills company; formula coaching deadline", async () => {
  const free = await buildParticipantRequest(fakeDb({ ...inter, is_free: true }), { training_id: TID, email: "a@b.fr", sold_price_ht: 100, type_stagiaire_bpf: "apprenti" });
  expect(free.body.soldPriceHt).toEqual(null);
  expect(free.body.typeStagiaireBpf).toEqual(null);
  const intra = await buildParticipantRequest(fakeDb({ ...inter, session_type: "intra", format_formation: "intra-entreprise", client_name: "ACME" }), { training_id: TID, email: "a@b.fr" });
  expect(intra.body.company).toEqual("ACME");
  expect(intra.body.isInterEntreprise).toEqual(false);
  const f = await buildParticipantRequest(fakeDb(inter, [], [{ id: "f1", name: "Premium", coaching_sessions_count: 2 }]), { training_id: TID, email: "a@b.fr" });
  expect(f.body.formulaId).toEqual("f1");
  expect(f.body.coachingSessionsTotal).toEqual(2);
});
