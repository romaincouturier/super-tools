/**
 * Tests de isInternalCall — le garde qui ouvre les fonctions de veille au cron
 * sans les ouvrir à tout le monde.
 *
 * L'invariant qui compte : un secret non configuré ferme la voie au lieu de
 * l'ouvrir. `watch-weekly-digest` laissait passer tout appel sans en-tête
 * d'autorisation, sur une fonction publique qui déclenche OpenAI et un post
 * Slack.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// verifyAuth vit dans supabase-client.ts qui importe le SDK depuis une URL
// esm.sh ; on le mocke pour tester isInternalOrAuthenticated sans charger cette
// dépendance (l'import dynamique dans cron-auth.ts est intercepté par ce mock).
const { verifyAuthMock, adminMock } = vi.hoisted(() => ({
  verifyAuthMock: vi.fn(),
  adminMock: { isAdmin: false as boolean, modules: [] as unknown[], rpcError: null as unknown },
}));
vi.mock("./supabase-client.ts", () => ({
  verifyAuth: verifyAuthMock,
  getSupabaseClient: () => fakeAdmin(),
}));

function fakeAdmin() {
  return {
    rpc: vi.fn(async () => ({ data: adminMock.isAdmin, error: adminMock.rpcError })),
    from: vi.fn(() => ({
      select: () => ({ eq: () => ({ limit: async () => ({ data: adminMock.modules, error: null }) }) }),
    })),
  };
}

const env: Record<string, string> = {};
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const { isInternalCall, isInternalOrAuthenticated, requireStaff } = await import("./cron-auth.ts");

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/", { method: "POST", headers });
}

beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  verifyAuthMock.mockReset();
  adminMock.isAdmin = false;
  adminMock.modules = [];
  adminMock.rpcError = null;
});

describe("isInternalCall", () => {
  it("accepte le bon secret de cron", () => {
    env.CRON_SECRET = "s3cret";
    expect(isInternalCall(request({ "x-cron-secret": "s3cret" }))).toBe(true);
  });

  it("refuse un mauvais secret de cron", () => {
    env.CRON_SECRET = "s3cret";
    expect(isInternalCall(request({ "x-cron-secret": "autre" }))).toBe(false);
  });

  it("refuse un appel sans en-tête", () => {
    env.CRON_SECRET = "s3cret";
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    expect(isInternalCall(request())).toBe(false);
  });

  it("ne laisse pas passer un en-tête vide quand le secret n'est pas configuré", () => {
    expect(isInternalCall(request({ "x-cron-secret": "" }))).toBe(false);
    expect(isInternalCall(request({ "x-internal-secret": "" }))).toBe(false);
    expect(isInternalCall(request())).toBe(false);
  });

  it("accepte la service_role en appel inter-fonctions", () => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    expect(isInternalCall(request({ "x-internal-secret": "service-role" }))).toBe(true);
    expect(isInternalCall(request({ "x-internal-secret": "autre" }))).toBe(false);
  });

  it("accepte un autre nom de secret", () => {
    env.SEO_CRON_SECRET = "seo";
    expect(isInternalCall(request({ "x-cron-secret": "seo" }), "SEO_CRON_SECRET")).toBe(true);
    expect(isInternalCall(request({ "x-cron-secret": "seo" }))).toBe(false);
  });
});

describe("isInternalOrAuthenticated", () => {
  it("accepte le service_role présenté en Bearer (cron/délégation)", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    expect(await isInternalOrAuthenticated(request({ Authorization: "Bearer service-role" }))).toBe(true);
    expect(verifyAuthMock).not.toHaveBeenCalled();
  });

  it("accepte x-internal-secret == service_role", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    expect(await isInternalOrAuthenticated(request({ "x-internal-secret": "service-role" }))).toBe(true);
  });

  it("accepte le secret de cron", async () => {
    env.CRON_SECRET = "s3cret";
    expect(await isInternalOrAuthenticated(request({ "x-cron-secret": "s3cret" }))).toBe(true);
  });

  it("accepte un JWT utilisateur valide (staff)", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "u1" });
    expect(await isInternalOrAuthenticated(request({ Authorization: "Bearer user-jwt" }))).toBe(true);
  });

  it("refuse un anonyme : pas de secret, JWT non valide", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    verifyAuthMock.mockResolvedValueOnce(null);
    expect(await isInternalOrAuthenticated(request({ Authorization: "Bearer cle-anon" }))).toBe(false);
  });

  it("ne confond pas un mauvais Bearer avec le service_role", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    verifyAuthMock.mockResolvedValueOnce(null);
    expect(await isInternalOrAuthenticated(request({ Authorization: "Bearer mauvais" }))).toBe(false);
  });
});

describe("requireStaff", () => {
  const withJwt = () => request({ Authorization: "Bearer user-jwt" });

  it("refuse un anonyme", async () => {
    verifyAuthMock.mockResolvedValueOnce(null);
    expect(await requireStaff(withJwt())).toBeNull();
  });

  it("refuse un apprenant connecté (session sans droit)", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "learner" });
    expect(await requireStaff(withJwt())).toBeNull();
  });

  it("accepte un admin", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "admin" });
    adminMock.isAdmin = true;
    expect(await requireStaff(withJwt())).toEqual({ id: "admin" });
  });

  it("accepte un compte avec un module", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "staff" });
    adminMock.modules = [{ module: "formations" }];
    expect(await requireStaff(withJwt())).toEqual({ id: "staff" });
  });

  it("une erreur de lecture is_admin ne vaut pas droit", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "u" });
    adminMock.isAdmin = true;
    adminMock.rpcError = { message: "boom" };
    expect(await requireStaff(withJwt())).toBeNull();
  });

  it("le service_role en Bearer n'est pas un staff", async () => {
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    verifyAuthMock.mockResolvedValueOnce(null);
    expect(await requireStaff(request({ Authorization: "Bearer service-role" }))).toBeNull();
  });
});
