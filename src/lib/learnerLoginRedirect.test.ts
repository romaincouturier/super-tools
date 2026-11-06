import { describe, it, expect } from "vitest";
import { buildLearnerLoginPath } from "./learnerLoginRedirect";

describe("buildLearnerLoginPath", () => {
  it("préremplit l'email et retire ?email= de la cible", () => {
    const path = buildLearnerLoginPath("/lms/abc/player", "?email=a%40b.fr&lesson=l1", "next");
    const q = new URLSearchParams(path.split("?")[1]);
    expect(q.get("email")).toBe("a@b.fr");
    expect(q.get("next")).toBe("/lms/abc/player?lesson=l1");
  });
  it("fonctionne sans email", () => {
    expect(buildLearnerLoginPath("/lms/abc/home", "", "next")).toBe("/connexion?next=%2Flms%2Fabc%2Fhome");
  });
});
