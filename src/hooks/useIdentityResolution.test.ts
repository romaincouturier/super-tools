import { describe, it, expect } from "vitest";
import { parseIdentityState } from "./useIdentityResolution";

describe("parseIdentityState", () => {
  it.each(["password", "unknown", "throttled"])("accepte l'état %s", (state) => {
    expect(parseIdentityState({ state })).toBe(state);
  });

  it("traite une réponse vide comme une panne", () => {
    expect(parseIdentityState(null)).toBeNull();
  });

  it("traite un état inattendu comme une panne", () => {
    expect(parseIdentityState({ state: "whatever" })).toBeNull();
  });

  it.each(["link", "activation"])("ne reconnaît plus l'ancien état %s (lien magique retiré)", (state) => {
    expect(parseIdentityState({ state })).toBeNull();
  });

  it("traite une réponse sans état comme une panne", () => {
    expect(parseIdentityState({ ok: true })).toBeNull();
  });
});
