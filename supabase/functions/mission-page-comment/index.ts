import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  getAppUrls,
  verifyAuth,
  sendEmail,
  escapeHtml,
  wrapEmailHtml,
  getSigniticSignature,
} from "../_shared/mod.ts";

// Écritures des commentaires de pages livrables. Point d'entrée unique :
// aucune policy anon en écriture sur mission_page_comments.
// Auteur = staff authentifié (JWT) ou contact identifié par son token de lien.

const MAX_BODY_LENGTH = 5000;
const RATE_LIMIT_WINDOW_MINUTES = 10;
const RATE_LIMIT_MAX_COMMENTS = 20;
const DELETE_WINDOW_MINUTES = 15;

interface Author {
  contactId: string | null;
  userId: string | null;
  /** Mission du contact porteur du token — null pour un membre du staff. */
  missionId: string | null;
  name: string;
  email: string | null;
  isStaff: boolean;
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const payload = await req.json();
    const action = payload.action as string | undefined;
    if (!action || !["create", "delete", "resolve"].includes(action)) {
      return createErrorResponse("action must be one of: create, delete, resolve", 400);
    }

    const supabase = getSupabaseClient();

    // ── Identification de l'auteur ────────────────────────────────────
    const user = await verifyAuth(req.headers.get("Authorization"));
    let author: Author | null = null;

    if (user) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, email")
        .eq("user_id", user.id)
        .maybeSingle();
      if (profile) {
        author = {
          contactId: null,
          userId: user.id,
          missionId: null,
          name: profile.display_name || profile.email || "Supertilt",
          email: profile.email || user.email || null,
          isStaff: true,
        };
      }
    }

    if (!author && payload.contact_token) {
      const { data: contact } = await supabase
        .from("mission_contacts")
        .select("id, mission_id, first_name, last_name, email")
        .eq("access_token", payload.contact_token)
        .maybeSingle();
      if (!contact) {
        return createErrorResponse("Lien invalide ou expiré", 403);
      }
      author = {
        contactId: contact.id,
        userId: null,
        missionId: contact.mission_id,
        name: [contact.first_name, contact.last_name].filter(Boolean).join(" ") || contact.email || "Contact",
        email: contact.email,
        isStaff: false,
      };
    }

    if (!author) {
      return createErrorResponse("Ouvrez le lien reçu par email pour commenter", 403);
    }

    if (action === "delete") return await handleDelete(supabase, payload, author);
    if (action === "resolve") return await handleResolve(supabase, payload, author);
    return await handleCreate(supabase, payload, author);
  } catch (err) {
    return createErrorResponse(
      err instanceof Error ? err.message : "Erreur inconnue",
      500,
      { cause: err, fn: "mission-page-comment" },
    );
  }
});

// ── create ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleCreate(supabase: any, payload: any, author: Author): Promise<Response> {
  const body = typeof payload.body === "string" ? payload.body.trim() : "";
  if (!body) return createErrorResponse("Le commentaire est vide", 400);
  if (body.length > MAX_BODY_LENGTH) {
    return createErrorResponse(`Le commentaire dépasse ${MAX_BODY_LENGTH} caractères`, 400);
  }
  if (!payload.page_id) return createErrorResponse("page_id is required", 400);

  const { data: page } = await supabase
    .from("mission_pages")
    .select("id, mission_id, title, is_deliverable, comments_enabled")
    .eq("id", payload.page_id)
    .maybeSingle();

  if (!page) return createErrorResponse("Page introuvable", 404);
  if (!page.is_deliverable || !page.comments_enabled) {
    return createErrorResponse("Les commentaires ne sont pas ouverts sur cette page", 403);
  }
  if (author.contactId && author.missionId !== page.mission_id) {
    return createErrorResponse("Lien invalide pour cette mission", 403);
  }

  // Une seule profondeur de fil : une réponse s'attache toujours à la racine.
  let parentId: string | null = null;
  if (payload.parent_comment_id) {
    const { data: parent } = await supabase
      .from("mission_page_comments")
      .select("id, page_id, parent_comment_id")
      .eq("id", payload.parent_comment_id)
      .maybeSingle();
    if (!parent || parent.page_id !== page.id) {
      return createErrorResponse("Fil de discussion introuvable", 404);
    }
    parentId = parent.parent_comment_id || parent.id;
  }

  const since = new Date(Date.now() - RATE_LIMIT_WINDOW_MINUTES * 60_000).toISOString();
  const rateQuery = supabase
    .from("mission_page_comments")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);
  const { count } = author.contactId
    ? await rateQuery.eq("author_contact_id", author.contactId)
    : await rateQuery.eq("author_user_id", author.userId);
  if ((count || 0) >= RATE_LIMIT_MAX_COMMENTS) {
    return createErrorResponse("Trop de commentaires envoyés, réessayez dans quelques minutes", 429);
  }

  const { data: comment, error } = await supabase
    .from("mission_page_comments")
    .insert({
      mission_id: page.mission_id,
      page_id: page.id,
      parent_comment_id: parentId,
      block_id: payload.block_id || null,
      quoted_text: payload.quoted_text ? String(payload.quoted_text).slice(0, 500) : null,
      author_contact_id: author.contactId,
      author_user_id: author.userId,
      author_name: author.name,
      author_email: author.email,
      is_staff: author.isStaff,
      body,
    })
    .select()
    .single();

  if (error) throw error;

  // Notifications hors chemin critique : un échec d'email ne fait pas
  // échouer le commentaire.
  try {
    await notify(supabase, { page, comment, author, threadId: parentId || comment.id });
  } catch (err) {
    console.error("[mission-page-comment] notification failed:", err);
  }

  return createJsonResponse({ comment });
}

