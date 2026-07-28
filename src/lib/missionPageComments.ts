/**
 * Organisation des commentaires d'une page livrable pour l'affichage.
 *
 * Fonctions pures : le composant ne fait que rendre le résultat.
 * Le droit de suppression calculé ici est cosmétique (afficher ou non
 * l'icône) — la décision qui fait foi est celle de l'edge function.
 */
import type { MissionPageCommentPublic } from "@/lib/supabase-rpc";

/** Doit rester aligné sur DELETE_WINDOW_MINUTES de l'edge function. */
export const OWN_DELETE_WINDOW_MINUTES = 15;

export interface CommentThread {
  root: MissionPageCommentPublic;
  replies: MissionPageCommentPublic[];
}

export interface ThreadPartition {
  /** Fils ouverts, rattachés à un bloc encore présent dans la page. */
  byBlock: Map<string, CommentThread[]>;
  /** Fils ouverts dont le bloc d'origine a disparu (page réécrite). */
  detached: CommentThread[];
  /** Fils clos par le staff, quel que soit leur bloc. */
  resolved: CommentThread[];
}

/** Regroupe les commentaires plats en fils d'un seul niveau. */
export function buildThreads(comments: MissionPageCommentPublic[]): CommentThread[] {
  return comments
    .filter((c) => !c.parent_comment_id)
    .map((root) => ({
      root,
      replies: comments.filter((c) => c.parent_comment_id === root.id),
    }));
}

export function partitionThreads(threads: CommentThread[], blockIds: Set<string>): ThreadPartition {
  const byBlock = new Map<string, CommentThread[]>();
  const detached: CommentThread[] = [];
  const resolved: CommentThread[] = [];

  for (const thread of threads) {
    if (thread.root.is_resolved) {
      resolved.push(thread);
      continue;
    }
    const blockId = thread.root.block_id;
    if (blockId && blockIds.has(blockId)) {
      byBlock.set(blockId, [...(byBlock.get(blockId) || []), thread]);
    } else {
      detached.push(thread);
    }
  }

  return { byBlock, detached, resolved };
}

export function canDeleteComment(
  comment: MissionPageCommentPublic,
  options: { isStaff: boolean; contactId: string | null; now?: number },
): boolean {
  if (options.isStaff) return true;
  if (!options.contactId || comment.author_contact_id !== options.contactId) return false;
  const now = options.now ?? Date.now();
  const ageMinutes = (now - new Date(comment.created_at).getTime()) / 60_000;
  return ageMinutes <= OWN_DELETE_WINDOW_MINUTES;
}
