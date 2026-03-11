import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";

const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const authResult = await verifyAuth(req.headers.get("Authorization"));
    if (!authResult) return createErrorResponse("Non autorisé", 401);

    const { synthesis, instructions, defaultVatRate = 20, catalogPricing } = await req.json();
    if (!synthesis && !instructions) {
      return createErrorResponse("synthesis ou instructions requis", 400);
    }

    // Build catalog pricing context if available
    let pricingContext = "";
    if (catalogPricing) {
      const parts = [`\nRÉFÉRENTIEL PRIX CATALOGUE :`];
      parts.push(`Formation : ${catalogPricing.formation_name}`);
      if (catalogPricing.formulas?.length > 0) {
        parts.push(`Formules disponibles :`);
        for (const f of catalogPricing.formulas) {
          parts.push(`  - ${f.name} : ${f.price != null ? f.price + "€ HT" : "prix non défini"}${f.duration_hours ? ` (${f.duration_hours}h)` : ""}`);
        }
        parts.push(`\nIMPORTANT : Si la synthèse ou les instructions mentionnent une formule spécifique, utilise le prix de CETTE FORMULE, pas le prix de base de la formation.`);
      }
      if (catalogPricing.formation_price != null) {
        parts.push(`Prix de base formation : ${catalogPricing.formation_price}€ HT${catalogPricing.formation_duration_hours ? ` (${catalogPricing.formation_duration_hours}h)` : ""}`);
      }
      pricingContext = parts.join("\n");
    }

    const systemPrompt = `Tu es un expert en chiffrage de prestations de conseil et formation professionnelle en France.

À partir de la synthèse d'opportunité et des instructions/notes du consultant, tu dois générer les lignes de devis détaillées avec les prix.

RÈGLES IMPÉRATIVES :
- Analyse les instructions pour extraire les prix, durées, quantités mentionnés
- Si un tarif journalier est mentionné, utilise-le exactement
- Si un référentiel prix catalogue est fourni, utilise les prix du catalogue (et en particulier le prix de la formule si une formule est identifiable)
- Si aucun prix n'est mentionné et pas de catalogue, propose un tarif cohérent pour le type de prestation (formation ~1200-1800€/jour, conseil ~1000-1500€/jour, coaching ~200-400€/session)
- Décompose la prestation en lignes distinctes et logiques
- Chaque ligne doit avoir un intitulé clair et une description utile
- L'unité par défaut est "jour" pour les formations, "forfait" pour les livrables, "heure" pour le coaching
- Le taux de TVA par défaut est ${defaultVatRate}%
- Inclus la préparation/ingénierie si pertinent (en général 0.5 à 1 jour par jour de formation)
- Si des frais de déplacement sont mentionnés dans les instructions, NE LES INCLUS PAS (ils sont gérés séparément)

IMPORTANT : Utilise la fonction suggest_quote_lines pour retourner les lignes.`;

    const userContent = [
      synthesis ? `=== SYNTHÈSE ===\n${synthesis}` : "",
      instructions ? `\n=== INSTRUCTIONS / NOTES DU CONSULTANT ===\n${instructions}` : "",
      pricingContext ? `\n=== ${pricingContext}` : "",
    ].filter(Boolean).join("\n");

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userContent },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "suggest_quote_lines",
              description: "Retourne les lignes de devis générées avec prix et descriptions",
              parameters: {
                type: "object",
                properties: {
                  lines: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        product: {
                          type: "string",
                          description: "Intitulé court de la prestation (ex: 'Formation React avancé')",
                        },
                        description: {
                          type: "string",
                          description: "Description détaillée de la prestation, objectifs, contenu",
                        },
                        quantity: {
                          type: "number",
                          description: "Nombre d'unités (ex: nombre de jours)",
                        },
                        unit: {
                          type: "string",
                          description: "Unité de facturation: jour, heure, forfait, session, participant",
                        },
                        unit_price_ht: {
                          type: "number",
                          description: "Prix unitaire HT en euros",
                        },
                        vat_rate: {
                          type: "number",
                          description: "Taux de TVA en pourcentage",
                        },
                      },
                      required: ["product", "description", "quantity", "unit", "unit_price_ht", "vat_rate"],
                      additionalProperties: false,
                    },
                  },
                  sale_type_suggestion: {
                    type: "string",
                    description: "Type de vente suggéré: 'formation', 'conseil', 'coaching', 'mixte'",
                  },
                },
                required: ["lines"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "suggest_quote_lines" } },
        temperature: 0.2,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI API error:", errText);
      if (response.status === 429) {
        return createErrorResponse("Trop de requêtes, réessayez dans quelques instants", 429);
      }
      if (response.status === 402) {
        return createErrorResponse("Crédits IA insuffisants", 402);
      }
      throw new Error(`AI API error: ${response.status}`);
    }

    const result = await response.json();

    // Extract tool call arguments
    const toolCall = result.choices?.[0]?.message?.tool_calls?.[0];
    if (!toolCall?.function?.arguments) {
      throw new Error("No tool call returned from AI");
    }

    let parsed: any;
    try {
      parsed = JSON.parse(toolCall.function.arguments);
    } catch {
      throw new Error("Invalid JSON in tool call response");
    }

    return createJsonResponse({
      lines: parsed.lines || [],
      sale_type_suggestion: parsed.sale_type_suggestion || null,
    });
  } catch (error: unknown) {
    console.error("Error in generate-quote-lines:", error);
    const msg = error instanceof Error ? error.message : "Erreur inconnue";
    return createErrorResponse(msg);
  }
});
