import { describe, it, expect } from "vitest";
import { generateHash, getClientIp } from "./crypto.ts";

describe("generateHash", () => {
  it("rend une empreinte SHA-256 stable pour la même valeur", async () => {
    const a = await generateHash("alice@exemple.fr");
    const b = await generateHash("alice@exemple.fr");
    expect(a).toBe(b);
    expect(a).toHaveLength(64);
    expect(a).toMatch(/^[0-9a-f]{64}$/);
  });

  it("rend des empreintes différentes pour des valeurs différentes", async () => {
    const a = await generateHash("alice@exemple.fr");
    const b = await generateHash("bob@exemple.fr");
    expect(a).not.toBe(b);
  });
});

describe("getClientIp", () => {
  it("préfère l'en-tête Cloudflare quand il est présent", () => {
    const req = new Request("https://exemple.fr", {
      headers: {
        "cf-connecting-ip": "1.1.1.1",
        "x-real-ip": "2.2.2.2",
        "x-forwarded-for": "3.3.3.3, 4.4.4.4",
      },
    });
    expect(getClientIp(req)).toBe("1.1.1.1");
  });

  it("retombe sur x-forwarded-for, première adresse de la liste", () => {
    const req = new Request("https://exemple.fr", {
      headers: { "x-forwarded-for": "3.3.3.3, 4.4.4.4" },
    });
    expect(getClientIp(req)).toBe("3.3.3.3");
  });

  it("rend 'unknown' sans aucun en-tête", () => {
    const req = new Request("https://exemple.fr");
    expect(getClientIp(req)).toBe("unknown");
  });
});
