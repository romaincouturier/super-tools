import { describe, expect, it } from "vitest";
import { selectAttendanceTrainer, type AttendanceTrainer } from "./attendance-trainer";

const romain: AttendanceTrainer = { id: "romain", email: "romain@supertilt.fr", first_name: "Romain", last_name: "Couturier" };
const other: AttendanceTrainer = { id: "other", email: "other@example.org", first_name: "Autre", last_name: "Formateur" };

describe("formateur des notifications d'émargement", () => {
  it("utilise Romain Couturier par défaut en l'absence de choix", () => {
    expect(selectAttendanceTrainer({}, [other, romain])?.email).toBe("romain@supertilt.fr");
  });
  it("retrouve Romain depuis le nom historique sans identifiant", () => {
    expect(selectAttendanceTrainer({ trainer_id: null, trainer_name: "Romain Couturier" }, [romain])?.id).toBe("romain");
  });
  it("respecte un autre formateur explicitement choisi", () => {
    expect(selectAttendanceTrainer({ trainer_id: "other", trainers: other }, [romain, other])?.email).toBe("other@example.org");
  });
  it("ne remplace pas un autre nom historique par Romain", () => {
    expect(selectAttendanceTrainer({ trainer_name: "Autre Formateur" }, [romain, other])?.id).toBe("other");
  });
  it("ne redirige pas vers Romain un formateur introuvable", () => {
    expect(selectAttendanceTrainer({ trainer_id: "missing" }, [romain])).toBeNull();
  });
  it("refuse une correspondance ambiguë", () => {
    expect(selectAttendanceTrainer({}, [romain, { ...romain, id: "duplicate" }])).toBeNull();
  });
});