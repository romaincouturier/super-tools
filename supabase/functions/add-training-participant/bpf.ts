const TYPE_STAGIAIRE_BPF_VALUES = ["salarie_prive", "apprenti", "demandeur_emploi", "particulier", "autre"];
const TYPE_STAGIAIRE_BPF_ALIASES: Record<string, string> = { entreprise: "salarie_prive", salarie: "salarie_prive" };

export function normalizeTypeStagiaireBpf(v: string | null | undefined): string | null {
  if (!v) return null;
  const k = v.trim().toLowerCase();
  const mapped = TYPE_STAGIAIRE_BPF_ALIASES[k] ?? k;
  return TYPE_STAGIAIRE_BPF_VALUES.includes(mapped) ? mapped : null;
}