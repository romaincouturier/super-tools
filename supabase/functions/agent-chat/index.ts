import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  getSupabaseClient,
  verifyAuth,
  corsHeaders,
} from "../_shared/mod.ts";

/**
 * Agent Chat — AI assistant with access to all SuperTools data.
 *
 * Streams responses via SSE:
 *   - event: status   → { text: "..." }           tool execution status
 *   - event: delta    → { text: "..." }           text chunk from Claude
 *   - event: done     → { conversation_id: "..." } final metadata
 *   - event: error    → { text: "..." }           error message
 *
 * Tools:
 *   1. query_database  — Execute read-only SQL queries
 *   2. search_content  — Semantic search via RAG (document_embeddings)
 *   3. execute_action  — Perform write actions (with confirmation)
 */

import { getOpenAIApiKey } from "../_shared/api-keys.ts";
import { CLAUDE_ADVANCED, CLAUDE_DEFAULT } from "../_shared/claude-models.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
let _openaiApiKey: string | null = null;
async function resolveOpenAIKey(): Promise<string | null> {
  if (!_openaiApiKey) _openaiApiKey = await getOpenAIApiKey();
  return _openaiApiKey;
}
const CLAUDE_MODEL = CLAUDE_ADVANCED;
const MAX_TOOL_ROUNDS = 10;

// ── Embedding cache helpers ─────────────────────────────────

