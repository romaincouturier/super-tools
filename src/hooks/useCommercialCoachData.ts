import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { v4 as uuidv4 } from "uuid";
import { supabase } from "@/integrations/supabase/client";
import { loadArenaApiKeys, saveArenaApiKeys } from "@/lib/arena/api";
import { TEMPLATES } from "@/lib/arena/templates";
import type { SessionConfig, ApiKeys } from "@/lib/arena/types";
import type { CrmColumn, CrmCard, CrmRevenueTarget, CommercialCoachContext } from "@/types/crm";
import type { OKRObjective, OKRKeyResult } from "@/types/okr";
import type { Mission } from "@/types/missions";
import { useToast } from "@/hooks/use-toast";

// Re-export context builders + helpers so existing imports still work
export {
  fmtEuro,
  buildAmbitionContext,
  buildOKRContext,
  buildCRMContext,
  buildAcquisitionContext,
  buildRevenueTargetContext,
  buildCalendarContext,
  buildMissionsContext,
  buildFormationsContext,
  buildCrmCommentsContext,
  buildCrmEmailsContext,
  buildTrainingEvaluationsContext,
  buildSponsorEvaluationsContext,
  buildMissionActivitiesContext,
  buildCrmActivityLogContext,
} from "@/lib/commercial-coach-context";

import {
  buildAmbitionContext,
  buildOKRContext,
  buildCRMContext,
  buildAcquisitionContext,
  buildRevenueTargetContext,
  buildCalendarContext,
  buildMissionsContext,
  buildFormationsContext,
  buildCrmCommentsContext,
  buildCrmEmailsContext,
  buildTrainingEvaluationsContext,
  buildSponsorEvaluationsContext,
  buildMissionActivitiesContext,
  buildCrmActivityLogContext,
} from "@/lib/commercial-coach-context";

// Claude is always available via server-side key
export function hasAnyProvider(_keys: ApiKeys): boolean {
  return true;
}

