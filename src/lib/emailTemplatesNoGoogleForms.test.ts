import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GOOGLE_FORMS_URL = /(?:docs\.google\.com\/forms|forms\.gle|goo\.gl\/forms)/i;

function readTypeScriptFiles(directory: string): string {
  return readdirSync(resolve(directory), { withFileTypes: true })
    .flatMap((entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return readTypeScriptFiles(path);
      return entry.isFile() && /\.(?:ts|tsx)$/.test(entry.name) ? readFileSync(path, "utf8") : [];
    })
    .join("\n");
}

describe("email templates", () => {
  it("never contain a Google Forms link", () => {
    const source = [
      readFileSync(resolve("src/components/settings/settingsConstants.ts"), "utf8"),
      readTypeScriptFiles("supabase/functions"),
    ].join("\n");

    expect(source).not.toMatch(GOOGLE_FORMS_URL);
  });
});