import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { passwordResetLink, passwordLinkState, SETUP_LINK_TTL_HOURS, RESET_LINK_TTL_HOURS } from "./password-reset.ts";

vi.mock("./app-urls.ts", () => ({
  getAppUrls: vi.fn().mockResolvedValue({ app_url: "https://app.example.com" }),
}));

function makeAdmin(result: { data: unknown; error: unknown }) {
  const generateLink = vi.fn().mockResolvedValue(result);
  const insert = vi.fn().mockResolvedValue({ error: null });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = { auth: { admin: { generateLink } }, from: vi.fn(() => ({ insert })) } as any;
  return { admin, generateLink, insert };
}

describe("passwordResetLink", () => {
  it("construit le lien et la redirection depuis app_url uniquement", async () => {
    const { admin, generateLink, insert } = makeAdmin({
      data: { properties: { hashed_token: "a/b+c" } },
      error: null,
    });

    const link = await passwordResetLink(admin, "jean@example.com");

    expect(link).toMatch(/^https:\/\/app\.example\.com\/connexion\/reinitialisation\?link=[a-f0-9]{64}$/);
    expect(link).not.toContain("a%2Fb");
    const row = insert.mock.calls[0][0];
    expect(row.email).toBe("jean@example.com");
    expect(row.token_hash).not.toBe(link!.split("link=")[1]);
    expect(generateLink).toHaveBeenCalledWith({
      type: "recovery",
      email: "jean@example.com",
      options: { redirectTo: "https://app.example.com/connexion/reinitialisation" },
    });
  });

  it("renvoie null sans jeton (compte inconnu)", async () => {
    const { admin } = makeAdmin({ data: null, error: { message: "User not found" } });
    await expect(passwordResetLink(admin, "x@example.com")).resolves.toBeNull();
  });
});

describe("durée des liens", () => {
  it("7 jours pour le mail d'accès, 24 h sur redemande", () => {
    expect(SETUP_LINK_TTL_HOURS).toBe(168);
    expect(RESET_LINK_TTL_HOURS).toBe(24);
  });

  it("enregistre l'échéance demandée", async () => {
    const { admin, insert } = makeAdmin({ data: { properties: { hashed_token: "h" } }, error: null });
    const before = Date.now();
    await passwordResetLink(admin, "a@example.com", false, SETUP_LINK_TTL_HOURS);
    const exp = new Date(insert.mock.calls[0][0].expires_at).getTime();
    expect(exp - before).toBeGreaterThanOrEqual(168 * 3600_000 - 1000);
    expect(exp - before).toBeLessThanOrEqual(168 * 3600_000 + 1000);
  });

  it("valide avant l'échéance, expiré après, utilisé une seule fois", () => {
    const now = new Date("2026-11-05T10:00:00Z");
    expect(passwordLinkState({ expires_at: "2026-11-12T09:59:00Z", used_at: null }, now)).toBe("valid");
    expect(passwordLinkState({ expires_at: "2026-11-05T09:59:00Z", used_at: null }, now)).toBe("expired");
    expect(passwordLinkState({ expires_at: "2026-11-12T09:59:00Z", used_at: "2026-11-05T09:00:00Z" }, now)).toBe("used");
  });
});

describe("send-password-reset", () => {
  const source = readFileSync("supabase/functions/send-password-reset/index.ts", "utf8");

  it("ne lit aucune URL de redirection dans le corps de la requête", () => {
    expect(source).not.toMatch(/redirectUrl\s*[}:,]/);
    expect(source).not.toMatch(/redirectTo/);
  });

  it("construit le lien avec passwordResetLink", () => {
    expect(source).toContain("passwordResetLink(supabaseClient, email)");
  });
});
