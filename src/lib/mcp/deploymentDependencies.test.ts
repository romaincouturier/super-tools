// @vitest-environment node
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../../../", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("package.json", root), "utf8"));
const lock = JSON.parse(readFileSync(new URL("package-lock.json", root), "utf8"));

describe("Dépendances du déploiement MCP", () => {
  it("fige le client Cloud à la version installée et verrouillée", () => {
    const version = manifest.dependencies["@supabase/supabase-js"];
    expect(version).toMatch(/^\d+\.\d+\.\d+$/);
    expect(lock.packages[""].dependencies["@supabase/supabase-js"]).toBe(version);
    expect(lock.packages["node_modules/@supabase/supabase-js"].version).toBe(version);
    expect(lock.packages["node_modules/@supabase/auth-js"].version).toBe(version);
  });

  it("génère un import Deno avec la même version exacte", () => {
    const generated = readFileSync(new URL("supabase/functions/mcp/index.ts", root), "utf8");
    expect(generated).toContain(`"npm:@supabase/supabase-js@${manifest.dependencies["@supabase/supabase-js"]}"`);
  });
});