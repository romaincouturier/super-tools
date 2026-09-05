import { describe, it, expect } from "vitest";
import { normalizeAudioAssignments } from "./lmsMediaImport";

describe("normalizeAudioAssignments", () => {
  it("garde plusieurs segments avec leur leçon respective", () => {
    const out = normalizeAudioAssignments([
      {
        audio_id: "a1",
        segments: [
          { title: "Intro", lesson_id: "l1", reformulated_text: "<p>A</p>", key_points: ["k1"] },
          { title: "Suite", lesson_id: null, reformulated_text: "<p>B</p>", key_points: [] },
        ],
      },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].segments.map((s) => s.lesson_id)).toEqual(["l1", null]);
  });

  it("convertit l'ancien format en un segment unique", () => {
    const out = normalizeAudioAssignments([
      { audio_id: "a1", lesson_id: "l1", reformulated_text: "<p>A</p>", key_points: ["k1", "k2"] },
    ]);
    expect(out[0].segments).toEqual([
      { title: "", lesson_id: "l1", reformulated_text: "<p>A</p>", key_points: ["k1", "k2"] },
    ]);
  });

  it("écarte les segments sans texte et les audios sans segment valide", () => {
    const out = normalizeAudioAssignments([
      { audio_id: "a1", segments: [{ title: "x", lesson_id: "l1", reformulated_text: "  ", key_points: [] }] },
      { audio_id: "a2", segments: [{ title: "y", lesson_id: "l2", reformulated_text: "<p>ok</p>", key_points: [] }] },
    ]);
    expect(out.map((a) => a.audio_id)).toEqual(["a2"]);
  });

  it("ignore les entrées sans audio_id et les points clés vides", () => {
    const out = normalizeAudioAssignments([
      { segments: [{ reformulated_text: "<p>x</p>" }] },
      { audio_id: "a3", segments: [{ reformulated_text: "<p>x</p>", key_points: ["ok", "", 3] }] },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].segments[0].key_points).toEqual(["ok"]);
  });

  it("renvoie un tableau vide sur une entrée non exploitable", () => {
    expect(normalizeAudioAssignments(null)).toEqual([]);
    expect(normalizeAudioAssignments({})).toEqual([]);
  });
});
