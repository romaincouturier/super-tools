/**
 * Onboarding auteur dropshipping (invitation, formulaire public, contrat
 * PDFMonkey, signature avec code à usage unique).
 *
 * Actions publiques : authentifiées par le jeton d'invitation (stocké haché).
 * Actions staff : JWT + admin ou module dropshipping.
 * Seul envoi automatique hors code OTP et relances : la copie signée.
 */
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { generateHash, hashArrayBuffer, getClientIp } from "../_shared/crypto.ts";
import { sendEmail } from "../_shared/resend.ts";
import { getSenderEmail } from "../_shared/email-settings.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getAppUrls } from "../_shared/app-urls.ts";
import { renderCatalogEmail, renderEmailText, loadEditableTemplate, ctaButton, escapeEmailValue } from "../_shared/editable-email.ts";
import { EDITABLE_EMAIL_DEFAULTS } from "../_shared/editable-email-defaults.ts";
import { generateSignedPdf } from "../_shared/generate-signed-pdf.ts";
import { buildJourneyEvents, LEGAL_BLOCK } from "../_shared/signature-helpers.ts";
import {
  INVITATION_DAYS, OTP_TTL_MS, sanitizeForm, missingForSubmit, fileKindAllowed, formatCommission,
  buildContractPayload, otpSendRefusal, otpCheckRefusal, frDateParis, type FormData as AuthorForm,
} from "../_shared/author-onboarding.ts";

const BUCKET = "author-onboarding";
const TEMPLATE_ID = "A3FFB90C-6622-41AA-821F-0FB37F685403";
const PRODUCT_SHEET_EMAIL = "emmanuelle@supertilt.fr";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
const fail = (error: string, status = 400) => json({ error }, status);

function randomToken(): string {
  const b = new Uint8Array(32);
  crypto.getRandomValues(b);
  return btoa(String.fromCharCode(...b)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
const appBase = async () => ((await getAppUrls()).app_url || "https://academy.supertilt.fr").replace(/\/+$/, "");
const publicLink = (base: string, token: string) => `${base}/proposer-mon-jeu/${encodeURIComponent(token)}`;

// deno-lint-ignore no-explicit-any
type Db = any;

async function staffUser(req: Request): Promise<{ id: string; email: string } | null> {
  const auth = req.headers.get("Authorization") || "";
  if (!auth.startsWith("Bearer ")) return null;
  const c = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: auth } } });
  const { data: { user } } = await c.auth.getUser();
  if (!user) return null;
  const [{ data: admin }, { data: mod }] = await Promise.all([
    c.rpc("is_admin", { _user_id: user.id }),
    c.rpc("has_module_access", { _user_id: user.id, _module: "dropshipping" }),
  ]);
  return admin || mod ? { id: user.id, email: user.email ?? "" } : null;
}

async function invitationByToken(db: Db, token: unknown) {
  if (typeof token !== "string" || token.length < 20 || token.length > 100) return null;
  const { data } = await db.from("author_onboarding_invitations").select("*").eq("token_hash", await generateHash(token)).maybeSingle();
  if (!data || data.revoked_at || new Date(data.expires_at).getTime() < Date.now()) return null;
  return data;
}

async function loadResponse(db: Db, invitationId: string) {
  const { data } = await db.from("author_onboarding_responses").select("*").eq("invitation_id", invitationId).maybeSingle();
  return data;
}
async function listFiles(db: Db, invitationId: string) {
  const { data } = await db.from("author_onboarding_files").select("id, kind, original_name, mime_type, size_bytes, created_at").eq("invitation_id", invitationId).order("created_at");
  return data ?? [];
}
async function pendingContract(db: Db, invitationId: string) {
  const { data } = await db.from("distribution_contract_signatures").select("*").eq("invitation_id", invitationId).in("status", ["pending", "signed"]).order("created_at", { ascending: false }).limit(1);
  return data?.[0] ?? null;
}
async function setStatus(db: Db, authorId: string, gameId: string, status: string) {
  await db.from("game_authors").update({ onboarding_status: status }).eq("id", authorId);
  await db.from("games").update({ onboarding_status: status }).eq("id", gameId);
}
async function getSetting(db: Db, key: string): Promise<string | null> {
  const { data } = await db.from("app_settings").select("setting_value").eq("setting_key", key).maybeSingle();
  return data?.setting_value ?? null;
}
async function putSetting(db: Db, key: string, value: string) {
  const { data } = await db.from("app_settings").select("id").eq("setting_key", key).maybeSingle();
  if (data) await db.from("app_settings").update({ setting_value: value, updated_at: new Date().toISOString() }).eq("id", data.id);
  else await db.from("app_settings").insert({ setting_key: key, setting_value: value, description: "Signature du distributeur (contrats auteurs)" });
}
async function storageDataUrl(db: Db, path: string | null): Promise<string> {
  if (!path) return "";
  const { data } = await db.storage.from(BUCKET).download(path);
  if (!data) return "";
  const buf = new Uint8Array(await data.arrayBuffer());
  let bin = ""; for (let i = 0; i < buf.length; i += 0x8000) bin += String.fromCharCode(...buf.subarray(i, i + 0x8000));
  return `data:${data.type || "image/png"};base64,${btoa(bin)}`;
}

