import { describe, it, expect } from "vitest";
import {
  buildProcedureRecord,
  nextVersion,
  procedureStatusLabel,
  publishBlockers,
  EMPTY_PROCEDURE_FORM,
  PROCEDURE_STATUSES,
  type VhdProcedureFormValues,
} from "./vhdProcedure";

const form = (over: Partial<VhdProcedureFormValues> = {}): VhdProcedureFormValues => ({
  ...EMPTY_PROCEDURE_FORM,
  version: "1",
  content: "Signaler à l'interlocuteur ci-dessous.",
  contact_name: "Romain Couturier",
  ...over,
});

describe("nextVersion", () => {
  it("part de 1 quand aucune version n'existe", () => {
    expect(nextVersion([])).toBe("1");
  });

  it("prend le plus grand numéro utilisé, pas le dernier créé", () => {
    expect(nextVersion(["3", "1", "2"])).toBe("4");
  });

  it("ignore les versions nommées autrement plutôt que de renoncer", () => {
    // Un numéro libre reste possible : la suggestion ne doit pas s'effondrer.
    expect(nextVersion(["1", "2026-11", "2"])).toBe("3");
  });

  it("rend 1 quand aucune version n'est numérique", () => {
    expect(nextVersion(["initiale", "2026-11"])).toBe("1");
  });
});

describe("publishBlockers", () => {
  it("ne bloque rien sur une procédure complète", () => {
    expect(publishBlockers(form())).toEqual([]);
  });

  it("accepte un interlocuteur identifié par son seul email", () => {
    expect(publishBlockers(form({ contact_name: "", contact_email: "vhd@example.com" }))).toEqual([]);
  });

  it("refuse une procédure sans interlocuteur", () => {
    // Une procédure qui ne dit pas à qui s'adresser ne remplit pas son office.
    expect(publishBlockers(form({ contact_name: "", contact_email: "" }))).toEqual([
      "un interlocuteur, nom ou email",
    ]);
  });

  it("refuse un texte ou une version faits d'espaces", () => {
    expect(publishBlockers(form({ version: "  ", content: "   " }))).toEqual([
      "un numéro de version",
      "le texte de la procédure",
    ]);
  });

  it("liste tout ce qui manque d'un coup", () => {
    expect(publishBlockers(EMPTY_PROCEDURE_FORM)).toHaveLength(3);
  });
});

describe("buildProcedureRecord", () => {
  it("nettoie les espaces autour du texte et de la version", () => {
    const record = buildProcedureRecord(form({ version: " 2 ", content: "  Texte  " }));

    expect(record.version).toBe("2");
    expect(record.content).toBe("Texte");
  });

  it("rend null plutôt qu'une chaîne vide sur les champs facultatifs", () => {
    const record = buildProcedureRecord(form({ contact_email: "", effective_from: "" }));

    expect(record.contact_email).toBeNull();
    expect(record.effective_from).toBeNull();
  });

  it("conserve la date d'entrée en vigueur telle que saisie", () => {
    expect(buildProcedureRecord(form({ effective_from: "2026-11-01" })).effective_from)
      .toBe("2026-11-01");
  });

  it("n'écrit pas le statut : la publication est une action, pas un champ", () => {
    expect(buildProcedureRecord(form())).not.toHaveProperty("status");
  });
});

describe("procedureStatusLabel", () => {
  it("nomme les trois états", () => {
    expect(PROCEDURE_STATUSES).toHaveLength(3);
    expect(procedureStatusLabel("active")).toBe("En vigueur");
    expect(procedureStatusLabel("archived")).toBe("Archivée");
  });

  it("rend un tiret pour un état inconnu", () => {
    expect(procedureStatusLabel(null)).toBe("—");
  });
});
