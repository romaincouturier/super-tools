import { describe, expect, it } from "vitest";
import { videoEmbed } from "./lmsVideoEmbed";

describe("videoEmbed", () => {
  it("uses the Google Drive player for the Live #1 replay sharing link", () => {
    expect(videoEmbed("https://drive.google.com/file/d/1D0X_8EzRJYyzgLPsjBh_eQojyHIe845j/view?usp=sharing"))
      .toBe("https://drive.google.com/file/d/1D0X_8EzRJYyzgLPsjBh_eQojyHIe845j/preview");
  });
  it("preserves restricted-link resource keys", () => {
    expect(videoEmbed("https://drive.google.com/open?id=video_123&resourcekey=key_456"))
      .toBe("https://drive.google.com/file/d/video_123/preview?resourcekey=key_456");
  });
  it("supports Drive download and preview links", () => {
    expect(videoEmbed("https://drive.google.com/uc?id=video_123&export=download"))
      .toBe("https://drive.google.com/file/d/video_123/preview");
    expect(videoEmbed("https://drive.google.com/file/d/video_123/preview"))
      .toBe("https://drive.google.com/file/d/video_123/preview");
  });
  it("does not embed unrelated hosts or folders", () => {
    expect(videoEmbed("https://drive.google.com.evil.example/file/d/video_123/view")).toBeNull();
    expect(videoEmbed("https://drive.google.com/drive/folders/video_123")).toBeNull();
    expect(videoEmbed("invalid URL")).toBeNull();
    expect(videoEmbed("https://example.com/replay.mp4")).toBeNull();
  });
  it("keeps YouTube and Vimeo playback URLs", () => {
    expect(videoEmbed("https://youtu.be/abcdefghijk"))
      .toBe("https://www.youtube.com/embed/abcdefghijk?autoplay=1&rel=0");
    expect(videoEmbed("https://vimeo.com/123456"))
      .toBe("https://player.vimeo.com/video/123456?autoplay=1");
  });
});