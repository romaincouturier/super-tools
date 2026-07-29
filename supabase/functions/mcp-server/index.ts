import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  getSupabaseClient,
  corsHeaders,
} from "../_shared/mod.ts";
import { searchContent } from "../_shared/agent-search.ts";
import {
  getSeoPerformance,
  getSeoOpportunities,
  getContentPerformance,
  getEditorialBrief,
} from "../_shared/seo-tools.ts";
import {
  BULK_DEFAULT_DOCUMENTS,
  getClientDossier,
  getMissionDossier,
  readDocument,
  readMediaImage,
  readMissionDocuments,
  readMissionPage,
  saveMissionNote,
  type AuditFn,
  type ExtractedPart,
} from "../_shared/mission-tools.ts";

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
 *   - read_mission_page   : une page de mission en entier, par parties bornées
 *   - read_mission_documents : contenu réel de TOUS les documents d'une mission
 *                           en un appel
 *   - save_mission_note   : SEULE écriture — crée/met à jour une page de
 *                           mission pour capitaliser un travail (transcription,
 *                           synthèse) hors de la conversation
 *   - get_seo_performance    : Search Console historisé, avec comparaison de
 *                           période (totaux, série journalière, détail par
 *                           requête / page / pays / appareil / apparence)
 *   - get_seo_opportunities  : diagnostic calculé — quick wins, CTR anormal,
 *                           cannibalisation, pages en déclin, indexation
 *   - get_content_performance: croisement articles WordPress x audience
 *                           (vues, clics, impressions, position, requêtes)
 *   - get_editorial_brief    : dossier de préparation d'une newsletter ou d'un
 *                           point éditorial en un seul appel
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

// ── Instructions du serveur (champ `instructions` du protocole MCP) ──
// Sans ce champ, le client ne sait pas quelles données existent : c'est ce qui
// produisait des réponses évasives (« Search Console n'est pas accessible
// d'ici ») alors que les données sont en base.

const SERVER_INSTRUCTIONS = `SuperTools est le système d'information de SuperTilt, organisme de formation Qualiopi (facilitation graphique, sketchnoting, intelligence collective, IA appliquée) : CRM, formations et participants, évaluations, missions de conseil, LMS, kanban éditorial et newsletters, articles WordPress, audience web et Search Console, dropshipping de jeux, support.

DONNÉES D'AUDIENCE — elles sont accessibles ici, ne jamais répondre le contraire.
- Google Search Console est synchronisé chaque nuit dans SuperTools (clics, impressions, CTR, position ; par requête, page, pays, appareil, apparence dans les résultats, et croisement page x requête). Publication Google avec environ deux jours de décalage : la période utile s'arrête à J-2.
- L'état d'indexation de chaque URL vient de l'API URL Inspection (balayage progressif : le corpus n'est pas forcément couvert en entier, get_seo_opportunities indique urls_inspected vs articles_published).
- Le trafic WordPress (WP-Statistics) est figé chaque jour : vues par page, référents, moteurs de recherche et référents IA (ChatGPT, Perplexity, Gemini, Copilot).
- Toute analyse commence par data_coverage : l'historisation a une date de début, ne jamais présenter une tendance plus longue que ce qui est stocké.

QUEL OUTIL POUR QUELLE QUESTION
- Visibilité, mots-clés, positions, évolution : get_seo_performance (comparaison de période incluse, ne pas la recalculer à la main).
- « Que faut-il optimiser », audit SEO ou GEO : get_seo_opportunities. Chaque bloc est mesuré ; s'appuyer dessus plutôt que sur des recommandations génériques.
- « Quels contenus marchent », préparation d'un article, refonte : get_content_performance.
- Newsletter, point éditorial, arbitrage de sommaire : get_editorial_brief d'abord, puis get_content_performance pour justifier les choix.
- Client, mission, formation, devis, évaluation : get_client_dossier, get_mission_dossier, read_mission_documents, search_content.
- query_database reste disponible pour tout le reste (SELECT, allowlist de tables) mais les outils agrégés ci-dessus sont plus fiables que du SQL improvisé.

MÉTHODE ATTENDUE
- Croiser plusieurs sources avant de conclure : une recommandation éditoriale s'appuie sur l'audience (get_content_performance), l'existant (kanban contenu, newsletters passées) et l'enjeu commercial (sessions à remplir).
- Distinguer les sources : les vues WP-Statistics comptent toutes les origines, les clics Search Console ne comptent que Google. Ne jamais additionner les deux.
- Chiffrer et dater : « 1 711 vues sur 90 jours (période du X au Y) », pas « beaucoup de vues ». Citer l'URL ou le titre exact.
- Ne pas extrapoler : si une donnée manque (URL non encore inspectée, période non synchronisée), le dire en une phrase et continuer avec ce qui existe.
- GEO (visibilité dans les moteurs génératifs) : aucune API ne mesure les citations. Les seuls faits disponibles sont les référents IA (geo_referrals), les apparences dans les résultats et l'état d'indexation. Toute autre affirmation sur le GEO relève de la recommandation, pas de la mesure : le préciser.

ÉCRITURE
Le serveur est en lecture seule. save_mission_note est la seule écriture : elle crée ou met à jour une page de mission, pour capitaliser un travail long hors de la conversation. Aucune modification du site WordPress, du CRM ou des formations n'est possible depuis ici.`;

