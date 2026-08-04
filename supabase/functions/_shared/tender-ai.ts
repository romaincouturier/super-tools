/**
 * Prompts et mise en forme de la synthèse d'un appel d'offres.
 *
 * Deux analyses distinctes, volontairement séparées :
 *
 *   - `buildNoticePrompt` travaille sur l'AVIS, qu'on a déjà en base en entier.
 *     Elle répond aux questions qui font basculer un Go / No Go.
 *   - `buildDocumentPrompt` travaille sur une PIÈCE DU DCE déposée à la main.
 *     Le DCE dit ce que l'avis tait : volume réel, références exigées,
 *     pièces à produire.
 *
 * Les deux rendent du JSON. Un modèle qui répond à côté du format ne doit pas
 * faire tomber la fiche : `parseAiJson` lève un message lisible, stocké tel
 * quel, plutôt que d'écrire une synthèse vide qui passerait pour un résultat.
 */

/** Au-delà, on tronque : un avis BOAMP complet peut faire 200 000 caractères. */
export const MAX_PROMPT_CHARS = 24_000;

export interface NoticeSummary {
  synthese: string;
  attendu: string[];
  criteres: { libelle: string; poids: string | null }[];
  vigilance: string[];
  adequation: { verdict: string; motif: string };
}

export interface DocumentAnalysis {
  synthese: string;
  demande: string[];
  contraintes: string[];
  pieces_a_produire: string[];
  vigilance: string[];
}

/** Le métier, rappelé au modèle : sans lui, « adéquation » ne veut rien dire. */
const METIER =
  "SuperTilt est un organisme de formation Qualiopi. Son métier : facilitation " +
  "graphique et sketchnoting, animation d'ateliers et intelligence collective, " +
  "conduite du changement et co-construction, acculturation et formation à " +
  "l'intelligence artificielle générative. Deux à trois personnes, pas de " +
  "capacité à porter un marché de plusieurs centaines de milliers d'euros ni " +
  "une prestation d'agence de communication (impression, régie, identité " +
  "visuelle), ni du développement informatique.";

const FORMAT_RULE =
  "Réponds UNIQUEMENT avec un JSON valide, sans balise markdown, sans phrase " +
  "d'introduction. N'invente rien : si une information est absente, écris null " +
  "ou laisse le tableau vide plutôt que de la déduire.";

export const NOTICE_SYSTEM =
  `Tu analyses un avis de marché public français pour aider à décider s'il faut y répondre. ${METIER}

Rends ce JSON :
{
  "synthese": "3 phrases maximum : ce que l'acheteur veut vraiment, en français simple, sans jargon administratif",
  "attendu": ["les prestations réellement demandées, une par entrée"],
  "criteres": [{"libelle": "nom du critère", "poids": "pondération telle qu'écrite, ou null"}],
  "vigilance": ["ce qui peut disqualifier ou coûter cher : références exigées, chiffre d'affaires minimum, reconduction, allotissement défavorable, délai court, titulaire sortant"],
  "adequation": {"verdict": "forte | partielle | faible", "motif": "une phrase, en citant ce qui colle ou ce qui cloche"}
}

${FORMAT_RULE}`;

export const DOCUMENT_SYSTEM =
  `Tu analyses une pièce du dossier de consultation (DCE) d'un marché public français : CCTP, règlement de consultation, bordereau de prix ou annexe. ${METIER}

Rends ce JSON :
{
  "synthese": "3 phrases maximum : ce que ce document ajoute par rapport à l'avis",
  "demande": ["ce qui est concrètement demandé : volume, nombre de sessions, livrables, durée"],
  "contraintes": ["références exigées, certifications, chiffre d'affaires, effectifs, assurances, contraintes de lieu ou de calendrier"],
  "pieces_a_produire": ["les pièces à fournir dans l'offre"],
  "vigilance": ["ce qui rend la réponse coûteuse ou risquée"]
}

${FORMAT_RULE}`;

function truncate(text: string, max = MAX_PROMPT_CHARS): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max)}\n\n[…document tronqué à ${max} caractères…]`;
}

export interface NoticeInput {
  objet?: string | null;
  acheteur?: string | null;
  nature?: string | null;
  datelimitereponse?: string | null;
  cpv_codes?: string[] | null;
  decision?: Record<string, unknown> | null;
  fullText?: string | null;
}

export function buildNoticePrompt(input: NoticeInput): string {
  const lines = [
    `Objet : ${input.objet ?? "(non renseigné)"}`,
    `Acheteur : ${input.acheteur ?? "(non renseigné)"}`,
    `Nature : ${input.nature ?? "(non renseignée)"}`,
    `Date limite de réponse : ${input.datelimitereponse ?? "(non renseignée)"}`,
    `Codes CPV : ${(input.cpv_codes ?? []).join(", ") || "(aucun)"}`,
  ];

  // `decision` porte déjà les éléments extraits du parseur (critères, lots,
  // montant, titulaire sortant). Les donner en JSON évite au modèle de les
  // rechercher dans la prose, où ils sont souvent mal formés.
  if (input.decision && Object.keys(input.decision).length > 0) {
    lines.push("", "Éléments extraits de l'avis :", JSON.stringify(input.decision, null, 2));
  }

  const text = (input.fullText ?? "").trim();
  if (text) lines.push("", "Texte de l'avis :", truncate(text));

  return lines.join("\n");
}

export function buildDocumentPrompt(input: {
  fileName: string;
  objet?: string | null;
  acheteur?: string | null;
  text: string;
  note?: string | null;
}): string {
  const lines = [
    `Marché : ${input.objet ?? "(objet non renseigné)"}`,
    `Acheteur : ${input.acheteur ?? "(non renseigné)"}`,
    `Document : ${input.fileName}`,
  ];
  if (input.note) lines.push(`Extraction : ${input.note}`);
  lines.push("", "Contenu :", truncate(input.text));
  return lines.join("\n");
}

/**
 * Lit la réponse du modèle en JSON.
 *
 * Les modèles encadrent volontiers leur JSON d'une clôture markdown malgré la
 * consigne, et ajoutent parfois une phrase avant. On retire la clôture puis on
 * se rabat sur le premier objet accolade-à-accolade.
 */
export function parseAiJson<T>(raw: string): T {
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/, "")
    .trim();

  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        // On tombe dans l'erreur commune ci-dessous.
      }
    }
    throw new Error(
      `Réponse du modèle illisible (${cleaned.slice(0, 120)}${cleaned.length > 120 ? "…" : ""})`,
    );
  }
}
