/**
 * Découpe le HTML d'une page livrable en blocs commentables.
 *
 * L'identifiant d'un bloc est dérivé de son contenu, pas d'un id persisté :
 * le contenu des pages est un unique blob HTML TipTap réécrit intégralement à
 * chaque auto-save, aucun identifiant ne survivrait à une édition. Conséquence
 * assumée : réécrire un bloc détache ses commentaires, qui sont alors affichés
 * à part avec la citation du texte d'origine.
 */

export interface PageBlock {
  id: string;
  html: string;
  text: string;
}

/** FNV-1a 32 bits, rendu en base 36. */
function hash(input: string): string {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0).toString(36);
}

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim().toLowerCase();
}

/**
 * @param html HTML déjà sanitizé (sanitizeLmsHtml) de la page.
 */
export function splitHtmlIntoBlocks(html: string): PageBlock[] {
  if (!html || !html.trim()) return [];

  const doc = new DOMParser().parseFromString(html, "text/html");
  const blocks: PageBlock[] = [];
  const occurrences = new Map<string, number>();

  for (const el of Array.from(doc.body.children)) {
    const text = (el.textContent || "").trim();
    // Les blocs sans texte (image, séparateur, vidéo) sont identifiés par leur
    // balise complète, qui contient l'URL du média.
    const fingerprint = normalize(text) || el.outerHTML;
    const base = hash(`${el.tagName.toLowerCase()}|${fingerprint}`);
    const seen = occurrences.get(base) ?? 0;
    occurrences.set(base, seen + 1);
    blocks.push({
      id: seen === 0 ? base : `${base}-${seen}`,
      html: el.outerHTML,
      text,
    });
  }

  return blocks;
}
