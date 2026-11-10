import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { PDFDocument, rgb, StandardFonts } from "https://esm.sh/pdf-lib@1.17.1";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { generateHash, hashArrayBuffer, getClientIp } from "../_shared/crypto.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { generateSignedPdf } from "../_shared/generate-signed-pdf.ts";
import { buildJourneyEvents, type JourneyEvent, type DeviceInfo } from "../_shared/signature-helpers.ts";
import { sendEmail } from "../_shared/resend.ts";
import { wrapEmailHtml } from "../_shared/templates.ts";
import { getSigniticSignature } from "../_shared/signitic.ts";
import { getBccSettings } from "../_shared/bcc-settings.ts";
import { formatDateTime } from "../_shared/date-utils.ts";
import { attestationSections, canonicalContent, effectiveStatus, type AttestationContent } from "../_shared/execution-attestation.ts";

const INTERNAL_RECIPIENT = "romain@supertilt.fr";
const CONSENT_TEXT = "Je certifie l'exactitude des informations de cette attestation et j'accepte de la signer électroniquement (règlement eIDAS UE n° 910/2014, articles 1366 et 1367 du Code civil).";
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

// Polices standard PDF : seuls les caractères WinAnsi sont imprimables.
const clean = (s: string) => s.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[\u2013\u2014]/g, "-").replace(/[\u00a0\u202f]/g, " ").replace(/[^\x09\x0a\x0d\x20-\x7e\u00a0-\u00ff\u20ac\u0152\u0153]/g, "");

async function buildAttestationPdf(a: AttestationContent, signer: { name: string; fn: string | null }): Promise<ArrayBuffer> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const yellow = rgb(0.902, 0.737, 0), dark = rgb(0.1, 0.1, 0.1), grey = rgb(0.35, 0.35, 0.35);
  let page = doc.addPage([595, 842]);
  const left = 56, width = 595 - 112;
  page.drawRectangle({ x: 0, y: 812, width: 595, height: 30, color: yellow });
  page.drawText("SuperTilt", { x: left, y: 821, size: 13, font: bold, color: dark });
  let y = 770;
  page.drawText(clean("Attestation de bonne exécution"), { x: left, y, size: 20, font: bold, color: dark });
  y -= 34;
  const wrap = (text: string, f: typeof font, size: number) => {
    const out: string[] = [];
    for (const para of clean(text).split("\n")) {
      let line = "";
      for (const w of para.split(" ")) {
        const next = line ? `${line} ${w}` : w;
        if (f.widthOfTextAtSize(next, size) > width && line) { out.push(line); line = w; } else line = next;
      }
      out.push(line);
    }
    return out;
  };
  const ensure = (h: number) => { if (y - h < 60) { page = doc.addPage([595, 842]); y = 790; } };
  for (const s of attestationSections(a, signer)) {
    ensure(40);
    page.drawRectangle({ x: left, y: y - 3, width: 3, height: 14, color: yellow });
    page.drawText(clean(s.title), { x: left + 10, y, size: 12, font: bold, color: dark });
    y -= 18;
    for (const l of s.lines) for (const w of wrap(l, font, 10.5)) { ensure(16); page.drawText(w, { x: left + 10, y, size: 10.5, font, color: grey }); y -= 14.5; }
    y -= 10;
  }
  ensure(40);
  page.drawText(clean(`Signé par ${signer.name}${signer.fn ? `, ${signer.fn}` : ""}${a.is_public_entity && a.public_entity_name ? ` (${a.public_entity_name})` : ""}`), { x: left, y, size: 10.5, font: bold, color: dark });
  y -= 14;
  page.drawText(clean("Signature électronique et page de preuve en annexe."), { x: left, y, size: 9, font, color: grey });
  const bytes = await doc.save();
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

const esc = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

