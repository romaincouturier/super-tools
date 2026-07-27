import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  getSupabaseClient,
  corsHeaders,
} from "../_shared/mod.ts";
import { searchContent } from "../_shared/agent-search.ts";
import { extractDocument } from "../_shared/document-extract.ts";

/**
 * Serveur MCP SuperTools — lecture seule, mono-utilisateur.
 *
 * Expose des tools en lecture seule à Claude (claude.ai / Claude Desktop
 * via connecteur custom) :
 *   - query_database      : SQL SELECT via agent_sql_query (allowlist + audit)
 *   - search_content      : recherche hybride dans les contenus indexés
 *   - list_schema         : tables requêtables
 *   - get_mission_dossier : mission + pages + activités + documents + galerie
 *   - get_client_dossier  : tout ce qui touche un client, par nom
 *   - read_media_image    : une photo de galerie en bloc image (base64)
 *   - read_document       : contenu réel d'un document (PDF texte ou scanné,
 *                           Word, Excel, texte, image)
 *   - save_mission_note   : SEULE écriture — crée/met à jour une page de
 *                           mission pour capitaliser un travail (transcription,
 *                           synthèse) hors de la conversation
 *
 * Sécurité :
 *   - OAuth 2.1 (PKCE S256, dynamic client registration) requis par claude.ai
 *   - L'écran d'autorisation demande une clé personnelle (MCP_PERSONAL_SECRET,
 *     secret d'edge function — jamais dans le repo)
 *   - Chaque requête MCP est liée à ALLOWED_EMAIL : liste blanche d'un seul
 *     utilisateur, codée en dur, vérifiée à chaque appel
 *   - Écriture limitée à save_mission_note : création/mise à jour d'une page
 *     de mission uniquement. Aucune suppression, aucune autre table, aucun
 *     autre tool d'action ; agent_sql_query reste SELECT-only
 *   - Rate limiting sur les tentatives de clé (5 échecs / 15 min)
 *   - Toutes les requêtes SQL sont journalisées (agent_query_audit_log)
 */

const ALLOWED_EMAIL = "romain@supertilt.fr";
const ACCESS_TOKEN_TTL_S = 30 * 24 * 3600; // 30 jours
const REFRESH_TOKEN_TTL_S = 60 * 24 * 3600; // 60 jours
const CODE_TTL_S = 600; // 10 minutes
const MAX_AUTH_FAILS = 5;
const AUTH_FAIL_WINDOW_MIN = 15;
// Domaines de callback officiels Claude acceptés sans enregistrement
// préalable (repli quand la dynamic client registration échoue côté
// claude.ai). Tout chemin est accepté sur ces hôtes exacts, en https.
const ALLOWED_IMPLICIT_REDIRECT_HOSTS = ["claude.ai", "claude.com"];

function isAllowedImplicitRedirect(redirectUri: string): boolean {
  try {
    const u = new URL(redirectUri);
    return u.protocol === "https:" && ALLOWED_IMPLICIT_REDIRECT_HOSTS.includes(u.hostname);
  } catch {
    return false;
  }
}
const SUPPORTED_PROTOCOL_VERSIONS = ["2025-06-18", "2025-03-26"];

// ── Helpers ─────────────────────────────────────────────────

function json(body: unknown, status = 200, extraHeaders: Record<string, string> = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
      // Les métadonnées OAuth et réponses de tokens ne doivent jamais être
      // mises en cache (une version http:// cachée a déjà fait perdre 3 essais)
      "Cache-Control": "no-store",
      ...extraHeaders,
    },
  });
}