async function pdfMonkey(payload: Record<string, unknown>): Promise<{ bytes: Uint8Array; documentId: string }> {
  const key = Deno.env.get("PDFMONKEY_API_KEY");
  if (!key) throw new Error("PDFMONKEY_API_KEY manquant");
  const res = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ document: { document_template_id: TEMPLATE_ID, payload, status: "pending" } }),
  });
  if (!res.ok) throw new Error(`PDFMonkey [${res.status}] ${await res.text()}`);
  const id = (await res.json()).document.id;
  for (let i = 0; i < 30; i++) {
    await new Promise((r) => setTimeout(r, 2000));
    const s = await fetch(`https://api.pdfmonkey.io/api/v1/documents/${id}`, { headers: { Authorization: `Bearer ${key}` } });
    if (!s.ok) throw new Error(`PDFMonkey statut [${s.status}]`);
    const d = (await s.json()).document;
    if (d.status === "error") throw new Error(`PDFMonkey : erreur de génération ${d.failure_cause ?? ""}`);
    if (d.status === "success") {
      const f = await fetch(d.download_url);
      if (!f.ok) throw new Error("PDFMonkey : téléchargement impossible");
      return { bytes: new Uint8Array(await f.arrayBuffer()), documentId: id };
    }
  }
  throw new Error("PDFMonkey : délai dépassé");
}

async function signedUrl(db: Db, path: string | null, seconds = 3600) {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, seconds);
  return data?.signedUrl ?? null;
}

function publicView(inv: Db, resp: Db, files: Db[], contract: Db | null) {
  return {
    status: contract?.status === "signed" ? "signed" : contract ? "contract" : inv.submitted_at ? "submitted" : "form",
    game_name: resp?.data?.game_name,
    commission: formatCommission(Number(inv.commission_rate)),
    expires_at: inv.expires_at,
    form: resp?.data ?? {},
    files,
    contract: contract ? {
      reference: contract.contrat_reference, status: contract.status, signed_at: contract.signed_at,
      otp_verified: !!contract.otp_verified_at, recipient_email: contract.recipient_email,
    } : null,
  };
}

