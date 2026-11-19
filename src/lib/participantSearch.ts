/** Champs cherchés dans la liste des participants d'une formation. */
export interface SearchableParticipant {
  email: string;
  first_name: string | null;
  last_name: string | null;
  company: string | null;
}

/** Minuscules, sans accents. */
export function normalizeForParticipantSearch(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Garde les participants dont l'email, le prénom, le nom ou l'entreprise
 * contiennent chacun des mots du terme. Les inscrits e-learning n'ont souvent
 * ni prénom ni nom : l'email est cherché au même titre que les autres champs.
 */
export function filterParticipantsBySearch<T extends SearchableParticipant>(
  participants: T[],
  term: string
): T[] {
  const terms = normalizeForParticipantSearch(term).split(/\s+/).filter(Boolean);
  if (terms.length === 0) return participants;
  return participants.filter((participant) => {
    const fields = [participant.email, participant.first_name, participant.last_name, participant.company]
      .map((value) => normalizeForParticipantSearch(value ?? ""));
    return terms.every((term) => fields.some((field) => field.includes(term)));
  });
}