serve(async (req) => {
  const pre = handleCorsPreflightIfNeeded(req);
  if (pre) return pre;
  try {
    const body = await req.json().catch(() => ({}));
    const { token, signatureData, consent, userAgent } = body as Record<string, unknown>;
    const signerName = String(body.signerName ?? "").trim().slice(0, 200);
    const signerFunction = String(body.signerFunction ?? "").trim().slice(0, 200) || null;
    if (typeof token !== "string" || !/^[0-9a-f]{64}$/.test(token)) return json({ error: "Lien invalide" }, 404);
    if (typeof signatureData !== "string" || !signatureData.startsWith("data:image/png;base64,") || signatureData.length > 2_000_000) return json({ error: "Signature requise" }, 400);
    if (!signerName) return json({ error: "Nom du signataire requis" }, 400);
    if (consent !== true) return json({ error: "Le consentement est requis" }, 400);

    const supabase = getSupabaseClient();
    const ip = getClientIp(req);
    const { data: allowed } = await supabase.rpc("check_formulaire_rate_limit", { p_ip_address: `attestation:${ip}`, p_max_requests: 40, p_window_seconds: 600 });
    if (allowed === false) return json({ error: "Trop de tentatives, réessayez plus tard" }, 429);

    const { data: a } = await supabase.from("execution_attestations").select("*").eq("token_hash", await generateHash(token)).maybeSingle();
    if (!a) return json({ error: "Lien invalide" }, 404);
    const status = effectiveStatus(a);
    if (status !== "sent") return json({ error: status === "signed" ? "Cette attestation a déjà été signée" : status === "expired" ? "Ce lien a expiré" : "Ce lien n'est plus valide" }, 400);
    if (a.is_public_entity && !signerFunction) return json({ error: "Fonction du signataire requise" }, 400);

    const signedAt = new Date().toISOString();
    const signer = { name: signerName, fn: signerFunction };
    const contentHash = await generateHash(canonicalContent(a, signer));
    const signatureHash = await generateHash(signatureData);
    const events = buildJourneyEvents([...(a.journey_events ?? []), ...((body.journeyEvents as JourneyEvent[]) ?? []).slice(0, 100)], signedAt, { ip_address: ip, content_hash: contentHash });

    // Verrou : un seul passage de "sent" à "signed".
    const { data: locked } = await supabase.from("execution_attestations").update({
      status: "signed", signed_at: signedAt, signed_signer_name: signerName, signed_signer_function: signerFunction,
      signature_image: signatureData, ip_address: ip, user_agent: String(userAgent ?? "").slice(0, 500),
      device_info: (body.deviceInfo as DeviceInfo) ?? {}, journey_events: events, content_hash: contentHash, token_hash: null,
    }).eq("id", a.id).eq("status", "sent").select("id").maybeSingle();
    if (!locked) return json({ error: "Cette attestation a déjà été signée" }, 409);

    const pdfBuffer = await buildAttestationPdf(a, signer);
    const pdf = await generateSignedPdf({
      pdfBuffer, signatureDataUrl: signatureData, signerName, signerFunction: signerFunction ?? undefined, signedAt,
      documentType: "Attestation de bonne exécution", documentTitle: a.subject ?? "", clientName: a.public_entity_name || a.client_name || signerName,
      signatureHash, ipAddress: ip, journeyEvents: events, pdfHashAtSignature: contentHash,
    });
    const path = `${a.id}/attestation-signee.pdf`;
    const { error: upErr } = await supabase.storage.from("attestations").upload(path, pdf, { contentType: "application/pdf", upsert: true });
    if (upErr) console.error("upload signed attestation", upErr);
    const pdfHash = await hashArrayBuffer(pdf.buffer.slice(pdf.byteOffset, pdf.byteOffset + pdf.byteLength) as ArrayBuffer);
    await supabase.from("execution_attestations").update({ signed_pdf_path: upErr ? null : path, signed_pdf_hash: pdfHash }).eq("id", a.id);

    // Seul email automatique : confirmation après signature, à Romain avec copie au signataire.
    try {
      const [sig, bcc] = await Promise.all([getSigniticSignature(), getBccSettings(supabase)]);
      const who = `${esc(signerName)}${signerFunction ? `, ${esc(signerFunction)}` : ""}`;
      const html = `<p>Bonjour,</p><p>L'attestation de bonne exécution « ${esc(a.subject ?? "")} » a été signée par ${who}${a.public_entity_name ? ` (${esc(a.public_entity_name)})` : ` pour ${esc(a.client_name ?? "")}`} le ${esc(formatDateTime(signedAt))}.</p><p>Vous trouverez le document signé en pièce jointe.</p>`;
      let b64 = ""; for (let i = 0; i < pdf.length; i += 0x8000) b64 += String.fromCharCode(...pdf.subarray(i, i + 0x8000));
      const result = await sendEmail({
        to: INTERNAL_RECIPIENT,
        cc: a.signer_email ? [a.signer_email] : undefined,
        bcc: bcc.filter((x: string) => x !== INTERNAL_RECIPIENT),
        subject: `Attestation de bonne exécution signée : ${a.subject ?? ""}`,
        html: wrapEmailHtml(html, sig),
        attachments: [{ filename: "attestation-bonne-execution-signee.pdf", content: btoa(b64) }],
        idempotencyKey: `attestation-signed-${a.id}`,
        _emailType: "execution_attestation_signed",
      });
      if ((result as { success?: boolean }).success) await supabase.from("execution_attestations").update({ email_sent_at: new Date().toISOString() }).eq("id", a.id);
    } catch (e) { console.error("attestation email", e); }

    return json({ success: true, signedAt });
  } catch (e) {
    console.error(e);
    return json({ error: "Erreur inattendue" }, 500);
  }
});
