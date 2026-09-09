import { describe, it, expect } from "vitest";
import {
  categoryLabel,
  channelLabel,
  statusLabel,
  isOverdue,
  VHD_CATEGORIES,
  buildReportRecord,
} from "./vhdConstants";

describe("libellés", () => {
  it("traduit les catégories nommées par le décret", () => {
    expect(categoryLabel("violence_sexiste_sexuelle")).toBe("Violence sexiste ou sexuelle");
    expect(categoryLabel("harcelement")).toBe("Harcèlement");
    expect(categoryLabel("discrimination")).toBe("Discrimination");
  });

  it("traduit canaux et statuts", () => {
    expect(channelLabel("telephone")).toBe("Téléphone");
    expect(statusLabel("mesures_prises")).toBe("Mesures prises");
  });

  it("rend un tiret plutôt qu'une valeur brute pour l'inconnu", () => {
    expect(categoryLabel("inexistant")).toBe("—");
    expect(channelLabel(null)).toBe("—");
    expect(statusLabel(undefined)).toBe("—");
  });

  it("couvre les quatre situations visées par l'indicateur 12", () => {
    const values = VHD_CATEGORIES.map((c) => c.value);
    expect(values).toContain("violence");
    expect(values).toContain("violence_sexiste_sexuelle");
    expect(values).toContain("harcelement");
    expect(values).toContain("discrimination");
  });
});

describe("isOverdue", () => {
  it("signale un signalement ouvert dont l'échéance est passée", () => {
    expect(isOverdue({ status: "en_analyse", due_date: "2026-09-01" }, "2026-09-04")).toBe(true);
  });

  it("ne signale rien le jour de l'échéance", () => {
    expect(isOverdue({ status: "recu", due_date: "2026-09-04" }, "2026-09-04")).toBe(false);
  });

  it("ne signale pas un signalement clôturé, même en retard", () => {
    expect(isOverdue({ status: "cloture", due_date: "2026-01-01" }, "2026-09-04")).toBe(false);
  });

  it("ne signale rien sans échéance", () => {
    expect(isOverdue({ status: "recu", due_date: null }, "2026-09-04")).toBe(false);
  });
});

describe("buildReportRecord", () => {
  const form = {
    reported_at: "2026-09-01",
    training_id: "t-1",
    channel: "mail",
    category: "harcelement",
    handled_by: "  Romain  ",
    actions_taken: "  Entretien mené  ",
    due_date: "2026-09-15",
    status: "en_analyse",
  };

  const NOW = "2026-09-04T10:00:00.000Z";
  const TODAY = "2026-09-04";

  it("nettoie les champs texte et garde les identifiants", () => {
    const record = buildReportRecord(form, NOW, TODAY);

    expect(record.handled_by).toBe("Romain");
    expect(record.actions_taken).toBe("Entretien mené");
    expect(record.training_id).toBe("t-1");
    expect(record.category).toBe("harcelement");
  });

  it("horodate la clôture quand le statut passe à clôturé", () => {
    const record = buildReportRecord({ ...form, status: "cloture" }, NOW, TODAY);

    expect(record.closed_at).toBe(NOW);
  });

  it("efface la date de clôture quand le signalement est rouvert", () => {
    // Sans cette remise à zéro, le registre affirmerait qu'une affaire close
    // est encore en cours de traitement.
    const record = buildReportRecord({ ...form, status: "en_analyse" }, NOW, TODAY);

    expect(record.closed_at).toBeNull();
  });

  it("rend nuls les champs facultatifs laissés vides", () => {
    const record = buildReportRecord(
      { ...form, training_id: "", handled_by: "   ", actions_taken: "", due_date: "" },
      NOW,
      TODAY,
    );

    expect(record.training_id).toBeNull();
    expect(record.handled_by).toBeNull();
    expect(record.actions_taken).toBeNull();
    expect(record.due_date).toBeNull();
  });

  it("date du jour un signalement saisi sans date", () => {
    const record = buildReportRecord({ ...form, reported_at: "" }, NOW, TODAY);

    expect(record.reported_at).toBe(TODAY);
  });
});