serve(async (req) => {
  const pre = handleCorsPreflightIfNeeded(req);
  if (pre) return pre;
  const db = getSupabaseClient() as Db;
  try {
    // ── Upload (multipart, public) ───────────────────────────────
    if ((req.headers.get("content-type") || "").startsWith("multipart/form-data")) {
      const fd = await req.formData();
      const inv = await invitationByToken(db, fd.get("token"));
      if (!inv) return fail("Lien invalide ou expiré", 404);
      if (inv.submitted_at) return fail("Formulaire déjà soumis");
      const file = fd.get("file");
      const kind = String(fd.get("kind") || "");
      if (!(file instanceof File)) return fail("Fichier manquant");
      const existing = await listFiles(db, inv.id);
      const refusal = fileKindAllowed(kind, file.type, file.size, existing);
      if (refusal) return fail(refusal);
      const buf = await file.arrayBuffer();
      const head = new Uint8Array(buf.slice(0, 4));
      const isPdf = head[0] === 0x25 && head[1] === 0x50; const isPng = head[0] === 0x89 && head[1] === 0x50;
      const isJpg = head[0] === 0xff && head[1] === 0xd8; const isWebp = head[0] === 0x52 && head[1] === 0x49;
      if (kind === "pdf" ? !isPdf : !(isPng || isJpg || isWebp)) return fail("Le contenu du fichier ne correspond pas à son type");
      if (kind === "logo") {
        for (const f of existing.filter((f: Db) => f.kind === "logo")) {
          const { data: row } = await db.from("author_onboarding_files").select("storage_path").eq("id", f.id).single();
          await db.storage.from(BUCKET).remove([row.storage_path]);
          await db.from("author_onboarding_files").delete().eq("id", f.id);
        }
      }
      const ext = { "application/pdf": "pdf", "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" }[file.type];
      const path = `invitations/${inv.id}/${kind}-${crypto.randomUUID()}.${ext}`;
      const { error: upErr } = await db.storage.from(BUCKET).upload(path, buf, { contentType: file.type });
      if (upErr) return fail("Échec de l'envoi du fichier", 500);
      const original = file.name.replace(/[^\p{L}\p{N}._ -]/gu, "_").slice(0, 120);
      await db.from("author_onboarding_files").insert({
        invitation_id: inv.id, kind, storage_path: path, original_name: original, mime_type: file.type,
        size_bytes: file.size, sha256: await hashArrayBuffer(buf),
      });
      return json({ files: await listFiles(db, inv.id) });
    }

    const body = await req.json().catch(() => ({}));
    const action = String(body.action || "");

    // ── Actions publiques ─────────────────────────────────────────
    if (["get", "save", "delete_file", "submit", "edit", "send_otp", "sign"].includes(action)) {
      const inv = await invitationByToken(db, body.token);
      if (!inv) return fail("Ce lien n'est plus valable. Contactez SuperTilt pour en recevoir un nouveau.", 404);
      let resp = await loadResponse(db, inv.id);

      if (action === "get") {
        if (!inv.opened_at) {
          await db.from("author_onboarding_invitations").update({ opened_at: new Date().toISOString() }).eq("id", inv.id);
        }
        if (!resp) {
          const [{ data: author }, { data: game }] = await Promise.all([
            db.from("game_authors").select("email, first_name, last_name").eq("id", inv.author_id).single(),
            db.from("games").select("title").eq("id", inv.game_id).single(),
          ]);
          const { data: created } = await db.from("author_onboarding_responses").insert({
            invitation_id: inv.id,
            data: sanitizeForm({ game_name: game?.title, author_email: author?.email, legal_rep_first_name: author?.first_name, legal_rep_last_name: author?.last_name }),
          }).select("*").single();
          resp = created;
        }
        const contract = await pendingContract(db, inv.id);
        return json({
          ...publicView(inv, resp, await listFiles(db, inv.id), contract),
          contract_pdf_url: contract ? await signedUrl(db, contract.signed_pdf_url ?? contract.pdf_url, 3600) : null,
        });
      }

      if (action === "save" || action === "submit") {
        if (inv.submitted_at) return fail("Formulaire déjà soumis");
        const data = sanitizeForm(body.form);
        const now = new Date().toISOString();
        await db.from("author_onboarding_responses").update({ data, updated_at: now, version: (resp?.version ?? 0) + 1 }).eq("invitation_id", inv.id);
        const { data: author } = await db.from("game_authors").select("onboarding_status").eq("id", inv.author_id).single();
        if (author?.onboarding_status === "invited") await setStatus(db, inv.author_id, inv.game_id, "form_in_progress");
        if (action === "save") {
          if (body.check === true) return json({ saved_at: now, missing: missingForSubmit(data, await listFiles(db, inv.id)) });
          return json({ saved_at: now });
        }

        const files = await listFiles(db, inv.id);
        const missing = missingForSubmit(data, files);
        if (missing.length) return json({ error: "Champs manquants", missing }, 400);

        // Verrou : une seule soumission.
        const { data: locked } = await db.from("author_onboarding_invitations")
          .update({ submitted_at: now }).eq("id", inv.id).is("submitted_at", null).select("id");
        if (!locked?.length) return fail("Formulaire déjà soumis");
        await db.from("author_onboarding_responses").update({ submitted_at: now }).eq("invitation_id", inv.id);
        await recopyToRecords(db, inv, data, files);
        await setStatus(db, inv.author_id, inv.game_id, "form_submitted");

        try {
          await createContract(db, inv, data);
        } catch (e) {
          console.error("contract generation failed", e);
          return json({ submitted: true, contract_error: "Le contrat n'a pas pu être généré. SuperTilt a été prévenu et vous recontactera." });
        }
        const contract = await pendingContract(db, inv.id);
        return json({ ...publicView(inv, await loadResponse(db, inv.id), files, contract), contract_pdf_url: await signedUrl(db, contract?.pdf_url ?? null, 3600) });
      }

      if (action === "delete_file") {
        if (inv.submitted_at) return fail("Formulaire déjà soumis");
        const { data: row } = await db.from("author_onboarding_files").select("id, storage_path").eq("id", String(body.file_id || "")).eq("invitation_id", inv.id).maybeSingle();
        if (row) {
          await db.storage.from(BUCKET).remove([row.storage_path]);
          await db.from("author_onboarding_files").delete().eq("id", row.id);
        }
        return json({ files: await listFiles(db, inv.id) });
      }

      // Modification par l'auteur : possible tant que le contrat n'est pas signé.
      // Le contrat en attente est annulé ; une nouvelle soumission en régénère un.
      if (action === "edit") {
        const { data: signed } = await db.from("distribution_contract_signatures").select("id").eq("invitation_id", inv.id).eq("status", "signed").limit(1);
        if (signed?.length) return fail("Contrat déjà signé : les réponses ne sont plus modifiables");
        await db.from("distribution_contract_signatures").update({ status: "cancelled" }).eq("invitation_id", inv.id).eq("status", "pending");
        await db.from("author_onboarding_invitations").update({ submitted_at: null }).eq("id", inv.id);
        await db.from("author_onboarding_responses").update({ submitted_at: null }).eq("invitation_id", inv.id);
        await setStatus(db, inv.author_id, inv.game_id, "form_in_progress");
        await db.from("activity_logs").insert({ action_type: "author_form_reopened_by_author", recipient_email: inv.recipient_email, details: { invitation_id: inv.id } } as Db);
        return json({ reopened: true });
      }

      const contract = await pendingContract(db, inv.id);
      if (!contract || contract.status !== "pending") return fail("Aucun contrat à signer");
      if (new Date(contract.expires_at).getTime() < Date.now()) return fail("Le lien de signature a expiré. Contactez SuperTilt.");

      if (action === "send_otp") {
        const refusal = otpSendRefusal(contract.otp_sent_count, contract.otp_last_sent_at, Date.now());
        if (refusal) return fail(refusal, 429);
        const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, "0");
        const now = new Date();
        const { data: claimed } = await db.from("distribution_contract_signatures").update({
          otp_hash: await generateHash(`${contract.id}:${code}`),
          otp_expires_at: new Date(now.getTime() + OTP_TTL_MS).toISOString(),
          otp_attempts: 0, otp_sent_count: contract.otp_sent_count + 1, otp_last_sent_at: now.toISOString(), otp_verified_at: null,
        }).eq("id", contract.id).eq("otp_sent_count", contract.otp_sent_count).select("id");
        if (!claimed?.length) return fail("Réessayez dans un instant", 429);
        const r = await renderCatalogEmail(db, "author_signature_otp", {
          vars: { signer_name: contract.recipient_name || "", contrat_reference: contract.contrat_reference, code },
        });
        const sent = await sendEmail({ to: contract.recipient_email, subject: r.subject, html: r.html + (await getSigniticSignature()), _emailType: "author_signature_otp" } as Db);
        if (!sent.success) return fail("L'envoi du code a échoué. Réessayez dans une minute.", 502);
        const [user, domain] = contract.recipient_email.split("@");
        return json({ sent_to: `${user.slice(0, 2)}***@${domain}` });
      }

      // ── sign ───────────────────────────────────────────────────
      const refusal = otpCheckRefusal(contract, Date.now());
      if (refusal) return fail(refusal);
      const code = String(body.code || "").replace(/\D/g, "");
      if ((await generateHash(`${contract.id}:${code}`)) !== contract.otp_hash) {
        await db.from("distribution_contract_signatures").update({ otp_attempts: contract.otp_attempts + 1 }).eq("id", contract.id);
        return fail("Code incorrect");
      }
      const signatureData = String(body.signatureData || "");
      const signerName = String(body.signerName || "").trim().slice(0, 150);
      if (!signatureData.startsWith("data:image/png;base64,") || signatureData.length > 500_000) return fail("Signature invalide");
      if (!signerName) return fail("Nom du signataire requis");
      if (body.consent !== true) return fail("Le consentement est requis");
      return json(await signContract(db, req, inv, contract, { signatureData, signerName, body }));
    }

    // ── Actions staff ─────────────────────────────────────────────
    const staff = await staffUser(req);
    if (!staff) return fail("Accès refusé", 403);
    const base = await appBase();

    if (action === "invite") {
      const email = String(body.email || "").trim().toLowerCase();
      const first = String(body.first_name || "").trim().slice(0, 100);
      const last = String(body.last_name || "").trim().slice(0, 100);
      const gameName = String(body.game_name || "").trim().slice(0, 150);
      const rate = Number(body.commission_rate ?? 0.15);
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !first || !last || !gameName) return fail("Email, prénom, nom et jeu requis");
      if (!(rate >= 0 && rate <= 1)) return fail("Commission invalide");

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
        title: gameName, author_id: authorId, status: "inactive", onboarding_status: "invited", commission_type: "percentage", commission_rate: rate,
      }).select("id").single();
      if (gErr) throw gErr;
      const token = randomToken();
      const { data: inv, error: iErr } = await db.from("author_onboarding_invitations").insert({
        token_hash: await generateHash(token), author_id: authorId, game_id: g.id, commission_rate: rate,
        recipient_email: email, invited_by: staff.id,
        expires_at: new Date(Date.now() + INVITATION_DAYS * 86_400_000).toISOString(),
      }).select("id").single();
      if (iErr) throw iErr;
      return json({ invitation_id: inv.id, link: publicLink(base, token), ...(await invitationDraft(db, inv.id, publicLink(base, token))) });
    }

    if (action === "new_link") {
      const { data: inv } = await db.from("author_onboarding_invitations").select("*").eq("id", String(body.invitation_id || "")).maybeSingle();
      if (!inv) return fail("Invitation introuvable", 404);
      const token = randomToken();
      const expires = new Date(Date.now() + INVITATION_DAYS * 86_400_000).toISOString();
      await db.from("author_onboarding_invitations").update({ token_hash: await generateHash(token), expires_at: expires, revoked_at: null }).eq("id", inv.id);
      return json({ link: publicLink(base, token), ...(await invitationDraft(db, inv.id, publicLink(base, token))) });
    }

    if (action === "send_invitation") {
      const { data: inv } = await db.from("author_onboarding_invitations").select("*").eq("id", String(body.invitation_id || "")).maybeSingle();
      if (!inv) return fail("Invitation introuvable", 404);
      const link = String(body.link || "");
      const token = link.split("/proposer-mon-jeu/")[1];
      if (!token || (await generateHash(decodeURIComponent(token))) !== inv.token_hash) return fail("Lien d'invitation périmé : générez-en un nouveau");
      const subject = String(body.subject || "").slice(0, 300);
      const content = String(body.content || "").slice(0, 20000);
      if (!subject || !content.includes("{{invitation_button}}")) return fail("Objet et bouton d'invitation requis");
      const r = renderEmailText(subject, content, {}, { invitation_button: ctaButton("Remplir le formulaire", escapeEmailValue(link)) });
      const [sig, bcc] = await Promise.all([getSigniticSignature(), getBccSettings(db)]);
      const sent = await sendEmail({ to: inv.recipient_email, bcc, subject: r.subject, html: r.html + sig, _emailType: "author_invitation" } as Db);
      if (!sent.success) return fail(`Envoi impossible : ${sent.error ?? "erreur inconnue"}`, 502);
      await db.from("author_onboarding_invitations").update({ invitation_sent_at: new Date().toISOString() }).eq("id", inv.id);
      await db.from("activity_logs").insert({ action_type: "author_invitation_sent", recipient_email: inv.recipient_email, user_id: staff.id, details: { invitation_id: inv.id } } as Db);
      return json({ sent: true });
    }

    if (action === "reopen") {
      const { data: inv } = await db.from("author_onboarding_invitations").select("*").eq("id", String(body.invitation_id || "")).maybeSingle();
      if (!inv) return fail("Invitation introuvable", 404);
      const { data: signed } = await db.from("distribution_contract_signatures").select("id").eq("invitation_id", inv.id).eq("status", "signed").limit(1);
      if (signed?.length) return fail("Contrat déjà signé : impossible de rouvrir");
      await db.from("distribution_contract_signatures").update({ status: "cancelled" }).eq("invitation_id", inv.id).eq("status", "pending");
      await db.from("author_onboarding_invitations").update({ submitted_at: null }).eq("id", inv.id);
      await db.from("author_onboarding_responses").update({ submitted_at: null }).eq("invitation_id", inv.id);
      await setStatus(db, inv.author_id, inv.game_id, "form_in_progress");
      return json({ reopened: true });
    }

    if (action === "set_online") {
      const { data: inv } = await db.from("author_onboarding_invitations").select("*").eq("id", String(body.invitation_id || "")).maybeSingle();
      if (!inv) return fail("Invitation introuvable", 404);
      await setStatus(db, inv.author_id, inv.game_id, "online");
      return json({ ok: true });
    }

    if (action === "distributor_signature") {
      const path = await getSetting(db, "distributor_signature_path");
      if (body.dataUrl === undefined) return json({ url: await signedUrl(db, path, 600) });
      const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(body.dataUrl));
      if (!m || m[1].length > 2_000_000) return fail("Image PNG attendue (2 Mo max)");
      const bytes = Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0));
      const newPath = `settings/distributor-signature-${Date.now()}.png`;
      const { error } = await db.storage.from(BUCKET).upload(newPath, bytes, { contentType: "image/png" });
      if (error) return fail("Échec de l'enregistrement", 500);
      await putSetting(db, "distributor_signature_path", newPath);
      return json({ url: await signedUrl(db, newPath, 600) });
    }

    if (action === "retry_contract") {
      const { data: inv } = await db.from("author_onboarding_invitations").select("*").eq("id", String(body.invitation_id || "")).maybeSingle();
      if (!inv?.submitted_at) return fail("Formulaire non soumis");
      if (await pendingContract(db, inv.id)) return fail("Un contrat existe déjà");
      const resp = await loadResponse(db, inv.id);
      await createContract(db, inv, resp.data);
      return json({ ok: true });
    }

    return fail("Action inconnue");
  } catch (e) {
    console.error("author-onboarding", e);
    return fail(e instanceof Error ? e.message : "Erreur inconnue", 500);
  }
});

