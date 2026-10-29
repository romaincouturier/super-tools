export function missingTrainerSlots(
  signatures: { schedule_date: string; period: string }[],
  trainerSignatures: { schedule_date: string; period: string; signed_at?: string | null; signature_data?: string | null }[],
): string[] {
  const signed = new Set(trainerSignatures.filter(s => s.signed_at && s.signature_data).map(s => `${s.schedule_date}-${s.period}`));
  return [...new Set(signatures.map(s => `${s.schedule_date}-${s.period}`))].filter(slot => !signed.has(slot));
}

export async function readCertificateGeneration(response: Response, expectedCount: number): Promise<string[]> {
  if (!response.ok) throw new Error(`Erreur de génération des attestations (${response.status}).`);
  const events = (await response.text()).split("\n").filter(line => line.trim()).map(line => JSON.parse(line));
  const complete = events.find(event => event.type === "complete");
  const failure = events.find(event => event.type === "step" && event.data?.status === "error" && event.data?.step !== "drive");
  if (failure) throw new Error(failure.data.message || "Une attestation n'a pas pu être générée ou envoyée.");
  if (!complete || complete.data.successCount !== expectedCount) throw new Error("Les attestations ne sont pas toutes disponibles. Aucun document n'a été envoyé.");
  return complete.data.certificateUrls || [];
}