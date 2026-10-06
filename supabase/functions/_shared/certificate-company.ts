// Raison sociale de l'employeur sur le certificat de réalisation (mention exigée par les OPCO).
// Priorité : fiche participant > saisie évaluation > client de la formation (intra uniquement).
// deno-lint-ignore no-explicit-any
export async function resolveCertificateCompany(supabase: any, opts: {
  participantId?: string | null;
  participantEmail?: string | null;
  trainingId?: string | null;
  evaluationCompany?: string | null;
  fallback?: string | null;
}): Promise<string> {
  let participantCompany: string | null = null;
  if (opts.participantId || (opts.trainingId && opts.participantEmail)) {
    let q = supabase.from("training_participants").select("company").limit(1);
    q = opts.participantId
      ? q.eq("id", opts.participantId)
      : q.eq("training_id", opts.trainingId).ilike("email", opts.participantEmail);
    const { data } = await q.maybeSingle();
    participantCompany = data?.company?.trim() || null;
  }
  return participantCompany || opts.evaluationCompany?.trim() || opts.fallback?.trim() || "";
}
