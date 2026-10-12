import { assertEquals } from "jsr:@std/assert@1";
import { isEmptyOrParasiteTranscript } from "./transcript-quality.ts";
Deno.test("parasite transcripts detected", () => {
  for (const t of ["", "Speaker 1: Sous-titrage Société Radio-Canada.", "Speaker 1: Sous-titrage Société Radio-Canada Merci.", "Speaker 1: Sous-titrage ST' 501.", "Marie M: Sous-titrage Société Radio-Canada Réno.\nMarie M: et", "Speaker 1: Sous-titres réalisés para la communauté d'Amara.org"]) assertEquals(isEmptyOrParasiteTranscript(t), true, t);
});
Deno.test("real transcript kept", () => {
  assertEquals(isEmptyOrParasiteTranscript("Speaker 1: Bonjour à tous, aujourd'hui on va parler du parcours utilisateur et des personas."), false);
});
