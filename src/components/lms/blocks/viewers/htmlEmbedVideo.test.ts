import { describe, expect, it } from "vitest";
import { deferVideoIframes, safeVideoEmbedUrl } from "./HtmlEmbedBlockViewer";

describe("vidéos des blocs HTML", () => {
  it("n'accepte que les lecteurs YouTube et Vimeo", () => {
    expect(safeVideoEmbedUrl("https://www.youtube.com/embed/GdLCBYzm4bo")).toBe("https://www.youtube.com/embed/GdLCBYzm4bo");
    expect(safeVideoEmbedUrl("https://player.vimeo.com/video/76979871?h=1")).toBe("https://player.vimeo.com/video/76979871?h=1");
    expect(safeVideoEmbedUrl("https://evil.com/embed/x")).toBeNull();
    expect(safeVideoEmbedUrl("https://www.youtube.com.evil.com/embed/x")).toBeNull();
    expect(safeVideoEmbedUrl("javascript:alert(1)")).toBeNull();
    expect(safeVideoEmbedUrl("https://www.youtube.com/watch?v=x")).toBeNull();
  });
  it("ne charge pas les vidéos écrites en dur dans le bac à sable", () => {
    expect(deferVideoIframes('<iframe width="560" src="https://player.vimeo.com/video/1"></iframe>')).toBe('<iframe width="560" data-st-video="https://player.vimeo.com/video/1"></iframe>');
    expect(deferVideoIframes('<iframe src="https://tally.so/embed/x"></iframe>')).toBe('<iframe src="https://tally.so/embed/x"></iframe>');
  });
});

describe("Google Forms embeds", () => {
  it("accepts a Google Forms viewform URL and defers it out of the sandbox", async () => {
    const { safeVideoEmbedUrl, deferVideoIframes } = await import("./HtmlEmbedBlockViewer");
    const u = "https://docs.google.com/forms/d/e/1FAIpQLScUzvvTKg/viewform?embedded=true";
    expect(safeVideoEmbedUrl(u)).toBe(u);
    expect(deferVideoIframes(`<iframe src="${u}"></iframe>`)).toContain("data-st-video=");
    expect(safeVideoEmbedUrl("https://docs.google.com/document/d/abc/edit")).toBeNull();
  });
});
