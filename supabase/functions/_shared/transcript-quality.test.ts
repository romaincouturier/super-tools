import { it, expect } from "vitest";
import { isEmptyOrParasiteTranscript } from "./transcript-quality.ts";
it("parasite transcripts detected", () => {
  for (const t of ["", "Speaker 1: Sous-titrage Société Radio-Canada.", "Speaker 1: Sous-titrage Société Radio-Canada Merci.", "Speaker 1: Sous-titrage ST' 501.", "Marie M: Sous-titrage Société Radio-Canada Réno.\nMarie M: et", "Speaker 1: Sous-titres réalisés para la communauté d'Amara.org"]) expect(isEmptyOrParasiteTranscript(t)).toEqual(true);
});
it("real transcript kept", () => {
  expect(isEmptyOrParasiteTranscript("Speaker 1: Bonjour à tous, aujourd'hui on va parler du parcours utilisateur et des personas.")).toEqual(false);
});
