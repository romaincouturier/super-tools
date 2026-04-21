import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
  getSupabaseClient,
} from "../_shared/mod.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

interface SummaryRequest {
  action: "summarize_page" | "summarize_mission";
  mission_id: string;
  page_id?: string; // Required for summarize_page
}

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  if (!LOVABLE_API_KEY) {
    throw new Error("LOVABLE_API_KEY not configured");
  }

  const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LOVABLE_API_KEY}`,
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("AI Gateway error:", errorText);
    throw new Error(`AI API error: ${response.status}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || "";
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authHeader = req.headers.get("Authorization");
    const authResult = await verifyAuth(authHeader);
    if (!authResult) {
      return createErrorResponse("Non autorisé", 401);
    }

    const { action, mission_id, page_id } = (await req.json()) as SummaryRequest;

    if (!action || !mission_id) {
      return createErrorResponse("action et mission_id sont requis", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch mission data
    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("*")
      .eq("id", mission_id)
      .single();

    if (missionError || !mission) {
      return createErrorResponse("Mission introuvable", 404);
    }

    let result: string;

    if (action === "summarize_page") {
      if (!page_id) {
        return createErrorResponse("page_id est requis pour summarize_page", 400);
      }

      const { data: page, error: pageError } = await supabase
        .from("mission_pages")
        .select("*")
        .eq("id", page_id)
        .single();

      if (pageError || !page) {
        return createErrorResponse("Page introuvable", 404);
      }

      const pageText = page.content ? stripHtml(page.content) : "";
      if (!pageText || pageText.length < 10) {
        return createErrorResponse("La page ne contient pas assez de contenu pour générer un résumé", 400);
      }

      const systemPrompt = `Tu es un assistant expert pour un consultant-formateur indépendant. Tu résumes des pages de documentation de mission.

Ton résumé doit être :
- Concis mais complet (3-8 points clés)
- Structuré avec des puces
- En français
- Focalisé sur les informations actionnables et les décisions importantes`;

      const userPrompt = `Résume cette page de mission :

**Mission :** ${mission.title}
${mission.client_name ? `**Client :** ${mission.client_name}` : ""}

**Titre de la page :** ${page.title}

**Contenu :**
${pageText.substring(0, 6000)}`;

      result = await callAI(systemPrompt, userPrompt);
    } else if (action === "summarize_mission") {
      // Fetch all activities
      const { data: activities } = await supabase
        .from("mission_activities")
        .select("*")
        .eq("mission_id", mission_id)
        .order("activity_date", { ascending: true });

      // Fetch all pages
      const { data: pages } = await supabase
        .from("mission_pages")
        .select("id, title, content")
        .eq("mission_id", mission_id)
        .order("position", { ascending: true });

      // Fetch contacts
      const { data: contacts } = await supabase
        .from("mission_contacts")
        .select("*")
        .eq("mission_id", mission_id)
        .order("is_primary", { ascending: false });

      // Build context
      let context = `# Mission : ${mission.title}\n`;
      if (mission.description) context += `**Description :** ${mission.description}\n`;
      if (mission.client_name) context += `**Client :** ${mission.client_name}\n`;
      context += `**Statut :** ${mission.status}\n`;
      if (mission.start_date) context += `**Début :** ${mission.start_date}\n`;
      if (mission.end_date) context += `**Fin :** ${mission.end_date}\n`;

      // Financial
      if (mission.initial_amount) context += `**Budget initial :** ${mission.initial_amount}€\n`;
      if (mission.consumed_amount) context += `**Consommé :** ${mission.consumed_amount}€\n`;
      if (mission.billed_amount) context += `**Facturé :** ${mission.billed_amount}€\n`;
      if (mission.daily_rate) context += `**TJM :** ${mission.daily_rate}€\n`;
      if (mission.total_days) context += `**Jours prévus :** ${mission.total_days}\n`;

      // Contacts
      if (contacts && contacts.length > 0) {
        context += `\n## Contacts\n`;
        for (const c of contacts) {
          const name = [c.first_name, c.last_name].filter(Boolean).join(" ");
          context += `- ${name}${c.role ? ` (${c.role})` : ""}${c.is_primary ? " [Principal]" : ""}\n`;
        }
      }

      // Activities
      if (activities && activities.length > 0) {
        context += `\n## Activités (${activities.length})\n`;
        for (const a of activities) {
          context += `- ${a.activity_date} | ${a.description} | ${a.duration}${a.duration_type === "hours" ? "h" : "j"}`;
          if (a.billable_amount) context += ` | ${a.billable_amount}€`;
          if (a.is_billed) context += ` [Facturé]`;
          context += "\n";
        }
      }

      // Pages (truncated to fit context)
      if (pages && pages.length > 0) {
        context += `\n## Pages de documentation (${pages.length})\n`;
        let totalPageChars = 0;
        const maxPageChars = 4000;
        for (const p of pages) {
          if (totalPageChars > maxPageChars) {
            context += `\n(... et ${pages.length - pages.indexOf(p)} autres pages)\n`;
            break;
          }
          const text = p.content ? stripHtml(p.content) : "";
          const truncated = text.substring(0, 500);
          context += `\n### ${p.title}\n${truncated}${text.length > 500 ? "..." : ""}\n`;
          totalPageChars += truncated.length;
        }
      }

      const systemPrompt = `Tu es un assistant expert pour un consultant-formateur indépendant. Tu génères des synthèses complètes de missions.

Ta synthèse doit être :
- Structurée et professionnelle
- En français
- Utile pour un bilan de mission ou un reporting client

Utilise le format suivant :
1. **Résumé exécutif** (2-3 phrases)
2. **Points clés** (puces)
3. **Avancement financier** (si des données sont disponibles)
4. **Livrables et documentation** (résumé des pages/travaux)
5. **Prochaines étapes suggérées** (si pertinent)`;

      const userPrompt = `Génère une synthèse complète de cette mission :\n\n${context}`;

      result = await callAI(systemPrompt, userPrompt);
    } else {
      return createErrorResponse("Action non reconnue", 400);
    }

    return createJsonResponse({ result });
  } catch (error: unknown) {
    console.error("Error in generate-mission-summary:", error);
    const errorMessage = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(errorMessage);
  }
});