function html(body: string, status = 200): Response {
  return new Response(body, {
    status,
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}

function base64url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function randomToken(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64url(bytes);
}

async function sha256Hex(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function sha256Base64url(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return base64url(new Uint8Array(buf));
}

// ── OAuth storage (mcp_oauth_records) ───────────────────────

type Supabase = ReturnType<typeof getSupabaseClient>;

async function insertRecord(
  supabase: Supabase,
  kind: string,
  data: Record<string, unknown>,
  opts: { tokenHash?: string; ttlSeconds?: number } = {},
): Promise<void> {
  await supabase.from("mcp_oauth_records").insert({
    kind,
    token_hash: opts.tokenHash ?? null,
    data,
    expires_at: opts.ttlSeconds ? new Date(Date.now() + opts.ttlSeconds * 1000).toISOString() : null,
  });
}

async function findByHash(
  supabase: Supabase,
  kind: string,
  tokenHash: string,
): Promise<{ id: string; data: Record<string, unknown> } | null> {
  const { data } = await supabase
    .from("mcp_oauth_records")
    .select("id, data, expires_at")
    .eq("kind", kind)
    .eq("token_hash", tokenHash)
    .maybeSingle();
  if (!data) return null;
  if (data.expires_at && new Date(data.expires_at as string) < new Date()) return null;
  return { id: data.id as string, data: data.data as Record<string, unknown> };
}

async function deleteRecord(supabase: Supabase, id: string): Promise<void> {
  await supabase.from("mcp_oauth_records").delete().eq("id", id);
}

function cleanupExpired(supabase: Supabase): void {
  supabase
    .from("mcp_oauth_records")
    .delete()
    .lt("expires_at", new Date().toISOString())
    .then(() => {}, () => {});
}

// ── Identité pour l'audit SQL ────────────────────────────────

let _allowedUserId: string | null = null;

async function getAllowedUserId(supabase: Supabase): Promise<string | null> {
  if (_allowedUserId) return _allowedUserId;
  const { data } = await supabase
    .from("profiles")
    .select("user_id")
    .eq("email", ALLOWED_EMAIL)
    .maybeSingle();
  _allowedUserId = (data as { user_id?: string } | null)?.user_id ?? null;
  return _allowedUserId;
}

// ── MCP tools ────────────────────────────────────────────────

const MCP_TOOLS = [
  {
    name: "query_database",
    description:
      "Execute a read-only SQL query (SELECT only) on the SuperTools database (organisme de formation : CRM, formations, participants, évaluations, devis, missions, transcripts, témoignages, dropshipping, support). Limited to an allowlist of tables, 100 rows max. Use tables/list first if unsure of the schema.",
    inputSchema: {
      type: "object",
      properties: {
        sql: { type: "string", description: "The SELECT SQL query (PostgreSQL syntax)" },
        explanation: { type: "string", description: "Brief explanation of the query (for the audit log)" },
      },
      required: ["sql"],
    },
  },
  {
    name: "search_content",
    description:
      "Semantic + keyword search across all indexed SuperTools content (CRM notes, emails, quotes, training descriptions, meeting transcripts, testimonials, support tickets...). Use for questions about meaning or context rather than exact values.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Natural language search query" },
        source_types: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional filter: crm_card, crm_comment, crm_email, inbound_email, training, mission, mission_page, mission_activity, quote, support_ticket, coaching_summary, content_card, lms_lesson, activity_log, evaluation_analysis, questionnaire_besoins, okr_objective, okr_key_result, okr_initiative, crm_attachment, support_attachment, transcript, testimonial",
        },
        max_results: { type: "number", description: "Number of results (default 10, max 20)" },
        mission_id: {
          type: "string",
          description:
            "Optional: restrict the search to one mission (UUID). Without it, results can come from other clients' missions.",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "list_schema",
    description:
      "Return the list of queryable tables with their columns and descriptions. Call this before writing SQL if unsure of the schema.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "get_mission_dossier",
    description:
      "Return the complete dossier of a mission: mission record, all its pages (full content), activities, and attached documents (name, type, URL). Use this to load the full working context of a mission in one call instead of multiple SQL queries.",
    inputSchema: {
      type: "object",
      properties: {
        mission: {
          type: "string",
          description: "Mission title (partial match, case-insensitive) or mission UUID",
        },
      },
      required: ["mission"],
    },
  },
  {
    name: "get_client_dossier",
    description:
      "Return everything related to a client across SuperTools: missions, trainings, quotes, CRM cards with recent comments, and meeting transcripts mentioning the client. Matching is done by name (partial, case-insensitive). Use this to load the full client context in one call.",
    inputSchema: {
      type: "object",
      properties: {
        client: { type: "string", description: "Client or organization name (partial match)" },
      },
      required: ["client"],
    },
  },
  {
    name: "read_document",
    description:
      "Read the actual content of a document attached to a mission, a CRM card or a support ticket (PDF, Word, Excel, text, image). Text-based PDFs are returned as text; scanned PDFs are returned as page images to read visually; spreadsheets are converted to CSV. Pass the document id from get_mission_dossier's documents list or from the mission_documents / crm_attachments tables.",
    inputSchema: {
      type: "object",
      properties: {
        document_id: { type: "string", description: "UUID of the document row" },
      },
      required: ["document_id"],
    },
  },
  {
    name: "save_mission_note",
    description:
      "Save a working note (e.g. transcriptions of workshop photos, an intermediate synthesis) as a page of a mission in SuperTools, so the work survives the conversation and becomes searchable later. Creates the page or replaces a previous note with the same title. This is the ONLY write operation of this server: it cannot delete anything nor touch any other data.",
    inputSchema: {
      type: "object",
      properties: {
        mission_id: { type: "string", description: "UUID of the mission" },
        title: { type: "string", description: "Note title, e.g. 'Transcription des fiches action'" },
        content: { type: "string", description: "Note content (plain text or simple HTML)" },
        mode: {
          type: "string",
          enum: ["replace", "append"],
          description: "replace (default) overwrites the note, append adds at the end — use append to save progressively",
        },
      },
      required: ["mission_id", "title", "content"],
    },
  },
  {
    name: "read_media_image",
    description:
      "Return an image from a SuperTools gallery (mission workshop photos, CRM card images...) so you can actually see it. Pass the media id from get_mission_dossier's gallery or from the media table. Images are downscaled server-side when possible.",
    inputSchema: {
      type: "object",
      properties: {
        media_id: { type: "string", description: "UUID of the media row" },
      },
      required: ["media_id"],
    },
  },
];

// ── Dossiers agrégés (lecture seule, journalisés) ────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE_CONTENT_MAX = 20000;

async function auditDossierCall(supabase: Supabase, label: string): Promise<void> {
  const userId = await getAllowedUserId(supabase);
  await supabase.from("agent_query_audit_log").insert({
    user_id: userId,
    query_text: label,
    explanation: "via connecteur MCP Claude (tool dossier)",
  });
}

async function getMissionDossier(supabase: Supabase, missionQuery: string): Promise<string> {
  await auditDossierCall(supabase, `get_mission_dossier: ${missionQuery.slice(0, 200)}`);

  let missionReq = supabase
    .from("missions")
    .select("id, title, client_name, client_contact, status, initial_amount, consumed_amount, billed_amount, total_amount, created_at")
    .limit(3);
  missionReq = UUID_RE.test(missionQuery.trim())
    ? missionReq.eq("id", missionQuery.trim())
    : missionReq.ilike("title", `%${missionQuery}%`);

  const { data: missions, error } = await missionReq;
  if (error) throw new Error(error.message);
  if (!missions?.length) {
    return JSON.stringify({ found: false, hint: "Aucune mission ne correspond. Essayer query_database sur la table missions." });
  }
  if (missions.length > 1) {
    return JSON.stringify({
      found: false,
      ambiguous: missions.map((m: Record<string, unknown>) => ({ id: m.id, title: m.title, client_name: m.client_name })),
      hint: "Plusieurs missions correspondent : rappeler avec l'UUID.",
    });
  }

  const mission = missions[0] as Record<string, unknown>;
  const [pages, activities, documents, gallery] = await Promise.all([
    supabase
      .from("mission_pages")
      .select("id, title, icon, content, page_type, parent_page_id, position, is_deliverable, created_at")
      .eq("mission_id", mission.id)
      .order("position", { ascending: true })
      .limit(60),
    supabase
      .from("mission_activities")
      .select("activity_date, description, duration, duration_type, is_billed, notes")
      .eq("mission_id", mission.id)
      .order("activity_date", { ascending: true })
      .limit(100),
    supabase
      .from("mission_documents")
      .select("file_name, file_url, mime_type, file_size, is_deliverable, processing_status, transcript_page_id, created_at")
      .eq("mission_id", mission.id)
      .order("created_at", { ascending: true })
      .limit(100),
    supabase
      .from("media")
      .select("id, file_name, mime_type, file_size, position, tags, transcript, is_deliverable, created_at")
      .eq("source_type", "mission")
      .eq("source_id", mission.id)
      .order("position", { ascending: true })
      .limit(100),
  ]);

  return JSON.stringify({
    found: true,
    mission,
    pages: (pages.data || []).map((p: Record<string, unknown>) => ({
      ...p,
      content: typeof p.content === "string" && p.content.length > PAGE_CONTENT_MAX
        ? p.content.slice(0, PAGE_CONTENT_MAX) + "… [tronqué]"
        : p.content,
    })),
    activities: activities.data || [],
    documents: documents.data || [],
    gallery: gallery.data || [],
    hint: "Les photos de la galerie se lisent avec read_media_image (passer l'id).",
  });
}

const IMAGE_MAX_BYTES = 3 * 1024 * 1024;

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

async function readMediaImage(
  supabase: Supabase,
  mediaId: string,
): Promise<{ data: string; mimeType: string }> {
  await auditDossierCall(supabase, `read_media_image: ${mediaId.slice(0, 60)}`);

  const { data: row, error } = await supabase
    .from("media")
    .select("file_name, file_url, mime_type")
    .eq("id", mediaId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  if (!row) throw new Error("Media introuvable");

  const mime = (row.mime_type as string) || "";
  if (!mime.startsWith("image/")) {
    throw new Error(`Ce media n'est pas une image (${mime || "type inconnu"})`);
  }

  const fileUrl = row.file_url as string;

  // Version réduite via le transformateur d'images du storage quand
  // disponible (les photos d'atelier sortent de téléphone : plusieurs Mo)
  let res: Response | null = null;
  if (fileUrl.includes("/storage/v1/object/public/")) {
    const renderUrl =
      fileUrl.replace("/storage/v1/object/public/", "/storage/v1/render/image/public/") +
      "?width=1600&quality=75";
    const r = await fetch(renderUrl);
    if (r.ok && (r.headers.get("content-type") || "").startsWith("image/")) {
      res = r;
    }
  }
  if (!res) {
    const r = await fetch(fileUrl);
    if (!r.ok) throw new Error(`Téléchargement impossible (${r.status})`);
    res = r;
  }

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > IMAGE_MAX_BYTES) {
    throw new Error(
      `Image trop lourde (${Math.round(bytes.length / 1024)} Ko, max ${IMAGE_MAX_BYTES / 1024} Ko)`,
    );
  }
  const mimeType = res.headers.get("content-type")?.split(";")[0] || mime;
  return { data: bytesToBase64(bytes), mimeType };
}

const MAX_DOWNLOAD_BYTES = 25 * 1024 * 1024;

/** Résout un document dans les 3 tables de pièces jointes et le télécharge. */
async function fetchDocumentBytes(
  supabase: Supabase,
  documentId: string,
): Promise<{ bytes: Uint8Array; fileName: string; mimeType: string; transcriptPageId?: string }> {
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";

  const { data: missionDoc } = await supabase
    .from("mission_documents")
    .select("file_name, file_url, mime_type, transcript_page_id")
    .eq("id", documentId)
    .maybeSingle();

  let url: string | null = null;
  let fileName = "";
  let mimeType = "";
  let transcriptPageId: string | undefined;

  if (missionDoc) {
    url = missionDoc.file_url as string;
    fileName = missionDoc.file_name as string;
    mimeType = (missionDoc.mime_type as string) || "";
    transcriptPageId = (missionDoc.transcript_page_id as string) ?? undefined;
  } else {
    for (const [table, bucket] of [
      ["crm_attachments", "crm-attachments"],
      ["support_ticket_attachments", "support-attachments"],
    ] as const) {
      const { data } = await supabase
        .from(table)
        .select("file_name, file_path, mime_type")
        .eq("id", documentId)
        .maybeSingle();
      if (data) {
        url = `${supabaseUrl}/storage/v1/object/authenticated/${bucket}/${data.file_path}`;
        fileName = data.file_name as string;
        mimeType = (data.mime_type as string) || "";
        break;
      }
    }
  }

  if (!url) throw new Error("Document introuvable");

  const res = await fetch(url, {
    headers: url.includes("/authenticated/") ? { Authorization: `Bearer ${serviceKey}` } : {},
  });
  if (!res.ok) throw new Error(`Téléchargement impossible (${res.status})`);

  const bytes = new Uint8Array(await res.arrayBuffer());
  if (bytes.length > MAX_DOWNLOAD_BYTES) {
    throw new Error(`Fichier trop lourd (${Math.round(bytes.length / 1024 / 1024)} Mo)`);
  }
  return { bytes, fileName, mimeType, transcriptPageId };
}

async function readDocument(supabase: Supabase, documentId: string): Promise<ToolResult> {
  await auditDossierCall(supabase, `read_document: ${documentId.slice(0, 60)}`);
  const { bytes, fileName, mimeType, transcriptPageId } = await fetchDocumentBytes(supabase, documentId);

  // Audio/vidéo : le fichier lui-même n'est pas lisible, mais SuperTools en a
  // peut-être déjà produit une transcription sous forme de page de mission.
  if (mimeType.startsWith("audio/") || mimeType.startsWith("video/")) {
    if (transcriptPageId) {
      const { data: page } = await supabase
        .from("mission_pages")
        .select("title, content")
        .eq("id", transcriptPageId)
        .maybeSingle();
      if (page) {
        return textResult(
          `Transcription de ${fileName} (page « ${page.title} ») :\n\n${page.content ?? ""}`,
        );
      }
    }
    return textResult(
      `${fileName} est un fichier ${mimeType} sans transcription disponible dans SuperTools.`,
      true,
    );
  }

  const { parts, note } = await extractDocument(bytes, mimeType, fileName);
  const content: Array<Record<string, unknown>> = [{ type: "text", text: note }];
  for (const part of parts) {
    if (part.kind === "text" && part.text) {
      content.push({ type: "text", text: part.text });
    } else if (part.kind === "image" && part.data) {
      content.push({ type: "image", data: part.data, mimeType: part.mimeType });
    }
  }
  return { content, ...(parts.length === 0 ? { isError: true } : {}) };
}

const NOTE_PREFIX = "Note agent — ";
const NOTE_MAX_CHARS = 200_000;

/**
 * Unique écriture du serveur : crée ou met à jour UNE page de mission.
 * Aucune suppression, aucune autre table. Titre préfixé pour que la page soit
 * identifiable comme produite par l'agent.
 */
async function saveMissionNote(
  supabase: Supabase,
  missionId: string,
  title: string,
  content: string,
  mode: string,
): Promise<string> {
  if (!UUID_RE.test(missionId.trim())) {
    throw new Error("mission_id doit être un UUID (utiliser get_mission_dossier pour le trouver)");
  }
  if (content.length > NOTE_MAX_CHARS) {
    throw new Error(`Contenu trop long (${content.length} caractères, max ${NOTE_MAX_CHARS})`);
  }

  const { data: mission } = await supabase
    .from("missions")
    .select("id, title")
    .eq("id", missionId)
    .maybeSingle();
  if (!mission) throw new Error("Mission introuvable");

  const fullTitle = title.startsWith(NOTE_PREFIX) ? title : `${NOTE_PREFIX}${title}`;
  await auditDossierCall(
    supabase,
    `save_mission_note (${mode}) sur ${mission.title}: ${fullTitle.slice(0, 120)}`,
  );

  const { data: existing } = await supabase
    .from("mission_pages")
    .select("id, content")
    .eq("mission_id", missionId)
    .eq("title", fullTitle)
    .maybeSingle();

  if (existing) {
    const next =
      mode === "append" ? `${(existing.content as string) ?? ""}\n${content}` : content;
    if (next.length > NOTE_MAX_CHARS) {
      throw new Error(`Note trop longue après ajout (${next.length} caractères)`);
    }
    const { error } = await supabase
      .from("mission_pages")
      .update({ content: next, updated_at: new Date().toISOString() })
      .eq("id", existing.id);
    if (error) throw new Error(error.message);
    return JSON.stringify({
      saved: true,
      page_id: existing.id,
      title: fullTitle,
      mode,
      total_chars: next.length,
    });
  }

  const { data: last } = await supabase
    .from("mission_pages")
    .select("position")
    .eq("mission_id", missionId)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data: created, error } = await supabase
    .from("mission_pages")
    .insert({
      mission_id: missionId,
      title: fullTitle,
      content,
      icon: "🤖",
      position: ((last?.position as number) ?? -1) + 1,
    })
    .select("id")
    .single();
  if (error) throw new Error(error.message);

  return JSON.stringify({
    saved: true,
    page_id: created.id,
    title: fullTitle,
    mode: "create",
    total_chars: content.length,
  });
}

async function getClientDossier(supabase: Supabase, client: string): Promise<string> {
  await auditDossierCall(supabase, `get_client_dossier: ${client.slice(0, 200)}`);
  const pattern = `%${client}%`;

  const [missions, trainings, quotes, cards, transcripts] = await Promise.all([
    supabase
      .from("missions")
      .select("id, title, client_name, client_contact, status, initial_amount, consumed_amount, created_at")
      .ilike("client_name", pattern)
      .limit(20),
    supabase
      .from("trainings")
      .select("id, training_name, client_name, start_date, end_date, location, is_cancelled")
      .ilike("client_name", pattern)
      .order("start_date", { ascending: false })
      .limit(20),
    supabase
      .from("quotes")
      .select("id, quote_number, client_company, client_email, status, total_ht, issue_date, crm_card_id")
      .ilike("client_company", pattern)
      .order("issue_date", { ascending: false })
      .limit(20),
    supabase
      .from("crm_cards")
      .select("id, title, sales_status, estimated_value, contact_email, waiting_next_action_text, created_at")
      .ilike("title", pattern)
      .limit(20),
    supabase
      .from("transcripts")
      .select("id, title, summary, source, created_at")
      .eq("status", "ready")
      .ilike("title", pattern)
      .order("created_at", { ascending: false })
      .limit(20),
  ]);

  const cardIds = (cards.data || []).map((c: Record<string, unknown>) => c.id);
  const comments = cardIds.length
    ? await supabase
        .from("crm_comments")
        .select("card_id, content, author_email, created_at")
        .in("card_id", cardIds)
        .order("created_at", { ascending: false })
        .limit(30)
    : { data: [] };

  return JSON.stringify({
    client_query: client,
    missions: missions.data || [],
    trainings: trainings.data || [],
    quotes: quotes.data || [],
    crm_cards: cards.data || [],
    crm_comments: comments.data || [],
    transcripts: transcripts.data || [],
    hint: "Pour le contenu détaillé d'une mission, utiliser get_mission_dossier. Pour chercher dans le texte des transcripts et notes, utiliser search_content.",
  });
}

type ToolResult = { content: Array<Record<string, unknown>>; isError?: boolean };

function textResult(text: string, isError = false): ToolResult {
  return { content: [{ type: "text", text }], ...(isError ? { isError: true } : {}) };
}

async function callTool(
  supabase: Supabase,
  name: string,
  args: Record<string, unknown>,
): Promise<ToolResult> {
  switch (name) {
    case "query_database": {
      const userId = await getAllowedUserId(supabase);
      const { data, error } = await supabase.rpc("agent_sql_query", {
        query_text: args.sql as string,
        p_user_id: userId,
        p_explanation: ((args.explanation as string) || "via connecteur MCP Claude").slice(0, 500),
      });
      if (error) return textResult(`SQL error: ${error.message}`, true);
      return textResult(JSON.stringify(data ?? []));
    }
    case "search_content": {
      try {
        const results = await searchContent(
          supabase,
          args.query as string,
          args.source_types as string[] | undefined,
          Math.min((args.max_results as number) || 10, 20),
          (args.mission_id as string) || null,
        );
        return textResult(JSON.stringify(results));
      } catch (e) {
        return textResult(`Search error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "list_schema": {
      const { data, error } = await supabase.rpc("get_agent_schema_prompt");
      if (error) return textResult(`Schema error: ${error.message}`, true);
      return textResult((data as string) || "(empty schema)");
    }
    case "get_mission_dossier": {
      try {
        return textResult(await getMissionDossier(supabase, (args.mission as string) || ""));
      } catch (e) {
        return textResult(`Dossier error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "get_client_dossier": {
      try {
        return textResult(await getClientDossier(supabase, (args.client as string) || ""));
      } catch (e) {
        return textResult(`Dossier error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "read_document": {
      try {
        return await readDocument(supabase, (args.document_id as string) || "");
      } catch (e) {
        return textResult(`Document error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "save_mission_note": {
      try {
        return textResult(
          await saveMissionNote(
            supabase,
            (args.mission_id as string) || "",
            (args.title as string) || "Note",
            (args.content as string) || "",
            (args.mode as string) === "append" ? "append" : "replace",
          ),
        );
      } catch (e) {
        return textResult(`Save error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "read_media_image": {
      try {
        const img = await readMediaImage(supabase, (args.media_id as string) || "");
        return { content: [{ type: "image", data: img.data, mimeType: img.mimeType }] };
      } catch (e) {
        return textResult(`Image error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    default:
      return textResult(`Unknown tool: ${name}`, true);
  }
}

// ── JSON-RPC (MCP Streamable HTTP, réponse JSON directe) ────

function rpcResult(id: unknown, result: unknown): Response {
  return json({ jsonrpc: "2.0", id, result });
}

function rpcError(id: unknown, code: number, message: string): Response {
  return json({ jsonrpc: "2.0", id, error: { code, message } });
}

async function handleMcpRequest(req: Request, supabase: Supabase, baseUrl: string): Promise<Response> {
  // Authentification Bearer, liée au seul utilisateur autorisé
  const authHeader = req.headers.get("Authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  const record = token ? await findByHash(supabase, "token", await sha256Hex(token)) : null;
  const isValid =
    record && record.data.type === "access" && record.data.email === ALLOWED_EMAIL;

  if (!isValid) {
    return json(
      { error: "unauthorized" },
      401,
      {
        "WWW-Authenticate":
          `Bearer realm="SuperTools MCP", resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
      },
    );
  }

  let rpc: Record<string, unknown>;
  try {
    rpc = await req.json();
  } catch {
    return rpcError(null, -32700, "Parse error");
  }
  if (Array.isArray(rpc)) {
    return rpcError(null, -32600, "Batch requests not supported");
  }

  const method = rpc.method as string;
  const id = rpc.id;
  const params = (rpc.params || {}) as Record<string, unknown>;

  // Notifications : accusé sans corps
  if (id === undefined || id === null) {
    return new Response(null, { status: 202, headers: corsHeaders });
  }

  switch (method) {
    case "initialize": {
      const requested = params.protocolVersion as string;
      const protocolVersion = SUPPORTED_PROTOCOL_VERSIONS.includes(requested)
        ? requested
        : SUPPORTED_PROTOCOL_VERSIONS[0];
      return rpcResult(id, {
        protocolVersion,
        capabilities: { tools: {} },
        serverInfo: { name: "supertools", title: "SuperTools (lecture seule)", version: "1.0.0" },
      });
    }
    case "ping":
      return rpcResult(id, {});
    case "tools/list":
      return rpcResult(id, { tools: MCP_TOOLS });
    case "tools/call": {
      const toolName = params.name as string;
      const args = (params.arguments || {}) as Record<string, unknown>;
      return rpcResult(id, await callTool(supabase, toolName, args));
    }
    default:
      return rpcError(id, -32601, `Method not found: ${method}`);
  }
}

// ── OAuth endpoints ──────────────────────────────────────────

function metadataAuthServer(baseUrl: string): Response {
  return json({
    issuer: baseUrl,
    authorization_endpoint: `${baseUrl}/authorize`,
    token_endpoint: `${baseUrl}/token`,
    registration_endpoint: `${baseUrl}/register`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
    scopes_supported: ["read"],
  });
}

function metadataProtectedResource(baseUrl: string): Response {
  return json({
    resource: baseUrl,
    authorization_servers: [baseUrl],
    scopes_supported: ["read"],
    bearer_methods_supported: ["header"],
  });
}

async function handleRegister(req: Request, supabase: Supabase): Promise<Response> {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "invalid_client_metadata" }, 400);
  }
  const redirectUris = (body.redirect_uris as string[]) || [];
  if (!redirectUris.length || redirectUris.some((u) => !u.startsWith("https://"))) {
    return json({ error: "invalid_redirect_uri" }, 400);
  }
  const clientId = randomToken();
  await insertRecord(supabase, "client", {
    client_id: clientId,
    redirect_uris: redirectUris,
    client_name: (body.client_name as string) || "unknown",
  }, { tokenHash: await sha256Hex(clientId) });

  return json({
    client_id: clientId,
    redirect_uris: redirectUris,
    client_name: body.client_name || "unknown",
    token_endpoint_auth_method: "none",
    grant_types: ["authorization_code", "refresh_token"],
    response_types: ["code"],
  }, 201);
}

function authorizePage(params: URLSearchParams, errorMsg?: string): Response {
  const fields = ["client_id", "redirect_uri", "state", "code_challenge", "code_challenge_method", "scope", "resource"]
    .map((k) => {
      const v = params.get(k);
      return v ? `<input type="hidden" name="${k}" value="${v.replace(/"/g, "&quot;")}">` : "";
    })
    .join("\n");

  // Charte graphique SuperTilt : jaune #FFD100, encre #101820, gris #F2F4F4
  return html(`<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Connecter Claude à SuperTools</title>
<style>
  body { font-family: 'Lexend', -apple-system, system-ui, sans-serif; background: #f2f4f4; color: #101820; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
  .card { background: #fff; border-radius: 16px; padding: 36px 32px; max-width: 400px; width: 100%; box-shadow: 0 4px 24px rgba(16,24,32,.10); }
  .logo { display: inline-flex; align-items: baseline; gap: 2px; margin-bottom: 20px; font-weight: 800; font-size: 20px; letter-spacing: .02em; }
  .logo .tilt { background: #ffd100; color: #101820; padding: 1px 7px 2px; border-radius: 6px; }
  h1 { font-size: 19px; margin: 0 0 8px; color: #101820; font-weight: 700; }
  p { color: rgba(16,24,32,.65); font-size: 14px; line-height: 1.5; margin: 0 0 22px; }
  input[type=password] { width: 100%; box-sizing: border-box; padding: 12px 14px; border: 1.5px solid rgba(16,24,32,.18); border-radius: 10px; font-size: 15px; font-family: inherit; margin-bottom: 16px; outline: none; }
  input[type=password]:focus { border-color: #101820; }
  button { width: 100%; padding: 12px; border: 0; border-radius: 10px; background: #ffd100; color: #101820; font-size: 15px; font-weight: 700; font-family: inherit; cursor: pointer; transition: filter 120ms; }
  button:hover { filter: brightness(.95); }
  .err { color: #b00020; font-size: 13px; margin-bottom: 12px; }
  .foot { margin-top: 18px; font-size: 12px; color: rgba(16,24,32,.45); }
</style></head>
<body><div class="card">
  <div class="logo"><span>Super</span><span class="tilt">Tilt</span></div>
  <h1>Connecter Claude à SuperTools</h1>
  <p>Accès en lecture seule aux données SuperTools. Réservé à ${ALLOWED_EMAIL}.</p>
  ${errorMsg ? `<div class="err">${errorMsg}</div>` : ""}
  <form method="POST">
    ${fields}
    <input type="password" name="personal_secret" placeholder="Clé personnelle" autofocus required>
    <button type="submit">Autoriser</button>
  </form>
  <div class="foot">Toutes les requêtes de Claude sont journalisées. Révocable à tout moment.</div>
</div></body></html>`);
}

async function countRecentAuthFails(supabase: Supabase): Promise<number> {
  const windowStart = new Date(Date.now() - AUTH_FAIL_WINDOW_MIN * 60 * 1000).toISOString();
  const { count } = await supabase
    .from("mcp_oauth_records")
    .select("*", { count: "exact", head: true })
    .eq("kind", "auth_fail")
    .gt("created_at", windowStart);
  return count ?? 0;
}

async function handleAuthorizePost(req: Request, supabase: Supabase): Promise<Response> {
  const form = await req.formData();
  const get = (k: string) => (form.get(k) as string) || "";

  const clientId = get("client_id");
  const redirectUri = get("redirect_uri");
  const codeChallenge = get("code_challenge");
  const method = get("code_challenge_method") || "S256";
  const state = get("state");
  const secret = get("personal_secret");

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    code_challenge_method: method,
    state,
  });

  // Client enregistré (DCR) OU client implicite : quand la découverte OAuth
  // de claude.ai échoue (well-known à la racine du domaine Supabase), le
  // Client ID est saisi à la main dans le connecteur — on l'accepte à la
  // seule condition que le callback soit une URL officielle de Claude.
  // La sécurité repose de toute façon sur PKCE + la clé personnelle.
  const client = await findByHash(supabase, "client", await sha256Hex(clientId));
  const registeredOk = !!client && (client.data.redirect_uris as string[]).includes(redirectUri);
  const implicitOk = isAllowedImplicitRedirect(redirectUri);
  if (!registeredOk && !implicitOk) {
    return json({ error: "invalid_client", error_description: `redirect_uri non autorisée: ${redirectUri.slice(0, 120)}` }, 400);
  }
  if (!codeChallenge || method !== "S256") {
    return json({ error: "invalid_request", error_description: "PKCE S256 required" }, 400);
  }

  // Rate limiting sur la clé personnelle
  if ((await countRecentAuthFails(supabase)) >= MAX_AUTH_FAILS) {
    return html("<p>Trop de tentatives. Réessayez dans 15 minutes.</p>", 429);
  }

  const expected = Deno.env.get("MCP_PERSONAL_SECRET");
  if (!expected) {
    return createErrorResponse("MCP_PERSONAL_SECRET non configurée", 500, { fn: "mcp-server" });
  }
  // Comparaison via hash : pas d'attaque temporelle exploitable
  const ok = secret.length > 0 && (await sha256Hex(secret)) === (await sha256Hex(expected));
  if (!ok) {
    await insertRecord(supabase, "auth_fail", {}, { ttlSeconds: AUTH_FAIL_WINDOW_MIN * 60 });
    return authorizePage(params, "Clé personnelle incorrecte.");
  }

  const code = randomToken();
  await insertRecord(supabase, "code", {
    client_id: clientId,
    redirect_uri: redirectUri,
    code_challenge: codeChallenge,
    email: ALLOWED_EMAIL,
  }, { tokenHash: await sha256Hex(code), ttlSeconds: CODE_TTL_S });

  const redirect = new URL(redirectUri);
  redirect.searchParams.set("code", code);
  if (state) redirect.searchParams.set("state", state);
  return new Response(null, { status: 302, headers: { Location: redirect.toString() } });
}

async function issueTokens(supabase: Supabase, clientId: string): Promise<Record<string, unknown>> {
  const accessToken = randomToken();
  const refreshToken = randomToken();
  await insertRecord(supabase, "token", {
    type: "access",
    email: ALLOWED_EMAIL,
    client_id: clientId,
  }, { tokenHash: await sha256Hex(accessToken), ttlSeconds: ACCESS_TOKEN_TTL_S });
  await insertRecord(supabase, "token", {
    type: "refresh",
    email: ALLOWED_EMAIL,
    client_id: clientId,
  }, { tokenHash: await sha256Hex(refreshToken), ttlSeconds: REFRESH_TOKEN_TTL_S });
  return {
    access_token: accessToken,
    token_type: "bearer",
    expires_in: ACCESS_TOKEN_TTL_S,
    refresh_token: refreshToken,
    scope: "read",
  };
}

async function handleToken(req: Request, supabase: Supabase): Promise<Response> {
  cleanupExpired(supabase);
  const form = await req.formData();
  const get = (k: string) => (form.get(k) as string) || "";
  const grantType = get("grant_type");

  if (grantType === "authorization_code") {
    const code = get("code");
    const verifier = get("code_verifier");
    const record = await findByHash(supabase, "code", await sha256Hex(code));
    if (!record) return json({ error: "invalid_grant" }, 400);
    // Code à usage unique
    await deleteRecord(supabase, record.id);

    if (get("redirect_uri") && get("redirect_uri") !== record.data.redirect_uri) {
      return json({ error: "invalid_grant", error_description: "redirect_uri mismatch" }, 400);
    }
    if (!verifier || (await sha256Base64url(verifier)) !== record.data.code_challenge) {
      return json({ error: "invalid_grant", error_description: "PKCE verification failed" }, 400);
    }
    return json(await issueTokens(supabase, record.data.client_id as string));
  }

  if (grantType === "refresh_token") {
    const refreshToken = get("refresh_token");
    const record = await findByHash(supabase, "token", await sha256Hex(refreshToken));
    if (!record || record.data.type !== "refresh") return json({ error: "invalid_grant" }, 400);
    // Rotation : l'ancien refresh token est révoqué
    await deleteRecord(supabase, record.id);
    return json(await issueTokens(supabase, record.data.client_id as string));
  }

  return json({ error: "unsupported_grant_type" }, 400);
}

// ── Router ───────────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const url = new URL(req.url);
    // MCP_PUBLIC_URL (secret) : URL publique du serveur quand il est servi
    // par un proxy racine (Cloudflare Worker). Les clients MCP comme
    // claude.ai cherchent les endpoints OAuth à la RACINE du domaine en
    // ignorant le chemin — impossible sur *.supabase.co dont la racine ne
    // nous appartient pas. Le proxy expose /authorize, /token, /register et
    // /.well-known/* à sa racine et relaie vers cette fonction. Sans proxy,
    // repli sur l'URL de la fonction (https forcé : le proxy TLS de
    // Supabase fait arriver req.url en http).
    const baseUrl =
      Deno.env.get("MCP_PUBLIC_URL")?.replace(/\/+$/, "") ??
      `https://${url.host}/functions/v1/mcp-server`;
    // Sous-chemin après /mcp-server ("" pour la racine)
    const subPath = url.pathname.replace(/^.*?\/mcp-server/, "").replace(/\/$/, "");
    const supabase = getSupabaseClient();

    if (subPath === "/.well-known/oauth-authorization-server") {
      return metadataAuthServer(baseUrl);
    }
    if (subPath === "/.well-known/oauth-protected-resource") {
      return metadataProtectedResource(baseUrl);
    }
    if (subPath === "/register" && req.method === "POST") {
      return await handleRegister(req, supabase);
    }
    if (subPath === "/authorize" && req.method === "GET") {
      return authorizePage(url.searchParams);
    }
    if (subPath === "/authorize" && req.method === "POST") {
      return await handleAuthorizePost(req, supabase);
    }
    if (subPath === "/token" && req.method === "POST") {
      return await handleToken(req, supabase);
    }
    if (subPath === "" && req.method === "POST") {
      return await handleMcpRequest(req, supabase, baseUrl);
    }
    if (subPath === "" && (req.method === "GET" || req.method === "DELETE")) {
      // Pas de stream SSE ni de session à clore : réponses JSON directes
      return json({ error: "method_not_allowed" }, 405);
    }

    return json({ error: "not_found" }, 404);
  } catch (error: unknown) {
    console.error("mcp-server error:", error);
    return createErrorResponse("Erreur interne", 500, { cause: error, fn: "mcp-server" });
  }
});
