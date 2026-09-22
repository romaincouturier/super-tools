import { describe, it, expect } from "vitest";
import {
  demoBlur,
  maskEmail,
  maskName,
  maskAmount,
  maskPhone,
  maskApiKey,
  maskAddress,
  maskSiren,
  maskText,
  maskFileName,
} from "./demoMask";

const ALL = [maskEmail, maskName, maskAmount, maskPhone, maskApiKey, maskAddress, maskSiren, maskText, maskFileName];

describe("demoMask", () => {
  it("laisse passer null/undefined/chaine vide sans lever", () => {
    for (const mask of ALL) {
      expect(mask(null)).toBe("");
      expect(mask(undefined)).toBe("");
      expect(mask("")).toBe("");
    }
  });

  it("maskEmail garde l'initiale, le domaine initial et le TLD", () => {
    expect(maskEmail("romain@supertilt.fr")).toBe("r•••••@s••••••••.fr");
  });

  it("maskEmail masque entierement une valeur sans arobase", () => {
    expect(maskEmail("pas-un-email")).toBe("••••••");
  });

  it("maskName garde premiere et derniere lettre de chaque mot", () => {
    expect(maskName("Romain Couturier")).toBe("R••••n C•••••••r");
  });

  it("maskName preserve les mots de deux lettres ou moins", () => {
    expect(maskName("Jo Li")).toBe("Jo Li");
  });

  it("maskAmount ne laisse fuir aucun chiffre", () => {
    expect(maskAmount(12345.67)).toBe("•••• €");
    expect(maskAmount("4 200 €")).toBe("•••• €");
  });

  it("maskAmount distingue zero de l'absence de valeur", () => {
    expect(maskAmount(0)).toBe("•••• €");
    expect(maskAmount("")).toBe("");
  });

  it("maskPhone et maskSiren rendent un gabarit fixe", () => {
    expect(maskPhone("06 12 34 56 78")).toBe("•• •• •• •• ••");
    expect(maskSiren("123 456 789")).toBe("••• ••• •••");
  });

  it("maskApiKey garde le prefixe de 4 caracteres", () => {
    expect(maskApiKey("sk-live-abcdef123456")).toBe("sk-l••••••••••••••••");
  });

  it("maskFileName garde l'extension", () => {
    expect(maskFileName("devis-acme-2026.pdf")).toBe("••••••••.pdf");
    expect(maskFileName("sans-extension")).toBe("••••••");
  });

  it("demoBlur ne rend un style que si le mode demo est actif", () => {
    expect(demoBlur(false)).toBeUndefined();
    expect(demoBlur(true)).toEqual({ filter: "blur(4px)", userSelect: "none" });
  });

  it("demoBlur verrouille le pointeur a la demande", () => {
    expect(demoBlur(true, { lockPointer: true })).toEqual({
      filter: "blur(4px)",
      userSelect: "none",
      pointerEvents: "none",
    });
    expect(demoBlur(true, { lockPointer: false })).toEqual({ filter: "blur(4px)", userSelect: "none" });
    expect(demoBlur(false, { lockPointer: true })).toBeUndefined();
  });

  it("aucun masque ne rend la valeur d'origine sur une donnee identifiante", () => {
    const samples: Array<[(v: string) => string, string]> = [
      [maskEmail, "romain@supertilt.fr"],
      [maskName, "Romain Couturier"],
      [maskPhone, "0612345678"],
      [maskText, "Acme Formation"],
      [maskAddress, "12 rue des Lilas"],
      [maskSiren, "123456789"],
      [maskApiKey, "sk-live-abcdef123456"],
      [maskFileName, "convention-acme.pdf"],
    ];
    for (const [mask, value] of samples) {
      expect(mask(value)).not.toBe(value);
    }
  });
});
