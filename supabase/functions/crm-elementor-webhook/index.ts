import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

/**
 * Edge Function: crm-elementor-webhook
 *
 * Public webhook for Elementor Pro Forms (WordPress).
 * Receives a form submission and creates a CRM opportunity card.
 *
 * Elementor "Webhook" action sends POST as either:
 *   - application/x-www-form-urlencoded (default)
 *   - multipart/form-data
 *   - application/json (if "Send as JSON" is enabled)
 *
 * Standard fields:
 *   - form_name, form_id
 *   - fields[<custom_id>][value], fields[<custom_id>][title], fields[<custom_id>][raw_value]
 *
 * "Advanced Data" toggle adds: form_url, user_agent, remote_ip, referrer, credit, page_url, page_title
 *
 * SECURITY: Validation by shared token. Configure ELEMENTOR_WEBHOOK_TOKEN
 * in project secrets, then add `?token=...` to the webhook URL in Elementor.
 */

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const ELEMENTOR_WEBHOOK_TOKEN = Deno.env.get("ELEMENTOR_WEBHOOK_TOKEN");

interface BriefQuestion {
  id: string;
  question: string;
  answered: boolean;
}

interface ExtractionResult {
  first_name: string | null;
  last_name: string | null;
  phone: string | null;
  company: string | null;
  email: string | null;
  linkedin_url: string | null;
  service_type: "formation" | "mission" | null;
  title: string;
  brief_questions: BriefQuestion[];
}

interface NormalizedField {
  id: string;
  title: string;
  value: string;
}

interface NormalizedSubmission {
  form_name?: string;
  form_id?: string;
  page_url?: string;
  page_title?: string;
  remote_ip?: string;
  user_agent?: string;
  referrer?: string;
  fields: NormalizedField[];
}

// ─── Helpers ────────────────────────────────────────────────────────────

function capitalizeName(name: string | null | undefined): string | null {
  if (!name) return null;
  return name.trim().toLowerCase().replace(/(^|[\s-])(\S)/g, (_m, sep, ch) => sep + ch.toUpperCase());
}

function normalizeEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  return email.trim().toLowerCase();
}

function extractCompanyFromEmail(email: string | null | undefined): string | null {
  if (!email) return null;
  const match = email.match(/@([^.]+)\./);
  if (match) {
    const domain = match[1].toLowerCase();
    const commonProviders = ["gmail", "yahoo", "hotmail", "outlook", "orange", "free", "sfr", "laposte", "wanadoo", "live", "icloud", "protonmail"];
    if (!commonProviders.includes(domain)) {
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }
  return null;
}

/**
 * Parse Elementor form data from URL-encoded / multipart payloads.
 * Keys look like:
 *   form_fields[name]=John
 *   form_fields[email]=john@x.com
 *   fields[name][value]=John
 *   fields[name][title]=Nom
 */
function normalizeFromForm(form: FormData | URLSearchParams): NormalizedSubmission {
  const fieldMap = new Map<string, { title?: string; value?: string }>();
  const out: NormalizedSubmission = { fields: [] };

  for (const [key, raw] of (form as any).entries()) {
    const value = typeof raw === "string" ? raw : String(raw);

    // Top-level meta
    if (key === "form_name" || key === "form_id" || key === "page_url" || key === "page_title" ||
        key === "remote_ip" || key === "user_agent" || key === "referrer") {
      (out as any)[key] = value;
      continue;
    }

    // form_fields[<id>] = value  (simple format)
    let m = key.match(/^form_fields\[([^\]]+)\]$/);
    if (m) {
      const id = m[1];
      const cur = fieldMap.get(id) ?? {};
      cur.value = value;
      fieldMap.set(id, cur);
      continue;
    }

    // fields[<id>][value|title|raw_value] = ...  (verbose format)
    m = key.match(/^fields\[([^\]]+)\]\[([^\]]+)\]$/);
    if (m) {
      const [, id, prop] = m;
      const cur = fieldMap.get(id) ?? {};
      if (prop === "value" || prop === "raw_value") cur.value = value;
      else if (prop === "title") cur.title = value;
      fieldMap.set(id, cur);
      continue;
    }
  }

  for (const [id, v] of fieldMap.entries()) {
    out.fields.push({ id, title: v.title ?? id, value: v.value ?? "" });
  }
  return out;
}

