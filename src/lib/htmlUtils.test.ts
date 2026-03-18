import { describe, it, expect } from "vitest";
import { htmlToPlainText, cleanHtmlOutput } from "./htmlUtils";

describe("htmlToPlainText", () => {
  it("strips HTML tags and returns plain text", () => {
    expect(htmlToPlainText("<p>Hello <strong>world</strong></p>")).toBe("Hello world");
  });

  it("returns empty string for empty input", () => {
    expect(htmlToPlainText("")).toBe("");
  });

  it("handles nested tags", () => {
    expect(htmlToPlainText("<div><ul><li>item</li></ul></div>")).toBe("item");
  });
});

describe("cleanHtmlOutput", () => {
  it("removes opening and closing code fences", () => {
    expect(cleanHtmlOutput("```html\n<p>Hi</p>\n```")).toBe("<p>Hi</p>");
  });

  it("handles fence without language tag", () => {
    expect(cleanHtmlOutput("```\n<p>Hi</p>\n```")).toBe("<p>Hi</p>");
  });

  it("handles fence with 'html' language tag (case-insensitive)", () => {
    expect(cleanHtmlOutput("```HTML\n<div>ok</div>\n```")).toBe("<div>ok</div>");
  });

  it("returns trimmed content when no fences present", () => {
    expect(cleanHtmlOutput("  <p>Hi</p>  ")).toBe("<p>Hi</p>");
  });
});
