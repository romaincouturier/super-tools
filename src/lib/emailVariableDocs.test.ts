import { describe, expect, it } from "vitest";
import { DEFAULT_TEMPLATES } from "@/components/settings/settingsConstants";
import { extractVariables } from "@/lib/emailTemplatePreview";
import { VARIABLE_DOCS } from "@/lib/emailVariableDocs";

describe("email template variable documentation", () => {
  it("documents every declared and used variable in every template variant", () => {
    const errors: string[] = [];

    Object.entries(DEFAULT_TEMPLATES).forEach(([templateType, template]) => {
      const declared = new Set(template.variables);

      ["tu", "vous"].forEach((mode) => {
        const subject = template.subject[mode as "tu" | "vous"];
        const content = template.content[mode as "tu" | "vous"];
        const used = extractVariables(subject, content);

        used.forEach((variable) => {
          if (!declared.has(variable)) {
            errors.push(`${templateType}/${mode}: ${variable} is used but not declared`);
          }
        });

        template.variables.forEach((variable) => {
          if (!VARIABLE_DOCS[variable]) {
            errors.push(`${templateType}: ${variable} is declared but not documented`);
          }
        });
      });
    });

    expect(errors).toEqual([]);
  });
});
