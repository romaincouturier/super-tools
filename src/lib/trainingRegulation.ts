export const REGULATION_SETTING_KEYS = ["reglement_interieur_url", "reglement_interieur_draft", "reglement_interieur_versions"];

export interface RegulationVersion {
  id: string;
  url: string;
  content: string | null;
  published_at: string | null;
  label?: string;
}

export function regulationDate(value: string) {
  return new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", dateStyle: "long", timeStyle: "short" }).format(new Date(value));
}