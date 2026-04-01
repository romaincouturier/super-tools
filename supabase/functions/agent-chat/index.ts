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

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");
const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_TOOL_ROUNDS = 10;

// ── Database schema for the system prompt ────────────────────

const DB_SCHEMA = `
Tables principales (PostgreSQL / Supabase) :

-- CRM
crm_cards (id UUID PK, title TEXT, description_html TEXT, sales_status TEXT ['OPEN','WON','LOST','CANCELED'], status_operational TEXT ['TODAY','WAITING'], estimated_value NUMERIC, contact_email TEXT, contact_phone TEXT, column_id UUID FK→crm_columns, waiting_next_action_text TEXT, waiting_next_action_date TIMESTAMPTZ, created_at, updated_at)
crm_columns (id UUID PK, name TEXT, display_order INT, pipeline_type TEXT)
crm_comments (id UUID PK, card_id UUID FK→crm_cards, content TEXT, author_email TEXT, is_deleted BOOL, created_at)
crm_card_emails (id UUID PK, card_id UUID FK→crm_cards, subject TEXT, body_html TEXT, sender_email TEXT, recipient_email TEXT, sent_at TIMESTAMPTZ, attachment_names TEXT[], delivery_status TEXT, opened_at TIMESTAMPTZ, open_count INT, clicked_at TIMESTAMPTZ, click_count INT)
crm_card_tags (card_id UUID FK, tag_id UUID FK)
crm_tags (id UUID PK, name TEXT, color TEXT)
crm_attachments (id UUID PK, card_id UUID FK, file_name TEXT, file_path TEXT, file_size BIGINT, mime_type TEXT, created_at)
crm_revenue_targets (id UUID PK, year INT, month INT, target_amount NUMERIC)

-- Formations
trainings (id UUID PK, training_name TEXT, client_name TEXT, location TEXT, start_date DATE, end_date DATE, status TEXT, format_formation TEXT, prerequisites TEXT[], program_file_url TEXT, created_at, updated_at)
participants (id UUID PK, training_id UUID FK→trainings, first_name TEXT, last_name TEXT, email TEXT, company TEXT, position TEXT, status TEXT, created_at)
formation_dates (id UUID PK, training_id UUID FK, date DATE, start_time TIME, end_time TIME)
formation_configs (id UUID PK, training_id UUID FK, config_type TEXT, config_data JSONB)

-- Évaluations & Questionnaires
evaluation_analyses (id UUID PK, training_id UUID FK, analysis_data JSONB, created_at)
questionnaire_besoins (id UUID PK, training_id UUID FK, participant_id UUID FK, experience_details TEXT, competences_actuelles TEXT, competences_visees TEXT, besoins_accessibilite TEXT, commentaires_libres TEXT, created_at)

-- Missions
missions (id UUID PK, title TEXT, description TEXT, client_name TEXT, client_contact TEXT, status TEXT ['not_started','in_progress','completed','cancelled'], tags TEXT[], start_date DATE, end_date DATE, daily_rate NUMERIC, total_days NUMERIC, created_at)
mission_activities (id UUID PK, mission_id UUID FK, date DATE, hours NUMERIC, description TEXT, is_billable BOOL)
mission_pages (id UUID PK, mission_id UUID FK, title TEXT, content TEXT)

-- Devis / Quotes
quotes (id UUID PK, quote_number TEXT, crm_card_id UUID FK, status TEXT ['draft','generated','sent','signed','expired','canceled'], synthesis TEXT, instructions TEXT, email_subject TEXT, email_body TEXT, client_company TEXT, client_address TEXT, total_ht NUMERIC, total_ttc NUMERIC, line_items JSONB, pdf_path TEXT, email_sent_at TIMESTAMPTZ, created_at, updated_at)
activity_logs (id UUID PK, action_type TEXT, recipient_email TEXT, details JSONB, user_id UUID, created_at)
-- activity_logs with action_type='micro_devis_sent' contains micro-devis history in details JSONB (formation_name, client_name, nb_participants, type_subrogation, etc.)

-- Emails
inbound_emails (id UUID PK, subject TEXT, text_body TEXT, html_body TEXT, from_email TEXT, from_name TEXT, to_email TEXT, notes TEXT, status TEXT ['received','processed','archived','spam'], received_at TIMESTAMPTZ)
email_templates (id UUID PK, template_type TEXT, template_name TEXT, subject TEXT, html_content TEXT, is_default BOOL)

-- Support
support_tickets (id UUID PK, ticket_number TEXT, title TEXT, description TEXT, resolution_notes TEXT, type TEXT ['bug','evolution'], priority TEXT, status TEXT ['nouveau','en_cours','en_attente','resolu','ferme'], created_at)

-- Coaching
coaching_bookings (id UUID PK, participant_id UUID FK, training_id UUID FK, status TEXT, instructor_notes TEXT, learner_notes TEXT, requested_date TIMESTAMPTZ)
coaching_summaries (id UUID PK, booking_id UUID FK, participant_id UUID FK, training_id UUID FK, summary_text TEXT, key_topics JSONB, action_items JSONB, created_at)

-- Contenu / Éditorial
content_cards (id UUID PK, title TEXT, description TEXT, column_id UUID FK→content_columns, tags JSONB, display_order INT, created_at)
content_columns (id UUID PK, title TEXT, display_order INT)

-- OKR
okr_objectives (id UUID PK, title TEXT, description TEXT, period TEXT, status TEXT, progress NUMERIC, created_at)
okr_key_results (id UUID PK, objective_id UUID FK, title TEXT, target_value NUMERIC, current_value NUMERIC, unit TEXT)
okr_initiatives (id UUID PK, key_result_id UUID FK, title TEXT, status TEXT, due_date DATE)

-- E-learning (LMS)
lms_courses (id UUID PK, title TEXT, description TEXT, status TEXT, created_at)
lms_modules (id UUID PK, course_id UUID FK, title TEXT, description TEXT, display_order INT)
lms_lessons (id UUID PK, module_id UUID FK, title TEXT, description TEXT, content TEXT, transcript TEXT, lesson_type TEXT, display_order INT)

-- Statistiques
daily_action_analytics (id UUID PK, date DATE, total_actions INT, completed_actions INT, data JSONB)

-- Événements
events (id UUID PK, title TEXT, description TEXT, event_type TEXT, start_date TIMESTAMPTZ, end_date TIMESTAMPTZ, location TEXT, status TEXT, created_at)
`.trim();

