/**
 * Historique de conversation de l'agent — compaction et points de cache.
 *
 * Extrait d'agent-chat pour être testable : l'invariant « le préfixe envoyé à
 * l'API ne fait que croître pendant un tour » conditionne tout le bénéfice du
 * prompt caching, et se casse silencieusement si la fenêtre de compaction
 * redevient glissante.
 */

export interface Message {
  role: string;
  content: unknown;
}

const CONTENT_READ_TOOLS = new Set([
  "get_mission_dossier",
  "get_client_dossier",
  "read_mission_page",
  "read_document",
  "read_mission_documents",
  "read_media_image",
]);

// Les tool_results (jusqu'à 100 lignes JSON) sont conservés en base mais
// tronqués à l'envoi API au-delà des derniers messages : sans cela chaque
// tour renvoie l'intégralité des résultats SQL de toute la conversation.

export const KEEP_RECENT_MESSAGES = 6;
const TOOL_RESULT_MAX_CHARS = 1200;
/**
 * Plafond des lectures de contenu. Très supérieur au rabotage ordinaire : un
 * document ou une page de mission n'a d'intérêt que lu en entier, et le
 * relire coûte un aller-retour complet. Assez large pour qu'une lecture
 * survive à plusieurs tours, assez borné pour qu'une conversation entière de
 * lectures ne sature pas le contexte.
 */
const CONTENT_RESULT_MAX_CHARS = 120000;

/** tool_use_id -> nom du tool, pour savoir quoi raboter et quoi préserver. */
export function toolNamesById(messages: Message[]): Map<string, string> {
  const names = new Map<string, string>();
  for (const m of messages) {
    if (!Array.isArray(m.content)) continue;
    for (const block of m.content as Array<Record<string, unknown>>) {
      if (block.type === "tool_use" && block.id) {
        names.set(block.id as string, block.name as string);
      }
    }
  }
  return names;
}

/**
 * @param frozenCutoff Index à partir duquel les messages sont laissés intacts.
 *   Calculé une seule fois par tour d'agent : si la fenêtre glissait à chaque
 *   round, un message envoyé entier au round N serait tronqué au round N+3.
 *   Les octets du préfixe changeraient, et le cache de prompt ne pourrait
 *   jamais être relu — c'est exactement ce qui faisait repayer plein tarif
 *   toute la conversation à chacun des 25 rounds possibles.
 */
export function compactForApi(messages: Message[], frozenCutoff?: number): Message[] {
  const cutoff = frozenCutoff ?? messages.length - KEEP_RECENT_MESSAGES;
  const names = toolNamesById(messages);

  return messages.map((m, i) => {
    if (i >= cutoff || !Array.isArray(m.content)) return m;
    const content = (m.content as Array<Record<string, unknown>>).map((block) => {
      if (block.type !== "tool_result") return block;

      // Blocs mixtes (documents scannés, photos) : le texte est conservé, les
      // images sont remplacées par une note. Une image base64 renvoyée à
      // chaque tour pèse plusieurs Mo pour une information déjà exploitée.
      if (Array.isArray(block.content)) {
        const blocks = block.content as Array<Record<string, unknown>>;
        const images = blocks.filter((b) => b.type === "image").length;
        if (images === 0) return block;
        return {
          ...block,
          content: [
            ...blocks.filter((b) => b.type !== "image"),
            {
              type: "text",
              text: `[${images} image(s) déjà lue(s), retirées de l'historique — relancer le tool pour les revoir]`,
            },
          ],
        };
      }

      if (typeof block.content !== "string") return block;

      const isRead = CONTENT_READ_TOOLS.has(names.get(block.tool_use_id as string) ?? "");
      const max = isRead ? CONTENT_RESULT_MAX_CHARS : TOOL_RESULT_MAX_CHARS;
      const text = block.content as string;
      if (text.length <= max) return block;

      return {
        ...block,
        content: text.slice(0, max) +
          "\n… [résultat tronqué — relancer le tool si besoin du détail]",
      };
    });
    return { ...m, content };
  });
}

/**
 * Pose les points de cache sur l'historique.
 *
 * Le system (schéma + tools) était déjà caché, mais `messages` ne l'était pas :
 * chaque round renvoyait toute la conversation au plein tarif d'entrée. On
 * marque le dernier bloc du dernier message — le préfixe étant désormais
 * append-only pendant un tour, les rounds suivants le relisent à 0,1x.
 *
 * Un second point est posé quelques messages en arrière : un breakpoint ne
 * remonte que 20 blocs de contenu pour retrouver une entrée de cache, et un
 * round avec plusieurs tools en parallèle peut dépasser ce seuil.
 *
 * Les objets sont copiés : `cache_control` ne doit pas fuiter dans
 * `agent_conversations.messages`, qui est persisté tel quel.
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