async function invitationDraft(db: Db, invitationId: string, link: string) {
  const { data: inv } = await db.from("author_onboarding_invitations").select("*, game_authors(first_name), games(title)").eq("id", invitationId).single();
  const d = EDITABLE_EMAIL_DEFAULTS.author_invitation;
  const tpl = await loadEditableTemplate(db, "author_invitation").catch(() => null);
  const vars: Record<string, string> = {
    first_name: inv.game_authors?.first_name ?? "",
    game_name: inv.games?.title ?? "",
    commission: formatCommission(Number(inv.commission_rate)),
    expires_at: frDateParis(new Date(inv.expires_at)),
  };
  const fill = (s: string) => s.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in vars ? vars[k] : m));
  return { subject: fill(tpl?.subject ?? d.subject.vous), content: fill(tpl?.html_content ?? d.content.vous), link, to: inv.recipient_email };
}

async function recopyToRecords(db: Db, inv: Db, f: AuthorForm, files: Db[]) {
  const rep = [f.legal_rep_first_name, f.legal_rep_last_name].filter(Boolean).join(" ");
  await db.from("game_authors").update({
    legal_name: f.legal_name, company: f.legal_name, postal_address: f.postal_address, legal_rep_name: rep,
    siren: f.siren, phone: f.phone,
  }).eq("id", inv.author_id);
  const logo = files.find((x) => x.kind === "logo");
  let logoPath: string | null = null;
  if (logo) {
    const { data } = await db.from("author_onboarding_files").select("storage_path").eq("id", logo.id).single();
    logoPath = data?.storage_path ?? null;
  }
  const loc = !!f.location_enabled;
  await db.from("games").update({
    title: f.game_name, description: f.long_description, pitch: f.pitch, credits: f.credits, video_url: f.video_url,
    proposed_price_ht: f.price_ht, weight_g: f.weight_g, package_dimensions: f.package_dimensions,
    shipping_fee: f.shipping_fee, shipping_delay: f.shipping_delay, logo_url: logoPath,
    secondary_author_email: f.author_email,
    location_enabled: loc,
    ...(loc ? {
      location_duree_jours: f.location_duration_days, location_duree_libelle: `${f.location_duration_days} jours`,
      location_tarif_ht: f.location_price_ht, location_tarif_retard_mois: f.location_late_fee_month,
      location_prix_remplacement: f.location_replacement_price,
    } : {}),
  }).eq("id", inv.game_id);
}

