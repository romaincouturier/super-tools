import { describe, expect, it, vi } from "vitest";
import {
  TENDER_NO_GO_REASONS,
  buildGoDescription,
  escapeHtml,
  safeUrl,
  tenderGo,
  tenderNoGo,
  todayParis,
} from "./tender-decision.ts";

describe("escapeHtml", () => {
  it("échappe les caractères dangereux du contenu externe", () => {
    expect(escapeHtml('<b>"A&B"</b>')).toBe("&lt;b&gt;&quot;A&amp;B&quot;&lt;/b&gt;");
  });
});

describe("safeUrl", () => {
  it("garde les URL http(s) échappées", () => {
    expect(safeUrl("https://boamp.fr/avis?id=1&x=2")).toBe("https://boamp.fr/avis?id=1&amp;x=2");
  });
  it("rejette les schémas non http et les valeurs vides", () => {
    expect(safeUrl("javascript:alert(1)")).toBeNull();
    expect(safeUrl("pas une url")).toBeNull();
    expect(safeUrl(null)).toBeNull();
  });
});

describe("buildGoDescription", () => {
  it("reprend acheteur, montant, critères et liens en HTML échappé", () => {
    const html = buildGoDescription({
      id: "t1",
      objet: "Facilitation graphique",
      acheteur: "Région <Sud>",
      datelimitereponse: "2026-09-01T00:00:00Z",
      url_avis: "https://boamp.fr/a1",
      source_ref: "ref1",
      crm_card_id: null,
      status: "to_review",
      decision: {
        montant: 50000,
        criteres: [{ libelle: "Prix", poids: 40 }],
        url_dce: "https://boamp.fr/dce1",
        contact_email: "acheteur@region.fr",
      },
    });
    expect(html).toContain("Région &lt;Sud&gt;");
    expect(html).toContain("Prix 40%");
    expect(html).toContain('href="https://boamp.fr/dce1"');
    expect(html).toContain("Retirer le DCE");
    expect(html).toContain("Voir l'avis");
  });

  it("reste vide quand rien n'est exploitable", () => {
    expect(
      buildGoDescription({
        id: "t2",
        objet: null,
        acheteur: null,
        datelimitereponse: null,
        url_avis: null,
        source_ref: null,
        crm_card_id: null,
        status: "raw",
        decision: null,
      }),
    ).toBe("");
  });
});

describe("todayParis", () => {
  it("formate une date ISO courte", () => {
    expect(todayParis(new Date("2026-08-05T09:00:00Z"))).toBe("2026-08-05");
  });
});

describe("tenderNoGo", () => {
  it("rejette un motif hors liste avant toute écriture", async () => {
    const supabase = { from: vi.fn() };
    await expect(
      tenderNoGo(supabase, { id: "t1", reason: "pas_envie", actorEmail: "romain@supertilt.fr" }),
    ).rejects.toThrow(/Motif de No Go invalide/);
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it("écrit les champs de décision sur la ligne existante", async () => {
    let captured: Record<string, unknown> | null = null;
    const supabase = {
      from: () => ({
        update: (payload: Record<string, unknown>) => {
          captured = payload;
          return {
            eq: () => ({
              select: () => ({ maybeSingle: async () => ({ data: { id: "t1" }, error: null }) }),
            }),
          };
        },
      }),
    };
    const res = await tenderNoGo(supabase, {
      id: "t1",
      reason: "criteres_prix",
      detail: "70% prix",
      actorEmail: "romain@supertilt.fr",
    });
    expect(res).toEqual({ status: "no_go", id: "t1", no_go_reason: "criteres_prix" });
    expect(captured).toMatchObject({
      status: "no_go",
      no_go_reason: "criteres_prix",
      no_go_detail: "70% prix",
      reviewed_by: "romain@supertilt.fr",
    });
  });

  it("remonte l'absence de ligne", async () => {
    const supabase = {
      from: () => ({
        update: () => ({
          eq: () => ({
            select: () => ({ maybeSingle: async () => ({ data: null, error: null }) }),
          }),
        }),
      }),
    };
    await expect(
      tenderNoGo(supabase, { id: "absent", reason: "autre", actorEmail: "romain@supertilt.fr" }),
    ).rejects.toThrow(/Aucun appel d'offres/);
  });

  it("expose la liste fermée des motifs", () => {
    expect(TENDER_NO_GO_REASONS).toContain("titulaire_sortant");
    expect(TENDER_NO_GO_REASONS).toHaveLength(9);
  });
});

describe("tenderGo", () => {
  it("refuse un service_type invalide", async () => {
    await expect(
      // @ts-expect-error test d'un service_type hors enum
      tenderGo({ from: vi.fn() }, { tenderId: "t1", serviceType: "coaching", actorEmail: "x" }),
    ).rejects.toThrow(/service_type requis/);
  });

  it("refuse un second Go sur un avis déjà relié à une carte", async () => {
    const supabase = {
      from: () => ({
        select: () => ({
          eq: () => ({
            maybeSingle: async () => ({
              data: { id: "t1", crm_card_id: "card-existante" },
              error: null,
            }),
          }),
        }),
      }),
    };
    await expect(
      tenderGo(supabase, { tenderId: "t1", serviceType: "mission", actorEmail: "romain@supertilt.fr" }),
    ).rejects.toThrow(/déjà une carte/);
  });
});
