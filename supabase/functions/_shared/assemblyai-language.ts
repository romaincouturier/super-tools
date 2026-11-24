export const ASSEMBLYAI_DEFAULT_LANGUAGE = { language_code: "fr" } as const;

export function isAssemblyAILanguageConfidenceError(error: unknown): boolean {
  return /detected language .*confidence .*below the requested confidence threshold/i.test(String(error ?? ""));
}

export function formatAssemblyAIError(error: unknown): string {
  const details = String(error ?? "").trim();
  if (isAssemblyAILanguageConfidenceError(details)) {
    return "Détection automatique de langue trop incertaine : transcription arrêtée, une reprise avec la langue française est nécessaire.";
  }
  return details || "Échec de transcription AssemblyAI.";
}
