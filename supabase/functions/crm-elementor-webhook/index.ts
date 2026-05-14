import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

/**
 * Edge Function: crm-elementor-webhook
 *
 * Public webhook for Elementor Pro Forms (WordPress).
 * Mirrors the manual "Nouvelle opportunité" flow:
 *  1. AI extraction (rich prompt: tags + suggested_next_action, same as crm-extract-opportunity)
 *  2. Value estimation from CRM history (averaged WON deals)
 *  3. Acquisition source detection (existing email -> "nouvelle_mission", else "site_web")
 *  4. Card insert in "Entrant" column (or first non-archived) with description_html + emoji
 *  5. Suggested tags assignment via crm_card_tags
 *  6. Slack notification
 */

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
const ELEMENTOR_WEBHOOK_TOKEN = Deno.env.get("ELEMENTOR_WEBHOOK_TOKEN");

const RANDOM_EMOJIS = [
  "🚀", "💡", "🎯", "⭐", "🔥", "💎", "🏆", "📈", "🤝", "💼",
  "🎪", "🌟", "⚡", "🎲", "🎸", "🌈", "🦁", "🐙", "🎨", "🍀",
  "🧩", "🔮", "🎁", "🛸", "🌊", "🏔️", "🎵", "🦊", "🐝", "🌻",
];
const pickRandomEmoji = () => RANDOM_EMOJIS[Math.floor(Math.random() * RANDOM_EMOJIS.length)];

interface BriefQuestion {
  id: string;
  question: string;
  answered: boolean;
}

interface SuggestedNextAction {
  text: string;
  date: string; // YYYY-MM-DD
}

