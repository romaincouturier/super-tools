import { describe, it, expect } from "vitest";
import { anthropicText, anthropicRefusal } from "./anthropic-response.ts";

describe("anthropicText", () => {
  it("lit le texte même quand un bloc thinking arrive en premier", () => {
    // Le cas qui motive le helper : le thinking est adaptatif par défaut à
    // partir de Sonnet 5, et `content[0].text` rend alors undefined.
    const data = {
      content: [
        { type: "thinking", thinking: "" },
        { type: "text", text: "la réponse" },
      ],
    };
    expect(anthropicText(data)).toBe("la réponse");
  });

  it("concatène plusieurs blocs texte", () => {
    const data = {
      content: [
        { type: "text", text: "première partie " },
        { type: "text", text: "seconde partie" },
      ],
    };
    expect(anthropicText(data)).toBe("première partie seconde partie");
  });

  it("renvoie une chaîne vide sans bloc texte", () => {
    expect(anthropicText({ content: [{ type: "thinking", thinking: "" }] })).toBe("");
    expect(anthropicText({ content: [] })).toBe("");
    expect(anthropicText({})).toBe("");
    expect(anthropicText(null)).toBe("");
  });
});

describe("anthropicRefusal", () => {
  it("détecte un refus de classifieur", () => {
    const data = {
      stop_reason: "refusal",
      stop_details: { category: "cyber", explanation: "demande déclinée" },
      content: [],
    };
    expect(anthropicRefusal(data)).toBe("Refus du modèle (cyber) : demande déclinée");
  });

  it("tolère un refus sans détail", () => {
    expect(anthropicRefusal({ stop_reason: "refusal" })).toBe("Refus du modèle (sans catégorie)");
  });

  it("renvoie null sur une réponse normale", () => {
    expect(anthropicRefusal({ stop_reason: "end_turn", content: [] })).toBeNull();
    expect(anthropicRefusal({ stop_reason: "tool_use", content: [] })).toBeNull();
    expect(anthropicRefusal(null)).toBeNull();
  });
});
