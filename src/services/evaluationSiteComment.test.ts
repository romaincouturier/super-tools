import { beforeEach, describe, expect, it, vi } from "vitest";
import { markSiteCommentPublished } from "./evaluationSiteComment";

const h = vi.hoisted(() => ({
  getUser: vi.fn(),
  from: vi.fn(),
  update: vi.fn(),
  eq: vi.fn(),
  is: vi.fn(),
  select: vi.fn(),
  single: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { auth: { getUser: h.getUser }, from: h.from },
}));

describe("Publication d'un avis sur le site", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getUser.mockResolvedValue({ data: { user: { id: "user-emmanuelle" } }, error: null });
    h.from.mockReturnValue({ update: h.update });
    h.update.mockReturnValue({ eq: h.eq });
    h.eq.mockReturnValue({ is: h.is });
    h.is.mockReturnValue({ select: h.select });
    h.select.mockReturnValue({ single: h.single });
    h.single.mockResolvedValue({ data: { site_comment_published_at: "2026-11-23T08:00:00Z" }, error: null });
  });

  it("enregistre la date et l'utilisateur connecté sur l'avis choisi", async () => {
    await expect(markSiteCommentPublished("evaluation-1")).resolves.toBe("2026-11-23T08:00:00Z");
    expect(h.from).toHaveBeenCalledWith("training_evaluations");
    expect(h.update).toHaveBeenCalledWith({
      site_comment_published_at: expect.any(String),
      site_comment_published_by: "user-emmanuelle",
    });
    expect(h.eq).toHaveBeenCalledWith("id", "evaluation-1");
    expect(h.is).toHaveBeenCalledWith("site_comment_published_at", null);
  });

  it("refuse toute écriture sans utilisateur connecté", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: null });
    await expect(markSiteCommentPublished("evaluation-1")).rejects.toThrow("Connexion requise");
    expect(h.from).not.toHaveBeenCalled();
  });

  it("remonte une écriture refusée au lieu d'afficher un faux succès", async () => {
    h.single.mockResolvedValue({ data: null, error: new Error("permission refusée") });
    await expect(markSiteCommentPublished("evaluation-1")).rejects.toThrow("permission refusée");
  });
});
