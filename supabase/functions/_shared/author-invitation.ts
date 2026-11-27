/**
 * Invitation d'un auteur de jeu (dropshipping) : logique des actions staff
 * « invite » et « send_invitation », partagée par `author-onboarding` et le MCP.
 * `inviteGameAuthor` n'envoie aucun email ; `sendAuthorInvitation` en envoie un.
 */
import { generateHash } from "./crypto.ts";
import { sendEmail } from "./resend.ts";
import { getBccSettings } from "./bcc-settings.ts";
import { getSigniticSignature } from "./signitic.ts";
import { getAppUrls } from "./app-urls.ts";
import { renderEmailText, loadEditableTemplate, ctaButton, escapeEmailValue } from "./editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "./editable-email-defaults.ts";
import {
  INVITATION_DAYS, formatCommission, frDateParis, invitationGameTitle, invitationGameName,
  parseInviteInput, invitationLinkToken, sendInvitationContentError,
} from "./author-onboarding.ts";

// deno-lint-ignore no-explicit-any
type Db = any;
export class InvitationError extends Error {
  constructor(message: string, public status = 400) { super(message); }
}

export function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
export const appBase = async () => ((await getAppUrls()).app_url || "https://academy.supertilt.fr").replace(/\/+$/, "");
export const publicLink = (base: string, token: string) => `${base}/proposer-mon-jeu/${encodeURIComponent(token)}`;

export async function invitationDraft(db: Db, invitationId: string, link: string) {
  const { data: inv } = await db.from("author_onboarding_invitations").select("*, game_authors(first_name), games(title)").eq("id", invitationId).single();
  const d = EDITABLE_EMAIL_DEFAULTS.author_invitation;
  const tpl = await loadEditableTemplate(db, "author_invitation", false).catch(() => null);
  const gameName = invitationGameName(inv.games?.title ?? "");
  const vars: Record<string, string> = {
    first_name: inv.game_authors?.first_name ?? "",
    game_name: gameName,
    game_mention: gameName ? `« ${gameName} »` : "ton jeu",
    commission: formatCommission(Number(inv.commission_rate)),
    expires_at: frDateParis(new Date(inv.expires_at)),
  };
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  const oldDefault = tpl?.html_content.includes("il vous suffit de remplir ce formulaire");
  return { subject: fill(!oldDefault && tpl ? tpl.subject : d.subject.tu), content: fill(!oldDefault && tpl ? tpl.html_content : d.content.tu), link, to: inv.recipient_email };
}

export async function inviteGameAuthor(db: Db, body: Record<string, unknown>, staffId: string) {
  const p = parseInviteInput(body);
  if ("error" in p) throw new InvitationError(p.error);
  const { email, first, last, gameName, rate } = p;
  const { data: existing } = await db.from("game_authors").select("id").ilike("email", email).limit(1);
  let authorId = existing?.[0]?.id as string | undefined;
  if (authorId) {
    await db.from("game_authors").update({ first_name: first, last_name: last, onboarding_status: "invited" }).eq("id", authorId);
  } else {
    const { data: a, error } = await db.from("game_authors").insert({
      name: `${first} ${last}`, first_name: first, last_name: last, email, royalty_rate: rate, onboarding_status: "invited",
    }).select("id").single();
    if (error) throw error;
    authorId = a.id;
  }
  const { data: g, error: gErr } = await db.from("games").insert({
    title: invitationGameTitle(gameName, first, last), author_id: authorId, status: "inactive", onboarding_status: "invited", commission_type: "percentage", commission_rate: rate,
  }).select("id").single();
  if (gErr) throw gErr;
  const token = randomToken();
  const { data: inv, error: iErr } = await db.from("author_onboarding_invitations").insert({
    token_hash: await generateHash(token), author_id: authorId, game_id: g.id, commission_rate: rate,
    recipient_email: email, invited_by: staffId,
    expires_at: new Date(Date.now() + INVITATION_DAYS * 86_400_000).toISOString(),
  }).select("id").single();
  if (iErr) throw iErr;
  const link = publicLink(await appBase(), token);
  return { invitation_id: inv.id as string, author_id: authorId as string, game_id: g.id as string, link, draft: await invitationDraft(db, inv.id, link) };
}

export async function sendAuthorInvitation(db: Db, body: Record<string, unknown>, staffId: string, defaults = false) {
  const { data: inv } = await db.from("author_onboarding_invitations").select("*").eq("id", String(body.invitation_id || "")).maybeSingle();
  if (!inv) throw new InvitationError("Invitation introuvable", 404);
  const link = String(body.link || "");
  const token = invitationLinkToken(link);
  if (!token || (await generateHash(token)) !== inv.token_hash) throw new InvitationError("Lien d'invitation périmé : générez-en un nouveau");
  let subject = String(body.subject || "").slice(0, 300);
  let content = String(body.content || "").slice(0, 20000);
  if (defaults && (!subject || !content)) {
    const d = await invitationDraft(db, inv.id, link);
    subject ||= d.subject;
    content ||= d.content;
  }
  const err = sendInvitationContentError(subject, content);
  if (err) throw new InvitationError(err);
  const r = renderEmailText(subject, content, {}, { invitation_button: ctaButton("Remplir le formulaire", escapeEmailValue(link)) });
  const [sig, bcc] = await Promise.all([getSigniticSignature(), getBccSettings(db)]);
  const sent = await sendEmail({ to: inv.recipient_email, bcc, subject: r.subject, html: r.html + sig, _emailType: "author_invitation" } as Db);
  if (!sent.success) throw new InvitationError(`Envoi impossible : ${sent.error ?? "erreur inconnue"}`, 502);
  await db.from("author_onboarding_invitations").update({ invitation_sent_at: new Date().toISOString() }).eq("id", inv.id);
  await db.from("activity_logs").insert({ action_type: "author_invitation_sent", recipient_email: inv.recipient_email, user_id: staffId, details: { invitation_id: inv.id } } as Db);
  return { sent: true, to: inv.recipient_email as string, invitation_id: inv.id as string };
}