async function createContract(db: Db, inv: Db, form: AuthorForm) {
  const { data: ref, error } = await db.rpc("next_distribution_contract_reference");
  if (error) throw error;
  const distributorSignature = await storageDataUrl(db, await getSetting(db, "distributor_signature_path"));
  const payload = buildContractPayload({ reference: ref, form, commissionRate: Number(inv.commission_rate), date: new Date(), distributorSignature });
  const { bytes, documentId } = await pdfMonkey(payload);
  const path = `contracts/${inv.id}/${ref}.pdf`;
  await db.storage.from(BUCKET).upload(path, bytes, { contentType: "application/pdf", upsert: true });
  const now = new Date().toISOString();
  const { SIGNATURE_DISTRIBUTEUR: _omit, ...storedPayload } = payload;
  await db.from("distribution_contract_signatures").insert({
    invitation_id: inv.id, author_id: inv.author_id, game_id: inv.game_id, contrat_reference: ref,
    recipient_email: form.author_email || inv.recipient_email,
    recipient_name: [form.legal_rep_first_name, form.legal_rep_last_name].filter(Boolean).join(" "),
    game_name: form.game_name, payload: storedPayload, pdf_url: path, pdf_document_id: documentId,
    pdf_hash: await hashArrayBuffer(bytes.buffer), email_sent_at: now,
    expires_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
  });
  await setStatus(db, inv.author_id, inv.game_id, "contract_sent");
}

