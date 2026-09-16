import { describe, it, expect } from "vitest";
import { isBannerEnabled, bannerMessage, DEFAULT_MAINTENANCE_MESSAGE } from "./useMaintenanceBanner";

describe("isBannerEnabled", () => {
  it("affiche le bandeau quand le réglage vaut true", () => {
    expect(isBannerEnabled("true")).toBe(true);
    expect(isBannerEnabled(" TRUE ")).toBe(true);
  });

  it("n'affiche rien pour toute autre valeur", () => {
    expect(isBannerEnabled("false")).toBe(false);
    expect(isBannerEnabled("")).toBe(false);
    expect(isBannerEnabled(null)).toBe(false);
    expect(isBannerEnabled(undefined)).toBe(false);
    expect(isBannerEnabled("oui")).toBe(false);
  });
});

describe("bannerMessage", () => {
  it("rend le texte réglé", () => {
    expect(bannerMessage("Travaux en cours")).toBe("Travaux en cours");
  });

  it("retombe sur le message par défaut si le texte est vide", () => {
    expect(bannerMessage("   ")).toBe(DEFAULT_MAINTENANCE_MESSAGE);
    expect(bannerMessage(null)).toBe(DEFAULT_MAINTENANCE_MESSAGE);
  });
});