// ── MCP tools ────────────────────────────────────────────────

const MCP_TOOLS = [
  {
    name: "query_database",
    description:
      "Execute a read-only SQL query (SELECT only) on the SuperTools database (organisme de formation : CRM, formations, participants, évaluations, devis, missions, transcripts, témoignages, dropshipping, support, contenus WordPress, audience). Limited to an allowlist of tables, 100 rows max. Use list_schema first if unsure of the schema. Audience data lives in gsc_metrics_daily (Search Console day by day), gsc_url_inspections (index status), gsc_sitemaps and wp_traffic_daily (WordPress traffic, including AI referrers) — but prefer the dedicated get_seo_* tools, which already aggregate and compare periods.",
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
      "Return the complete dossier of a mission: mission record, all its pages (full content), activities, attached documents (id, name, type) and gallery images (id, name, tags). Use this to load the full working context of a mission in one call instead of multiple SQL queries. It is the entry point: the returned ids let you then read the actual content of each document (read_document / read_mission_documents) and each photo (read_media_image).",
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
    name: "read_mission_page",
    description:
      "Read ONE mission page in full, in bounded parts. get_mission_dossier delivers every page it can in full, and lists the pages it could not fit in reading_plan: this tool reads those. Each answer states part N of M and the next part to call, so a page is never silently half-read. Use it to reach 100% coverage of a large mission before writing any synthesis.",
    inputSchema: {
      type: "object",
      properties: {
        page_id: { type: "string", description: "UUID of the page (from reading_plan or the pages list)" },
        part: {
          type: "number",
          description: "Part number, starting at 1 (default 1). Keep calling until next_part is null.",
        },
      },
      required: ["page_id"],
    },
  },
  {
    name: "read_mission_documents",
    description:
      "Read the actual content of ALL documents attached to a mission in one call (PDF, Word, Excel, text, images, and transcripts of audio/video files). Use this instead of calling read_document repeatedly when you need the whole documentary base of a mission. Combined with get_mission_dossier (pages + activities + gallery) and read_media_image, it gives complete access to a mission.",
    inputSchema: {
      type: "object",
      properties: {
        mission: { type: "string", description: "Mission UUID, or part of its title" },
        only_deliverables: {
          type: "boolean",
          description: "Restrict to documents flagged as deliverables (default false: read everything)",
        },
        max_documents: {
          type: "number",
          description: "Maximum number of documents to read in this call (default 10, max 20). Documents left out are listed with their id so you can call again.",
        },
        include_images: {
          type: "boolean",
          description: "Include image files and scanned-PDF pages as images (default true). Set to false for a text-only, lighter answer.",
        },
      },
      required: ["mission"],
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
    name: "get_seo_performance",
    description:
      "Google Search Console performance for the SuperTilt site, read from SuperTools' own history (synced daily, kept beyond Google's 16-month retention). Returns totals, the day-by-day series, the breakdown for one dimension, AND the comparison with the previous period of the same length (deltas per row). Use this for any question about search visibility, keywords, landing pages, countries, devices or rich results. Always check data_coverage: it states how far back the history actually goes.",
    inputSchema: {
      type: "object",
      properties: {
        dimension: {
          type: "string",
          enum: ["query", "page", "country", "device", "appearance", "page_query"],
          description:
            "Breakdown to return. query = search terms, page = landing pages, appearance = rich result types, page_query = which query brings which page (default query)",
        },
        days: { type: "number", description: "Length of the period ending 2 days ago (default 28). Ignored if from/to are given." },
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        limit: { type: "number", description: "Number of rows in the breakdown (default 25, max 500)" },
        contains: { type: "string", description: "Only keep rows whose key contains this text (e.g. 'sketchnot' or '/formation')" },
        search_type: { type: "string", description: "web (default), image, video, news, discover" },
        compare: { type: "boolean", description: "Compare with the previous period (default true)" },
      },
    },
  },
  {
    name: "get_seo_opportunities",
    description:
      "SEO/GEO diagnosis computed from the stored Search Console history: quick wins (queries ranked 4-20 with the extra clicks they would bring at position 3), pages whose CTR is far below the norm for their position (title/description problem), keyword cannibalisation, pages losing clicks, queries whose demand is rising, index coverage from the URL Inspection API, sitemap errors, and referrals coming from generative engines (ChatGPT, Perplexity...). Use this instead of inferring priorities from raw numbers: every item is measured, not estimated.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Length of the analysed period (default 90)" },
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        limit: { type: "number", description: "Items per category (default 20)" },
      },
    },
  },
  {
    name: "get_content_performance",
    description:
      "Cross-reference of WordPress articles and audience, article by article: WordPress views over the period, Search Console clicks/impressions/CTR/average position, the queries that bring each of the top articles, index status, publication and last modification dates. This is the tool for questions like 'which content works', 'what should we put in the newsletter', 'which articles should be refreshed'.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Length of the analysed period (default 90)" },
        from: { type: "string", description: "Start date YYYY-MM-DD" },
        to: { type: "string", description: "End date YYYY-MM-DD" },
        limit: { type: "number", description: "Number of articles (default 30, max 200)" },
        category: { type: "string", description: "Restrict to one WordPress category" },
        with_queries: { type: "boolean", description: "Include the entry queries of the top 10 articles (default true)" },
      },
    },
  },
  {
    name: "get_editorial_brief",
    description:
      "Everything needed to prepare a newsletter or an editorial meeting, in one call: past newsletters and the content cards they used, the current editorial board with column names and a flag telling whether a card has already been promoted, upcoming events, upcoming training sessions with their fill rate (and those below 70%), the best performing content of the period with its entry queries, and the audience signals (rising queries, quick wins, AI referrals). Call this before drafting any newsletter instead of assembling ten separate SQL queries.",
    inputSchema: {
      type: "object",
      properties: {
        days: { type: "number", description: "Length of the audience period analysed (default 90)" },
        horizon_days: { type: "number", description: "How far ahead to look for events and sessions (default 120)" },
      },
    },
  },
  {
    name: "read_media_image",
    description:
      "Return an image from a SuperTools gallery (mission workshop photos, CRM card images...) so you can actually see it. Pass the media id from get_mission_dossier's gallery or from the media table. The whole image is always returned, never cropped; it is downscaled server-side to keep it light.",
    inputSchema: {
      type: "object",
      properties: {
        media_id: { type: "string", description: "UUID of the media row" },
        full_resolution: {
          type: "boolean",
          description:
            "Return the original file without downscaling. Use it to re-read a photo whose details (small handwriting, edges) are hard to make out.",
        },
      },
      required: ["media_id"],
    },
  },
];