async function signContract(db: Db, req: Request, inv: Db, c: Db, o: { signatureData: string; signerName: string; body: Db }) {
  const signedAt = new Date();
  const ip = getClientIp(req);
  const signatureHash = await generateHash(o.signatureData);
  const { data: orig } = await db.storage.from(BUCKET).download(c.pdf_url);
  const origBuf = orig ? await orig.arrayBuffer() : null;
  const pdfHashAtSignature = origBuf ? await hashArrayBuffer(origBuf) : null;
  if (c.pdf_hash && pdfHashAtSignature && c.pdf_hash !== pdfHashAtSignature) throw new Error("Intégrité du contrat non vérifiable");

  // Verrou : une seule signature.
  const { data: claimed } = await db.from("distribution_contract_signatures").update({
    status: "signed", signed_at: signedAt.toISOString(), signature_data: o.signatureData, ip_address: ip,
    user_agent: String(o.body.userAgent || "").slice(0, 500), otp_verified_at: signedAt.toISOString(), otp_hash: null,
  }).eq("id", c.id).eq("status", "pending").select("id");
  if (!claimed?.length) throw new Error("Ce contrat a déjà été signé");

  // PDF signé : régénéré avec les deux signatures ; repli sur l'apposition si PDFMonkey échoue.
  let signedBytes: Uint8Array | null = null;
  const resp = await loadResponse(db, inv.id);
  try {
    const payload = buildContractPayload({
      reference: c.contrat_reference, form: resp.data, commissionRate: Number(inv.commission_rate), date: new Date(c.created_at),
      distributorSignature: await storageDataUrl(db, await getSetting(db, "distributor_signature_path")),
      supplierSignature: o.signatureData, supplierSignedAt: signedAt,
    });
    signedBytes = (await pdfMonkey(payload)).bytes;
  } catch (e) {
    console.warn("signed PDF via PDFMonkey failed, overlay fallback", e);
    if (origBuf) {
      signedBytes = await generateSignedPdf({
        pdfBuffer: origBuf, signatureDataUrl: o.signatureData, signerName: o.signerName, signedAt: signedAt.toISOString(),
        documentType: "Contrat de distribution", documentTitle: `${c.game_name} — ${c.contrat_reference}`, clientName: o.signerName,
        signatureHash, ipAddress: ip, journeyEvents: [], pdfHashAtSignature,
      } as Db);
    }
  }
  const signedPath = signedBytes ? `contracts/${inv.id}/${c.contrat_reference}-signe.pdf` : null;
  if (signedBytes && signedPath) await db.storage.from(BUCKET).upload(signedPath, signedBytes, { contentType: "application/pdf", upsert: true });
  const signedPdfHash = signedBytes ? await hashArrayBuffer(signedBytes.buffer as ArrayBuffer) : null;

  const journey = buildJourneyEvents(o.body.journeyEvents, signedAt.toISOString(), { ip_address: ip, otp_verified: true });
  const consentText = "En signant ce contrat de distribution, j'en accepte les conditions et reconnais que cette signature électronique a valeur légale (règlement eIDAS UE n° 910/2014, articles 1366 et 1367 du Code civil).";
  const proof = {
    version: "1.0", type: "distribution_contract_signature_proof", generated_at: new Date().toISOString(),
    signature: { id: c.id, signed_at: signedAt.toISOString(), signer_name: o.signerName, ip_address: ip, user_agent: o.body.userAgent ?? null, signature_image_hash: signatureHash },
    document: { type: "contrat_de_distribution", contrat_reference: c.contrat_reference, game_name: c.game_name, pdf_hash_at_creation: c.pdf_hash, pdf_hash_at_signature: pdfHashAtSignature, signed_pdf_hash: signedPdfHash },
    identification: {
      method: "email_otp", email: c.recipient_email, otp_sent_count: c.otp_sent_count, otp_last_sent_at: c.otp_last_sent_at,
      otp_verified_at: signedAt.toISOString(), otp_attempts_before_success: c.otp_attempts, invitation_opened_at: inv.opened_at,
    },
    consent: { given: true, timestamp: signedAt.toISOString(), text: consentText },
    device: o.body.deviceInfo ?? {}, journey_timeline: journey, legal: { ...LEGAL_BLOCK, signature_level: "SES renforcée par code à usage unique" },
  };
  const proofBytes = new TextEncoder().encode(JSON.stringify(proof, null, 2));
  const proofPath = `contracts/${inv.id}/${c.contrat_reference}-preuve.json`;
  await db.storage.from(BUCKET).upload(proofPath, proofBytes, { contentType: "application/json", upsert: true });
  await db.from("distribution_contract_signatures").update({
    signed_pdf_url: signedPath, signed_pdf_hash: signedPdfHash, proof_file_url: proofPath, proof_hash: await hashArrayBuffer(proofBytes.buffer),
    journey_events: journey, audit_metadata: { consent_text: consentText, signer_name: o.signerName, signature_hash: signatureHash, pdf_hash_at_signature: pdfHashAtSignature },
  }).eq("id", c.id);
  await setStatus(db, inv.author_id, inv.game_id, "signed");
  await db.from("game_authors").update({ royalty_rate: inv.commission_rate }).eq("id", inv.author_id);

  // Copie signée aux deux parties (seul envoi automatique hors code et relances).
  try {
    const { data: inviter } = inv.invited_by
      ? await db.from("profiles").select("email").eq("id", inv.invited_by).maybeSingle() : { data: null };
    const ownerEmail = inviter?.email || await getSenderEmail();
    const attachments = signedBytes ? [{ filename: `${c.contrat_reference}-signe.pdf`, content: btoa(Array.from(signedBytes, (b) => String.fromCharCode(b)).join("")) }] : undefined;
    const link = await signedUrl(db, signedPath ?? c.pdf_url, 7 * 86_400);
    const r = await renderCatalogEmail(db, "author_contract_signed", {
      vars: { signer_name: o.signerName, game_name: c.game_name ?? "", contrat_reference: c.contrat_reference },
      blocks: {
        details_list: `<ul><li><strong>Jeu :</strong> ${escapeEmailValue(c.game_name)}</li><li><strong>Référence :</strong> ${escapeEmailValue(c.contrat_reference)}</li><li><strong>Signé le :</strong> ${frDateParis(signedAt)}</li></ul>`,
        download_button: link ? ctaButton("Télécharger le contrat signé", escapeEmailValue(link)) : "",
      },
    });
    const sig = await getSigniticSignature();
    const res = await sendEmail({ to: [c.recipient_email, ownerEmail], subject: r.subject, html: r.html + sig, attachments, _emailType: "author_contract_signed", idempotencyKey: `author-contract-signed-${c.id}` } as Db);
    if (res.success) await db.from("distribution_contract_signatures").update({ confirmation_email_sent_at: new Date().toISOString() }).eq("id", c.id);
  } catch (e) { console.warn("signed copy email failed", e); }

  // Action datée pour la fiche produit.
  try {
    const { data: target } = await db.from("profiles").select("id").eq("email", PRODUCT_SHEET_EMAIL).maybeSingle();
    const userId = target?.id ?? inv.invited_by;
    if (userId) {
      const { data: existing } = await db.from("daily_actions").select("id").eq("entity_type", "author_onboarding").eq("entity_id", inv.id).eq("category", "dropshipping_fiche_produit").limit(1);
      if (!existing?.length) {
        await db.from("daily_actions").insert({
          user_id: userId, category: "dropshipping_fiche_produit", action_date: new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Paris" }).format(signedAt),
          title: `Créer la fiche produit WooCommerce de ${c.game_name}`,
          description: `Contrat ${c.contrat_reference} signé. Réponses du formulaire et médias téléchargeables sur la fiche.`,
          link: `/dropshipping/auteurs/${inv.id}`, entity_type: "author_onboarding", entity_id: inv.id,
        });
      }
    }
  } catch (e) { console.warn("daily action failed", e); }

  return { signed: true, signed_at: signedAt.toISOString(), download_url: await signedUrl(db, signedPath ?? c.pdf_url, 3600) };
}
