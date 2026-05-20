import { describe, it, expect } from "vitest";
import {
  blockKindOf,
  defaultBlockContent,
  isLayoutBlockType,
  LAYOUT_BLOCK_TYPES,
  type ContentBlockType,
  type LayoutBlockType,
  type RowBlockContent,
  type SectionBlockContent,
  type SpacerBlockContent,
  type ContainerBlockContent,
  type DividerBlockContent,
  type TextBlockContent,
  type GalleryBlockContent,
} from "./lms-blocks";

describe("isLayoutBlockType", () => {
  it("accepts every layout type listed in LAYOUT_BLOCK_TYPES", () => {
    for (const t of LAYOUT_BLOCK_TYPES) {
      expect(isLayoutBlockType(t)).toBe(true);
    }
  });

  it("rejects every known content type", () => {
    const contentTypes: ContentBlockType[] = [
      "text",
      "video",
      "image",
      "gallery",
      "file",
      "quiz",
      "assignment",
      "callout",
      "key_points",
      "checklist",
      "bullet_list",
      "button",
      "exercise",
      "self_assessment",
      "work_deposit",
      "table",
      "shortcode",
    ];
    for (const t of contentTypes) {
      expect(isLayoutBlockType(t)).toBe(false);
    }
  });
});

describe("blockKindOf", () => {
  it("returns 'layout' for layout types", () => {
    const layoutTypes: LayoutBlockType[] = ["section", "row", "container", "divider", "spacer"];
    for (const t of layoutTypes) {
      expect(blockKindOf(t)).toBe("layout");
    }
  });

  it("returns 'content' for content types", () => {
    expect(blockKindOf("text")).toBe("content");
    expect(blockKindOf("video")).toBe("content");
    expect(blockKindOf("work_deposit")).toBe("content");
    expect(blockKindOf("quiz")).toBe("content");
  });
});

describe("defaultBlockContent — layout types", () => {
  it("section defaults to no title and 'default' background", () => {
    const c = defaultBlockContent("section") as SectionBlockContent;
    expect(c.title).toBeNull();
    expect(c.background).toBe("default");
  });

  it("row defaults to 2 columns", () => {
    const c = defaultBlockContent("row") as RowBlockContent;
    expect(c.column_count).toBe(2);
  });

  it("container defaults to 'lg' max width", () => {
    const c = defaultBlockContent("container") as ContainerBlockContent;
    expect(c.max_width).toBe("lg");
  });

  it("divider defaults to a solid line", () => {
    const c = defaultBlockContent("divider") as DividerBlockContent;
    expect(c.style).toBe("solid");
  });

  it("spacer defaults to 24px height", () => {
    const c = defaultBlockContent("spacer") as SpacerBlockContent;
    expect(c.height_px).toBe(24);
  });
});

describe("defaultBlockContent — regression on existing content types", () => {
  it("text still returns an empty html string", () => {
    const c = defaultBlockContent("text") as TextBlockContent;
    expect(c.html).toBe("");
  });

  it("returns a defined value for every known type (no missing case)", () => {
    const allTypes = [
      ...LAYOUT_BLOCK_TYPES,
      "text",
      "video",
      "image",
      "gallery",
      "file",
      "quiz",
      "assignment",
      "callout",
      "key_points",
      "checklist",
      "bullet_list",
      "button",
      "exercise",
      "self_assessment",
      "work_deposit",
      "table",
      "shortcode",
    ] as const;
    for (const t of allTypes) {
      expect(defaultBlockContent(t)).toBeDefined();
    }
  });
});

describe("defaultBlockContent — gallery", () => {
  it("defaults to an empty images array, grid mode, 3 columns", () => {
    const c = defaultBlockContent("gallery") as GalleryBlockContent;
    expect(c.images).toEqual([]);
    expect(c.mode).toBe("grid");
    expect(c.columns).toBe(3);
  });

  it("blockKindOf returns 'content' for gallery", () => {
    expect(blockKindOf("gallery")).toBe("content");
  });

  it("isLayoutBlockType returns false for gallery", () => {
    expect(isLayoutBlockType("gallery")).toBe(false);
  });
});
