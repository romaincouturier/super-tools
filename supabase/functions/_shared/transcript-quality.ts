// Detects failed transcriptions: empty text or Whisper-style hallucinated credits
// ("Sous-titrage Société Radio-Canada", "Sous-titrage ST' 501", Amara...).
const PARASITE_PATTERNS: RegExp[] = [
  /sous[- ]?titrage\s+(soci[eé]t[eé]\s+)?radio[- ]?canada/gi,
  /sous[- ]?titrage\s+st\s*'?\s*\d+/gi,
  /sous[- ]?titres?\s+r[eé]alis[eé]s?\s+para?\s+la\s+communaut[eé]\s+d'?\s*amara(\.org)?/gi,
  /sous[- ]?titres?\s+par\s+.{0,40}amara(\.org)?/gi,
];

const MIN_MEANINGFUL_CHARS = 40;

export const PARASITE_TRANSCRIPT_ERROR =
  "Transcription vide ou parasite (aucun contenu exploitable, ex. « Sous-titrage Radio-Canada »)";

export function isEmptyOrParasiteTranscript(text: string | null | undefined): boolean {
  if (!text) return true;
  let t = text.replace(/^[^:\n]{1,60}:\s*/gm, " "); // strip "Speaker 1:" prefixes
  for (const p of PARASITE_PATTERNS) t = t.replace(p, " ");
  t = t.replace(/\b(merci|r[eé]no|au revoir)\b/gi, " ");
  const meaningful = t.replace(/[^\p{L}\p{N}]+/gu, "");
  return meaningful.length < MIN_MEANINGFUL_CHARS;
}
