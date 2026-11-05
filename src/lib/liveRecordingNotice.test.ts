import { describe, it, expect } from "vitest";
import { liveRecordingNoticeText } from "./liveRecordingNotice";

describe("liveRecordingNoticeText", () => {
  it("tutoie quand la formation est en tu", () => {
    expect(liveRecordingNoticeText(null, false)).toContain("Si tu préfères ne pas apparaître");
  });
  it("vouvoie par défaut", () => {
    expect(liveRecordingNoticeText(null, null)).toContain("Si vous préférez ne pas apparaître");
  });
  it("utilise le texte modifié du modèle", () => {
    expect(liveRecordingNoticeText("<p>Texte perso</p>", true)).toBe("Texte perso");
  });
});
