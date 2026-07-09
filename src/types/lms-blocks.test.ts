import { describe, it, expect } from "vitest";
import {
  acceptsChildren,
  blockKindOf,
  defaultBlockContent,
  exampleBlockContent,
  isLayoutBlockType,
  LAYOUT_BLOCK_TYPES,
  type ContentBlockType,
  type LayoutBlockType,
  type RevealBlockContent,
  type RowBlockContent,
  type SectionBlockContent,
  type SpacerBlockContent,
  type ContainerBlockContent,
  type DividerBlockContent,
  type TextBlockContent,
  type GalleryBlockContent,
  type HtmlEmbedBlockContent,
  type TimelineBlockContent,
  type FlipCardsBlockContent,
  type CtaBlockContent,
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
      "html_embed",
      "timeline",
      "flip_cards",
    ];
    for (const t of contentTypes) {
      expect(isLayoutBlockType(t)).toBe(false);
    }
  });
});

describe("blockKindOf", () => {
  it("returns 'layout' for layout types", () => {
    const layoutTypes: LayoutBlockType[] = ["section", "row", "container", "reveal", "divider", "spacer"];
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

  it("reveal defaults to the 'Révéler la suite' button, no auto-hide, not collapsible", () => {
    const c = defaultBlockContent("reveal") as RevealBlockContent;
    expect(c.button_label).toBe("Révéler la suite");
    expect(c.hide_button_after_click).toBe(false);
    expect(c.collapsible).toBe(false);
  });

  it("reveal is a layout container that accepts children", () => {
    expect(blockKindOf("reveal")).toBe("layout");
    expect(acceptsChildren("reveal")).toBe(true);
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
      "html_embed",
      "timeline",
      "flip_cards",
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

describe("defaultBlockContent — html_embed", () => {
  it("defaults to empty html and null title", () => {
    const c = defaultBlockContent("html_embed") as HtmlEmbedBlockContent;
    expect(c.html).toBe("");
    expect(c.title).toBeNull();
  });

  it("blockKindOf returns 'content' for html_embed", () => {
    expect(blockKindOf("html_embed")).toBe("content");
  });

  it("isLayoutBlockType returns false for html_embed", () => {
    expect(isLayoutBlockType("html_embed")).toBe(false);
  });
});

describe("defaultBlockContent — timeline", () => {
  it("defaults to 3 steps with titles and empty panel_items", () => {
    const c = defaultBlockContent("timeline") as TimelineBlockContent;
    expect(c.steps).toHaveLength(3);
    expect(c.steps[0].title).toBe("Étape 1");
    expect(c.steps[1].title).toBe("Étape 2");
    expect(c.steps[2].title).toBe("Étape 3");
    for (const step of c.steps) {
      expect(step.id).toBeTruthy();
      expect(step.panel_items).toEqual([]);
    }
  });

  it("defaults to null accent_color", () => {
    const c = defaultBlockContent("timeline") as TimelineBlockContent;
    expect(c.accent_color).toBeNull();
  });

  it("blockKindOf returns 'content' for timeline", () => {
    expect(blockKindOf("timeline")).toBe("content");
  });

  it("isLayoutBlockType returns false for timeline", () => {
    expect(isLayoutBlockType("timeline")).toBe(false);
  });
});

describe("exampleBlockContent — timeline", () => {
  it("returns an example with 3 steps each having panel_items", () => {
    const c = exampleBlockContent("timeline") as TimelineBlockContent;
    expect(c.steps).toHaveLength(3);
    for (const step of c.steps) {
      expect(step.panel_items!.length).toBeGreaterThan(0);
    }
  });
});

describe("defaultBlockContent — flip_cards", () => {
  it("defaults to 2 cards with recto/verso placeholder text", () => {
    const c = defaultBlockContent("flip_cards") as FlipCardsBlockContent;
    expect(c.cards).toHaveLength(2);
    for (const card of c.cards) {
      expect(card.id).toBeTruthy();
      expect(card.front_text).toBe("Recto");
      expect(card.back_text).toBe("Verso");
    }
  });

  it("defaults to card_height_px of 180", () => {
    const c = defaultBlockContent("flip_cards") as FlipCardsBlockContent;
    expect(c.card_height_px).toBe(180);
  });

  it("blockKindOf returns 'content' for flip_cards", () => {
    expect(blockKindOf("flip_cards")).toBe("content");
  });

  it("isLayoutBlockType returns false for flip_cards", () => {
    expect(isLayoutBlockType("flip_cards")).toBe(false);
  });
});

describe("defaultBlockContent — cta", () => {
  it("defaults to a label, a button label, empty benefits and no image", () => {
    const c = defaultBlockContent("cta") as CtaBlockContent;
    expect(c.label).toBe("Pour aller plus loin");
    expect(c.button_label).toBe("Découvrir le programme");
    expect(c.button_url).toBe("");
    expect(c.benefits).toEqual([]);
    expect(c.image_url).toBeNull();
    expect(c.badge).toBeNull();
    expect(c.open_in_new_tab).toBe(true);
    expect(c.accent_color).toBeNull();
  });

  it("blockKindOf returns 'content' for cta", () => {
    expect(blockKindOf("cta")).toBe("content");
  });

  it("isLayoutBlockType returns false for cta", () => {
    expect(isLayoutBlockType("cta")).toBe(false);
  });
});

describe("exampleBlockContent — cta", () => {
  it("returns an example with at most 3 benefits, a badge and a secondary link", () => {
    const c = exampleBlockContent("cta") as CtaBlockContent;
    expect(c.benefits!.length).toBeGreaterThanOrEqual(2);
    expect(c.benefits!.length).toBeLessThanOrEqual(3);
    expect(c.badge).toBeTruthy();
    expect(c.secondary_label).toBeTruthy();
    expect(c.secondary_url).toBeTruthy();
    expect(c.button_label).toBeTruthy();
    expect(c.button_url).toBeTruthy();
  });

  it("example title carries an accented segment marked with asterisks", () => {
    const c = exampleBlockContent("cta") as CtaBlockContent;
    expect(c.title).toMatch(/\*[^*]+\*/);
  });
});

describe("exampleBlockContent — flip_cards", () => {
  it("returns an example with 3 cards, each having distinct front and back text", () => {
    const c = exampleBlockContent("flip_cards") as FlipCardsBlockContent;
    expect(c.cards).toHaveLength(3);
    for (const card of c.cards) {
      expect(card.front_text).toBeTruthy();
      expect(card.back_text).toBeTruthy();
      expect(card.front_text).not.toBe(card.back_text);
    }
  });

  it("example cards have unique ids", () => {
    const c = exampleBlockContent("flip_cards") as FlipCardsBlockContent;
    const ids = c.cards.map((card) => card.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
