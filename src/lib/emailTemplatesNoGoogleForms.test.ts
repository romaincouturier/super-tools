import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const GOOGLE_FORMS_URL = /(?:docs\.google\.com\/forms|forms\.gle|goo\.gl\/forms)/i;

const TEMPLATE_SOURCES = [
  "src/components/settings/settingsConstants.ts",
  "supabase/functions",
];

describe("email templates", () => {
  it("never contain a Google Forms link", () => {
    const source = TEMPLATE_SOURCES.map((path) => {
      if (path === "supabase/functions") {
        return readFileSync(resolve("supabase/functions/force-send-scheduled-email/index.ts"), "utf8")
          + readFileSync(resolve("supabase/functions/send-questionnaire-confirmation/index.ts"), "utf8");
      }
      return readFileSync(resolve(path), "utf8");
    }).join("\n");

    expect(source).not.toMatch(GOOGLE_FORMS_URL);
  });
});