// ── delete ──────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleDelete(supabase: any, payload: any, author: Author): Promise<Response> {
  if (!payload.comment_id) return createErrorResponse("comment_id is required", 400);

  const { data: comment } = await supabase
    .from("mission_page_comments")
    .select("id, author_contact_id, created_at")
    .eq("id", payload.comment_id)
    .maybeSingle();
  if (!comment) return createErrorResponse("Commentaire introuvable", 404);

  if (!author.isStaff) {
    if (comment.author_contact_id !== author.contactId) {
      return createErrorResponse("Vous ne pouvez supprimer que vos propres commentaires", 403);
    }
    const ageMinutes = (Date.now() - new Date(comment.created_at).getTime()) / 60_000;
    if (ageMinutes > DELETE_WINDOW_MINUTES) {
      return createErrorResponse(
        `Un commentaire ne peut être supprimé que dans les ${DELETE_WINDOW_MINUTES} minutes`,
        403,
      );
    }
  }

  const { error } = await supabase
    .from("mission_page_comments")
    .update({ is_deleted: true })
    .eq("id", comment.id);
  if (error) throw error;

  return createJsonResponse({ deleted: true });
}

// ── resolve ─────────────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function handleResolve(supabase: any, payload: any, author: Author): Promise<Response> {
  if (!author.isStaff) {
    return createErrorResponse("Réservé au staff Supertilt", 403);
  }
  if (!payload.comment_id) return createErrorResponse("comment_id is required", 400);

  const resolved = payload.resolved !== false;
  const { error } = await supabase
    .from("mission_page_comments")
    .update({ is_resolved: resolved, resolved_at: resolved ? new Date().toISOString() : null })
    .eq("id", payload.comment_id);
  if (error) throw error;

  return createJsonResponse({ resolved });
}

// ── notifications ───────────────────────────────────────────────────

// deno-lint-ignore no-explicit-any
async function notify(supabase: any, ctx: { page: any; comment: any; author: Author; threadId: string }) {
  const { page, comment, author, threadId } = ctx;

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title, assigned_to, created_by")
    .eq("id", page.mission_id)
    .maybeSingle();
  if (!mission) return;

  // Destinataires : le consultant de la mission + les participants du fil,
  // jamais l'auteur du commentaire qui vient d'être écrit.
  const emails = new Set<string>();

  const consultantId = mission.assigned_to || mission.created_by;
  if (consultantId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", consultantId)
      .maybeSingle();
    if (profile?.email) emails.add(profile.email.toLowerCase());
  }

  const { data: threadComments } = await supabase
    .from("mission_page_comments")
    .select("author_email")
    .or(`id.eq.${threadId},parent_comment_id.eq.${threadId}`)
    .eq("is_deleted", false);
  for (const c of threadComments || []) {
    if (c.author_email) emails.add(c.author_email.toLowerCase());
  }

  if (author.email) emails.delete(author.email.toLowerCase());
  if (emails.size === 0) return;

  const { data: contacts } = await supabase
    .from("mission_contacts")
    .select("email, access_token")
    .eq("mission_id", mission.id);
  const tokenByEmail = new Map<string, string>();
  for (const c of contacts || []) {
    if (c.email) tokenByEmail.set(c.email.toLowerCase(), c.access_token);
  }

  const [urls, signature] = await Promise.all([getAppUrls(), getSigniticSignature()]);
  const pageTitle = page.title || "Sans titre";
  const subject = `Nouveau commentaire sur « ${pageTitle} » - ${mission.title}`;

  for (const email of emails) {
    const token = tokenByEmail.get(email);
    const link = `${urls.app_url}/mission-info/${mission.id}${token ? `?c=${token}` : ""}`;
    const html = wrapEmailHtml(
      `<p><strong>${escapeHtml(author.name)}</strong> a commenté la page « ${escapeHtml(pageTitle)} » de la mission « ${escapeHtml(mission.title)} ».</p>
       ${comment.quoted_text ? `<blockquote style="margin:16px 0;padding:8px 16px;border-left:3px solid #ddd;color:#666;font-style:italic;">${escapeHtml(comment.quoted_text)}</blockquote>` : ""}
       <p style="margin:16px 0;padding:12px 16px;background:#f6f6f6;border-radius:6px;">${escapeHtml(comment.body).replace(/\n/g, "<br>")}</p>
       <p style="margin:24px 0;"><a href="${link}" style="display:inline-block;padding:12px 24px;background-color:#e6bc00;color:#000;text-decoration:none;border-radius:6px;font-weight:bold;">Voir et répondre</a></p>`,
      signature,
    );
    await sendEmail({ to: email, subject, html });
  }
}
