import { describe, expect, it } from "vitest";
import { bodyToHtml, processTemplate, rendererForTemplateType } from "@/lib/emailTemplatePreview";

describe("needs survey reminder preview", () => {
  it("uses the dedicated renderer for both address modes", () => {
    expect(rendererForTemplateType("needs_survey_reminder")).toBe("needs-survey-reminder");
  });

  it("renders a compatible button and a text fallback link", () => {
    const html = bodyToHtml(
      "Bonjour Emma,\n\nhttps://super-tools.lovable.app/questionnaire/test-token",
      "needs-survey-reminder",
    );

    expect(html).toContain('<table role="presentation"');
    expect(html).toContain("Répondre au questionnaire de préparation");
    expect(html).toContain("Si le bouton ne fonctionne pas");
    expect(html.match(/https:\/\/super-tools\.lovable\.app\/questionnaire\/test-token/g)).toHaveLength(3);
  });

  it("keeps the participant first name and escapes unsafe participant data", () => {
    const rendered = processTemplate(
      "Bonjour{{#first_name}} {{first_name}}{{/first_name}}, {{training_name}}",
      { first_name: "Emma", training_name: '<img src=x onerror="alert(1)">' },
    );

    expect(rendered).toContain("Bonjour Emma");
    expect(rendered).toContain("&lt;img");
    expect(rendered).not.toContain("<img");
  });
});