/**
 * Parse Elementor JSON payload ("Send as JSON" option).
 * Common shapes:
 *   { form: { name, id }, fields: { <id>: { value, title } } }
 *   { form_name, form_id, form_fields: { <id>: "value" } }
 */
function normalizeFromJson(payload: any): NormalizedSubmission {
  const out: NormalizedSubmission = { fields: [] };

  out.form_name = payload?.form?.name ?? payload?.form_name;
  out.form_id = payload?.form?.id ?? payload?.form_id;
  out.page_url = payload?.page_url ?? payload?.form_url;
  out.page_title = payload?.page_title;
  out.remote_ip = payload?.remote_ip;
  out.user_agent = payload?.user_agent;
  out.referrer = payload?.referrer;

  const fieldsObj = payload?.fields ?? payload?.form_fields ?? {};
  for (const [id, raw] of Object.entries(fieldsObj)) {
    if (raw && typeof raw === "object") {
      const r = raw as any;
      out.fields.push({ id, title: r.title ?? id, value: String(r.value ?? r.raw_value ?? "") });
    } else {
      out.fields.push({ id, title: id, value: String(raw ?? "") });
    }
  }
  return out;
}

/**
 * Heuristic detection of well-known fields by id/title.
 */
function detectField(submission: NormalizedSubmission, patterns: RegExp[]): string | null {
  for (const f of submission.fields) {
    const haystack = `${f.id} ${f.title}`.toLowerCase();
    if (patterns.some((p) => p.test(haystack))) {
      const v = f.value?.trim();
      if (v) return v;
    }
  }
  return null;
}

function buildRawInput(s: NormalizedSubmission): string {
  const lines: string[] = [];
  if (s.form_name) lines.push(`Formulaire: ${s.form_name}`);
  if (s.page_url) lines.push(`Page: ${s.page_url}`);
  lines.push("");
  for (const f of s.fields) {
    if (f.value) lines.push(`${f.title}: ${f.value}`);
  }
  return lines.join("\n");
}

// ─── AI extraction (mirrors resend-inbound-webhook) ─────────────────────

