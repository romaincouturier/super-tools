import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";

/**
 * Universal document indexing edge function.
 *
 * Modes:
 *   1. Index a single record:  { source_type, source_id }
 *   2. Backfill a whole type:  { source_type, backfill: true }
 *
 * For each record the function:
 *   - Extracts text content from the relevant table/columns
 *   - Splits into chunks if > 6000 chars
 *   - Generates embeddings via OpenAI text-embedding-3-small
 *   - Upserts into document_embeddings
 */

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
const MAX_CHUNK_CHARS = 6000;
const EMBEDDING_MODEL = "text-embedding-3-small";

// ── Source type definitions ──────────────────────────────────

interface ExtractedDoc {
  source_id: string;
  content: string;
  source_title: string;
  source_date: string;
  metadata: Record<string, unknown>;
}

type Extractor = (
  supabase: ReturnType<typeof getSupabaseClient>,
  sourceId?: string,
) => Promise<ExtractedDoc[]>;

/** Strip HTML tags to plain text */
function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Build a query — either a single record or all records */
function buildQuery(
  supabase: ReturnType<typeof getSupabaseClient>,
  table: string,
  columns: string,
  sourceId?: string,
) {
  let q = supabase.from(table).select(columns);
  if (sourceId) {
    q = q.eq("id", sourceId);
  } else {
    q = q.order("created_at", { ascending: false }).limit(500);
  }
  return q;
}

// ── Extractors per source type ───────────────────────────────

const extractors: Record<string, Extractor> = {
  async crm_card(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "crm_cards",
      "id, title, description_html, waiting_next_action_text, created_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [r.title, stripHtml(r.description_html || ""), r.waiting_next_action_text].filter(Boolean).join("\n"),
      source_title: r.title,
      source_date: r.created_at,
      metadata: {},
    }));
  },

  async crm_comment(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "crm_comments",
      "id, content, card_id, author_email, created_at",
      sourceId,
    );
    return (data || []).filter((r) => !r.is_deleted).map((r) => ({
      source_id: r.id,
      content: r.content,
      source_title: `Commentaire CRM par ${r.author_email}`,
      source_date: r.created_at,
      metadata: { card_id: r.card_id, author_email: r.author_email },
    }));
  },

  async crm_email(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "crm_card_emails",
      "id, subject, body_html, sender_email, recipient_email, card_id, sent_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [r.subject, stripHtml(r.body_html || "")].filter(Boolean).join("\n"),
      source_title: r.subject,
      source_date: r.sent_at,
      metadata: { card_id: r.card_id, sender_email: r.sender_email, recipient_email: r.recipient_email },
    }));
  },

  async inbound_email(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "inbound_emails",
      "id, subject, text_body, html_body, from_email, from_name, to_email, notes, received_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [r.subject, r.text_body || stripHtml(r.html_body || ""), r.notes].filter(Boolean).join("\n"),
      source_title: r.subject || `Email de ${r.from_name || r.from_email}`,
      source_date: r.received_at,
      metadata: { from_email: r.from_email, from_name: r.from_name, to_email: r.to_email },
    }));
  },

  async training(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "trainings",
      "id, training_name, location, client_name, prerequisites, format_formation, created_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [
        r.training_name,
        `Client: ${r.client_name}`,
        `Lieu: ${r.location}`,
        `Format: ${r.format_formation}`,
        r.prerequisites?.length ? `Prérequis: ${r.prerequisites.join(", ")}` : "",
      ].filter(Boolean).join("\n"),
      source_title: r.training_name,
      source_date: r.created_at,
      metadata: { client_name: r.client_name },
    }));
  },

  async mission(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "missions",
      "id, title, description, client_name, client_contact, tags, status, created_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [r.title, r.description, `Client: ${r.client_name}`, r.tags?.join(", ")].filter(Boolean).join("\n"),
      source_title: r.title,
      source_date: r.created_at,
      metadata: { client_name: r.client_name, status: r.status },
    }));
  },

  async quote(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "quotes",
      "id, quote_number, synthesis, instructions, email_subject, email_body, client_company, status, total_ttc, created_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [
        `Devis ${r.quote_number}`,
        r.synthesis,
        r.instructions,
        `Client: ${r.client_company}`,
        r.email_subject,
        r.email_body,
      ].filter(Boolean).join("\n"),
      source_title: `Devis ${r.quote_number} — ${r.client_company}`,
      source_date: r.created_at,
      metadata: { status: r.status, total_ttc: r.total_ttc, client_company: r.client_company },
    }));
  },

  async support_ticket(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "support_tickets",
      "id, ticket_number, title, description, resolution_notes, type, priority, status, created_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [r.title, r.description, r.resolution_notes].filter(Boolean).join("\n"),
      source_title: `${r.ticket_number} — ${r.title}`,
      source_date: r.created_at,
      metadata: { type: r.type, priority: r.priority, status: r.status },
    }));
  },

  async coaching_summary(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "coaching_summaries",
      "id, summary_text, key_topics, action_items, training_id, participant_id, created_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: r.summary_text,
      source_title: "Résumé de coaching",
      source_date: r.created_at,
      metadata: { training_id: r.training_id, participant_id: r.participant_id },
    }));
  },

  async content_card(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "content_cards",
      "id, title, description, tags, created_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [r.title, r.description].filter(Boolean).join("\n"),
      source_title: r.title,
      source_date: r.created_at,
      metadata: { tags: r.tags },
    }));
  },

  async lms_lesson(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "lms_lessons",
      "id, title, description, content, transcript, created_at",
      sourceId,
    );
    return (data || []).map((r) => ({
      source_id: r.id,
      content: [r.title, r.description, stripHtml(r.content || ""), r.transcript].filter(Boolean).join("\n"),
      source_title: r.title,
      source_date: r.created_at,
      metadata: {},
    }));
  },

  async activity_log(supabase, sourceId) {
    const { data } = await buildQuery(
      supabase,
      "activity_logs",
      "id, action_type, recipient_email, details, created_at",
      sourceId,
    );
    return (data || [])
      .filter((r) => r.action_type === "micro_devis_sent")
      .map((r) => {
        const d = (r.details || {}) as Record<string, unknown>;
        return {
          source_id: r.id,
          content: [
            `Micro-devis envoyé à ${r.recipient_email}`,
            d.formation_name ? `Formation: ${d.formation_name}` : "",
            d.client_name ? `Client: ${d.client_name}` : "",
          ].filter(Boolean).join("\n"),
          source_title: `Micro-devis — ${d.formation_name || r.recipient_email}`,
          source_date: r.created_at,
          metadata: { recipient_email: r.recipient_email, ...d },
        };
      });
  },
};

