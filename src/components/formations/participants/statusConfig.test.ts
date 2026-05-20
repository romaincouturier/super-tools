import { describe, it, expect } from "vitest";
import { getStatusConfig } from "./statusConfig";
import { Mail, MailCheck, Clock, CheckCircle, AlertTriangle, HelpCircle } from "lucide-react";

describe("getStatusConfig", () => {
  it("non_envoye → Mail icon, gray, no colorClass", () => {
    const cfg = getStatusConfig("non_envoye");
    expect(cfg.icon).toBe(Mail);
    expect(cfg.variant).toBe("secondary");
    expect(cfg.colorClass).toBeUndefined();
  });

  it("programme → Mail icon, amber colorClass", () => {
    const cfg = getStatusConfig("programme");
    expect(cfg.icon).toBe(Mail);
    expect(cfg.colorClass).toBe("text-amber-500");
    expect(cfg.tooltip).toContain("J-7");
  });

  it("accueil_envoye → Mail icon, amber colorClass", () => {
    const cfg = getStatusConfig("accueil_envoye");
    expect(cfg.icon).toBe(Mail);
    expect(cfg.colorClass).toBe("text-amber-500");
  });

  it("manuel → AlertTriangle icon, gray", () => {
    const cfg = getStatusConfig("manuel");
    expect(cfg.icon).toBe(AlertTriangle);
    expect(cfg.variant).toBe("secondary");
    expect(cfg.colorClass).toBeUndefined();
  });

  it("envoye → MailCheck icon, amber colorClass", () => {
    const cfg = getStatusConfig("envoye");
    expect(cfg.icon).toBe(MailCheck);
    expect(cfg.colorClass).toBe("text-amber-500");
  });

  it("en_cours → Clock icon, primary variant", () => {
    const cfg = getStatusConfig("en_cours");
    expect(cfg.icon).toBe(Clock);
    expect(cfg.variant).toBe("default");
  });

  it("complete → CheckCircle icon, primary variant", () => {
    const cfg = getStatusConfig("complete");
    expect(cfg.icon).toBe(CheckCircle);
    expect(cfg.variant).toBe("default");
  });

  it("valide_formateur → CheckCircle icon", () => {
    const cfg = getStatusConfig("valide_formateur");
    expect(cfg.icon).toBe(CheckCircle);
  });

  it("expire → AlertTriangle icon, destructive variant", () => {
    const cfg = getStatusConfig("expire");
    expect(cfg.icon).toBe(AlertTriangle);
    expect(cfg.variant).toBe("destructive");
  });

  it("statut inconnu → HelpCircle icon, label = statut passé", () => {
    const cfg = getStatusConfig("valeur_inconnue");
    expect(cfg.icon).toBe(HelpCircle);
    expect(cfg.label).toBe("valeur_inconnue");
    expect(cfg.variant).toBe("secondary");
  });
});
