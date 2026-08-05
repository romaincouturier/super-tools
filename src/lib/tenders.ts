/**
 * Calculs partagés de l'écran marchés publics.
 *
 * La date limite est la seule vraie horloge du module : un avis reçu à J-8 qui
 * attend six jours en revue est mort. Elle est fréquemment absente du flux
 * BOAMP, auquel cas l'avis reste à traiter mais ne peut pas être priorisé.
 */

/** Jours restants avant la date limite. Négatif = dépassée, null = inconnue. */
export function daysLeft(deadline: string | null | undefined, now: Date = new Date()): number | null {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return null;
  return Math.ceil((d.getTime() - now.getTime()) / 86_400_000);
}

/** Seuil au-delà duquel répondre devient difficile, signalé en rouge. */
export const TENDER_URGENT_DAYS = 12;

export function isTenderUrgent(deadline: string | null | undefined, now: Date = new Date()): boolean {
  const left = daysLeft(deadline, now);
  return left !== null && left >= 0 && left <= TENDER_URGENT_DAYS;
}

/**
 * Libellés des codes CPV surveillés. Un code nu ne dit rien au lecteur de la
 * fiche : c'est le libellé qui explique pourquoi l'avis a été retenu.
 */
export const CPV_LABELS: Record<string, string> = {
  "80000000": "Services d'enseignement et de formation",
  "80500000": "Services de formation",
  "80510000": "Services de formation spécialisée",
  "80511000": "Services de formation du personnel",
  "80522000": "Séminaires de formation",
  "80530000": "Services de formation professionnelle",
  "80532000": "Services de formation en gestion",
  "80533100": "Services de formation informatique",
  "80570000": "Services de formation au développement personnel",
  "79400000": "Conseil en affaires et en gestion",
  "79411000": "Conseil en gestion générale",
  "79419000": "Services de conseil en évaluation",
  "79822500": "Services de conception graphique",
  "79951000": "Organisation de séminaires",
  "79952000": "Services d'organisation d'événements",
  "79998000": "Services de coaching",
  "79311300": "Services d'analyse d'enquêtes",
};

/** Rend lisible un élément de `matched_on` : code CPV traduit, mot-clé tel quel. */
export function describeMatch(match: string): string {
  if (!/^\d{6,8}$/.test(match)) return match;
  const label = CPV_LABELS[match];
  return label ? `${label} (CPV ${match})` : `CPV ${match}`;
}

// ── Lien de retrait du DCE ────────────────────────────────────

/**
 * Le flux BOAMP ne porte pas toujours le lien direct de la consultation : sur
 * les avis eForms, `url_dce` retombe souvent sur `BuyerProfileURI`, c'est-à-dire
 * la racine de la plateforme (« marches-publics.gouv.fr/entreprise »). Le
 * bouton menait donc à l'accueil, à l'utilisateur de chercher lui-même.
 *
 * Deux corrections ici :
 *  - les entités HTML (`&amp;`) présentes dans les liens AWS, qui cassaient les
 *    paramètres `type=DCE&IDM=…` ;
 *  - une recherche pré-remplie sur la référence de consultation quand le lien
 *    n'est qu'une racine de plateforme.
 */

/** URL réduite à l'accueil d'une plateforme : aucun identifiant de consultation. */
function isPlatformRoot(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.search || u.hash) return false;
    const path = u.pathname.replace(/\/+$/, "");
    return path === "" || /^\/(entreprise|fr\/marches-publics|marches-publics|avis)$/i.test(path);
  } catch (_invalidUrl) {
    // Sonde de forme : un lien non analysable n'est pas une racine de plateforme.
    return false;
  }
}

