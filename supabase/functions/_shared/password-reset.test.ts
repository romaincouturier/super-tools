import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { passwordResetLink } from "./password-reset.ts";

vi.mock("./app-urls.ts", () => ({
  getAppUrls: vi.fn().mockResolvedValue({ app_url: "https://app.example.com" }),
}));

function makeAdmin(result: { data: unknown; error: unknown }) {
  const generateLink = vi.fn().mockResolvedValue(result);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const admin = { auth: { admin: { generateLink } } } as any;
  return { admin, generateLink };
}

describe("passwordResetLink", () => {
  it("construit le lien et la redirection depuis app_url uniquement", async () => {
    const { admin, generateLink } = makeAdmin({
      data: { properties: { hashed_token: "a/b+c" } },
      error: null,
    });

    const link = await passwordResetLink(admin, "jean@example.com");

    expect(link).toBe(
      "https://app.example.com/connexion/reinitialisation?token_hash=a%2Fb%2Bc&type=recovery",
    );
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