// ── Dossiers agrégés (lecture seule, journalisés) ────────────

/**
 * La logique de lecture des missions vit dans _shared/mission-tools.ts :
 * le serveur MCP et l'agent intégré (agent-chat) doivent voir exactement les
 * mêmes données. Ici on ne garde que l'adaptation au protocole MCP.
 */
const audit: (supabase: Supabase) => AuditFn = (supabase) => async (label) => {
  const userId = await getAllowedUserId(supabase);
  await supabase.from("agent_query_audit_log").insert({
    user_id: userId,
    query_text: label,
    explanation: "via connecteur MCP Claude (tool dossier)",
  });
};

/** ExtractedPart -> blocs de contenu MCP. */
function partsToMcpContent(parts: ExtractedPart[]): Array<Record<string, unknown>> {
  const content: Array<Record<string, unknown>> = [];
  for (const part of parts) {
    if (part.kind === "text" && part.text) {
      content.push({ type: "text", text: part.text });
    } else if (part.kind === "image" && part.data) {
      content.push({ type: "image", data: part.data, mimeType: part.mimeType });
    }
  }
  return content;
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
  const log = audit(supabase);
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
        return textResult(await getMissionDossier(supabase, (args.mission as string) || "", log));
      } catch (e) {
        return textResult(`Dossier error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "get_client_dossier": {
      try {
        return textResult(await getClientDossier(supabase, (args.client as string) || "", log));
      } catch (e) {
        return textResult(`Dossier error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "read_document": {
      try {
        const parts = await readDocument(supabase, (args.document_id as string) || "", log);
        const content = partsToMcpContent(parts);
        return { content, ...(content.length ? {} : { isError: true }) };
      } catch (e) {
        return textResult(`Document error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "read_mission_page": {
      try {
        return textResult(
          await readMissionPage(
            supabase,
            (args.page_id as string) || "",
            (args.part as number) || 1,
            log,
          ),
        );
      } catch (e) {
        return textResult(`Page error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "read_mission_documents": {
      try {
        const parts = await readMissionDocuments(
          supabase,
          (args.mission as string) || "",
          args.only_deliverables === true,
          (args.max_documents as number) || BULK_DEFAULT_DOCUMENTS,
          args.include_images !== false,
          log,
        );
        return { content: partsToMcpContent(parts) };
      } catch (e) {
        return textResult(`Documents error: ${e instanceof Error ? e.message : "failed"}`, true);
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
            log,
          ),
        );
      } catch (e) {
        return textResult(`Save error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "get_seo_performance": {
      try {
        await log("get_seo_performance");
        return textResult(JSON.stringify(await getSeoPerformance(supabase, {
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          days: args.days as number | undefined,
          dimension: args.dimension as "query" | undefined,
          search_type: args.search_type as string | undefined,
          limit: args.limit as number | undefined,
          contains: args.contains as string | undefined,
          compare: args.compare !== false,
        })));
      } catch (e) {
        return textResult(`SEO error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "get_seo_opportunities": {
      try {
        await log("get_seo_opportunities");
        return textResult(JSON.stringify(await getSeoOpportunities(supabase, {
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          days: args.days as number | undefined,
          limit: args.limit as number | undefined,
        })));
      } catch (e) {
        return textResult(`SEO error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "get_content_performance": {
      try {
        await log("get_content_performance");
        return textResult(JSON.stringify(await getContentPerformance(supabase, {
          from: args.from as string | undefined,
          to: args.to as string | undefined,
          days: args.days as number | undefined,
          limit: args.limit as number | undefined,
          category: args.category as string | undefined,
          with_queries: args.with_queries !== false,
        })));
      } catch (e) {
        return textResult(`Content error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "get_editorial_brief": {
      try {
        await log("get_editorial_brief");
        return textResult(JSON.stringify(await getEditorialBrief(supabase, {
          days: args.days as number | undefined,
          horizon_days: args.horizon_days as number | undefined,
        })));
      } catch (e) {
        return textResult(`Brief error: ${e instanceof Error ? e.message : "failed"}`, true);
      }
    }
    case "read_media_image": {
      try {
        const img = await readMediaImage(
          supabase,
          (args.media_id as string) || "",
          args.full_resolution === true,
          log,
        );
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
        serverInfo: { name: "supertools", title: "SuperTools (lecture seule)", version: "1.1.0" },
        instructions: SERVER_INSTRUCTIONS,
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
