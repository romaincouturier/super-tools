/**
 * Tri et rapprochement des appels d'offres détectés, quelle que soit la source.
 *
 * Volontairement grossier : à une dizaine d'avis pertinents par mois, ils sont
 * tous lus. Le rôle du filtre est d'écarter le hors-sujet évident, pas de
 * classer finement — un moteur de scoring pondéré serait du travail perdu.
 *
 * Les listes de codes, de mots-clés et d'exclusions vivent dans `app_settings`,
 * pas ici : elles bougeront à chaque revue et ne doivent pas demander un
 * déploiement.
 */

export interface TenderFilterConfig {
  cpvCodes: string[];
  keywords: string[];
  exclusions: string[];
}

export interface TenderMatch {
  /** Ce qui a déclenché la retenue : codes CPV et mots-clés. */
  matched: string[];
  /** Mot d'exclusion rencontré, le cas échéant. */
  excludedBy: string | null;
  keep: boolean;
}

const SETTING_KEYS = {
  cpv: "tender_cpv_codes",
  keywords: "tender_keywords",
  exclusions: "tender_exclusions",
} as const;

/** Découpe une valeur de réglage « a,b , c » en liste normalisée. */
export function parseSettingList(value: string | null | undefined): string[] {
  return (value ?? "")
    .split(",")
    .map((v) => v.trim())
    .filter(Boolean);
}

// deno-lint-ignore no-explicit-any
export async function loadTenderFilterConfig(supabase: any): Promise<TenderFilterConfig> {
  const { data } = await supabase
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", Object.values(SETTING_KEYS));

  const byKey = new Map<string, string>(
    (data ?? []).map((r: { setting_key: string; setting_value: string }) => [
      r.setting_key,
      r.setting_value,
    ]),
  );
  return {
    cpvCodes: parseSettingList(byKey.get(SETTING_KEYS.cpv)),
    keywords: parseSettingList(byKey.get(SETTING_KEYS.keywords)),
    exclusions: parseSettingList(byKey.get(SETTING_KEYS.exclusions)),
  };
}

/** Minuscules sans accents : les avis publics mélangent les deux. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

/**
 * Retient un avis si l'un de ses CPV est surveillé, ou si un mot-clé apparaît
 * dans son objet. L'exclusion l'emporte toujours : elle est là pour écarter
 * les marchés de travaux ou de restauration qui matchent un mot-clé par
 * accident.
 */
export function matchTender(
  input: { objet?: string | null; cpvCodes?: string[]; extraText?: string | null },
  config: TenderFilterConfig,
): TenderMatch {
  const haystack = normalizeText(`${input.objet ?? ""} ${input.extraText ?? ""}`);

  const excludedBy =
    config.exclusions.find((word) => word && haystack.includes(normalizeText(word))) ?? null;
  if (excludedBy) return { matched: [], excludedBy, keep: false };

  const matched: string[] = [];
  for (const code of config.cpvCodes) {
    if ((input.cpvCodes ?? []).includes(code)) matched.push(code);
  }
  for (const word of config.keywords) {
    if (word && haystack.includes(normalizeText(word))) matched.push(word);
  }

  return { matched, excludedBy: null, keep: matched.length > 0 };
}

/**
 * Clé de rapprochement inter-sources.
 *
 * Le même marché arrive par le BOAMP et par une alerte PLACE, avec des
 * libellés qui diffèrent à la ponctuation près. On normalise fort : acheteur
 * et objet réduits à leurs lettres et chiffres, plus le jour de la date
 * limite quand elle est connue.
 */
export function dedupKey(input: {
  acheteur?: string | null;
  objet?: string | null;
  datelimitereponse?: string | null;
}): string | null {
  const acheteur = normalizeText(input.acheteur).replace(/[^a-z0-9]/g, "");
  const objet = normalizeText(input.objet).replace(/[^a-z0-9]/g, "").slice(0, 80);
  if (!acheteur && !objet) return null;
  const jour = (input.datelimitereponse ?? "").slice(0, 10);
  return [acheteur.slice(0, 40), objet, jour].join("|");
}

/**
 * Nombre de jours entre maintenant et la date limite. Négatif = dépassée,
 * null = date inconnue (fréquent au BOAMP, l'avis reste à traiter).
 */
export function daysUntil(deadline: string | null | undefined, now = new Date()): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}