interface AvailableTag {
  id: string;
  name: string;
  category?: string | null;
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
  suggested_tag_ids: string[];
  suggested_next_action: SuggestedNextAction | null;
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

function todayParisISO(): string {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Europe/Paris",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

/** Build HTML paragraphs from raw text — mirrors NewOpportunityDialog. */
function buildDescriptionHtml(rawInput: string): string {
  return rawInput
    .replace(/\r\n/g, "\n")
    .replace(/[\u2028\u2029]/g, "\n")
    .replace(/\n[ \t]*\n/g, "\n\n")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n\n")
    .map((paragraph) => {
      const lines = paragraph.split("\n").map((line) =>
        line.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;"),
      );
      return `<p>${lines.join("<br>") || "<br>"}</p>`;
    })
    .join("");
}

function normalizeFromForm(form: FormData | URLSearchParams): NormalizedSubmission {
  const fieldMap = new Map<string, { title?: string; value?: string }>();
  const out: NormalizedSubmission = { fields: [] };

  for (const [key, raw] of (form as any).entries()) {
    const value = typeof raw === "string" ? raw : String(raw);

    if (key === "form_name" || key === "form_id" || key === "page_url" || key === "page_title" ||
        key === "remote_ip" || key === "user_agent" || key === "referrer") {
      (out as any)[key] = value;
      continue;
    }

    let m = key.match(/^form_fields\[([^\]]+)\]$/);
    if (m) {
      const id = m[1];
      const cur = fieldMap.get(id) ?? {};
      cur.value = value;
      fieldMap.set(id, cur);
      continue;
    }

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

// ─── AI extraction (mirrors crm-extract-opportunity) ────────────────────

function buildSystemPrompt(today: string, availableTags: AvailableTag[]): string {
  const tagList = availableTags.length > 0
    ? availableTags.map((t) => `- "${t.name}"${t.category ? ` (${t.category})` : ""}`).join("\n")
    : "(aucun tag disponible)";

  return `Tu es un assistant qui analyse des demandes commerciales pour un organisme de formation professionnelle.

Date du jour : ${today} (utilise-la pour calculer la date de la prochaine action).

À partir du texte fourni, extrais les informations suivantes au format JSON:
- first_name, last_name, phone, company, email, linkedin_url
- service_type: "formation" ou "mission" (ou null si peu clair)
- title: intitulé court de la prestation, SANS le nom du client ni de l'entreprise (ex: "Formation management", "Mission audit RH")
- brief_questions: tableau de 3-5 questions pertinentes pour qualifier l'opportunité
- suggested_tag_names: tableau de noms de tags pertinents (vide si aucun) choisis STRICTEMENT parmi la liste ci-dessous
- suggested_next_action: objet { text: "Action courte à mener", date: "YYYY-MM-DD" } recommandant la prochaine action commerciale, ou null

Tags disponibles (ne propose RIEN d'autre que des noms de cette liste, copie le nom exactement) :
${tagList}

Règles:
- Si une info est absente, utilise null
- Le nom de l'entreprise peut être déduit du domaine email
- suggested_tag_names: ne JAMAIS inventer de tag ; si rien ne matche, renvoie []
- suggested_next_action.date: format strict YYYY-MM-DD, postérieure ou égale à aujourd'hui ; déduis-la du ton (urgent → 1-2 jours, standard → 3-7 jours, "je vous tiens au courant" → 10-15 jours)

Réponds UNIQUEMENT avec un JSON valide, sans texte autour.`;
}

function normalizeNextAction(raw: unknown, today: string): SuggestedNextAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { text?: unknown; date?: unknown };
  const text = typeof r.text === "string" ? r.text.trim() : "";
  const date = typeof r.date === "string" ? r.date.trim() : "";
  if (!text || !date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  return { text, date: date < today ? today : date };
}

function resolveSuggestedTagIds(rawNames: unknown, available: AvailableTag[]): string[] {
  if (!Array.isArray(rawNames)) return [];
  const byName = new Map(available.map((t) => [t.name.toLowerCase(), t.id]));
  const ids: string[] = [];
  for (const n of rawNames) {
    if (typeof n !== "string") continue;
    const id = byName.get(n.toLowerCase().trim());
    if (id && !ids.includes(id)) ids.push(id);
  }
  return ids;
}

async function extractOpportunity(
  rawInput: string,
  fallbackEmail: string | null,
  availableTags: AvailableTag[],
): Promise<ExtractionResult> {
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const today = todayParisISO();

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${LOVABLE_API_KEY}` },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: buildSystemPrompt(today, availableTags) },
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
    extracted.title = extracted.service_type === "formation"
      ? "Formation"
      : extracted.service_type === "mission"
        ? "Mission"
        : "Nouvelle opportunité";
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
    suggested_tag_ids: resolveSuggestedTagIds(extracted.suggested_tag_names, availableTags),
    suggested_next_action: normalizeNextAction(extracted.suggested_next_action, today),
  };
}

// ─── Value estimation from CRM history (mirrors NewOpportunityDialog) ───

async function estimateValueFromHistory(
  supabase: any,
  extraction: ExtractionResult,
): Promise<number> {
  try {
    const { data } = await supabase
      .from("crm_cards")
      .select("estimated_value, service_type, company")
      .eq("sales_status", "WON")
      .gt("estimated_value", 0);

    if (!data || data.length === 0) return 0;

    let matches = data.filter((c: any) =>
      extraction.company &&
      c.company?.toLowerCase() === extraction.company.toLowerCase() &&
      extraction.service_type &&
      c.service_type === extraction.service_type,
    );

    if (matches.length === 0 && extraction.company) {
      matches = data.filter((c: any) => c.company?.toLowerCase() === extraction.company?.toLowerCase());
    }

    if (matches.length === 0 && extraction.service_type) {
      matches = data.filter((c: any) => c.service_type === extraction.service_type);
    }

    if (matches.length === 0) matches = data;

    const avg = matches.reduce((sum: number, c: any) => sum + (c.estimated_value || 0), 0) / matches.length;
    return Math.max(0, Math.round(avg / 100) * 100);
  } catch {
    return 0;
  }
}

// ─── Acquisition source detection (mirrors NewOpportunityDialog) ────────

async function detectAcquisitionSource(
  supabase: any,
  email: string | null,
): Promise<"site_web" | "nouvelle_mission"> {
  if (email) {
    const { data: existingCards } = await supabase
      .from("crm_cards")
      .select("id")
      .eq("email", email)
      .limit(1);
    if (existingCards && existingCards.length > 0) return "nouvelle_mission";
  }
  return "site_web";
}

// ─── Slack notification (best-effort) ───────────────────────────────────

async function notifySlack(supabase: any, card: { title: string; company?: string | null; first_name?: string | null; last_name?: string | null; email?: string | null; form_name?: string }) {
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

  if (!ELEMENTOR_WEBHOOK_TOKEN) {
    console.error("ELEMENTOR_WEBHOOK_TOKEN not configured");
    return new Response(JSON.stringify({ error: "Webhook not configured" }), {
      status: 503,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const url = new URL(req.url);
  const providedToken = url.searchParams.get("token") || req.headers.get("x-webhook-token");
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
    // ─── Parse payload ───
    const contentType = (req.headers.get("content-type") || "").toLowerCase();
    let submission: NormalizedSubmission;

    if (contentType.includes("application/json")) {
      submission = normalizeFromJson(await req.json());
    } else if (contentType.includes("application/x-www-form-urlencoded")) {
      submission = normalizeFromForm(new URLSearchParams(await req.text()));
    } else if (contentType.includes("multipart/form-data")) {
      submission = normalizeFromForm(await req.formData());
    } else {
      const text = await req.text();
      try {
        submission = normalizeFromJson(JSON.parse(text));
      } catch {
        submission = normalizeFromForm(new URLSearchParams(text));
      }
    }

    console.log("Elementor submission:", { form: submission.form_name, fields: submission.fields.length });

    if (submission.fields.length === 0) {
      return new Response(JSON.stringify({ error: "No form fields found in payload" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // ─── Field detection (fallback) ───
    const detectedEmail = normalizeEmail(detectField(submission, [/email|courriel|mail/]));
    const detectedPhone = detectField(submission, [/phone|tel|tél|mobile|portable/]);
    const detectedFirstName = detectField(submission, [/first[_\s-]?name|prenom|prénom/]);
    const detectedLastName = detectField(submission, [/last[_\s-]?name|surname|nom(?!bre)/]);
    const detectedCompany = detectField(submission, [/company|entreprise|société|societe|organisation/]);

    const rawInput = buildRawInput(submission);

    // ─── Fetch available tags ───
    const { data: tagsData } = await supabase
      .from("crm_tags")
      .select("id, name, category")
      .limit(100);
    const availableTags: AvailableTag[] = (tagsData || []).map((t: any) => ({
      id: t.id, name: t.name, category: t.category ?? null,
    }));

    // ─── AI extraction ───
    let extraction: ExtractionResult;
    try {
      extraction = await extractOpportunity(rawInput, detectedEmail, availableTags);
    } catch (e) {
      console.error("AI extraction failed, using detected fields fallback:", e);
      const company = detectedCompany || extractCompanyFromEmail(detectedEmail);
      extraction = {
        first_name: detectedFirstName,
        last_name: detectedLastName,
        phone: detectedPhone,
        company,
        email: detectedEmail,
        linkedin_url: null,
        service_type: null,
        title: "Nouvelle opportunité",
        brief_questions: [
          { id: crypto.randomUUID(), question: "Quel est le contexte de cette demande ?", answered: false },
          { id: crypto.randomUUID(), question: "Quel est le budget envisagé ?", answered: false },
          { id: crypto.randomUUID(), question: "Quelle est l'échéance souhaitée ?", answered: false },
        ],
        suggested_tag_ids: [],
        suggested_next_action: null,
      };
    }

    // Apply fallbacks for any null fields the AI missed
    extraction.email = extraction.email || detectedEmail;
    extraction.phone = extraction.phone || detectedPhone;
    extraction.first_name = extraction.first_name || detectedFirstName;
    extraction.last_name = extraction.last_name || detectedLastName;
    extraction.company = extraction.company || detectedCompany || extractCompanyFromEmail(extraction.email);

    // ─── Value estimation + acquisition source ───
    const [estimatedValue, acquisitionSource] = await Promise.all([
      estimateValueFromHistory(supabase, extraction),
      detectAcquisitionSource(supabase, extraction.email),
    ]);

    // ─── Pick column: "Entrant" first, else first non-archived ───
    const { data: columns } = await supabase
      .from("crm_columns")
      .select("id, name")
      .eq("is_archived", false)
      .order("position", { ascending: true });

    const targetColumn = columns?.find((c: any) => c.name === "Entrant") || columns?.[0];
    if (!targetColumn) {
      return new Response(JSON.stringify({ error: "No CRM column available" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: existingCards } = await supabase
      .from("crm_cards")
      .select("position")
      .eq("column_id", targetColumn.id)
      .order("position", { ascending: false })
      .limit(1);
    const maxPos = existingCards?.[0]?.position ?? -1;

    // ─── Next action: always today (text from AI suggestion or default) ───
    const today = todayParisISO();
    const nextActionDate = today;
    const nextActionText = extraction.suggested_next_action?.text || "Recontacter le prospect (formulaire site web)";

    // ─── Create card ───
    const { data: newCard, error: cardError } = await supabase
      .from("crm_cards")
      .insert({
        column_id: targetColumn.id,
        title: extraction.title,
        description_html: buildDescriptionHtml(rawInput),
        position: maxPos + 1,
        sales_status: "OPEN",
        status_operational: "WAITING",
        waiting_next_action_date: nextActionDate,
        waiting_next_action_text: nextActionText,
        estimated_value: estimatedValue,
        first_name: capitalizeName(extraction.first_name),
        last_name: capitalizeName(extraction.last_name),
        phone: extraction.phone || null,
        company: extraction.company || null,
        email: normalizeEmail(extraction.email),
        linkedin_url: extraction.linkedin_url || null,
        service_type: extraction.service_type || null,
        brief_questions: extraction.brief_questions as unknown,
        raw_input: rawInput,
        acquisition_source: acquisitionSource,
        emoji: pickRandomEmoji(),
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

    console.log("CRM card created:", newCard.id);

    // ─── Activity log ───
    await supabase.from("crm_activity_log").insert({
      card_id: newCard.id,
      action_type: "card_created",
      actor_email: "system@elementor",
      new_value: extraction.title,
    });

    // ─── Persist suggested tags ───
    if (extraction.suggested_tag_ids.length > 0) {
      const tagRows = extraction.suggested_tag_ids.map((tag_id) => ({ card_id: newCard.id, tag_id }));
      const { error: tagErr } = await supabase.from("crm_card_tags").insert(tagRows);
      if (tagErr) console.error("Tag assignment error (non-fatal):", tagErr);
    }

    // ─── Slack ───
    notifySlack(supabase, {
      title: extraction.title,
      company: extraction.company,
      first_name: extraction.first_name,
      last_name: extraction.last_name,
      email: extraction.email,
      form_name: submission.form_name,
    });

    return new Response(
      JSON.stringify({
        success: true,
        card_id: newCard.id,
        title: extraction.title,
        column: targetColumn.name,
        estimated_value: estimatedValue,
        tags_assigned: extraction.suggested_tag_ids.length,
      }),
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
