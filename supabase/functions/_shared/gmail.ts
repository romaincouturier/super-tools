/**
 * Lecture Gmail (boîte de romain@supertilt.fr) via le connecteur Lovable.
 * Lecture seule : message, en-têtes, pièces jointes.
 */

const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

async function gmailGet(path: string): Promise<Record<string, unknown>> {
  const lovableKey = Deno.env.get("LOVABLE_API_KEY");
  const gmailKey = Deno.env.get("GOOGLE_MAIL_API_KEY");
  if (!lovableKey || !gmailKey) throw new Error("Connexion Gmail non configurée (GOOGLE_MAIL_API_KEY)");
  const res = await fetch(`${GATEWAY_URL}${path}`, {
    headers: { Authorization: `Bearer ${lovableKey}`, "X-Connection-Api-Key": gmailKey },
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Gmail [${res.status}]: ${text.slice(0, 500)}`);
  return JSON.parse(text);
}

export function base64UrlToBytes(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const bin = atob(b64 + "=".repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

interface GmailPart {
  partId?: string;
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { attachmentId?: string; data?: string; size?: number };
  parts?: GmailPart[];
}

export interface GmailAttachment {
  fileName: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface GmailMessage {
  id: string;
  threadId: string;
  subject: string;
  from: string;
  to: string;
  date: string;
  snippet: string;
  raw: Uint8Array;
  attachments: GmailAttachment[];
}

function collectAttachmentParts(part: GmailPart, acc: GmailPart[]) {
  if (part.filename && part.body?.attachmentId) acc.push(part);
  for (const p of part.parts || []) collectAttachmentParts(p, acc);
}

/** Accepte un id Gmail ou un Message-ID RFC 822 (<...@...>). */
async function resolveMessageId(messageId: string): Promise<string> {
  const id = messageId.trim();
  if (/^[0-9a-f]{10,24}$/i.test(id)) return id;
  const rfc = id.replace(/^<|>$/g, "");
  const list = await gmailGet(`/users/me/messages?maxResults=1&q=${encodeURIComponent(`rfc822msgid:${rfc}`)}`);
  const found = (list.messages as Array<{ id: string }> | undefined)?.[0]?.id;
  if (!found) throw new Error(`Aucun mail Gmail trouvé pour ${messageId}`);
  return found;
}

export async function fetchGmailMessage(messageId: string, maxBytesPerFile: number): Promise<GmailMessage> {
  const id = await resolveMessageId(messageId);
  const full = await gmailGet(`/users/me/messages/${id}?format=full`);
  const payload = (full.payload || {}) as GmailPart;
  const header = (n: string) =>
    payload.headers?.find((h) => h.name.toLowerCase() === n.toLowerCase())?.value || "";

  const rawResp = await gmailGet(`/users/me/messages/${id}?format=raw`);
  const raw = base64UrlToBytes(String(rawResp.raw || ""));

  const parts: GmailPart[] = [];
  collectAttachmentParts(payload, parts);
  const attachments: GmailAttachment[] = [];
  for (const p of parts) {
    if ((p.body?.size || 0) > maxBytesPerFile) {
      throw new Error(`Pièce jointe trop lourde : ${p.filename} (${p.body?.size} octets)`);
    }
    const att = await gmailGet(`/users/me/messages/${id}/attachments/${p.body!.attachmentId}`);
    attachments.push({
      fileName: p.filename!,
      mimeType: p.mimeType || "application/octet-stream",
      bytes: base64UrlToBytes(String(att.data || "")),
    });
  }

  return {
    id,
    threadId: String(full.threadId || ""),
    subject: header("Subject"),
    from: header("From"),
    to: header("To"),
    date: header("Date"),
    snippet: String(full.snippet || ""),
    raw,
    attachments,
  };
}
