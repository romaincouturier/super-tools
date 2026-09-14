import { describe, it, expect } from "vitest";
import { stageFromResponse } from "./useLearnerTokenRedemption";

describe("stageFromResponse", () => {
  it("connecte quand le serveur rend une empreinte", () => {
    expect(stageFromResponse({ status: "ok", token_hash: "abc" })).toBe("connected");
  });

  it("distingue un lien expiré", () => {
    expect(stageFromResponse({ status: "expired" })).toBe("expired");
  });

  it("distingue un lien déjà utilisé", () => {
    expect(stageFromResponse({ status: "used" })).toBe("used");
  });

  it("traite un statut ok sans empreinte comme invalide", () => {
    expect(stageFromResponse({ status: "ok" })).toBe("invalid");
  });

  it("traite une réponse vide comme invalide", () => {
    expect(stageFromResponse(null)).toBe("invalid");
  });
});
