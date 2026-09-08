/**
 * Procédure de prévention des violences, du harcèlement et des discriminations
 * (indicateur 12).
 *
 * Une seule procédure est active à la fois : c'est celle communiquée aux
 * apprenants sur la page publique de session. Publier une nouvelle version
 * archive la précédente au lieu de l'écraser, pour qu'un signalement puisse
 * toujours dire quelle procédure s'appliquait au moment des faits.
 */

export const PROCEDURE_STATUSES = [
  { value: "draft", label: "Brouillon" },
  { value: "active", label: "En vigueur" },
  { value: "archived", label: "Archivée" },
] as const;

export type ProcedureStatus = (typeof PROCEDURE_STATUSES)[number]["value"];

export const procedureStatusLabel = (v: string | null | undefined) =>
  PROCEDURE_STATUSES.find((s) => s.value === v)?.label ?? "—";

export interface VhdProcedureFormValues {
  version: string;
  content: string;
  contact_name: string;
  contact_email: string;
  effective_from: string;
}

export interface VhdProcedureRecord {
  version: string;
  content: string;
  contact_name: string | null;
  contact_email: string | null;
  effective_from: string | null;
}

export const EMPTY_PROCEDURE_FORM: VhdProcedureFormValues = {
  version: "",
  content: "",
  contact_name: "",
  contact_email: "",
  effective_from: "",
};

/**
 * Prochain numéro de version à proposer.
 *
 * Le numéro est libre et unique en base. On repart du plus grand entier déjà
 * utilisé : une version nommée autrement (« 2026-11 ») n'empêche pas la
 * suggestion, elle est simplement ignorée du calcul.
 */
export function nextVersion(existing: ReadonlyArray<string>): string {
  const highest = existing.reduce((max, v) => {
    // Le test d'entier porte sur la chaîne entière, pas sur son début :
    // `parseInt("2026-11")` rendrait 2026 et proposerait 2027 comme suite
    // d'une version « 2 ».
    const trimmed = v.trim();
    return /^\d+$/.test(trimmed) ? Math.max(max, Number(trimmed)) : max;
  }, 0);
  return String(highest + 1);
}

/**
 * Ce qui manque pour publier, en clair. Une procédure sans interlocuteur ne
 * dit pas à qui s'adresser : elle ne remplit pas son office, et le décret
 * demande le traitement des situations, pas seulement leur description.
 */
export function publishBlockers(form: VhdProcedureFormValues): string[] {
  const blockers: string[] = [];
  if (!form.version.trim()) blockers.push("un numéro de version");
  if (!form.content.trim()) blockers.push("le texte de la procédure");
  if (!form.contact_name.trim() && !form.contact_email.trim()) {
    blockers.push("un interlocuteur, nom ou email");
  }
  return blockers;
}

export function buildProcedureRecord(form: VhdProcedureFormValues): VhdProcedureRecord {
  const trimmed = (value: string) => value.trim() || null;
  return {
    version: form.version.trim(),
    content: form.content.trim(),
    contact_name: trimmed(form.contact_name),
    contact_email: trimmed(form.contact_email),
    effective_from: form.effective_from || null,
  };
}
