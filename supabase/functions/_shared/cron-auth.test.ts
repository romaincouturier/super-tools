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
const { verifyAuthMock, rpcMock } = vi.hoisted(() => ({ verifyAuthMock: vi.fn(), rpcMock: vi.fn() }));
vi.mock("./supabase-client.ts", () => ({
  verifyAuth: verifyAuthMock,
  getSupabaseClient: () => ({ rpc: rpcMock }),
}));

const env: Record<string, string> = {};
vi.stubGlobal("Deno", { env: { get: (k: string) => env[k] } });

const { isInternalCall, isInternalOrAuthenticated, isStaffCaller, isInternalOrAdmin } = await import("./cron-auth.ts");

function request(headers: Record<string, string> = {}): Request {
  return new Request("https://example.test/", { method: "POST", headers });
}

beforeEach(() => {
  for (const k of Object.keys(env)) delete env[k];
  verifyAuthMock.mockReset();
  rpcMock.mockReset();
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

function rpcAnswers(answers: Record<string, boolean>) {
  rpcMock.mockImplementation(async (fn: string) => ({ data: answers[fn] ?? false }));
}

describe("isStaffCaller", () => {
  it("refuse un appel sans JWT valide", async () => {
    verifyAuthMock.mockResolvedValueOnce(null);
    expect(await isStaffCaller(request({ Authorization: "Bearer cle-anon" }), "missions")).toBe(false);
    expect(rpcMock).not.toHaveBeenCalled();
  });

  it("accepte un admin", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "u1" });
    rpcAnswers({ is_admin: true });
    expect(await isStaffCaller(request({ Authorization: "Bearer jwt" }), "missions")).toBe(true);
  });

  it("accepte un utilisateur du module demandé", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "u1" });
    rpcAnswers({ has_module_access: true });
    expect(await isStaffCaller(request({ Authorization: "Bearer jwt" }), "missions")).toBe(true);
    expect(rpcMock).toHaveBeenCalledWith("has_module_access", { _user_id: "u1", _module: "missions" });
  });

  it("refuse un apprenant : JWT valide mais ni admin ni accès module", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "apprenant" });
    rpcAnswers({});
    expect(await isStaffCaller(request({ Authorization: "Bearer jwt" }), "missions")).toBe(false);
  });

  it("sans module, n'accepte que les admins", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "u1" });
    rpcAnswers({ has_module_access: true });
    expect(await isStaffCaller(request({ Authorization: "Bearer jwt" }))).toBe(false);
  });
});

describe("isInternalOrAdmin", () => {
  it("accepte le cron et le service_role sans consulter les JWT", async () => {
    env.CRON_SECRET = "s3cret";
    env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
    expect(await isInternalOrAdmin(request({ "x-cron-secret": "s3cret" }))).toBe(true);
    expect(await isInternalOrAdmin(request({ Authorization: "Bearer service-role" }))).toBe(true);
    expect(verifyAuthMock).not.toHaveBeenCalled();
  });

  it("accepte un admin connecté", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "u1" });
    rpcAnswers({ is_admin: true });
    expect(await isInternalOrAdmin(request({ Authorization: "Bearer jwt" }))).toBe(true);
  });

  it("refuse un utilisateur connecté non admin et un anonyme", async () => {
    verifyAuthMock.mockResolvedValueOnce({ id: "u1" });
    rpcAnswers({});
    expect(await isInternalOrAdmin(request({ Authorization: "Bearer jwt" }))).toBe(false);
    verifyAuthMock.mockResolvedValueOnce(null);
    expect(await isInternalOrAdmin(request())).toBe(false);
  });
});
