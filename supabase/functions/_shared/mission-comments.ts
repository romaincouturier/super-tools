/**
 * Règles d'autorisation des commentaires de pages livrables.
 *
 * Fonctions pures, sans accès base ni API Deno : c'est ici que se décide qui
 * peut écrire, répondre et supprimer. L'edge function `mission-page-comment`
 * ne fait qu'enchaîner les requêtes et appliquer ces décisions.
 */

export const MAX_BODY_LENGTH = 5000;
export const RATE_LIMIT_WINDOW_MINUTES = 10;
export const RATE_LIMIT_MAX_COMMENTS = 20;
export const DELETE_WINDOW_MINUTES = 15;

export interface CommentAuthor {
  contactId: string | null;
  userId: string | null;
  /** Mission du contact porteur du token — null pour un membre du staff. */
  missionId: string | null;
  name: string;
  email: string | null;
  isStaff: boolean;
}

export interface CommentPage {
  id: string;
  mission_id: string;
  is_deliverable: boolean;
  comments_enabled: boolean;
}

export interface Denial {
  message: string;
  status: number;
}

/** Corps du commentaire : non vide, borné. */
export function validateCommentBody(raw: unknown): { body: string; error?: never } | { body?: never; error: Denial } {
  const body = typeof raw === "string" ? raw.trim() : "";
  if (!body) return { error: { message: "Le commentaire est vide", status: 400 } };
  if (body.length > MAX_BODY_LENGTH) {
    return { error: { message: `Le commentaire dépasse ${MAX_BODY_LENGTH} caractères`, status: 400 } };
  }
  return { body };
}

/** Droit d'écrire sur cette page. `null` = autorisé. */
export function checkCanComment(page: CommentPage | null, author: CommentAuthor): Denial | null {
  if (!page) return { message: "Page introuvable", status: 404 };
  if (!page.is_deliverable || !page.comments_enabled) {
    return { message: "Les commentaires ne sont pas ouverts sur cette page", status: 403 };
  }
  // Un token de contact n'ouvre que la mission de ce contact.
  if (author.contactId && author.missionId !== page.mission_id) {
    return { message: "Lien invalide pour cette mission", status: 403 };
  }
  return null;
}

/** Droit de supprimer. `null` = autorisé. */
export function checkCanDelete(
  comment: { author_contact_id: string | null; created_at: string } | null,
  author: CommentAuthor,
  now: number,
): Denial | null {
  if (!comment) return { message: "Commentaire introuvable", status: 404 };
  if (author.isStaff) return null;
  if (!author.contactId || comment.author_contact_id !== author.contactId) {
    return { message: "Vous ne pouvez supprimer que vos propres commentaires", status: 403 };
  }
  const ageMinutes = (now - new Date(comment.created_at).getTime()) / 60_000;
  if (ageMinutes > DELETE_WINDOW_MINUTES) {
    return {
      message: `Un commentaire ne peut être supprimé que dans les ${DELETE_WINDOW_MINUTES} minutes`,
      status: 403,
    };
  }
  return null;
}

/**
 * Une réponse s'attache toujours à la racine du fil : pas de sous-fils.
 * `null` en entrée = commentaire racine.
 */
export function resolveThreadParentId(
  parent: { id: string; page_id: string; parent_comment_id: string | null } | null,
  pageId: string,
): { parentId: string | null; error?: never } | { parentId?: never; error: Denial } {
  if (!parent) return { parentId: null };
  if (parent.page_id !== pageId) {
    return { error: { message: "Fil de discussion introuvable", status: 404 } };
  }
  return { parentId: parent.parent_comment_id || parent.id };
}

export function isRateLimited(recentCount: number): boolean {
  return recentCount >= RATE_LIMIT_MAX_COMMENTS;
}

export function rateLimitSince(now: number): string {
  return new Date(now - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
}

/**
 * Destinataires de la notification : le consultant de la mission et les
 * participants du fil, jamais l'auteur du commentaire qui vient d'être écrit.
 */
export function notificationRecipients(input: {
  consultantEmail?: string | null;
  threadEmails: (string | null | undefined)[];
  authorEmail?: string | null;
}): string[] {
  const emails = new Set<string>();
  if (input.consultantEmail) emails.add(input.consultantEmail.toLowerCase());
  for (const email of input.threadEmails) {
    if (email) emails.add(email.toLowerCase());
  }
  if (input.authorEmail) emails.delete(input.authorEmail.toLowerCase());
  return [...emails];
}