// ── System prompt ────────────────────────────────────────────

function buildSystemPrompt(): string {
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
- Utilise execute_action pour effectuer des modifications (créer, mettre à jour, supprimer)
- Tu peux combiner les tools dans une même réponse
- Formate les montants en euros (€) et les dates en français
- Si une requête SQL échoue, analyse l'erreur et corrige la requête
- Ne retourne jamais de données brutes JSON — synthétise toujours pour l'utilisateur
- IMPORTANT : avant toute action d'écriture, décris ce que tu vas faire et demande confirmation à l'utilisateur. N'exécute l'action que si l'utilisateur confirme explicitement (oui, ok, vas-y, confirme, etc.)
- Si l'utilisateur demande une action et que tu n'as pas assez d'infos, pose des questions avant d'agir
- Pour les requêtes temporelles relatives ("cette semaine", "ce mois-ci", "les 7 derniers jours"), utilise la date actuelle ci-dessus pour calculer les bornes SQL appropriées

Schéma de la base de données :
${DB_SCHEMA}`;
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
            "Optional filter by source type(s): crm_card, crm_comment, crm_email, inbound_email, training, mission, quote, support_ticket, coaching_summary, content_card, lms_lesson, activity_log, crm_attachment, support_attachment",
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
      "Execute a write action on SuperTools data. ONLY use this AFTER the user has explicitly confirmed the action. Available actions: move_crm_card, update_crm_card, add_crm_comment, update_mission_status, update_ticket_status, update_quote_status, add_training_note.",
    input_schema: {
      type: "object" as const,
      properties: {
        action: {
          type: "string",
          enum: [
            "move_crm_card",
            "update_crm_card",
            "add_crm_comment",
            "update_mission_status",
            "update_ticket_status",
            "update_quote_status",
            "add_training_note",
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
): Promise<string> {
  switch (toolName) {
    case "query_database": {
      const sql = toolInput.sql as string;
      try {
        const { data, error } = await supabase.rpc("agent_sql_query", {
          query_text: sql,
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

      if (!OPENAI_API_KEY) {
        return JSON.stringify({ error: "OPENAI_API_KEY not configured for search" });
      }

      try {
        const embRes = await fetch("https://api.openai.com/v1/embeddings", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
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
        const queryEmbedding = embData.data?.[0]?.embedding;
        if (!queryEmbedding) {
          return JSON.stringify({ error: "Failed to generate query embedding" });
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

          case "add_training_note": {
            const { error } = await supabase
              .from("formation_configs")
              .insert({
                training_id: params.training_id,
                config_type: "agent_note",
                config_data: {
                  content: params.content,
                  author: params.author_email || "agent@supertools.ai",
                  created_at: new Date().toISOString(),
                },
              });
            if (error) return JSON.stringify({ error: error.message });
            return JSON.stringify({ success: true, message: "Note ajoutée à la formation" });
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
): Promise<{ fullResponse: string; updatedMessages: Message[] }> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const encoder = new TextEncoder();
  const write = (text: string) => writer.write(encoder.encode(text));

  const conversationMessages = [...messages];
  let fullResponse = "";

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
        system: buildSystemPrompt(),
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

          case "message_delta": {
            if (event.delta?.stop_reason) {
              stopReason = event.delta.stop_reason;
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
    if (stopReason === "end_turn" || stopReason !== "tool_use") {
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
      );
      toolResults.push({
        type: "tool_result",
        tool_use_id: toolBlock.id as string,
        content: toolResult,
      });
    }

    conversationMessages.push({ role: "user", content: toolResults });
  }

  return { fullResponse, updatedMessages: conversationMessages };
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
        model: "claude-haiku-4-5-20251001",
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

    const { message, conversation_id } = await req.json();

    if (!message || typeof message !== "string") {
      return createErrorResponse("message is required", 400);
    }

    const supabase = getSupabaseClient();
    const userId = authResult.sub || authResult.user_id;

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

    // Add user message
    messages.push({ role: "user", content: message });

    // Set up SSE stream
    const { readable, writable } = new TransformStream<Uint8Array>();
    const writer = writable.getWriter();

    // Run agent in background, writing to the stream
    (async () => {
      const encoder = new TextEncoder();
      try {
        const { fullResponse, updatedMessages } = await runAgentStreaming(
          messages,
          supabase,
          writer,
        );

        // Save conversation
        let title: string | undefined;

        if (conversationId) {
          await supabase
            .from("agent_conversations")
            .update({
              messages: updatedMessages,
              updated_at: new Date().toISOString(),
            })
            .eq("id", conversationId);
        } else {
          // Generate a smart title for new conversations
          title = await generateTitle(message, fullResponse);

          const { data: newConv } = await supabase
            .from("agent_conversations")
            .insert({
              user_id: userId,
              title,
              messages: updatedMessages,
              updated_at: new Date().toISOString(),
            })
            .select("id")
            .single();
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
