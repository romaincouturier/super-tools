/**
 * Google Drive helper — token refresh + file operations.
 * Used by poll-drive-transcripts and poll-drive-testimonials.
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID")!;
const GOOGLE_OAUTH_CLIENT_SECRET = Deno.env.get("GOOGLE_OAUTH_CLIENT_SECRET")!;

export interface DriveFile {
  id: string;
  name: string;
  mimeType: string;
  modifiedTime: string;
  size?: string;
}

export interface DriveListResult {
  files: DriveFile[];
  nextPageToken?: string;
}

export function getModifiedAfterWithLookback(lastSyncedAt?: string, lookbackHours = 24): string {
  const base = lastSyncedAt ? new Date(lastSyncedAt).getTime() : 0;
  if (!Number.isFinite(base) || base <= 0) return new Date(0).toISOString();
  return new Date(base - lookbackHours * 60 * 60 * 1000).toISOString();
}

/** Verify that the connected Google account can access a Drive folder. */
export async function assertDriveFolderAccessible(
  folderId: string,
  accessToken: string,
): Promise<void> {
  const params = new URLSearchParams({
    fields: "id,name,mimeType,trashed",
    supportsAllDrives: "true",
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files/${folderId}?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!res.ok) {
    const details = await res.text();
    throw new Error(`Dossier Google Drive inaccessible (${res.status}). Reconnectez Google Drive avec les nouveaux droits ou partagez le dossier avec le compte connecté. ${details}`);
  }

  const folder = await res.json();
  if (folder.trashed) throw new Error("Le dossier Google Drive configuré est dans la corbeille.");
  if (folder.mimeType !== "application/vnd.google-apps.folder") {
    throw new Error("L'identifiant Google Drive configuré ne correspond pas à un dossier.");
  }
}

/** Returns a valid access token (auto-refreshes if expired). Null if no token stored. */
export async function getValidDriveAccessToken(
  admin: ReturnType<typeof createClient>,
): Promise<string | null> {
  const { data: token } = await (admin as any)
    .from("google_drive_tokens")
    .select("id, access_token, refresh_token, token_expires_at")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!token) return null;

  const expiresAt = new Date(token.token_expires_at).getTime();
  const bufferMs = 5 * 60 * 1000;

  if (Date.now() + bufferMs < expiresAt) {
    return token.access_token as string;
  }

  // Refresh
  const refreshRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: GOOGLE_OAUTH_CLIENT_ID,
      client_secret: GOOGLE_OAUTH_CLIENT_SECRET,
      refresh_token: token.refresh_token as string,
      grant_type: "refresh_token",
    }),
  });

  if (!refreshRes.ok) {
    console.error("Drive token refresh failed:", await refreshRes.text());
    return null;
  }

  const refreshData = await refreshRes.json();
  const newExpiresAt = new Date(Date.now() + refreshData.expires_in * 1000).toISOString();

  await (admin as any)
    .from("google_drive_tokens")
    .update({ access_token: refreshData.access_token, token_expires_at: newExpiresAt })
    .eq("id", token.id);

  return refreshData.access_token as string;
}

/** List files in a Drive folder, optionally filtering by mimeType prefix and modifiedTime. */
export async function listDriveFolder(
  folderId: string,
  accessToken: string,
  options: { modifiedAfter?: string; pageToken?: string; mimeTypePrefix?: string } = {},
): Promise<DriveListResult> {
  const queries = [`'${folderId}' in parents`, "trashed = false"];
  if (options.mimeTypePrefix) queries.push(`mimeType contains '${options.mimeTypePrefix}'`);
  if (options.modifiedAfter) queries.push(`modifiedTime > '${options.modifiedAfter}'`);

  const params = new URLSearchParams({
    q: queries.join(" and "),
    fields: "nextPageToken,files(id,name,mimeType,modifiedTime,size)",
    orderBy: "modifiedTime asc",
    pageSize: "100",
    supportsAllDrives: "true",
    includeItemsFromAllDrives: "true",
  });
  if (options.pageToken) params.set("pageToken", options.pageToken);

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) throw new Error(`Drive list error ${res.status}: ${await res.text()}`);
  return res.json() as Promise<DriveListResult>;
}

