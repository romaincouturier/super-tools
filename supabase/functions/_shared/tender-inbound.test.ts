/**
 * L'invariant vérifié ici est celui qui protège le kanban commercial : une
 * alerte de marché public ne doit jamais pouvoir devenir une carte CRM, et le
 * routage doit fonctionner sur un mail TRANSFÉRÉ, où l'en-tête To porte
 * l'adresse d'origine et non l'adresse de transfert.
 */
import { describe, expect, it } from "vitest";
import { inboundRecipients, matchTenderRecipient } from "./tender-inbound.ts";

describe("inboundRecipients", () => {
  it("privilégie le destinataire d'enveloppe sur l'en-tête To", () => {
    // Cas du transfert automatique Gmail : To = adresse d'origine.
    expect(
      inboundRecipients({
        to: ["romain@supertilt.fr"],
        received_for: ["place@inbound.supertilt.fr"],
      }),
    ).toEqual(["place@inbound.supertilt.fr"]);
  });

  it("retombe sur To quand l'enveloppe est absente", () => {
    expect(inboundRecipients({ to: ["Romain <marches@inbound.supertilt.fr>"] })).toEqual([
      "marches@inbound.supertilt.fr",
    ]);
  });

  it("ne casse pas sur un payload vide", () => {
    expect(inboundRecipients({})).toEqual([]);
  });
});

describe("matchTenderRecipient", () => {
  const RULE = "@inbound.supertilt.fr";

  it("reconnaît le sous-domaine et déduit la source de la partie locale", () => {
    expect(matchTenderRecipient(["place@inbound.supertilt.fr"], RULE)).toEqual({
      matched: true,
      source: "place",
    });
    expect(matchTenderRecipient(["aws@inbound.supertilt.fr"], RULE)).toEqual({
      matched: true,
      source: "aws",
    });
  });

  it("accepte une source inconnue sans configuration préalable", () => {
    // Tout l'intérêt du routage par destinataire : ajouter une source ne
    // demande ni migration ni déploiement.
    expect(matchTenderRecipient(["boamp@inbound.supertilt.fr"], RULE).source).toBe("boamp");
  });

  it("ignore le courrier normal, qui reste éligible au CRM", () => {
    expect(matchTenderRecipient(["romain@supertilt.fr"], RULE)).toEqual({
      matched: false,
      source: null,
    });
  });

  it("ne se laisse pas tromper par un domaine qui ressemble", () => {
    expect(matchTenderRecipient(["place@inbound.supertilt.fr.evil.com"], RULE).matched).toBe(false);
  });

  it("est insensible à la casse", () => {
    expect(matchTenderRecipient(["PLACE@Inbound.Supertilt.FR"], RULE).source).toBe("place");
  });

  it("accepte aussi une adresse exacte plutôt qu'un sous-domaine", () => {
    expect(matchTenderRecipient(["marches@supertilt.fr"], "marches@supertilt.fr")).toEqual({
      matched: true,
      source: "mail",
    });
  });

  it("est désactivé tant que le réglage est vide", () => {
    expect(matchTenderRecipient(["place@inbound.supertilt.fr"], "")).toEqual({
      matched: false,
      source: null,
    });
    expect(matchTenderRecipient(["place@inbound.supertilt.fr"], null).matched).toBe(false);
  });
});
