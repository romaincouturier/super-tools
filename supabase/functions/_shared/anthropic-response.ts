/**
 * Lecture d'une réponse Messages API (Anthropic).
 *
 * `content[0]` n'est pas le texte. Le thinking est adaptatif par défaut à
 * partir de Sonnet 5 : sans paramètre `thinking`, le premier bloc renvoyé est
 * un `thinking` (au texte vide, l'affichage étant `omitted` par défaut), et
 * lire l'index 0 rend `undefined` sans lever d'erreur. Une réponse peut aussi
 * porter plusieurs blocs `text` (citations).
 *
 * Un refus de classifieur n'est pas une erreur HTTP : la réponse est un 200
 * avec `stop_reason: "refusal"` et aucun bloc texte. Lu à l'aveugle, il donne
 * une chaîne vide indiscernable d'une réponse manquée.
 */

export interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }> | null;
  stop_reason?: string | null;
  stop_details?: { category?: string | null; explanation?: string | null } | null;
}

/** Concatène les blocs `text`. Renvoie "" si la réponse n'en porte aucun. */
export function anthropicText(data: AnthropicResponse | null | undefined): string {
  const blocks = data?.content;
  if (!Array.isArray(blocks)) return "";
  return blocks
    .filter((b) => b?.type === "text" && typeof b.text === "string")
    .map((b) => b.text as string)
    .join("");
}

/**
 * Message de refus si les classifieurs ont décliné la demande, sinon `null`.
 * À vérifier avant de lire le texte : un refus ne remonte aucun bloc `text`.
 */
export function anthropicRefusal(data: AnthropicResponse | null | undefined): string | null {
  if (data?.stop_reason !== "refusal") return null;
  const { category, explanation } = data.stop_details ?? {};
  return `Refus du modèle (${category ?? "sans catégorie"})${explanation ? ` : ${explanation}` : ""}`;
}
