/**
 * Historique de conversation de l'agent — points de cache et blocs thinking.
 *
 * Extrait d'agent-chat pour être testable : l'invariant « le préfixe envoyé à
 * l'API ne fait que croître » conditionne à la fois le prompt caching et la
 * validité des blocs `thinking`, et se casse silencieusement dès qu'un tour
 * déjà envoyé est réécrit.
 *
 * Le rabotage des tool_results se faisait ici, côté client : chaque nouveau
 * tour retronquait des messages envoyés entiers au tour précédent. C'est
 * exactement l'édition d'historique que la règle « preserved thinking »
 * interdit — la signature d'un bloc thinking scelle tout ce qui le précède,
 * donc une troncature rétroactive invalide tous les blocs postérieurs. Le
 * ménage passe désormais par le context editing serveur
 * (`clear_tool_uses_20250919`), qui ne compte pas comme une édition puisque
 * l'API compare la conversation telle qu'elle a été envoyée.
 */

export interface Message {
  role: string;
  content: unknown;
}

export const KEEP_RECENT_MESSAGES = 6;

/**
 * Nombre de paires tool_use/tool_result que le context editing serveur
 * conserve intactes. Unité différente de KEEP_RECENT_MESSAGES, qui compte des
 * messages : un round à plusieurs tools en parallèle tient dans deux messages.
 */
export const KEEP_RECENT_TOOL_USES = 6;

/**
 * Tools dont le résultat ne doit jamais être purgé par le context editing.
 * Un dossier ou une page de mission n'a d'intérêt que lu en entier, et le
 * relire coûte un aller-retour complet. `read_media_image` en est exclu :
 * une image base64 renvoyée à chaque tour pèse plusieurs Mo pour une
 * information déjà exploitée, elle a vocation à être purgée.
 */
export const CONTENT_READ_TOOLS = [
  "get_mission_dossier",
  "get_client_dossier",
  "read_mission_page",
  "read_document",
  "read_mission_documents",
];

/**
 * Retire les blocs `thinking` et `redacted_thinking` des messages indiqués.
 *
 * Nécessaire après une compaction par résumé : les tours conservés en queue
 * portent des blocs produits quand tout l'historique était présent. Les
 * rejouer derrière le résumé fait échouer la vérification de préfixe. Les
 * blocs `text` et `tool_use` du tour restent, eux, valides.
 */
export function stripThinking(messages: Message[]): Message[] {
  return messages.map((m) => {
    if (!Array.isArray(m.content)) return m;
    const blocks = m.content as Array<Record<string, unknown>>;
    const kept = blocks.filter(
      (b) => b.type !== "thinking" && b.type !== "redacted_thinking",
    );
    return kept.length === blocks.length ? m : { ...m, content: kept };
  });
}

/**
 * Pose les points de cache sur l'historique.
 *
 * Le system (schéma + tools) était déjà caché, mais `messages` ne l'était pas :
 * chaque round renvoyait toute la conversation au plein tarif d'entrée. On
 * marque le dernier bloc du dernier message — le préfixe étant append-only,
 * les rounds suivants le relisent à 0,1x.
 *
 * Un second point est posé quelques messages en arrière : un breakpoint ne
 * remonte que 20 blocs de contenu pour retrouver une entrée de cache, et un
 * round avec plusieurs tools en parallèle peut dépasser ce seuil.
 *
 * Poser, déplacer ou retirer un marqueur `cache_control` ne compte pas comme
 * une édition d'historique. Les objets sont malgré tout copiés : le marqueur
 * ne doit pas fuiter dans `agent_conversations.messages`, persisté tel quel.
 */
const CACHE_LOOKBACK_ANCHOR = 3;

export function withCacheBreakpoints(messages: Message[]): Message[] {
  const targets = new Set<number>();
  if (messages.length > 0) targets.add(messages.length - 1);
  if (messages.length > CACHE_LOOKBACK_ANCHOR) {
    targets.add(messages.length - 1 - CACHE_LOOKBACK_ANCHOR);
  }

  return messages.map((m, i) => {
    if (!targets.has(i)) return m;

    if (typeof m.content === "string") {
      return {
        ...m,
        content: [
          { type: "text", text: m.content, cache_control: { type: "ephemeral" } },
        ],
      };
    }
    if (!Array.isArray(m.content) || m.content.length === 0) return m;

    const blocks = m.content as Array<Record<string, unknown>>;
    const lastIndex = blocks.length - 1;
    // Un bloc `thinking` porte une signature : ne rien y ajouter.
    if (blocks[lastIndex]?.type === "thinking") return m;

    return {
      ...m,
      content: blocks.map((block, bi) =>
        bi === lastIndex ? { ...block, cache_control: { type: "ephemeral" } } : block,
      ),
    };
  });
}