// ── Embedding generation ─────────────────────────────────────

async function generateEmbedding(text: string): Promise<number[] | null> {
  if (!OPENAI_API_KEY || !text.trim()) return null;

  try {
    const res = await fetch("https://api.openai.com/v1/embeddings", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: EMBEDDING_MODEL,
        input: text.slice(0, 8000),
      }),
    });

    if (!res.ok) {
      console.error("OpenAI embedding error:", res.status, await res.text());
      return null;
    }

    const data = await res.json();
    return data.data?.[0]?.embedding || null;
  } catch (e) {
    console.error("Embedding generation failed:", e);
    return null;
  }
}

/** Split text into chunks of ~MAX_CHUNK_CHARS, breaking at sentence boundaries */
function chunkText(text: string): string[] {
  if (text.length <= MAX_CHUNK_CHARS) return [text];

  const chunks: string[] = [];
  let remaining = text;

  while (remaining.length > 0) {
    if (remaining.length <= MAX_CHUNK_CHARS) {
      chunks.push(remaining);
      break;
    }

    // Find a sentence boundary near the limit
    let cutPoint = remaining.lastIndexOf(". ", MAX_CHUNK_CHARS);
    if (cutPoint < MAX_CHUNK_CHARS * 0.5) {
      cutPoint = remaining.lastIndexOf(" ", MAX_CHUNK_CHARS);
    }
    if (cutPoint < MAX_CHUNK_CHARS * 0.5) {
      cutPoint = MAX_CHUNK_CHARS;
    }

    chunks.push(remaining.slice(0, cutPoint + 1).trim());
    remaining = remaining.slice(cutPoint + 1).trim();
  }

  return chunks;
}

// ── Main handler ─────────────────────────────────────────────

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const { source_type, source_id, backfill } = await req.json();

    if (!source_type || !extractors[source_type]) {
      return createErrorResponse(
        `Invalid source_type. Supported: ${Object.keys(extractors).join(", ")}`,
        400,
      );
    }

    if (!backfill && !source_id) {
      return createErrorResponse("source_id is required (or set backfill: true)", 400);
    }

    if (!OPENAI_API_KEY) {
      return createErrorResponse("OPENAI_API_KEY not configured", 500);
    }

    const supabase = getSupabaseClient();
    const extractor = extractors[source_type];

    // Extract documents
    const docs = await extractor(supabase, backfill ? undefined : source_id);

    let indexed = 0;
    let errors = 0;

    for (const doc of docs) {
      try {
        if (!doc.content.trim()) continue;

        const chunks = chunkText(doc.content);

        for (let i = 0; i < chunks.length; i++) {
          const embedding = await generateEmbedding(chunks[i]);
          if (!embedding) {
            errors++;
            continue;
          }

          const { error } = await supabase.from("document_embeddings").upsert(
            {
              source_type,
              source_id: doc.source_id,
              chunk_index: i,
              content: chunks[i],
              embedding: JSON.stringify(embedding),
              source_title: doc.source_title,
              source_date: doc.source_date,
              metadata: doc.metadata,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "source_type,source_id,chunk_index" },
          );

          if (error) {
            console.error("Upsert error:", error);
            errors++;
          } else {
            indexed++;
          }
        }

        // Small delay to respect OpenAI rate limits during backfill
        if (backfill && docs.length > 10) {
          await new Promise((r) => setTimeout(r, 200));
        }
      } catch (e) {
        console.error(`Error indexing ${doc.source_id}:`, e);
        errors++;
      }
    }

    return createJsonResponse({
      success: true,
      source_type,
      documents_found: docs.length,
      chunks_indexed: indexed,
      errors,
    });
  } catch (error: unknown) {
    console.error("Index-documents error:", error);
    const msg = error instanceof Error ? error.message : "Erreur interne";
    return createErrorResponse(msg);
  }
});