async function sha256(text: string): Promise<string> {
  const encoded = new TextEncoder().encode(text.trim().toLowerCase());
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

async function getCachedEmbedding(
  supabase: ReturnType<typeof getSupabaseClient>,
  queryText: string,
): Promise<number[] | null> {
  const hash = await sha256(queryText);
  const { data } = await supabase
    .from("agent_embedding_cache")
    .select("embedding")
    .eq("query_hash", hash)
    .single();
  if (data?.embedding) {
    return data.embedding as number[];
  }
  return null;
}

async function storeCachedEmbedding(
  supabase: ReturnType<typeof getSupabaseClient>,
  queryText: string,
  embedding: number[],
): Promise<void> {
  const hash = await sha256(queryText);
  await supabase.from("agent_embedding_cache").upsert(
    {
      query_hash: hash,
      query_text: queryText.slice(0, 500),
      embedding,
    },
    { onConflict: "query_hash" },
  );
}

// ── Database schema — loaded dynamically from agent_schema_registry ──

let _cachedSchema: { text: string; fetchedAt: number } | null = null;
const SCHEMA_CACHE_TTL_MS = 5 * 60 * 1000; // 5 min cache

async function getDbSchema(supabase: ReturnType<typeof getSupabaseClient>): Promise<string> {
  const now = Date.now();
  if (_cachedSchema && now - _cachedSchema.fetchedAt < SCHEMA_CACHE_TTL_MS) {
    return _cachedSchema.text;
  }

  try {
    const { data, error } = await supabase.rpc("get_agent_schema_prompt");
    if (error) throw error;
    if (data) {
      _cachedSchema = { text: data as string, fetchedAt: now };
      return data as string;
    }
  } catch (e) {
    console.error("Failed to load schema from registry, using cache or fallback:", e);
    if (_cachedSchema) return _cachedSchema.text;
  }

  return "(schema unavailable — ask the user to check the agent_schema_registry table)";
}

// ── System prompt ────────────────────────────────────────────

function buildSystemPrompt(dbSchema: string): string {
  const now = new Date();
  const dateStr = now.toLocaleDateString("fr-FR", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const timeStr = now.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

  return `Tu es l'assistant IA de SuperTools, une application de gestion pour un organisme de formation professionnelle.

Date et heure actuelles : ${dateStr}, ${timeStr}.

Tu aides l'utilisateur à :
- Analyser ses données (CRM, formations, devis, missions, emails, etc.)
- Retrouver des informations spécifiques dans n'importe quel contenu
- Produire des synthèses, recommandations et analyses
- Exécuter des actions sur les modules (créer, modifier, déplacer, envoyer)

Règles :
- Réponds en français, de manière concise et professionnelle
- Utilise query_database pour les questions sur des données structurées (comptages, listes, agrégations, filtres par date/statut/montant)
- Utilise search_content pour rechercher dans le contenu textuel (emails, notes, descriptions, commentaires) quand la question porte sur le sens ou le contexte plutôt que sur des valeurs exactes
- Utilise execute_action pour effectuer des modifications (créer, mettre à jour)
- Pour ajouter du contenu, utilise les actions de création de page :
  • add_mission_page : params { mission_id, title, content (HTML), icon (emoji, optionnel) }
  • add_crm_comment : params { card_id, content } — ajoute une note/commentaire sur une opportunité
  • add_support_note : params { ticket_id, content } — ajoute une note au ticket support
  • add_content_card : params { title, content, tags (array, optionnel), column_id (optionnel, défaut: "Idées") } — crée une carte dans le module contenu
- Tu peux combiner les tools dans une même réponse
- Formate les montants en euros (€) et les dates en français
- Si une requête SQL échoue, analyse l'erreur et corrige la requête
- Ne retourne jamais de données brutes JSON — synthétise toujours pour l'utilisateur
- IMPORTANT : avant toute action d'écriture, décris ce que tu vas faire et demande confirmation à l'utilisateur. N'exécute l'action que si l'utilisateur confirme explicitement (oui, ok, vas-y, confirme, etc.)
- Si l'utilisateur demande une action et que tu n'as pas assez d'infos, pose des questions avant d'agir
- Pour les requêtes temporelles relatives ("cette semaine", "ce mois-ci", "les 7 derniers jours"), utilise la date actuelle ci-dessus pour calculer les bornes SQL appropriées
- Tu ne peux requêter QUE les tables listées ci-dessous. Toute table hors de cette liste sera rejetée.

Schéma de la base de données :
${dbSchema}`;
}

// ── Tool definitions ─────────────────────────────────────────

const TOOLS = [
  {
    name: "query_database",
    description:
      "Execute a read-only SQL query (SELECT only) on the PostgreSQL database. Use this for structured data: counts, aggregations, filters, joins, date ranges, etc. The query is limited to 100 rows. Use standard PostgreSQL syntax.",
    input_schema: {
      type: "object" as const,
      properties: {
        sql: {
          type: "string",
          description: "The SELECT SQL query to execute",
        },
        explanation: {
          type: "string",
          description: "Brief explanation of what this query does (for logging)",
        },
      },
      required: ["sql"],
    },
  },
  {
    name: "search_content",
    description:
      "Semantic search across all indexed content (CRM emails, comments, notes, training descriptions, mission details, quotes, inbound emails, coaching summaries, support tickets, file attachments, etc.). Use this when the user asks about the meaning or context of content, not just structured fields. Returns the most semantically similar documents.",
    input_schema: {
      type: "object" as const,
      properties: {
        query: {
          type: "string",
          description: "The natural language search query",
        },
        source_types: {
          type: "array",
          items: { type: "string" },
          description:
            "Optional filter by source type(s): crm_card, crm_comment, crm_email, inbound_email, training, mission, mission_page, mission_activity, quote, support_ticket, coaching_summary, content_card, lms_lesson, activity_log, evaluation_analysis, questionnaire_besoins, okr_objective, okr_key_result, okr_initiative, crm_attachment, support_attachment",
        },
        max_results: {
          type: "number",
          description: "Number of results to return (default 10, max 20)",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "execute_action",
    description:
      "Execute a write action on SuperTools data. ONLY use this AFTER the user has explicitly confirmed the action. Available actions: move_crm_card, update_crm_card, add_crm_comment, add_mission_page, add_support_note, add_content_card, update_mission_status, update_ticket_status, update_quote_status.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "move_crm_card",
            "update_crm_card",
            "add_crm_comment",
            "add_mission_page",
            "add_support_note",
            "add_content_card",
            "update_mission_status",
            "update_ticket_status",
            "update_quote_status",
          ],
          description: "The action to execute",
        },
        params: {
          type: "object",
          description: "Action-specific parameters",
        },
      },
      required: ["action", "params"],
    },
  },
];

// ── Tool labels for streaming status ────────────────────────

const TOOL_LABELS: Record<string, string> = {
  query_database: "Requête base de données",
  search_content: "Recherche dans les contenus",
  execute_action: "Exécution d'une action",
};

// ── Tool execution ───────────────────────────────────────────

async function executeTool(
  toolName: string,
  toolInput: Record<string, unknown>,
  supabase: ReturnType<typeof getSupabaseClient>,
  userId?: string,
): Promise<string> {
  switch (toolName) {
    case "query_database": {
      const sql = toolInput.sql as string;
      const explanation = (toolInput.explanation as string) || null;
      try {
        const { data, error } = await supabase.rpc("agent_sql_query", {
          query_text: sql,
          p_user_id: userId || null,
          p_explanation: explanation,
        });
        if (error) {
          return JSON.stringify({ error: error.message });
        }
        return JSON.stringify(data ?? []);
      } catch (e) {
        return JSON.stringify({
          error: e instanceof Error ? e.message : "Query execution failed",
        });
      }
    }

    case "search_content": {
      const query = toolInput.query as string;
      const sourceTypes = toolInput.source_types as string[] | undefined;
      const maxResults = Math.min((toolInput.max_results as number) || 10, 20);

      const openaiKey = await resolveOpenAIKey();
      if (!openaiKey) {
        return JSON.stringify({ error: "OPENAI_API_KEY not configured for search" });
      }

      try {
        // Check embedding cache first
        let queryEmbedding = await getCachedEmbedding(supabase, query);

        if (!queryEmbedding) {
          // Cache miss — call OpenAI
          const embRes = await fetch("https://api.openai.com/v1/embeddings", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${openaiKey}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model: "text-embedding-3-small",
              input: query,
            }),
          });

          if (!embRes.ok) {
            return JSON.stringify({ error: `Embedding API error: ${embRes.status}` });
          }

          const embData = await embRes.json();
          queryEmbedding = embData.data?.[0]?.embedding;
          if (!queryEmbedding) {
            return JSON.stringify({ error: "Failed to generate query embedding" });
          }

          // Store in cache (fire-and-forget)
          storeCachedEmbedding(supabase, query, queryEmbedding).catch(() => {});
        }

        const { data, error } = await supabase.rpc("match_documents", {
          query_embedding: JSON.stringify(queryEmbedding),
          match_threshold: 0.65,
          match_count: maxResults,
          filter_source_types: sourceTypes || null,
        });

        if (error) {
          return JSON.stringify({ error: error.message });
        }

        const results = (data || []).map((r: Record<string, unknown>) => ({
          source_type: r.source_type,
          title: r.source_title,
          date: r.source_date,
          content: (r.content as string)?.slice(0, 1000),
          similarity: Number((r.similarity as number).toFixed(3)),
          metadata: r.metadata,
        }));

        return JSON.stringify(results);
      } catch (e) {
        return JSON.stringify({
          error: e instanceof Error ? e.message : "Search failed",
        });
      }
    }

    case "execute_action": {
      const action = toolInput.action as string;
      const params = (toolInput.params || {}) as Record<string, unknown>;

      try {
        switch (action) {
          case "move_crm_card": {
            const { error } = await supabase
              .from("crm_cards")
              .update({ column_id: params.column_id, updated_at: new Date().toISOString() })
              .eq("id", params.card_id);
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Carte CRM déplacée" });
          }

          case "update_crm_card": {
            const { card_id, ...updates } = params;
            const { error } = await supabase
              .from("crm_cards")
              .update({ ...updates, updated_at: new Date().toISOString() })
              .eq("id", card_id);
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Carte CRM mise à jour" });
          }

          case "add_crm_comment": {
            const { error } = await supabase
              .from("crm_comments")
              .insert({
                card_id: params.card_id,
                content: params.content,
                author_email: params.author_email || "agent@supertools.ai",
              });
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Commentaire ajouté" });
          }

          case "add_mission_page": {
            const { data: lastPage } = await supabase
              .from("mission_pages")
              .select("position")
              .eq("mission_id", params.mission_id)
              .is("parent_page_id", null)
              .order("position", { ascending: false })
              .limit(1)
              .maybeSingle();
            const position = ((lastPage as Record<string, unknown>)?.position as number ?? -1) + 1;

            const { error } = await supabase
              .from("mission_pages")
              .insert({
                mission_id: params.mission_id,
                title: params.title || "Sans titre",
                content: params.content || "",
                icon: params.icon || "📄",
                position,
                created_by: userId,
              });
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Page ajoutée à la mission" });
          }

          case "add_support_note": {
            const { data: ticket } = await supabase
              .from("support_tickets")
              .select("resolution_notes")
              .eq("id", params.ticket_id)
              .maybeSingle();
            const existing = (ticket as Record<string, unknown>)?.resolution_notes as string || "";
            const separator = existing ? "\n\n---\n\n" : "";
            const timestamp = new Date().toLocaleDateString("fr-FR");
            const newNotes = `${existing}${separator}Note agent (${timestamp}) :\n${params.content}`;

            const { error } = await supabase
              .from("support_tickets")
              .update({ resolution_notes: newNotes, updated_at: new Date().toISOString() })
              .eq("id", params.ticket_id);
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Note ajoutée au ticket support" });
          }

          case "add_content_card": {
            let columnId = params.column_id as string | undefined;
            if (!columnId) {
              const { data: cols } = await supabase
                .from("content_columns")
                .select("id, name")
                .order("display_order", { ascending: true });
              const colsList = (cols || []) as Array<{ id: string; name: string }>;
              columnId = colsList.find((c) => c.name === "Idées")?.id || colsList[0]?.id;
            }
            if (!columnId) {
              return JSON.stringify({ error: "Aucune colonne trouvée pour le contenu" });
            }

            const { error } = await supabase
              .from("content_cards")
              .insert({
                column_id: columnId,
                title: params.title || "Sans titre",
                description: params.content || "",
                tags: params.tags || [],
                created_by: userId,
              });
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Carte de contenu créée" });
          }

          case "update_mission_status": {
            const validStatuses = ["not_started", "in_progress", "completed", "cancelled"];
            if (!validStatuses.includes(params.status as string)) {
              return JSON.stringify({ error: `Statut invalide. Valeurs: ${validStatuses.join(", ")}` });
            }
            const { error } = await supabase
              .from("missions")
              .update({ status: params.status, updated_at: new Date().toISOString() })
              .eq("id", params.mission_id);
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Statut de la mission mis à jour" });
          }

          case "update_ticket_status": {
            const validTicketStatuses = ["nouveau", "en_cours", "en_attente", "resolu", "ferme"];
            if (!validTicketStatuses.includes(params.status as string)) {
              return JSON.stringify({ error: `Statut invalide. Valeurs: ${validTicketStatuses.join(", ")}` });
            }
            const ticketUpdate: Record<string, unknown> = {
              status: params.status,
              updated_at: new Date().toISOString(),
            };
            if (params.resolution_notes) ticketUpdate.resolution_notes = params.resolution_notes;
            if (params.status === "resolu") ticketUpdate.resolved_at = new Date().toISOString();

            const { error } = await supabase
              .from("support_tickets")
              .update(ticketUpdate)
              .eq("id", params.ticket_id);
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Ticket mis à jour" });
          }

          case "update_quote_status": {
            const validQuoteStatuses = ["draft", "generated", "sent", "signed", "expired", "canceled"];
            if (!validQuoteStatuses.includes(params.status as string)) {
              return JSON.stringify({ error: `Statut invalide. Valeurs: ${validQuoteStatuses.join(", ")}` });
            }
            const { error } = await supabase
              .from("quotes")
              .update({ status: params.status, updated_at: new Date().toISOString() })
              .eq("id", params.quote_id);
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Statut du devis mis à jour" });
          }

          default:
            return JSON.stringify({ error: `Action inconnue: ${action}` });
        }
      } catch (e) {
        return JSON.stringify({
          error: e instanceof Error ? e.message : "Action execution failed",
        });
      }
    }

    default:
      return JSON.stringify({ error: `Unknown tool: ${toolName}` });
  }
}