function decodeEntities(url: string): string {
  return url
    .replace(/&amp;/g, "&")
    .replace(/&#38;/g, "&")
    .replace(/&quot;/g, "")
    .trim();
}

/**
 * Référence de consultation de l'acheteur (`cbc:ID` du ProcurementProject en
 * eForms, `REFERENCE` dans l'ancien schéma) : c'est le seul terme qui retrouve
 * la consultation dans le moteur de recherche d'une plateforme.
 */
export function extractTenderReference(raw: unknown): string | null {
  if (!raw) return null;
  const text = typeof raw === "string" ? raw : JSON.stringify(raw);
  const patterns = [
    /"cac:ProcurementProject"\s*:\s*\{\s*"cbc:ID"\s*:\s*"([^"]{3,40})"/,
    /\\"cac:ProcurementProject\\"\s*:\s*\{\s*\\"cbc:ID\\"\s*:\s*\\"([^\\"]{3,40})\\"/,
    /"(?:REFERENCE|reference|IDENT_MARCHE)"\s*:\s*"([^"]{3,40})"/,
    /\\"(?:REFERENCE|reference|IDENT_MARCHE)\\"\s*:\s*\\"([^\\"]{3,40})\\"/,
  ];
  for (const re of patterns) {
    const m = text.match(re);
    const value = m?.[1]?.trim();
    // Un UUID est un identifiant technique de l'avis, pas la référence de
    // l'acheteur : il ne donne aucun résultat dans un moteur de recherche.
    if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(value)) return value;
  }
  return null;
}

export interface TenderDceLink {
  url: string;
  /** true = lien direct vers la consultation, false = recherche pré-remplie. */
  direct: boolean;
  label: string;
}

/** Moteurs de recherche des plateformes, par domaine. */
function searchUrl(host: string, term: string): string | null {
  const q = encodeURIComponent(term);
  if (/marches-publics\.gouv\.fr$/i.test(host)) {
    return `https://www.marches-publics.gouv.fr/?page=Entreprise.EntrepriseAdvancedSearch&AllCons&keyWord=${q}`;
  }
  // Les plateformes Atexo/Dematis partagent le même moteur que PLACE.
  if (/(maximilien\.fr|ternum-bfc\.fr|e-marchespublics\.com|achatpublic\.com)$/i.test(host)) {
    return null;
  }
  return null;
}

/** Hôtes de plateformes de retrait : un avis qui pointe là mène au DCE. */
const PLATFORM_HOSTS =
  /(achatpublic\.com|marches-publics\.gouv\.fr|maximilien\.fr|ternum-bfc\.fr|e-marchespublics\.com|megalis\.bretagne\.bzh|marches-securises\.fr|mpe-?[a-z]*\.[a-z.]+)$/i;

export function resolveDceLink(tender: {
  decision?: { url_dce?: string | null } | null;
  url_avis?: string | null;
  raw?: unknown;
}): TenderDceLink | null {
  // Les avis issus d'alertes mail n'ont pas d'`url_dce` : le lien de l'avis est
  // déjà la page de consultation sur la plateforme de retrait.
  let rawUrl = tender.decision?.url_dce;
  if (!rawUrl && tender.url_avis) {
    try {
      if (PLATFORM_HOSTS.test(new URL(decodeEntities(tender.url_avis)).hostname)) {
        rawUrl = tender.url_avis;
      }
    } catch (_invalidUrl) {
      // Lien non analysable : pas de bouton DCE.
    }
  }
  if (!rawUrl) return null;
  const url = decodeEntities(rawUrl);
  if (!/^https?:\/\//i.test(url)) return null;

  if (!isPlatformRoot(url)) return { url, direct: true, label: "Le DCE" };


  const reference = extractTenderReference(tender.raw);
  if (reference) {
    try {
      const search = searchUrl(new URL(url).hostname, reference);
      if (search) {
        return { url: search, direct: false, label: `Chercher le DCE (${reference})` };
      }
    } catch (_invalidUrl) {
      // URL non analysable : on retombe sur le lien tel quel.
    }
  }
  return { url, direct: false, label: "Plateforme de retrait" };
}
