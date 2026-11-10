import { describe, expect, it } from "vitest";
import { attestationSections, effectiveStatus, missingForLink, PUBLIC_ENTITY_MENTION } from "./execution-attestation";

describe("attestations de bonne exécution", () => {
  const base = { subject: "Atelier", client_name: "Ville de Lyon" };

  it("collectivité cochée sans collectivité ou nom : lien refusé ; la fonction est complétée par le signataire", () => {
    expect(missingForLink({ ...base, is_public_entity: true })).toEqual(["Nom de la collectivité", "Nom du signataire"]);
    expect(missingForLink({ ...base, is_public_entity: true, public_entity_name: "Ville de Lyon", signer_name: "A B" })).toEqual([]);
  });

  it("sans collectivité, objet et client suffisent", () => {
    expect(missingForLink(base)).toEqual([]);
    expect(missingForLink({})).toEqual(["Objet de la prestation", "Client"]);
  });

  it("le contenu collectivité porte la mention, la collectivité et la fonction", () => {
    const s = attestationSections({ ...base, is_public_entity: true, public_entity_name: "Métropole de Lyon", signer_name: "Jeanne Martin", signer_function: "Directrice RH" });
    const block = s.find((x) => x.title === PUBLIC_ENTITY_MENTION);
    expect(block?.lines).toEqual(["Collectivité : Métropole de Lyon", "Signataire : Jeanne Martin", "Fonction : Directrice RH"]);
  });

  it("sans collectivité, pas de mention", () => {
    expect(attestationSections(base).some((x) => x.title === PUBLIC_ENTITY_MENTION)).toBe(false);
  });

  it("une attestation envoyée dont la date est passée est expirée", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    expect(effectiveStatus({ status: "sent", expires_at: "2026-11-09T12:00:00Z" }, now)).toBe("expired");
    expect(effectiveStatus({ status: "sent", expires_at: "2026-11-11T12:00:00Z" }, now)).toBe("sent");
  });
});