// ── SSE helpers ─────────────────────────────────────────────

function sseEvent(event: string, data: Record<string, unknown>): string {
  return `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
}

// ── Streaming agent with tool loop ──────────────────────────

interface Message {
  role: string;
  content: unknown;
}

async function runAgentStreaming(
  messages: Message[],
  supabase: ReturnType<typeof getSupabaseClient>,
  writer: WritableStreamDefaultWriter<Uint8Array>,
  userId?: string,
): Promise<{ fullResponse: string; updatedMessages: Message[]; totalInputTokens: number; totalOutputTokens: number }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const encoder = new TextEncoder();
  const write = (text: string) => writer.write(encoder.encode(text));

  // Load schema dynamically from registry (cached 5 min)
  const dbSchema = await getDbSchema(supabase);

  const conversationMessages = [...messages];
  let fullResponse = "";
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
    // Call Claude with streaming
    const apiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_MODEL,
        max_tokens: 4096,
        stream: true,
        system: buildSystemPrompt(dbSchema),
        tools: TOOLS,
        messages: conversationMessages,
      }),
    });

    if (!apiRes.ok) {
      const errBody = await apiRes.text();
      console.error("Claude API error:", apiRes.status, errBody);
      throw new Error(`Claude API error: ${apiRes.status}`);
    }

    // Parse SSE stream from Claude
    const reader = apiRes.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let stopReason = "";
    const contentBlocks: Array<Record<string, unknown>> = [];
    let currentBlockIndex = -1;
    let currentBlockType = "";
    let currentText = "";
    let currentToolName = "";
    let currentToolId = "";
    let currentToolInput = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]" || !jsonStr) continue;

        let event;
        try {
          event = JSON.parse(jsonStr);
        } catch {
          continue;
        }

        switch (event.type) {
          case "content_block_start": {
            currentBlockIndex = event.index;
            const block = event.content_block;
            currentBlockType = block.type;
            if (block.type === "text") {
              currentText = block.text || "";
            } else if (block.type === "tool_use") {
              currentToolName = block.name;
              currentToolId = block.id;
              currentToolInput = "";
              // Send status to client
              const label = TOOL_LABELS[block.name] || block.name;
              await write(sseEvent("status", { text: label }));
            }
            break;
          }

          case "content_block_delta": {
            if (currentBlockType === "text" && event.delta?.text) {
              currentText += event.delta.text;
              // Stream text delta to client
              await write(sseEvent("delta", { text: event.delta.text }));
            } else if (currentBlockType === "tool_use" && event.delta?.partial_json) {
              currentToolInput += event.delta.partial_json;
            }
            break;
          }

          case "content_block_stop": {
            if (currentBlockType === "text") {
              contentBlocks[currentBlockIndex] = {
                type: "text",
                text: currentText,
              };
            } else if (currentBlockType === "tool_use") {
              let parsedInput = {};
              try {
                parsedInput = JSON.parse(currentToolInput);
              } catch {
                // empty
              }
              contentBlocks[currentBlockIndex] = {
                type: "tool_use",
                id: currentToolId,
                name: currentToolName,
                input: parsedInput,
              };
            }
            break;
          }

          case "message_start": {
            // Capture input tokens from the message start event
            if (event.message?.usage?.input_tokens) {
              totalInputTokens += event.message.usage.input_tokens;
            }
            break;
          }

          case "message_delta": {
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
            }
            // Capture output tokens from the message delta event
            if (event.usage?.output_tokens) {
              totalOutputTokens += event.usage.output_tokens;
            }
            break;
          }
        }
      }
    }

    // Add assistant response to conversation
    const validBlocks = contentBlocks.filter(Boolean);
    conversationMessages.push({ role: "assistant", content: validBlocks });

    // If Claude is done, extract full text
    if (stopReason !== "tool_use") {
      fullResponse = validBlocks
        .filter((b) => b.type === "text")
        .map((b) => b.text as string)
        .join("\n");
      break;
    }

    // Execute tool calls
    const toolUseBlocks = validBlocks.filter((b) => b.type === "tool_use");

    const toolResults: Array<{
      type: "tool_result";
      tool_use_id: string;
      content: string;
    }> = [];

    for (const toolBlock of toolUseBlocks) {
      const toolResult = await executeTool(
        toolBlock.name as string,
        toolBlock.input as Record<string, unknown>,
        supabase,
        userId,
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id as string,
        content: toolResult,
      });
    }

    conversationMessages.push({ role: "user", content: toolResults });
  }

  return { fullResponse, updatedMessages: conversationMessages, totalInputTokens, totalOutputTokens };
}

// ── Title generation ────────────────────────────────────────

async function generateTitle(userMessage: string, assistantResponse: string): Promise<string> {
  if (!ANTHROPIC_API_KEY) return userMessage.slice(0, 80);

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": ANTHROPIC_API_KEY,
        "content-type": "application/json",
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_DEFAULT,
        max_tokens: 60,
        messages: [
          {
            role: "user",
            content: `Génère un titre court (max 60 caractères, en français) pour cette conversation. Réponds UNIQUEMENT avec le titre, sans guillemets ni ponctuation finale.\n\nQuestion: ${userMessage.slice(0, 200)}\nRéponse: ${assistantResponse.slice(0, 300)}`,
          },
        ],
      }),
    });

    if (!res.ok) return userMessage.slice(0, 80);

    const data = await res.json();
    const title = data.content?.[0]?.text?.trim();
    return title || userMessage.slice(0, 80);
  } catch {
    return userMessage.slice(0, 80);
  }
}

// ── Main handler ─────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const { message, conversation_id, attachments } = await req.json();

    if (!message || typeof message !== "string") {
      return createErrorResponse("message is required", 400);
    }

    const supabase = getSupabaseClient();
    const userId = authResult.id;

    // Load or create conversation
    let conversationId = conversation_id;
    let messages: Message[] = [];

    if (conversationId) {
      const { data: conv } = await supabase
        .from("agent_conversations")
        .select("messages")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .single();

      if (conv?.messages) {
        messages = conv.messages as Message[];
      }
    }

    // Add user message (with optional image/document attachments)
    if (Array.isArray(attachments) && attachments.length > 0) {
      const contentBlocks: unknown[] = [];
      for (const att of attachments) {
        if (att.type === "image" && att.url) {
          contentBlocks.push({
            type: "image",
            source: { type: "url", url: att.url },
          });
        } else if (att.type === "document" && att.url) {
          contentBlocks.push({
            type: "document",
            source: { type: "url", url: att.url },
          });
        }
      }
      contentBlocks.push({ type: "text", text: message });
      messages.push({ role: "user", content: contentBlocks });
    } else {
      messages.push({ role: "user", content: message });
    }

    // Set up SSE stream
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();

    // Run agent in background, writing to the stream
    (async () => {
      const encoder = new TextEncoder();
      try {
        const { fullResponse, updatedMessages, totalInputTokens, totalOutputTokens } = await runAgentStreaming(
          messages,
          supabase,
          writer,
          userId,
        );

        // Save conversation with token usage
        let title: string | undefined;

        if (conversationId) {
          // Increment token counters on existing conversation
          await supabase.rpc("increment_agent_tokens", {
            p_conversation_id: conversationId,
            p_input_tokens: totalInputTokens,
            p_output_tokens: totalOutputTokens,
            p_messages: updatedMessages,
          });
        } else {
          // Generate a smart title for new conversations
          title = await generateTitle(message, fullResponse);

          const { data: newConv, error: insertError } = await supabase
            .from("agent_conversations")
            .insert({
              user_id: userId,
              title,
              messages: updatedMessages,
              total_input_tokens: totalInputTokens,
              total_output_tokens: totalOutputTokens,
              updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (insertError) {
            console.error("Failed to create conversation:", insertError);
          }
          conversationId = newConv?.id;
        }

        // Send done event
        await writer.write(
          encoder.encode(
            sseEvent("done", {
              conversation_id: conversationId,
              response: fullResponse,
              ...(title ? { title } : {}),
            }),
          ),
        );
      } catch (error: unknown) {
        console.error("Agent streaming error:", error);
        const msg = error instanceof Error ? error.message : "Erreur interne";
        await writer.write(encoder.encode(sseEvent("error", { text: msg })));
      } finally {
        await writer.close();
      }
    })();

    return new Response(readable, {
      headers: {
        ...corsHeaders,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch (error: unknown) {
    console.error("Agent chat error:", error);
    const msg = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(msg);
  }
});
