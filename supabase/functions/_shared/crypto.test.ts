import { describe, it, expect } from "vitest";
import { generateHash, getClientIp, timingSafeEqualSecret } from "./crypto.ts";

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

describe("timingSafeEqualSecret", () => {
  it("retourne true pour deux secrets identiques", async () => {
    expect(await timingSafeEqualSecret("s3cret-token-abc", "s3cret-token-abc")).toBe(true);
  });

  it("retourne false pour des secrets différents de même longueur", async () => {
    expect(await timingSafeEqualSecret("aaaaaa", "aaaaab")).toBe(false);
  });

  it("retourne false pour des longueurs différentes", async () => {
    expect(await timingSafeEqualSecret("court", "beaucoup-plus-long")).toBe(false);
  });

  it("retourne false quand une seule valeur est absente", async () => {
    expect(await timingSafeEqualSecret(null, "x")).toBe(false);
    expect(await timingSafeEqualSecret("x", undefined)).toBe(false);
  });

  // Contrat documenté : deux valeurs vides sont "égales". Les appelants doivent
  // donc rejeter un secret non configuré AVANT d'appeler cette fonction (ce que
  // font les webhooks). Ce test verrouille ce comportement.
  it("considère deux valeurs vides comme égales (les appelants filtrent en amont)", async () => {
    expect(await timingSafeEqualSecret("", "")).toBe(true);
    expect(await timingSafeEqualSecret(null, undefined)).toBe(true);
  });
});