// Main hook
export function useCommercialCoachData() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);

  const launchCoach = async (customTopic?: string) => {
    setIsLoading(true);
    try {
      const apiKeys = await loadArenaApiKeys();

      const [
        okrRes, columnsRes, cardsRes, missionsRes, trainingsRes, catalogueRes,
        revenueTargetsRes, coachContextsRes,
        commentsRes, emailsRes, evalRes, sponsorEvalRes, missionActivitiesRes, activityLogRes,
      ] =
        await Promise.all([
          supabase
            .from("okr_objectives")
            .select(`*, okr_key_results ( id, title, description, target_value, current_value, unit, progress_percentage, confidence_level )`)
            .in("status", ["active", "draft"])
            .order("position", { ascending: true }),
          supabase
            .from("crm_columns")
            .select("*")
            .eq("is_archived", false)
            .order("position", { ascending: true }),
          supabase.from("crm_cards").select("*").order("position", { ascending: true }),
          supabase
            .from("missions")
            .select("*")
            .order("position", { ascending: true }),
          supabase
            .from("trainings")
            .select("id, training_name, client_name, start_date, end_date, sold_price_ht")
            .gte("start_date", new Date().toISOString().slice(0, 10))
            .order("start_date", { ascending: true }),
          supabase
            .from("formation_configs")
            .select("formation_name, prix, duree_heures")
            .order("display_order", { ascending: true }),
          supabase
            .from("crm_revenue_targets")
            .select("*")
            .order("period_start", { ascending: true }),
          supabase
            .from("commercial_coach_contexts")
            .select("*")
            .eq("year", new Date().getFullYear())
            .order("context_type", { ascending: true }),
          supabase
            .from("crm_comments")
            .select("card_id, author_email, content, created_at")
            .eq("is_deleted", false)
            .gte("created_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false })
            .limit(100),
          supabase
            .from("crm_card_emails")
            .select("card_id, sender_email, recipient_email, subject, sent_at")
            .gte("sent_at", new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
            .order("sent_at", { ascending: false })
            .limit(100),
          supabase
            .from("training_evaluations")
            .select("appreciation_generale, recommandation, message_recommandation, amelioration_suggeree, company, trainings!inner(training_name)")
            .eq("etat", "soumis")
            .order("date_soumission", { ascending: false })
            .limit(100),
          supabase
            .from("sponsor_cold_evaluations")
            .select("satisfaction_globale, recommandation, message_recommandation, points_forts, axes_amelioration, impact_competences, objectifs_atteints, sponsor_name, company, trainings!inner(training_name)")
            .eq("etat", "soumis")
            .order("date_soumission", { ascending: false })
            .limit(50),
          supabase
            .from("mission_activities")
            .select("description, activity_date, duration, duration_type, billable_amount, is_billed, missions!inner(title)")
            .gte("activity_date", new Date(Date.now() - 180 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10))
            .order("activity_date", { ascending: false })
            .limit(100),
          supabase
            .from("crm_activity_log")
            .select("card_id, action_type, old_value, new_value, created_at")
            .gte("created_at", new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString())
            .order("created_at", { ascending: false })
            .limit(200),
        ]);

      // Fetch calendar events (non-blocking)
      let calendarEvents: { summary: string; start: string; end: string; allDay: boolean; attendees: string[] }[] = [];
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          const calRes = await fetch(
            `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/google-calendar-events?action=events`,
            { headers: { Authorization: `Bearer ${session.access_token}` } }
          );
          if (calRes.ok) {
            const calData = await calRes.json();
            calendarEvents = calData.events || [];
          }
        }
      } catch {
        // Calendar not connected
      }

      // Check errors
      const errors: string[] = [];
      if (okrRes.error) errors.push(`OKR: ${okrRes.error.message}`);
      if (columnsRes.error) errors.push(`CRM colonnes: ${columnsRes.error.message}`);
      if (cardsRes.error) errors.push(`CRM cartes: ${cardsRes.error.message}`);
      if (missionsRes.error) errors.push(`Missions: ${(missionsRes.error as Error).message}`);
      if (trainingsRes.error) errors.push(`Formations: ${trainingsRes.error.message}`);
      if (catalogueRes.error) errors.push(`Catalogue: ${catalogueRes.error.message}`);
      if (revenueTargetsRes.error) console.warn("Revenue targets fetch error:", revenueTargetsRes.error.message);

      if (errors.length > 0) {
        toast({
          title: "Erreur de chargement",
          description: `Impossible de charger certaines donnees: ${errors.join(", ")}`,
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      // Cast data
      const okrData = (okrRes.data || []) as (OKRObjective & { okr_key_results: OKRKeyResult[] })[];
      const columnsData = (columnsRes.data || []) as CrmColumn[];
      const cardsData = (cardsRes.data || []) as unknown as CrmCard[];
      const missionsData = (missionsRes.data || []) as Mission[];
      const trainingsData = (trainingsRes.data || []) as { id: string; training_name: string; client_name: string; start_date: string; end_date: string | null; sold_price_ht: number | null }[];
      const catalogueData = (catalogueRes.data || []) as { formation_name: string; prix: number | null; duree_heures: number | null }[];
      const revenueTargetsData = (revenueTargetsRes.data || []) as CrmRevenueTarget[];
      const coachContexts = (coachContextsRes.data || []) as CommercialCoachContext[];
      const ambitionText = coachContexts.find((c) => c.context_type === "ambition")?.content;
      const acquisitionText = coachContexts.find((c) => c.context_type === "acquisition_structure")?.content;

      const commentsData = (commentsRes?.data || []) as { card_id: string; author_email: string; content: string; created_at: string }[];
      const emailsData = (emailsRes?.data || []) as { card_id: string; sender_email: string; recipient_email: string; subject: string; sent_at: string }[];
      const evalData = (evalRes?.data || []).map((e) => ({
        training_name: e.trainings?.training_name || "Inconnue",
        appreciation_generale: e.appreciation_generale,
        recommandation: e.recommandation,
        message_recommandation: e.message_recommandation,
        amelioration_suggeree: e.amelioration_suggeree,
        company: e.company,
      }));
      const sponsorEvalData = (sponsorEvalRes?.data || []).map((e) => ({
        training_name: e.trainings?.training_name || "Inconnue",
        sponsor_name: e.sponsor_name,
        company: e.company,
        satisfaction_globale: e.satisfaction_globale,
        recommandation: e.recommandation,
        message_recommandation: e.message_recommandation,
        points_forts: e.points_forts,
        axes_amelioration: e.axes_amelioration,
        impact_competences: e.impact_competences,
        objectifs_atteints: e.objectifs_atteints,
      }));
      const missionActivitiesData = (missionActivitiesRes?.data || []).map((a) => ({
        mission_title: a.missions?.title || "Inconnue",
        description: a.description,
        activity_date: a.activity_date,
        duration: a.duration,
        duration_type: a.duration_type,
        billable_amount: a.billable_amount,
        is_billed: a.is_billed,
      }));
      const activityLogData = (activityLogRes?.data || []) as { card_id: string; action_type: string; old_value: string | null; new_value: string | null; created_at: string }[];

      // Build context blocks
      const ambitionContext = buildAmbitionContext(okrData, ambitionText);
      const okrContext = buildOKRContext(okrData);
      const crmContext = buildCRMContext(columnsData, cardsData);
      const acquisitionContext = buildAcquisitionContext(cardsData, missionsData, acquisitionText);
      const missionsContext = buildMissionsContext(missionsData);
      const formationsContext = buildFormationsContext(trainingsData, catalogueData);
      const wonCards = cardsData.filter((c) => c.sales_status === "WON");
      const revenueTargetContext = buildRevenueTargetContext(revenueTargetsData, wonCards);
      const calendarContext = buildCalendarContext(calendarEvents);
      const commentsContext = buildCrmCommentsContext(commentsData, cardsData);
      const emailsContext = buildCrmEmailsContext(emailsData, cardsData);
      const evalContext = buildTrainingEvaluationsContext(evalData);
      const sponsorEvalContext = buildSponsorEvaluationsContext(sponsorEvalData);
      const missionActivitiesContext = buildMissionActivitiesContext(missionActivitiesData);
      const activityLogContext = buildCrmActivityLogContext(activityLogData, cardsData);

      const today = new Date().toLocaleDateString("fr-FR", {
        weekday: "long",
        year: "numeric",
        month: "long",
        day: "numeric",
      });

      const additionalContext = `=== DONNEES COMMERCIALES EN TEMPS REEL (${today}) ===

--- AMBITION ANNUELLE ---
${ambitionContext}

--- OBJECTIFS CHIFFRE D'AFFAIRES ---
${revenueTargetContext}

--- OKR PERIODIQUES ---
${okrContext}

--- PIPELINE CRM (avec indices de confiance, velocite, stagnation) ---
${crmContext}

--- COMMENTAIRES CRM (echanges et notes sur les deals) ---
${commentsContext}

--- EMAILS CRM (historique de communication) ---
${emailsContext}

--- ACTIVITE CRM (mouvements et engagement recent) ---
${activityLogContext}

--- STRUCTURE D'ACQUISITION CLIENTS ---
${acquisitionContext}

--- KANBAN MISSIONS ---
${missionsContext}

--- ACTIVITES MISSIONS (delivery et facturation) ---
${missionActivitiesContext}

--- FORMATIONS ---
${formationsContext}

--- EVALUATIONS FORMATIONS (satisfaction participants) ---
${evalContext}

--- EVALUATIONS COMMANDITAIRES (satisfaction sponsors/decideurs) ---
${sponsorEvalContext}

--- AGENDA (14 prochains jours) ---
${calendarContext}

=== FIN DES DONNEES ===

Instructions : Utilisez TOUTES ces donnees reelles pour analyser la situation commerciale. Portez une attention particuliere a :
1. L'ambition annuelle et l'ecart avec la situation actuelle
2. Les objectifs CA et la progression par periode (mensuel/trimestriel)
3. Les deals gagnes ET perdus pour comprendre les patterns de conversion, les raisons de perte
4. Les indices de confiance pour identifier les deals a risque ou a accelerer
5. La velocite commerciale (delai moyen de closing, deals stagnants)
6. La structure d'acquisition (formation vs mission, sources) pour optimiser l'allocation d'effort
7. La capacite de delivery vs le pipeline ouvert et les activites missions
8. L'agenda pour contextualiser les recommandations d'actions avec les rendez-vous a venir
9. Les commentaires et emails CRM pour identifier les preoccupations clients et le niveau d'engagement
10. Les evaluations formation et commanditaires pour identifier la qualite du service et les opportunites d'upsell
11. Les activites missions (facturation, delivery) pour evaluer la sante financiere et la charge
Ne demandez pas de donnees supplementaires, tout est ci-dessus.`;

      // Build session config from template
      const template = TEMPLATES.find((t) => t.id === "coach-commercial");
      if (!template) {
        toast({
          title: "Erreur",
          description: "Template Coach Commercial introuvable.",
          variant: "destructive",
        });
        setIsLoading(false);
        return;
      }

      const availableProvider: "claude" | "openai" | "gemini" = "claude";
      const defaultModel = "claude-haiku-4-5-20251001";

      const config: SessionConfig = {
        topic:
          customTopic ||
          "Analyse ma situation commerciale complete et produis un plan d'action structure avec : (1) ecart entre ambition annuelle et objectifs CA, (2) actions prioritaires cette semaine avec priorisation par indice de confiance et velocite, (3) plan de prospection physique pour missions et facilitation, (4) strategie d'acquisition en ligne pour les formations avec analyse des sources, (5) analyse des deals gagnes/perdus avec raisons de perte et patterns, (6) deals stagnants a debloquer, (7) jalons lies aux OKR, (8) recommandations basees sur l'agenda des 14 prochains jours.",
        additionalContext,
        mode: template.mode,
        userMode: "interventionist",
        agents: template.agents.map((a, i) => ({
          ...a,
          id: uuidv4(),
          provider: availableProvider,
          model: defaultModel,
          color: a.color || ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6"][i],
        })),
        rules: template.rules,
      };

      sessionStorage.setItem("ai-arena-config", JSON.stringify(config));
      sessionStorage.setItem("ai-arena-api-keys", JSON.stringify(apiKeys));
      saveArenaApiKeys(apiKeys);
      navigate("/arena/discussion");
    } catch (err) {
      console.error("Erreur lancement Coach Commercial:", err);
      toast({
        title: "Erreur inattendue",
        description: "Impossible de lancer le Coach Commercial. Verifiez la console pour plus de details.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return { launchCoach, isLoading };
}
