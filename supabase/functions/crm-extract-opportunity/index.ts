import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/mod.ts";

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

function extractCompanyFromEmail(email: string): string | null {
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

function generateId(): string {
  return crypto.randomUUID();
}

function buildSystemPrompt(today: string, availableTags: AvailableTag[]): string {
  const tagList = availableTags.length > 0
    ? availableTags.map((t) => `- "${t.name}"${t.category ? ` (${t.category})` : ""}`).join("\n")
    : "(aucun tag disponible)";

  return `Tu es un assistant qui analyse des demandes commerciales pour un organisme de formation professionnelle.

Date du jour : ${today} (utilise-la pour calculer la date de la prochaine action).

À partir du texte fourni, extrais les informations suivantes au format JSON:
- first_name: prénom de la personne
- last_name: nom de famille
- phone: numéro de téléphone (formaté)
- company: nom de l'entreprise
- email: adresse email
- linkedin_url: URL LinkedIn si mentionnée
- service_type: "formation" ou "mission" selon le contexte
- title: titre descriptif court pour l'opportunité (intitulé de la prestation, sans le nom du client ni de l'entreprise)
- brief_questions: tableau de 3-5 questions pertinentes à poser lors du brief initial
- suggested_tag_names: tableau de noms de tags pertinents (vide si aucun) choisis STRICTEMENT parmi la liste de tags disponibles ci-dessous
- suggested_next_action: objet { text: "Action courte à mener", date: "YYYY-MM-DD" } recommandant la prochaine action commerciale, ou null si aucune action évidente

Tags disponibles (ne propose RIEN d'autre que des noms de cette liste, copie le nom exactement) :
${tagList}

Règles:
- Si une information n'est pas présente, utilise null
- Le nom de l'entreprise peut être déduit du domaine de l'email
- Pour le titre, donne uniquement l'intitulé de la prestation (ex: "Formation management", "Mission audit RH"). Ne PAS inclure le nom du client ou de l'entreprise dans le titre
- Les questions du brief doivent être pertinentes pour qualifier l'opportunité
- Si le type de prestation n'est pas clair, utilise null
- suggested_tag_names: ne JAMAIS inventer de tag ; si rien ne matche, renvoie []
- suggested_next_action.text: court et actionnable (ex: "Envoyer une proposition commerciale", "Appeler pour qualifier le besoin", "Relancer après réflexion")
- suggested_next_action.date: format strict YYYY-MM-DD, postérieure ou égale à la date du jour ; déduis-la du ton du message (urgent → 1-2 jours, demande standard → 3-7 jours, "je vous tiens au courant" → 10-15 jours)

Réponds UNIQUEMENT avec un JSON valide, sans texte autour.`;
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10);
}

function normalizeNextAction(
  raw: unknown,
  today: string,
): SuggestedNextAction | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as { text?: unknown; date?: unknown };
  const text = typeof r.text === "string" ? r.text.trim() : "";
  const date = typeof r.date === "string" ? r.date.trim() : "";
  if (!text || !date) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  // Clamp past dates to today
  const clamped = date < today ? today : date;
  return { text, date: clamped };
}

