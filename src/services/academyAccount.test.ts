import { beforeEach, describe, expect, it, vi } from "vitest";
import { AcademyAccountExistsError, createAcademyAccount, hasExistingAcademyEnrollment } from "./academyAccount";

const h = vi.hoisted(() => ({ invoke: vi.fn(), getUser: vi.fn(), from: vi.fn(), limit: vi.fn(), eq: vi.fn(), statuses: vi.fn() }));
vi.mock("@/lib/invokeEdge", () => ({ invokeEdge: h.invoke }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { getUser: h.getUser }, from: h.from } }));

describe("Compte Academy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    h.getUser.mockResolvedValue({ data: { user: { email: " MARIE.LEURENT@ORANGE.FR " } }, error: null });
    h.from.mockReturnValue({ select: () => ({ eq: h.eq }) });
    h.eq.mockReturnValue({ in: h.statuses });
    h.statuses.mockReturnValue({ limit: h.limit });
    h.limit.mockResolvedValue({ data: [{ id: "c3fc18cd-491a-449e-9af0-a668b27cd253" }], error: null });
  });

  it("un doublon HTTP 409 oriente vers la récupération sans nouvel appel", async () => {
    h.invoke.mockRejectedValue({ context: new Response('{"error":"already_exists"}', { status: 409 }) });
    await expect(createAcademyAccount({ email: "marie.leurent@orange.fr", password: "not-used", firstName: "Marie", lastName: "Leurent" })).rejects.toBeInstanceOf(AcademyAccountExistsError);
    expect(h.invoke).toHaveBeenCalledTimes(1);
  });

  it("l'inscription active est cherchée uniquement pour l'identité authentifiée", async () => {
    expect(await hasExistingAcademyEnrollment()).toBe(true);
    expect(h.getUser).toHaveBeenCalledOnce();
    expect(h.eq).toHaveBeenCalledWith("learner_email", "marie.leurent@orange.fr");
    expect(h.statuses).toHaveBeenCalledWith("status", ["active", "completed"]);
  });

  it("sans session, ne lit aucune inscription", async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: null });
    expect(await hasExistingAcademyEnrollment()).toBe(false);
    expect(h.from).not.toHaveBeenCalled();
  });

  it("sans inscription, laisse le choix des formations disponible", async () => {
    h.limit.mockResolvedValue({ data: [], error: null });
    expect(await hasExistingAcademyEnrollment()).toBe(false);
  });

  it("une erreur de lecture ne devient pas une absence d'inscription", async () => {
    h.limit.mockResolvedValue({ data: null, error: new Error("unavailable") });
    await expect(hasExistingAcademyEnrollment()).rejects.toThrow("unavailable");
  });
});