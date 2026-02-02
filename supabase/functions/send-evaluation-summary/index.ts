import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface EvaluationSummary {
  training_id: string;
  training_name: string;
  sponsor_email: string;
  sponsor_first_name: string;
  trainer_name: string;
  start_date: string;
  end_date: string | null;
  participants_count: number;
  evaluations_count: number;
  average_score: number;
  objectives_scores: { label: string; score: number }[];
  nps_score: number | null;
  strengths: string[];
  improvements: string[];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);
    const { trainingId, customMessage } = await req.json();

    if (!trainingId) {
      return new Response(
        JSON.stringify({ error: "Training ID is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get training details
    const { data: training, error: trainingError } = await supabase
      .from("trainings")
      .select("*")
      .eq("id", trainingId)
      .single();

    if (trainingError || !training) {
      return new Response(
        JSON.stringify({ error: "Training not found" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!training.sponsor_email) {
      return new Response(
        JSON.stringify({ error: "No sponsor email configured for this training" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get participants count
    const { count: participantsCount } = await supabase
      .from("training_participants")
      .select("*", { count: "exact", head: true })
      .eq("training_id", trainingId);

    // Get evaluations
    const { data: evaluations, error: evalError } = await supabase
      .from("training_evaluations")
      .select("*")
      .eq("training_id", trainingId)
      .eq("etat", "soumis");

    if (evalError) {
      throw evalError;
    }

    if (!evaluations || evaluations.length === 0) {
      return new Response(
        JSON.stringify({ error: "No evaluations submitted for this training" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Calculate statistics
    const evaluationsCount = evaluations.length;

    // Average overall score
    const overallScores = evaluations
      .map(e => e.appreciation_globale)
      .filter(s => s != null);
    const averageScore = overallScores.length > 0
      ? overallScores.reduce((a, b) => a + b, 0) / overallScores.length
      : 0;

    // Objectives scores
    const objectivesScores: { label: string; score: number }[] = [];
    const objectives = training.objectifs_pedagogiques || [];
    objectives.forEach((obj: string, index: number) => {
      const scores = evaluations
        .map(e => {
          const objScores = e.objectifs_atteints || {};
          return objScores[`objectif_${index + 1}`];
        })
        .filter(s => s != null);
      if (scores.length > 0) {
        objectivesScores.push({
          label: obj,
          score: scores.reduce((a, b) => a + b, 0) / scores.length,
        });
      }
    });

    // NPS calculation
    const npsScores = evaluations
      .map(e => e.recommandation_nps)
      .filter(s => s != null);
    let npsScore: number | null = null;
    if (npsScores.length > 0) {
      const promoters = npsScores.filter(s => s >= 9).length;
      const detractors = npsScores.filter(s => s <= 6).length;
      npsScore = Math.round(((promoters - detractors) / npsScores.length) * 100);
    }

    // Collect qualitative feedback
    const strengths: string[] = [];
    const improvements: string[] = [];

    evaluations.forEach(e => {
      if (e.points_forts && e.points_forts.trim()) {
        strengths.push(e.points_forts.trim());
      }
      if (e.axes_amelioration) {
        const axes = Array.isArray(e.axes_amelioration)
          ? e.axes_amelioration
          : [e.axes_amelioration];
        axes.forEach((axe: string) => {
          if (axe && axe.trim()) {
            improvements.push(axe.trim());
          }
        });
      }
    });

    // Format date
    const formatDate = (dateStr: string) => {
      return new Date(dateStr).toLocaleDateString("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
      });
    };

    // Build email HTML
    const emailHtml = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; }
    .header { background: #f8f9fa; padding: 20px; text-align: center; border-bottom: 3px solid #6366f1; }
    .content { padding: 20px; }
    .stat-box { background: #f8f9fa; padding: 15px; border-radius: 8px; margin: 10px 0; text-align: center; }
    .stat-value { font-size: 32px; font-weight: bold; color: #6366f1; }
    .stat-label { color: #666; font-size: 14px; }
    .section { margin: 25px 0; }
    .section-title { font-size: 16px; font-weight: bold; color: #333; margin-bottom: 10px; border-bottom: 2px solid #e5e7eb; padding-bottom: 5px; }
    .objective-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #f0f0f0; }
    .score-bar { background: #e5e7eb; height: 8px; border-radius: 4px; overflow: hidden; margin-top: 5px; }
    .score-fill { background: #6366f1; height: 100%; }
    .feedback-item { background: #f8f9fa; padding: 10px; margin: 5px 0; border-radius: 4px; font-style: italic; }
    .nps-positive { color: #22c55e; }
    .nps-negative { color: #ef4444; }
    .footer { background: #f8f9fa; padding: 15px; text-align: center; color: #666; font-size: 12px; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0; color: #333;">Synthèse des évaluations</h1>
    <p style="margin: 10px 0 0; color: #666;">${training.training_name}</p>
  </div>

  <div class="content">
    <p>Bonjour ${training.sponsor_first_name || ""},</p>

    <p>Voici la synthèse des évaluations de la formation <strong>${training.training_name}</strong> qui s'est déroulée ${training.end_date && training.end_date !== training.start_date
      ? `du ${formatDate(training.start_date)} au ${formatDate(training.end_date)}`
      : `le ${formatDate(training.start_date)}`
    }.</p>

    ${customMessage ? `<p style="background: #fef3c7; padding: 10px; border-radius: 4px;">${customMessage}</p>` : ""}

    <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 20px 0;">
      <div class="stat-box">
        <div class="stat-value">${participantsCount || 0}</div>
        <div class="stat-label">Participants</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${evaluationsCount}</div>
        <div class="stat-label">Évaluations</div>
      </div>
      <div class="stat-box">
        <div class="stat-value">${averageScore.toFixed(1)}/5</div>
        <div class="stat-label">Note moyenne</div>
      </div>
    </div>

    ${npsScore !== null ? `
    <div class="section">
      <div class="section-title">Net Promoter Score (NPS)</div>
      <div class="stat-box">
        <div class="stat-value ${npsScore >= 0 ? 'nps-positive' : 'nps-negative'}">${npsScore > 0 ? '+' : ''}${npsScore}</div>
        <div class="stat-label">
          ${npsScore >= 50 ? 'Excellent' : npsScore >= 0 ? 'Bon' : 'À améliorer'}
        </div>
      </div>
    </div>
    ` : ""}

    ${objectivesScores.length > 0 ? `
    <div class="section">
      <div class="section-title">Atteinte des objectifs pédagogiques</div>
      ${objectivesScores.map(obj => `
        <div style="margin: 10px 0;">
          <div style="display: flex; justify-content: space-between;">
            <span style="font-size: 14px;">${obj.label}</span>
            <span style="font-weight: bold;">${obj.score.toFixed(1)}/5</span>
          </div>
          <div class="score-bar">
            <div class="score-fill" style="width: ${(obj.score / 5) * 100}%;"></div>
          </div>
        </div>
      `).join("")}
    </div>
    ` : ""}

    ${strengths.length > 0 ? `
    <div class="section">
      <div class="section-title">Points forts relevés</div>
      ${strengths.slice(0, 5).map(s => `<div class="feedback-item">"${s}"</div>`).join("")}
      ${strengths.length > 5 ? `<p style="color: #666; font-size: 12px;">+ ${strengths.length - 5} autres commentaires</p>` : ""}
    </div>
    ` : ""}

    ${improvements.length > 0 ? `
    <div class="section">
      <div class="section-title">Axes d'amélioration identifiés</div>
      <ul style="margin: 0; padding-left: 20px;">
        ${[...new Set(improvements)].slice(0, 5).map(i => `<li>${i}</li>`).join("")}
      </ul>
    </div>
    ` : ""}

    <p style="margin-top: 30px;">Cordialement,<br><strong>${training.trainer_name || "L'équipe de formation"}</strong></p>
  </div>

  <div class="footer">
    <p>Ce rapport a été généré automatiquement par SuperTools.</p>
    <p>Conformément à notre certification Qualiopi, nous nous engageons dans une démarche d'amélioration continue.</p>
  </div>
</body>
</html>
    `;

    // Send email via Resend
    const emailResponse = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: "SuperTools <noreply@supertilt.fr>",
        to: [training.sponsor_email],
        subject: `Synthèse des évaluations - ${training.training_name}`,
        html: emailHtml,
        bcc: ["romain@supertilt.fr"],
      }),
    });

    if (!emailResponse.ok) {
      const errorData = await emailResponse.json();
      throw new Error(`Resend API error: ${JSON.stringify(errorData)}`);
    }

    // Log activity
    await supabase.from("activity_logs").insert({
      action_type: "evaluation_summary_sent",
      recipient_email: training.sponsor_email,
      details: {
        training_id: trainingId,
        training_name: training.training_name,
        evaluations_count: evaluationsCount,
        average_score: averageScore,
        nps_score: npsScore,
      },
    });

    // Update training to mark summary as sent
    await supabase
      .from("trainings")
      .update({
        evaluation_summary_sent_at: new Date().toISOString(),
      })
      .eq("id", trainingId);

    return new Response(
      JSON.stringify({
        success: true,
        message: `Synthèse envoyée à ${training.sponsor_email}`,
        stats: {
          evaluations_count: evaluationsCount,
          average_score: averageScore,
          nps_score: npsScore,
        },
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error sending evaluation summary:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
