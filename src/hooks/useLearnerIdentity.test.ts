import { describe, it, expect } from "vitest";
import { resolveLearnerEmail } from "./useLearnerIdentity";

describe("resolveLearnerEmail", () => {
  it("fait primer la session sur le paramètre d'URL", () => {
    expect(resolveLearnerEmail({
      sessionEmail: "moi@exemple.fr",
      urlEmail: "quelquun-dautre@exemple.fr",
      isStaff: false,
    })).toBe("moi@exemple.fr");
  });

  it("laisse le staff prévisualiser une autre adresse", () => {
    expect(resolveLearnerEmail({
      sessionEmail: "staff@supertilt.fr",
      urlEmail: "apprenant@exemple.fr",
      isStaff: true,
    })).toBe("apprenant@exemple.fr");
  });

  it("rend au staff sa propre adresse quand l'URL n'en porte pas", () => {
    expect(resolveLearnerEmail({
      sessionEmail: "staff@supertilt.fr",
      urlEmail: "",
      isStaff: true,
    })).toBe("staff@supertilt.fr");
  });

  it("sert le paramètre d'URL quand il n'y a pas de session (liens historiques)", () => {
    expect(resolveLearnerEmail({
      sessionEmail: null,
      urlEmail: "apprenant@exemple.fr",
      isStaff: false,
    })).toBe("apprenant@exemple.fr");
  });

  it("rend une chaîne vide quand ni session ni paramètre", () => {
    expect(resolveLearnerEmail({ sessionEmail: null, urlEmail: "", isStaff: false })).toBe("");
  });
});
