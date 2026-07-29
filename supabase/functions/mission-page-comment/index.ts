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
import {
  validateCommentBody,
  checkCanComment,
  checkCanDelete,
  resolveThreadParentId,
  isRateLimited,
  rateLimitSince,
  notificationRecipients,
  type CommentAuthor as Author,
} from "../_shared/mission-comments.ts";

// Écritures des commentaires de pages livrables. Point d'entrée unique :
// aucune policy anon en écriture sur mission_page_comments.
// Auteur = staff authentifié (JWT) ou contact identifié par son token de lien.
// Les règles d'autorisation sont dans _shared/mission-comments.ts (testées).

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const raw = await req.text();
    if (!raw.trim()) {
      return createErrorResponse("Corps de requête JSON manquant", 400);
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw);
    } catch {
      return createErrorResponse("Corps de requête JSON invalide", 400);
    }
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
  const validated = validateCommentBody(payload.body);
  if (validated.error) return createErrorResponse(validated.error.message, validated.error.status);
  const body = validated.body;
  if (!payload.page_id) return createErrorResponse("page_id is required", 400);

  const { data: page } = await supabase
    .from("mission_pages")
    .select("id, mission_id, title, is_deliverable, comments_enabled")
    .eq("id", payload.page_id)
    .maybeSingle();

  const denial = checkCanComment(page, author);
  if (denial) return createErrorResponse(denial.message, denial.status);

  let parent = null;
  if (payload.parent_comment_id) {
    const { data } = await supabase
      .from("mission_page_comments")
      .select("id, page_id, parent_comment_id")
      .eq("id", payload.parent_comment_id)
      .maybeSingle();
    if (!data) return createErrorResponse("Fil de discussion introuvable", 404);
    parent = data;
  }
  const thread = resolveThreadParentId(parent, page.id);
  if (thread.error) return createErrorResponse(thread.error.message, thread.error.status);
  const parentId = thread.parentId;

  const rateQuery = supabase
    .from("mission_page_comments")
    .select("id", { count: "exact", head: true })
    .gte("created_at", rateLimitSince(Date.now()));
  const { count } = author.contactId
    ? await rateQuery.eq("author_contact_id", author.contactId)
    : await rateQuery.eq("author_user_id", author.userId);
  if (isRateLimited(count || 0)) {
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
  const denial = checkCanDelete(comment, author, Date.now());
  if (denial) return createErrorResponse(denial.message, denial.status);

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

  const consultantId = mission.assigned_to || mission.created_by;
  let consultantEmail: string | null = null;
  if (consultantId) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("email")
      .eq("user_id", consultantId)
      .maybeSingle();
    consultantEmail = profile?.email ?? null;
  }

  const { data: threadComments } = await supabase
    .from("mission_page_comments")
    .select("author_email")
    .or(`id.eq.${threadId},parent_comment_id.eq.${threadId}`)
    .eq("is_deleted", false);

  const emails = notificationRecipients({
    consultantEmail,
    // deno-lint-ignore no-explicit-any
    threadEmails: (threadComments || []).map((c: any) => c.author_email),
    authorEmail: author.email,
  });
  if (emails.length === 0) return;

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
