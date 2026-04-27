import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { getSupabaseClient } from "../_shared/supabase-client.ts";
import { CLAUDE_DEFAULT } from "../_shared/claude-models.ts";

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { prompt, mode, objectiveId, year } = await req.json();

    if (!prompt && !mode) {
      return new Response(JSON.stringify({ error: "Prompt ou mode requis" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anthropicKey = Deno.env.get("ANTHROPIC_API_KEY");
    const supabase = getSupabaseClient();

    const targetYear = year || new Date().getFullYear();

    // ─── Load OKR data ───

    const { data: objectives } = await supabase
      .from("okr_objectives")
      .select("*")
      .eq("target_year", targetYear)
      .order("position", { ascending: true });

    const objectiveIds = (objectives || []).map((o: any) => o.id);

    const { data: keyResults } = objectiveIds.length
      ? await supabase
          .from("okr_key_results")
          .select("*")
          .in("objective_id", objectiveIds)
          .order("position", { ascending: true })
      : { data: [] };

    const { data: checkIns } = objectiveIds.length
      ? await supabase
          .from("okr_check_ins")
          .select("*")
          .in("objective_id", objectiveIds)
          .order("check_in_date", { ascending: false })
          .limit(100)
      : { data: [] };

    const { data: initiatives } = (keyResults || []).length
      ? await supabase
          .from("okr_initiatives")
          .select("*")
          .in("key_result_id", (keyResults || []).map((kr: any) => kr.id))
      : { data: [] };

    const { data: participants } = objectiveIds.length
      ? await supabase
          .from("okr_participants")
          .select("*")
          .in("objective_id", objectiveIds)
      : { data: [] };

    // ─── Build context ───

    const okrContext = JSON.stringify({
      year: targetYear,
      objectives: (objectives || []).map((o: any) => ({
        id: o.id,
        title: o.title,
        description: o.description,
        status: o.status,
        time_target: o.time_target,
        progress: o.progress_percentage,
        confidence: o.confidence_level,
        cadence: o.cadence,
        owner: o.owner_email,
        next_review: o.next_review_date,
        created_at: o.created_at,
        key_results: (keyResults || [])
          .filter((kr: any) => kr.objective_id === o.id)
          .map((kr: any) => ({
            title: kr.title,
            progress: kr.progress_percentage,
            confidence: kr.confidence_level,
            current_value: kr.current_value,
            target_value: kr.target_value,
            unit: kr.unit,
            initiatives: (initiatives || [])
              .filter((i: any) => i.key_result_id === kr.id)
              .map((i: any) => ({
                title: i.title,
                status: i.status,
                progress: i.progress_percentage,
              })),
          })),
        check_ins: (checkIns || [])
          .filter((ci: any) => ci.objective_id === o.id)
          .slice(0, 10)
          .map((ci: any) => ({
            date: ci.check_in_date,
            progress: ci.new_progress,
            confidence: ci.new_confidence,
            notes: ci.notes,
          })),
        participants: (participants || [])
          .filter((p: any) => p.objective_id === o.id)
          .map((p: any) => ({ name: p.name, email: p.email, role: p.role })),
      })),
    }, null, 0);

    // ─── Build prompt based on mode ───

    let userPrompt = prompt || "";

    if (mode === "audit") {
      userPrompt = `Réalise un audit qualité de tous mes OKRs selon ces critères :
- Mesurabilité (les KR ont-ils des valeurs cibles chiffrées ?)
- Focus outcome (les objectifs sont-ils orientés résultat, pas activité ?)
- Clarté ownership (y a-t-il un responsable clairement identifié ?)
- Scope réaliste (le nombre de KR est-il raisonnable, 2-5 par objectif ?)

Présente le résultat sous forme de tableau avec un score de 1 à 5 par critère pour chaque objectif.
Ajoute une note diagnostique courte par objectif et un résumé des faiblesses récurrentes.
Ne réécris pas les OKRs, évalue-les seulement.`;
    }

    if (mode === "draft_checkin" && objectiveId) {
      const targetObj = (objectives || []).find((o: any) => o.id === objectiveId);
      userPrompt = `Génère un brouillon de check-in pour l'objectif "${targetObj?.title || objectiveId}".
Analyse les derniers check-ins et la progression des KRs pour :
1. Suggérer un nouveau pourcentage de progression (justifié)
2. Suggérer un niveau de confiance (justifié)
3. Rédiger des notes de suivi qui résument les avancées, les blocages, et les prochaines étapes
Sois concis et factuel. Réponds en JSON avec les champs : suggested_progress, suggested_confidence, suggested_notes.`;
    }

    if (mode === "executive_summary") {
      userPrompt = `Génère un résumé exécutif de nos OKRs pour ${targetYear}. Inclus :
1. Vue d'ensemble (progression globale, confiance moyenne)
2. Top 3 victoires (objectifs avec le plus de progrès)
3. Top 3 risques (objectifs en danger avec raisons)
4. Changements notables des 2 dernières semaines
5. 3 recommandations de focus pour la semaine
Sois direct et orienté action. Format markdown.`;
    }

    if (mode === "risk_report") {
      userPrompt = `Identifie tous les KRs avec une confiance inférieure à 60% ou une progression en retard par rapport au calendrier.
Pour chacun :
- Classement par sévérité
- Résumé de la cause racine (3 phrases max)
- Actions de mitigation proposées
- Dépendances cross-team à signaler
Ton direct et orienté action.`;
    }

    const systemPrompt = `Tu es l'assistant IA des OKRs de SuperTilt. Tu as accès aux données OKR complètes de l'organisation pour l'année ${targetYear}.

Voici les données OKR actuelles :
${okrContext}

Règles :
- Réponds toujours en français
- Base tes réponses uniquement sur les données fournies
- Sois concis, factuel et orienté action
- Utilise le markdown pour la mise en forme
- Si on te demande un JSON, réponds uniquement avec du JSON valide, sans markdown autour
- Ne fabrique jamais de données que tu n'as pas
- Date du jour : ${new Date().toISOString().split("T")[0]}`;

    // ─── Call LLM ───

    if (!anthropicKey) {
      // Fallback: use Lovable AI
      const lovableResponse = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
          max_tokens: 4000,
          temperature: 0.3,
        }),
      });

      const lovableData = await lovableResponse.json();
      const answer = lovableData.choices?.[0]?.message?.content || "Pas de réponse";

      return new Response(JSON.stringify({ answer, mode }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const response = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_DEFAULT,
        max_tokens: 4000,
        temperature: 0.3,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      }),
    });

    const data = await response.json();
    const answer = data.content?.[0]?.text || "Pas de réponse";

    return new Response(JSON.stringify({ answer, mode }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("OKR AI Assistant error:", error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
