import { it, expect } from "vitest";
import { logTrainingFeedback, feedbackDate } from "./feedback-tools.ts";
import { extractPlainText, type GmailMessage } from "./gmail.ts";

const TID = "11111111-1111-1111-1111-111111111111";
const PID = "22222222-2222-2222-2222-222222222222";
const noop = async () => {};

function fakeDb(opts: { participant?: Record<string, unknown> | null; existing?: Record<string, unknown> | null } = {}) {
  const inserted: Record<string, unknown>[] = [];
  const from = (table: string) => {
    const chain: Record<string, unknown> = {};
    const self = () => chain;
    Object.assign(chain, { select: self, eq: self });
    chain.maybeSingle = () => Promise.resolve({ data: table === "training_participants" ? opts.participant ?? null : opts.existing ?? null, error: null });
    chain.insert = (row: Record<string, unknown>) => {
      inserted.push(row);
      return { select: () => ({ single: () => Promise.resolve({ data: { id: "fb-1" }, error: null }) }) };
    };
    return chain;
  };
  return { db: { from }, inserted };
}

const b64 = (s: string) => btoa(unescape(encodeURIComponent(s))).replace(/\+/g, "-").replace(/\//g, "_");

it("rattache un retour saisi au participant et déduit la session et le nom", async () => {
  const { db, inserted } = fakeDb({ participant: { id: PID, first_name: "Anne", last_name: "Martin", email: "a@x.fr", training_id: TID } });
  const out = JSON.parse(await logTrainingFeedback(db, { participant_id: PID, content: "  Merci pour l'approche généreuse  ", source: "telephone", received_at: "2026-10-30" }, noop, "me"));
  expect(out.created).toBe(true);
  expect(inserted[0]).toMatchObject({
    training_id: TID, participant_id: PID, author_name: "Anne Martin", source: "telephone",
    received_at: "2026-10-30", content: "Merci pour l'approche généreuse", consent_publication: false, gmail_message_id: null,
  });
});

it("refuse un training_id qui contredit la session du participant", async () => {
  const { db } = fakeDb({ participant: { id: PID, training_id: TID } });
  await expect(logTrainingFeedback(db, { participant_id: PID, training_id: "33333333-3333-3333-3333-333333333333", content: "x" }, noop, "me"))
    .rejects.toThrow(/ne correspond pas/);
});

it("exige un rattachement et un contenu", async () => {
  const { db } = fakeDb();
  await expect(logTrainingFeedback(db, { content: "x" }, noop, "me")).rejects.toThrow(/participant_id ou training_id/);
  await expect(logTrainingFeedback(db, { training_id: TID }, noop, "me")).rejects.toThrow(/content ou gmail_message_id/);
  await expect(logTrainingFeedback(db, { training_id: TID, content: "x", source: "fax" }, noop, "me")).rejects.toThrow(/source invalide/);
});

it("n'enregistre jamais deux fois le même mail", async () => {
  const { db, inserted } = fakeDb({ existing: { id: "fb-0", training_id: TID, participant_id: PID } });
  const fetchMail = async () => ({ id: "abc123", text: "Bonjour", date: "", from: "", snippet: "" } as unknown as GmailMessage);
  const out = JSON.parse(await logTrainingFeedback(db, { training_id: TID, gmail_message_id: "abc123" }, noop, "me", fetchMail));
  expect(out).toMatchObject({ created: false, reason: "already_logged", feedback_id: "fb-0" });
  expect(inserted).toHaveLength(0);
});

it("feedbackDate : date explicite, sinon date du mail en heure de Paris", () => {
  expect(feedbackDate("2026-01-02", "Mon, 3 Nov 2026 10:00:00 +0000")).toBe("2026-01-02");
  expect(feedbackDate(undefined, "Sun, 1 Nov 2026 23:30:00 +0000")).toBe("2026-11-02");
});

it("extractPlainText préfère text/plain et nettoie le HTML à défaut", () => {
  const plain = { mimeType: "multipart/alternative", parts: [
    { mimeType: "text/plain", body: { data: b64("Je n'ai pas le temps de pratiquer.\n") } },
    { mimeType: "text/html", body: { data: b64("<p>ignoré</p>") } },
  ] };
  expect(extractPlainText(plain)).toBe("Je n'ai pas le temps de pratiquer.");
  const html = { mimeType: "text/html", body: { data: b64("<style>p{}</style><p>Merci&nbsp;!</p><p>L&#39;approche</p>") } };
  expect(extractPlainText(html)).toBe("Merci !\nL'approche");
  const attachmentOnly = { mimeType: "multipart/mixed", parts: [{ mimeType: "text/plain", filename: "a.txt", body: { data: b64("pj") } }] };
  expect(extractPlainText(attachmentOnly)).toBe("");
});
