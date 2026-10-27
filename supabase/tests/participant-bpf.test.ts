import { describe, expect, it } from "vitest";
import { normalizeTypeStagiaireBpf } from "../functions/add-training-participant/bpf";

describe("participant BPF normalization", () => {
  it("maps the legacy WooCommerce Entreprise value", () => {
    expect(normalizeTypeStagiaireBpf("Entreprise")).toBe("salarie_prive");
  });
  it("maps the legacy WooCommerce Particulier value", () => {
    expect(normalizeTypeStagiaireBpf("Particulier")).toBe("particulier");
  });
  it.each(["salarie_prive", "apprenti", "demandeur_emploi", "particulier", "autre"])("preserves the CHECK value %s", (value) => {
    expect(normalizeTypeStagiaireBpf(value)).toBe(value);
  });
  it("normalizes case and surrounding spaces", () => {
    expect(normalizeTypeStagiaireBpf("  PARTICULIER  ")).toBe("particulier");
  });
  it("maps the salarie alias", () => {
    expect(normalizeTypeStagiaireBpf("salarie")).toBe("salarie_prive");
  });
  it.each([null, undefined, "", "  ", "inconnu"])("does not write an invalid BPF value (%s)", (value) => {
    expect(normalizeTypeStagiaireBpf(value)).toBeNull();
  });
});