async function extractOpportunity(rawInput: string, fallbackEmail: string | null): Promise<ExtractionResult> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const systemPrompt = `Tu es un assistant qui analyse des soumissions de formulaire de contact pour un organisme de formation professionnelle.

À partir des données fournies, extrais les informations suivantes au format JSON:
- first_name, last_name, phone, company, email, linkedin_url
- service_type: "formation" ou "mission" (ou null si peu clair)
- title: "(ENTREPRISE) Description courte de la prestation"
- brief_questions: tableau de 3-5 questions pertinentes pour qualifier l'opportunité

Règles:
- Si une info est absente, utilise null
- Le nom de l'entreprise peut être déduit du domaine email
- Réponds UNIQUEMENT avec un JSON valide, sans texte autour.`;

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: rawInput },
      ],
    }),
  });

  if (!response.ok) {
    const t = await response.text();
    console.error("AI gateway error:", t);
    throw new Error(`AI extraction failed: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "{}";
  const cleanContent = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  let extracted: any = {};
  try {
    extracted = JSON.parse(cleanContent);
  } catch {
    const match = cleanContent.match(/\{[\s\S]*\}/);
    if (match) {
      try { extracted = JSON.parse(match[0]); } catch { /* noop */ }
    }
  }

  if (!extracted.email && fallbackEmail) extracted.email = fallbackEmail;
  if (!extracted.company && extracted.email) extracted.company = extractCompanyFromEmail(extracted.email);

  if (!extracted.title) {
    const companyPart = extracted.company ? `(${String(extracted.company).toUpperCase()})` : "(SITE WEB)";
    extracted.title = `${companyPart} Nouvelle opportunité`;
  }

  const briefQuestions: BriefQuestion[] = (extracted.brief_questions || []).map((q: any) => ({
    id: crypto.randomUUID(),
    question: typeof q === "string" ? q : q.question,
    answered: false,
  }));
  if (briefQuestions.length === 0) {
    briefQuestions.push(
      { id: crypto.randomUUID(), question: "Quel est le contexte de cette demande ?", answered: false },
      { id: crypto.randomUUID(), question: "Quel est le budget envisagé ?", answered: false },
      { id: crypto.randomUUID(), question: "Quelle est l'échéance souhaitée ?", answered: false },
      { id: crypto.randomUUID(), question: "Combien de personnes sont concernées ?", answered: false },
    );
  }

  return {
    first_name: extracted.first_name || null,
    last_name: extracted.last_name || null,
    phone: extracted.phone || null,
    company: extracted.company || null,
    email: extracted.email || null,
    linkedin_url: extracted.linkedin_url || null,
    service_type: extracted.service_type === "formation" || extracted.service_type === "mission" ? extracted.service_type : null,
    title: extracted.title,
    brief_questions: briefQuestions,
  };
}

// ─── Slack notification (best-effort) ───────────────────────────────────

async function notifySlack(supabase: any, card: { title: string; company?: string | null; first_name?: string | null; last_name?: string | null; service_type?: string | null; email?: string | null; form_name?: string }) {
  try {
    const { data: settings } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", "slack_crm_webhook_url")
      .single();
    const webhookUrl = settings?.setting_value;
    if (!webhookUrl) return;

    const contactName = [card.first_name, card.last_name].filter(Boolean).join(" ");
    const fields: { type: string; text: string }[] = [];
    if (contactName) fields.push({ type: "mrkdwn", text: `*Contact :* ${contactName}` });
    if (card.company) fields.push({ type: "mrkdwn", text: `*Entreprise :* ${card.company}` });
    if (card.email) fields.push({ type: "mrkdwn", text: `*Email :* ${card.email}` });

    const blocks: any[] = [
      { type: "header", text: { type: "plain_text", text: "🌐 Nouvelle opportunité (formulaire site web)", emoji: true } },
      { type: "section", text: { type: "mrkdwn", text: `*${card.title}*` } },
    ];
    if (fields.length > 0) blocks.push({ type: "section", fields });
    blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `Formulaire : ${card.form_name || "Elementor"}` }] });

    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: `Nouvelle opportunité (formulaire) : ${card.title}`, blocks }),
    });
  } catch (e) {
    console.error("Slack notification error (non-fatal):", e);
  }
}

// ─── Main handler ───────────────────────────────────────────────────────

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── Token validation ───
  if (!ELEMENTOR_WEBHOOK_TOKEN) {
    console.error("ELEMENTOR_WEBHOOK_TOKEN not configured");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const queryToken = url.searchParams.get("token");
  const headerToken = req.headers.get("x-webhook-token");
  const providedToken = queryToken || headerToken;

  if (providedToken !== ELEMENTOR_WEBHOOK_TOKEN) {
    console.error("Invalid webhook token");
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

  try {
    // ─── Parse payload (json | form-urlencoded | multipart) ───
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let submission: NormalizedSubmission;

    if (contentType.includes("application/json")) {
      const json = await req.json();
      submission = normalizeFromJson(json);
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      const text = await req.text();
      submission = normalizeFromForm(new URLSearchParams(text));
    } else if (contentType.includes("multipart/form-data")) {
      const fd = await req.formData();
      submission = normalizeFromForm(fd);
    } else {
      // Best-effort fallback: try JSON, then urlencoded
      const text = await req.text();
      try {
        submission = normalizeFromJson(JSON.parse(text));
      } catch {
        submission = normalizeFromForm(new URLSearchParams(text));
      }
    }

    console.log("Elementor submission received:", {
      form: submission.form_name,
      page: submission.page_url,
      fields_count: submission.fields.length,
    });

    if (submission.fields.length === 0) {
      return new Response(JSON.stringify({ error: "No form fields found in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Field detection (used as fallback if AI misses) ───
    const detectedEmail = normalizeEmail(detectField(submission, [/email|courriel|mail/]));
    const detectedPhone = detectField(submission, [/phone|tel|tél|mobile|portable/]);
    const detectedFirstName = detectField(submission, [/first[_\s-]?name|prenom|prénom/]);
    const detectedLastName = detectField(submission, [/last[_\s-]?name|surname|nom(?!bre)/]);
    const detectedCompany = detectField(submission, [/company|entreprise|société|societe|organisation/]);

    const rawInput = buildRawInput(submission);

    // ─── AI extraction ───
    let extraction: ExtractionResult;
    try {
      extraction = await extractOpportunity(rawInput, detectedEmail);
    } catch (e) {
      console.error("AI extraction failed, using detected fields fallback:", e);
      const company = detectedCompany || extractCompanyFromEmail(detectedEmail);
      const companyPart = company ? `(${company.toUpperCase()})` : "(SITE WEB)";
      extraction = {
        first_name: detectedFirstName,
        last_name: detectedLastName,
        phone: detectedPhone,
        company,
        email: detectedEmail,
        linkedin_url: null,
        service_type: null,
        title: `${companyPart} Nouvelle opportunité`,
        brief_questions: [
          { id: crypto.randomUUID(), question: "Quel est le contexte de cette demande ?", answered: false },
          { id: crypto.randomUUID(), question: "Quel est le budget envisagé ?", answered: false },
          { id: crypto.randomUUID(), question: "Quelle est l'échéance souhaitée ?", answered: false },
        ],
      };
    }

    // Apply fallbacks for any null fields the AI missed
    extraction.email = extraction.email || detectedEmail;
    extraction.phone = extraction.phone || detectedPhone;
    extraction.first_name = extraction.first_name || detectedFirstName;
    extraction.last_name = extraction.last_name || detectedLastName;
    extraction.company = extraction.company || detectedCompany || extractCompanyFromEmail(extraction.email);

    // ─── Find target column (first non-archived) ───
    const { data: firstColumn, error: colErr } = await supabase
      .from("crm_columns")
      .select("id")
      .eq("is_archived", false)
      .order("position", { ascending: true })
      .limit(1)
      .single();

    if (colErr || !firstColumn) {
      console.error("No CRM column available:", colErr);
      return new Response(JSON.stringify({ error: "No CRM column available" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingCards } = await supabase
      .from("crm_cards")
      .select("position")
      .eq("column_id", firstColumn.id)
      .order("position", { ascending: false })
      .limit(1);
    const maxPos = existingCards?.[0]?.position ?? -1;

    // ─── Create card ───
    const { data: newCard, error: cardError } = await supabase
      .from("crm_cards")
      .insert({
        column_id: firstColumn.id,
        title: extraction.title,
        position: maxPos + 1,
        sales_status: "OPEN",
        status_operational: "TODAY",
        estimated_value: 0,
        first_name: capitalizeName(extraction.first_name),
        last_name: capitalizeName(extraction.last_name),
        phone: extraction.phone || null,
        company: extraction.company || null,
        email: normalizeEmail(extraction.email),
        linkedin_url: extraction.linkedin_url || null,
        service_type: extraction.service_type || null,
        brief_questions: extraction.brief_questions as unknown,
        raw_input: rawInput,
        acquisition_source: "site_web",
      })
      .select()
      .single();

    if (cardError) {
      console.error("Error creating CRM card:", cardError);
      return new Response(JSON.stringify({ error: "Failed to create CRM card", details: cardError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("CRM card created from Elementor webhook:", newCard.id);

    await supabase.from("crm_activity_log").insert({
      card_id: newCard.id,
      action_type: "card_created",
      actor_email: "system@elementor",
      new_value: extraction.title,
    });

    // Slack notify (fire-and-forget)
    notifySlack(supabase, {
      title: extraction.title,
      company: extraction.company,
      first_name: extraction.first_name,
      last_name: extraction.last_name,
      service_type: extraction.service_type,
      email: extraction.email,
      form_name: submission.form_name,
    });

    return new Response(
      JSON.stringify({ success: true, card_id: newCard.id, title: extraction.title }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    console.error("Elementor webhook unexpected error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return new Response(JSON.stringify({ error: "Internal error", details: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
