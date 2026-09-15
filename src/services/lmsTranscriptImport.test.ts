import { describe, it, expect } from "vitest";
import { normalizeTranscriptProposals, buildLessonBlockContents } from "./lmsTranscriptImport";

describe("normalizeTranscriptProposals", () => {
  it("garde les leçons exploitables et normalise les champs", () => {
    const out = normalizeTranscriptProposals([
      {
        transcript_id: "t1",
        lessons: [
          {
            title: "  Cadrer la réunion ",
            summary_html: "<p>intro</p>",
            sections: [
              { heading: "Étape 1", html: "<p>a</p>" },
              { heading: "vide", html: "   " },
            ],
            key_points: ["kp1", "", 3],
            target_lesson_id: "",
          },
        ],
      },
    ]);

    expect(out).toHaveLength(1);
    expect(out[0].lessons[0]).toEqual({
      title: "Cadrer la réunion",
      summary_html: "<p>intro</p>",
      sections: [{ heading: "Étape 1", html: "<p>a</p>" }],
      key_points: ["kp1"],
      target_lesson_id: null,
    });
  });

  it("écarte les entrées sans id et les leçons vides", () => {
    expect(normalizeTranscriptProposals([{ lessons: [] }])).toEqual([]);
    expect(
      normalizeTranscriptProposals([
        { transcript_id: "t1", lessons: [{ title: "x", summary_html: "", sections: [], key_points: [] }] },
      ]),
    ).toEqual([]);
  });

  it("tolère une entrée non tableau", () => {
    expect(normalizeTranscriptProposals(null)).toEqual([]);
    expect(normalizeTranscriptProposals("oops")).toEqual([]);
  });
});

describe("buildLessonBlockContents", () => {
  it("produit intro, sections et bloc À retenir", () => {
    const blocks = buildLessonBlockContents({
      title: "T",
      summary_html: "<p>intro</p>",
      sections: [{ heading: "S1", html: "<p>a</p>" }],
      key_points: ["kp"],
      target_lesson_id: null,
    });

    expect(blocks).toHaveLength(3);
    expect(blocks[0].html).toBe("<p>intro</p>");
    expect(blocks[1].html).toContain("<h3>S1</h3>");
    expect(blocks[2].html).toContain("À retenir");
  });

  it("omet les blocs absents", () => {
    const blocks = buildLessonBlockContents({
      title: "T",
      summary_html: "",
      sections: [{ heading: "", html: "<p>a</p>" }],
      key_points: [],
      target_lesson_id: null,
    });
    expect(blocks).toHaveLength(1);
    expect(blocks[0].html).toBe("<p>a</p>");
  });
});