function resolveSuggestedTagIds(
  rawNames: unknown,
  available: AvailableTag[],
): string[] {
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

async function extractWithAI(
  rawInput: string,
  availableTags: AvailableTag[],
): Promise<ExtractionResult> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const today = todayISO();

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: buildSystemPrompt(today, availableTags) },
        { role: "user", content: rawInput },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", errorText);
    throw new Error(`Failed to extract information: ${response.status}`);
  }

  const result = await response.json();
  const content = result.choices?.[0]?.message?.content || "{}";

  // Strip markdown code fences if present
  const cleanContent = content.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "").trim();

  try {
    const extracted = JSON.parse(cleanContent);

    if (!extracted.company && extracted.email) {
      extracted.company = extractCompanyFromEmail(extracted.email);
    }

    if (!extracted.title) {
      const servicePart = extracted.service_type === "formation" ? "Formation" :
                          extracted.service_type === "mission" ? "Mission" : "Nouvelle opportunité";
      extracted.title = servicePart;
    }

    const briefQuestions: BriefQuestion[] = (extracted.brief_questions || []).map((q: string | { question: string }) => ({
      id: generateId(),
      question: typeof q === "string" ? q : q.question,
      answered: false,
    }));

    if (briefQuestions.length === 0) {
      briefQuestions.push(
        { id: generateId(), question: "Quel est le contexte de cette demande ?", answered: false },
        { id: generateId(), question: "Quel est le budget envisagé ?", answered: false },
        { id: generateId(), question: "Quelle est l'échéance souhaitée ?", answered: false },
        { id: generateId(), question: "Combien de personnes sont concernées ?", answered: false }
      );
    }

    return {
      first_name: extracted.first_name || null,
      last_name: extracted.last_name || null,
      phone: extracted.phone || null,
      company: extracted.company || null,
      email: extracted.email || null,
      linkedin_url: extracted.linkedin_url || null,
      service_type: extracted.service_type || null,
      title: extracted.title,
      brief_questions: briefQuestions,
      suggested_tag_ids: resolveSuggestedTagIds(extracted.suggested_tag_names, availableTags),
      suggested_next_action: normalizeNextAction(extracted.suggested_next_action, today),
    };
  } catch (parseError) {
    console.error("Failed to parse AI response:", cleanContent);
    return {
      first_name: null,
      last_name: null,
      phone: null,
      company: null,
      email: null,
      linkedin_url: null,
      service_type: null,
      title: "Nouvelle opportunité",
      brief_questions: [
        { id: generateId(), question: "Quel est le contexte de cette demande ?", answered: false },
        { id: generateId(), question: "Quel est le budget envisagé ?", answered: false },
        { id: generateId(), question: "Quelle est l'échéance souhaitée ?", answered: false },
        { id: generateId(), question: "Combien de personnes sont concernées ?", answered: false },
      ],
      suggested_tag_ids: [],
      suggested_next_action: null,
    };
  }
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const authHeader = req.headers.get("Authorization");
    const authResult = await verifyAuth(authHeader);

    if (!authResult) {
      return createErrorResponse("Non autorisé", 401);
    }

    const { raw_input, available_tags } = await req.json();

    if (!raw_input || typeof raw_input !== "string") {
      return createErrorResponse("raw_input est requis", 400);
    }

    if (raw_input.length > 15000) {
      return createErrorResponse("Texte trop long (max 15000 caractères)", 400);
    }

    const truncatedInput = raw_input.length > 5000 ? raw_input.substring(0, 5000) : raw_input;

    // available_tags is optional ; sanitize on entry to avoid prompt injection via category text
    const safeTags: AvailableTag[] = Array.isArray(available_tags)
      ? available_tags
          .filter((t: unknown): t is { id: string; name: string; category?: string | null } =>
            !!t && typeof t === "object" &&
            typeof (t as { id?: unknown }).id === "string" &&
            typeof (t as { name?: unknown }).name === "string",
          )
          .slice(0, 100)
          .map((t) => ({
            id: t.id,
            name: t.name.slice(0, 60),
            category: typeof t.category === "string" ? t.category.slice(0, 60) : null,
          }))
      : [];

    console.log("Extracting opportunity from:", raw_input.substring(0, 100), "with", safeTags.length, "tags");

    const extraction = await extractWithAI(truncatedInput, safeTags);

    console.log("Extraction result:", JSON.stringify(extraction, null, 2));

    return createJsonResponse(extraction);
  } catch (error: unknown) {
    console.error("Error extracting opportunity:", error);
    const errorMessage = error instanceof Error ? error.message : "Échec de l'extraction";
    return createErrorResponse(errorMessage);
  }
});
