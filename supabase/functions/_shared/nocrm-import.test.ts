import { describe, expect, it, vi } from "vitest";
import { activityContent, buildHistory, findMergeTarget, groupComments, leadTags, mapLeadToCard, noteContent, parisToIso, parseAmount, parseCsv, textToHtml } from "./nocrm-import";

const COLS = { "Entrant": "E", "Contacté": "C", "Devis envoyé": "D", "Gagné": "G", "Perdu": "P" };

describe("import noCRM", () => {
  it("lit les champs entre guillemets avec virgules et sauts de ligne", () => {
    const rows = parseCsv('ID,Univers,Description\r\n1,"Agilité,Intelligence Collective","ligne 1\nligne ""2"""\r\n');
    expect(rows).toEqual([{ ID: "1", Univers: "Agilité,Intelligence Collective", Description: 'ligne 1\nligne "2"' }]);
  });

  it("convertit l'heure de Paris en UTC, hiver comme été", () => {
    expect(parisToIso("2020-01-21 10:34")).toBe("2020-01-21T09:34:00.000Z");
    expect(parisToIso("2024-07-01 10:00")).toBe("2024-07-01T08:00:00.000Z");
    expect(parisToIso("")).toBeNull();
  });

  it("réutilise le convertisseur Paris pour les 15 577 commentaires", () => {
    const spy = vi.spyOn(Intl, "DateTimeFormat");
    try {
      const rows = Array.from({ length: 15577 }, (_, i) => ({ nocrm_id: String(i % 1955), commented_at: "2024-07-01 10:00" }));
      const comments = [...groupComments(rows).values()].flat();
      expect(comments).toHaveLength(15577);
      expect(comments.every(c => c.at === "2024-07-01T08:00:00.000Z")).toBe(true);
      expect(spy).not.toHaveBeenCalled();
    } finally { spy.mockRestore(); }
  });

  it("lit les montants", () => {
    expect(parseAmount("1427556.20")).toBe(1427556.2);
    expect(parseAmount("1 200,50")).toBe(1200.5);
  });

  it("conserve les sauts de ligne de la description", () => {
    expect(textToHtml("a\nb\n\nc <d>")).toBe("<p>a<br>b</p><p>c &lt;d&gt;</p>");
  });

  it("mappe statut, clôture, origine, type et relance des fiches ouvertes uniquement", () => {
    const won = mapLeadToCard({ ID: "1", Lead: "X", Status: "won", Amount: "1000", Created_at: "2021-03-01 09:00", Closed_at: "2021-04-01 09:00", Origine: "Téléphone", Type: "Prestation", Remind_date: "2021-05-01 09:00" });
    expect(won.card.sales_status).toBe("WON");
    expect(won.card.won_at).toBe("2021-04-01T07:00:00.000Z");
    expect(won.card.acquisition_source).toBe("appel_entrant");
    expect(won.card.service_type).toBe("mission");
    expect(won.card.waiting_next_action_date).toBeNull();
    const open = mapLeadToCard({ ID: "2", Status: "standby", Remind_date: "2026-12-01 09:00", Reminder_note: "Relancer" });
    expect(open.card.sales_status).toBe("OPEN");
    expect(open.card.waiting_next_action_date).toBe("2026-12-01");
    const cancel = mapLeadToCard({ ID: "3", Status: "cancelled", Closed_at: "2022-01-01 10:00", "Raison de la perte de l_affaire": "Prix,Timing" });
    expect(cancel.card.lost_at).not.toBeNull();
    expect(cancel.card.loss_reason).toBe("prix");
    expect(cancel.card.loss_reason_detail).toBe("Prix, Timing");
  });

  it("pose un tag par valeur selon la table de correspondance", () => {
    const { tags, unknown } = leadTags({ Univers: "Agilité,Misc", Cible: "Public", "Qualiopi déterminant ?": "Ne sait pas", Origine: "Conférence/Evènement,Inconnue" });
    expect(tags).toEqual([["Univers", "Transformation"], ["Taille", "Public"], ["Origine", "Evènement"], ["Qualiopi déterminant ?", "Inconnu"]]);
    expect(unknown).toEqual([{ column: "Origine", value: "Inconnue" }]);
  });

  it("préfixe les notes par leur type d'activité", () => {
    const [n] = groupComments([{ nocrm_id: "1", commented_at: "2021-01-01 10:00", activity_type: "Non abouti", content: "À rappeler jeudi", is_note: "True" }]).get("1")!;
    expect(noteContent(n)).toBe("[Non abouti] À rappeler jeudi");
  });

  it("conserve le texte complet des activités", () => {
    const [a] = groupComments([{ nocrm_id: "1", commented_at: "2021-01-01 10:00", activity_type: "E-mail reçu", content: "Accord pour 5 jeux\nMerci", is_note: "False" }]).get("1")!;
    expect(activityContent(a)).toBe("[E-mail reçu] Accord pour 5 jeux\nMerci");
  });

  it("reconstitue un historique chronologique, Devis envoyé à la date de la proposition", () => {
    const comments = groupComments([
      { nocrm_id: "1", commented_at: "2021-01-10 10:00", content: "Envoi proposition-commerciale.fr/x", is_note: "True" },
    ]).get("1")!;
    const h = buildHistory({ title: "X", createdAt: "2021-01-01T09:00:00.000Z", firstActivity: "2021-01-05T09:00:00.000Z", closedAt: "2021-02-01T09:00:00.000Z", step: "Devis envoyé", status: "WON", comments, columnIds: COLS });
    expect(h.map((e) => [e.action_type, e.new_value, e.estimated])).toEqual([
      ["card_created", "X", false], ["card_moved", "C", true], ["card_moved", "D", true], ["sales_status_changed", "WON", false], ["card_moved", "G", false],
    ]);
    expect(h[2].at).toBe("2021-01-10T09:00:00.000Z");
    const ats = h.map((e) => e.at);
    expect([...ats].sort()).toEqual(ats);
  });

  it("ne place jamais une étape avant la création ni après la clôture", () => {
    const h = buildHistory({ title: "X", createdAt: "2021-01-10T09:00:00.000Z", firstActivity: "2021-01-01T09:00:00.000Z", closedAt: "2021-01-05T09:00:00.000Z", step: "Contacté", status: "LOST", comments: [], columnIds: COLS });
    expect(h.every((e) => e.at === "2021-01-10T09:00:00.000Z")).toBe(true);
    expect(h.at(-1)!.new_value).toBe("P");
  });

  it("fusionne seulement le même email à moins de 30 jours", () => {
    const cands = [{ id: "a", email: "X@Y.fr", created_at: "2026-02-10T00:00:00Z" }, { id: "b", email: "x@y.fr", created_at: "2025-01-01T00:00:00Z" }];
    expect(findMergeTarget("x@y.fr", "2026-02-01T00:00:00Z", cands, new Set())?.id).toBe("a");
    expect(findMergeTarget("x@y.fr", "2023-06-01T00:00:00Z", cands, new Set())).toBeNull();
    expect(findMergeTarget("x@y.fr", "2026-02-01T00:00:00Z", cands, new Set(["a"]))).toBeNull();
  });
});
