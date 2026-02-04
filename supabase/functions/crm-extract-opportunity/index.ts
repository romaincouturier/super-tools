import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  verifyAuth,
} from "../_shared/index.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

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

// Extract company name from email domain
function extractCompanyFromEmail(email: string): string | null {
  const match = email.match(/@([^.]+)\./);
  if (match) {
    const domain = match[1].toLowerCase();
    // Exclude common email providers
    const commonProviders = ["gmail", "yahoo", "hotmail", "outlook", "orange", "free", "sfr", "laposte", "wanadoo", "live", "icloud", "protonmail"];
    if (!commonProviders.includes(domain)) {
      // Capitalize first letter
      return domain.charAt(0).toUpperCase() + domain.slice(1);
    }
  }
  return null;
}

// Generate a unique ID for brief questions
function generateId(): string {
  return crypto.randomUUID();
}

async function extractWithAI(rawInput: string): Promise<ExtractionResult> {
  if (!ANTHROPIC_API_KEY) {
    throw new Error("ANTHROPIC_API_KEY not configured");
  }

  const systemPrompt = `Tu es un assistant qui analyse des demandes commerciales pour un organisme de formation professionnelle.

À partir du texte fourni, extrais les informations suivantes au format JSON:
- first_name: prénom de la personne
- last_name: nom de famille
- phone: numéro de téléphone (formaté)
- company: nom de l'entreprise
- email: adresse email
- linkedin_url: URL LinkedIn si mentionnée
- service_type: "formation" ou "mission" selon le contexte
- title: titre descriptif pour l'opportunité (format: "(ENTREPRISE) Intitulé de la prestation")
- brief_questions: tableau de 3-5 questions pertinentes à poser lors du brief initial

Règles:
- Si une information n'est pas présente, utilise null
- Le nom de l'entreprise peut être déduit du domaine de l'email
- Pour le titre, utilise le format "(ENTREPRISE) Description courte de la prestation"
- Les questions du brief doivent être pertinentes pour qualifier l'opportunité
- Si le type de prestation n'est pas clair, utilise null

Réponds UNIQUEMENT avec un JSON valide, sans texte autour.`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": ANTHROPIC_API_KEY,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-3-haiku-20240307",
      max_tokens: 1024,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: rawInput,
        },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("Anthropic API error:", errorText);
    throw new Error(`Failed to extract information: ${response.status}`);
  }

  const result = await response.json();
  const content = result.content[0]?.text || "{}";

  try {
    const extracted = JSON.parse(content);

    // If company is null but email exists, try to extract from email
    if (!extracted.company && extracted.email) {
      extracted.company = extractCompanyFromEmail(extracted.email);
    }

    // Generate title if not provided
    if (!extracted.title) {
      const companyPart = extracted.company ? `(${extracted.company.toUpperCase()})` : "(INCONNU)";
      const servicePart = extracted.service_type === "formation" ? "Formation" :
                          extracted.service_type === "mission" ? "Mission" : "Nouvelle opportunité";
      extracted.title = `${companyPart} ${servicePart}`;
    }

    // Add IDs to brief questions
    const briefQuestions: BriefQuestion[] = (extracted.brief_questions || []).map((q: string | { question: string }) => ({
      id: generateId(),
      question: typeof q === "string" ? q : q.question,
      answered: false,
    }));

    // If no questions were generated, add default ones
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
    };
  } catch (parseError) {
    console.error("Failed to parse AI response:", content);
    // Return default values with raw input as title
    return {
      first_name: null,
      last_name: null,
      phone: null,
      company: null,
      email: null,
      linkedin_url: null,
      service_type: null,
      title: "(INCONNU) Nouvelle opportunité",
      brief_questions: [
        { id: generateId(), question: "Quel est le contexte de cette demande ?", answered: false },
        { id: generateId(), question: "Quel est le budget envisagé ?", answered: false },
        { id: generateId(), question: "Quelle est l'échéance souhaitée ?", answered: false },
        { id: generateId(), question: "Combien de personnes sont concernées ?", answered: false },
      ],
    };
  }
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const supabase = getSupabaseClient();
    const authResult = await verifyAuth(req, supabase);

    if (!authResult.user) {
      return createErrorResponse("Non autorisé", 401);
    }

    const { raw_input } = await req.json();

    if (!raw_input || typeof raw_input !== "string") {
      return createErrorResponse("raw_input est requis", 400);
    }

    if (raw_input.length > 5000) {
      return createErrorResponse("Texte trop long (max 5000 caractères)", 400);
    }

    console.log("Extracting opportunity from:", raw_input.substring(0, 100));

    const extraction = await extractWithAI(raw_input);

    console.log("Extraction result:", JSON.stringify(extraction, null, 2));

    return createJsonResponse(extraction);
  } catch (error: unknown) {
    console.error("Error extracting opportunity:", error);
    const errorMessage = error instanceof Error ? error.message : "Échec de l'extraction";
    return createErrorResponse(errorMessage);
  }
});