/** Download file bytes from Drive. */
export async function downloadDriveFileBytes(
  fileId: string,
  accessToken: string,
): Promise<Uint8Array> {
  const res = await fetch(
    `https://www.googleapis.com/drive/v3/files/${fileId}?alt=media`,
    { headers: { Authorization: `Bearer ${accessToken}` } },
  );
  if (!res.ok) throw new Error(`Drive download error ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
}

/** Upload bytes to AssemblyAI and return the upload_url. */
export async function uploadToAssemblyAI(
  bytes: Uint8Array,
  apiKey: string,
): Promise<string> {
  const res = await fetch("https://api.assemblyai.com/v2/upload", {
    method: "POST",
    headers: {
      Authorization: apiKey,
      "Content-Type": "application/octet-stream",
    },
    body: bytes,
  });
  if (!res.ok) throw new Error(`AssemblyAI upload error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.upload_url as string;
}

/** Submit a transcription job to AssemblyAI. Returns the job id.
 * Optionally configures a webhook so AssemblyAI notifies us as soon as the job completes.
 */
export async function submitAssemblyAIJob(
  uploadUrl: string,
  apiKey: string,
  webhook?: { url: string; authHeaderName: string; authHeaderValue: string },
): Promise<string> {
  const payload: Record<string, unknown> = {
    audio_url: uploadUrl,
    language_detection: true,
    language_confidence_threshold: 0.5,
    punctuate: true,
    format_text: true,
    speaker_labels: true,
  };
  if (webhook?.url && webhook.authHeaderValue) {
    payload.webhook_url = webhook.url;
    payload.webhook_auth_header_name = webhook.authHeaderName;
    payload.webhook_auth_header_value = webhook.authHeaderValue;
  }
  const res = await fetch("https://api.assemblyai.com/v2/transcript", {
    method: "POST",
    headers: { Authorization: apiKey, "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`AssemblyAI submit error ${res.status}: ${await res.text()}`);
  const data = await res.json();
  return data.id as string;
}

/** Poll AssemblyAI for a completed transcript. Returns null if still processing. */
export async function pollAssemblyAIJob(
  jobId: string,
  apiKey: string,
): Promise<{ text: string; duration: number } | null | "error"> {
  const res = await fetch(`https://api.assemblyai.com/v2/transcript/${jobId}`, {
    headers: { Authorization: apiKey },
  });
  if (!res.ok) return "error";
  const result = await res.json();

  if (result.status === "completed") {
    let text = result.text as string;
    if (result.utterances?.length > 1) {
      const speakers = new Set(result.utterances.map((u: { speaker: string }) => u.speaker));
      if ((speakers as Set<string>).size > 1) {
        text = (result.utterances as Array<{ speaker: string; text: string }>)
          .map((u) => `Speaker ${u.speaker}: ${u.text}`)
          .join("\n\n");
      }
    }
    return { text, duration: Math.round((result.audio_duration ?? 0)) };
  }
  if (result.status === "error") return "error";
  return null; // still queued/processing
}

/** Send a Slack notification via Lovable connector gateway. Fire and forget. */
export async function notifySlack(text: string, channel: string): Promise<void> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const SLACK_API_KEY = Deno.env.get("SLACK_API_KEY");
  if (!LOVABLE_API_KEY || !SLACK_API_KEY) return;

  await fetch("https://connector-gateway.lovable.dev/slack/api/chat.postMessage", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "X-Connection-Api-Key": SLACK_API_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ channel, text }),
  }).catch((err) => console.error("Slack notify error:", err));
}

/** Analyze transcript text with Claude (tags + summary). */
export async function analyzeTranscript(
  text: string,
): Promise<{ summary: string; tags: string[] }> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return { summary: "", tags: [] };

  const prompt = `Analyse ce transcript et retourne UNIQUEMENT un JSON valide avec exactement ces deux champs :
- "summary": résumé en 2-3 phrases
- "tags": tableau de 3-5 tags pertinents (minuscules, underscores, pas d'espaces)

Transcript :
${text.slice(0, 4000)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 512,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch ? JSON.parse(jsonMatch[0]) : { summary: "", tags: [] };
  } catch {
    return { summary: "", tags: [] };
  }
}

/** Extract testimonial metadata from transcript using Claude. */
export async function extractTestimonialMeta(
  text: string,
): Promise<{ client_name: string; company: string; service_type: string }> {
  const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
  if (!ANTHROPIC_API_KEY) return { client_name: "", company: "", service_type: "" };

  const prompt = `Ce texte est la transcription d'une vidéo de témoignage client. Extrais les informations suivantes et retourne UNIQUEMENT un JSON valide :
- "client_name": prénom et nom du client (chaîne vide si non trouvé)
- "company": nom de l'entreprise du client (chaîne vide si non trouvé)
- "service_type": type de prestation ou formation mentionné (chaîne vide si non trouvé)

Transcription :
${text.slice(0, 4000)}`;

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 256,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const data = await res.json();
    const raw = data.content?.[0]?.text ?? "{}";
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    return jsonMatch
      ? JSON.parse(jsonMatch[0])
      : { client_name: "", company: "", service_type: "" };
  } catch {
    return { client_name: "", company: "", service_type: "" };
  }
}
