import { describe, expect, it, vi } from "vitest";
import { parseFrenchDeadline, parseTenderEmailNotices } from "./tender-email-notices.ts";
import { routeTenderEmail } from "./tender-inbound.ts";

const body = `Référence Avis Rectificatif : 20260130S2638
Acheteur : ALTEMED
Objet : Déploiement de la stratégie d'intelligence artificielle du groupe ALTEMED
Date limite : 18/11/2026 à 12h00
https://www.marches-publics.info/Annonces/AAPC_1889284.htm
--------------------------------------------------------------------------------
Référence Avis : hors-sujet
Acheteur : Autre
Objet : Nettoyage d'un bâtiment
Date limite : 15/12/2026 à 12h00
https://example.com/2`;

describe("alertes AWS", () => {
  it("lit la date de novembre à midi Paris sans décalage d'été", () => {
    expect(parseFrenchDeadline("18/11/2026 à 12h00")).toBe("2026-11-18T11:00:00.000Z");
  });
  it("conserve l'heure d'été pour septembre", () => {
    expect(parseFrenchDeadline("18/09/2026 à 12h00")).toBe("2026-09-18T10:00:00.000Z");
  });
  it("lit les avis rectificatifs séparément", () => {
    const notices = parseTenderEmailNotices(body);
    expect(notices).toHaveLength(2);
    expect(notices[0].reference).toBe("20260130S2638");
  });
  it("une exclusion du second avis ne supprime pas ALTEMED", async () => {
    const rows = [
      { setting_key: "tender_keywords", setting_value: "stratégie d'intelligence artificielle" },
      { setting_key: "tender_exclusions", setting_value: "nettoyage,bâtiment" },
    ];
    const rpc = vi.fn().mockResolvedValue({ data: "id", error: null });
    const client = { rpc, from: (table: string) => ({ select: () => ({
      eq: () => table === "app_settings" ? { maybeSingle: async () => ({ data: { setting_value: "@inbound.supertilt.fr" } }) } : Promise.resolve({ data: [] }),
      in: async () => ({ data: rows }),
    }) }) };
    const result = await routeTenderEmail(client, { id: "email", messageId: "message", subject: "ALERTE", from: "courrier@aws-france.com", body, recipients: ["marches@inbound.supertilt.fr"] });
    expect(result.created).toBe(true);
    expect(rpc).toHaveBeenCalledTimes(1);
    expect(rpc.mock.calls[0][1].p_source).toBe("marches");
    expect(rpc.mock.calls[0][1].p_source_ref).toBe("20260130S2638");
  });
});