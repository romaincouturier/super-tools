import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";

const source = readFileSync("supabase/functions/create-academy-account/index.ts", "utf8")
  .replace(/^import[\s\S]*?from ["'][^"']+["'];\s*/gm, "");

async function request(createError: { message: string } | null) {
  let handler: ((req: Request) => Promise<Response>) | undefined;
  const upsert = vi.fn().mockResolvedValue({ error: null });
  const createUser = vi.fn().mockResolvedValue({ data: { user: createError ? null : { id: "test-user" } }, error: createError });
  const from = vi.fn().mockReturnValue({ upsert });
  new Function("serve", "createClient", "Deno", "createErrorResponse", "createJsonResponse", "handleCorsPreflightIfNeeded", source)(
    (fn: typeof handler) => { handler = fn; },
    () => ({ auth: { admin: { createUser } }, from }),
    { env: { get: () => "test-only" } },
    (error: string, status: number) => new Response(JSON.stringify({ error }), { status }),
    (body: unknown) => new Response(JSON.stringify(body)),
    () => null,
  );
  if (!handler) throw new Error("Missing handler");
  const response = await handler(new Request("http://localhost/test", { method: "POST", body: JSON.stringify({ email: "existing@example.com", password: "TestOnly123!", firstName: "Changed", lastName: "Name" }) }));
  return { response, from, upsert, createUser };
}

describe("Création Academy et profil existant", () => {
  it("un doublon ne réécrit ni le nom existant ni son état de sécurité", async () => {
    const result = await request({ message: "User already registered" });
    expect(result.response.status).toBe(409);
    expect(result.from).not.toHaveBeenCalled();
    expect(result.upsert).not.toHaveBeenCalled();
  });
  it("une nouvelle identité réussie peut enregistrer son profil", async () => {
    const result = await request(null);
    expect(result.response.status).toBe(200);
    expect(result.from).toHaveBeenCalledWith("learner_profiles");
    expect(result.from).toHaveBeenCalledWith("user_security_metadata");
    expect(result.upsert).toHaveBeenCalledWith({ user_id: "test-user", password_set: true }, { onConflict: "user_id" });
  });
});