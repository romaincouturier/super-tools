/**
 * Surlignage des passages commentés dans une page livrable.
 *
 * Le HTML de la page est rendu tel quel ; les citations sont retrouvées à
 * l'exécution dans les nœuds texte, puis enveloppées dans un <mark> cliquable.
 * Si la citation traverse plusieurs éléments (gras, lien…), on se rabat sur le
 * premier nœud texte qui la contient partiellement, sinon sur le bloc entier.
 */

export const MARK_ATTR = "data-comment-thread";
export const MARK_CLASS = "mission-comment-mark";

function normalize(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

/** Retire tous les surlignages précédemment posés. */
export function clearHighlights(root: HTMLElement): void {
  root.querySelectorAll(`mark[${MARK_ATTR}]`).forEach((mark) => {
    const parent = mark.parentNode;
    if (!parent) return;
    while (mark.firstChild) parent.insertBefore(mark.firstChild, mark);
    parent.removeChild(mark);
    parent.normalize();
  });
}

/**
 * Enveloppe la première occurrence de `quote` dans `scope`.
 * @returns l'élément <mark> créé, ou null si la citation est introuvable.
 */
export function highlightQuote(
  scope: HTMLElement,
  quote: string,
  threadId: string,
): HTMLElement | null {
  const needle = normalize(quote);
  if (!needle) return null;

  const walker = document.createTreeWalker(scope, NodeFilter.SHOW_TEXT);
  let node = walker.nextNode() as Text | null;

  while (node) {
    const haystack = node.data;
    let index = haystack.indexOf(needle);
    if (index === -1 && needle.length > 12) {
      // Tolère les écarts d'espaces : on cherche un préfixe significatif.
      index = haystack.indexOf(needle.slice(0, 40));
    }
    if (index !== -1) {
      const length = Math.min(needle.length, haystack.length - index);
      const range = document.createRange();
      range.setStart(node, index);
      range.setEnd(node, index + length);
      const mark = document.createElement("mark");
      mark.setAttribute(MARK_ATTR, threadId);
      mark.className = MARK_CLASS;
      try {
        range.surroundContents(mark);
        return mark;
      } catch {
        return null;
      }
    }
    node = walker.nextNode() as Text | null;
  }

  return null;
}
