import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

/**
 * Process Logistics Reminders
 *
 * Called daily at 7:00 AM by a cron job.
 * Finds trainings where train_booked or hotel_booked is false
 * and start_date is in the future, then sends a reminder email.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const VERSION = "process-logistics-reminders@1.0.0";

serve(async (req) => {
  console.log(`[${VERSION}] Starting...`);

  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const resendApiKey = Deno.env.get("RESEND_API_KEY")!;
    const appUrl = Deno.env.get("APP_URL") || "https://super-tools.lovable.app";
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const today = new Date().toISOString().split("T")[0];
    console.log(`[${VERSION}] Checking logistics for trainings starting after ${today}`);

    // Find trainings starting in the future where train or hotel is not booked
    // and format is not e-learning
    const { data: trainings, error: fetchError } = await supabase
      .from("trainings")
      .select("id, training_name, start_date, location, train_booked, hotel_booked, format_formation")
      .gt("start_date", today)
      .neq("format_formation", "e_learning");

    if (fetchError) {
      console.error(`[${VERSION}] Error fetching trainings:`, fetchError);
      throw fetchError;
    }

    // Filter to trainings with at least one unchecked logistics item
    const pendingTrainings = (trainings || []).filter(
      (t) => t.train_booked === false || t.hotel_booked === false
    );

    if (pendingTrainings.length === 0) {
      console.log(`[${VERSION}] No trainings with pending logistics`);
      return new Response(
        JSON.stringify({ success: true, message: "No pending logistics", _version: VERSION }),
        { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    console.log(`[${VERSION}] Found ${pendingTrainings.length} training(s) with pending logistics`);

    // Get admin email from profiles (first admin user)
    const { data: adminProfiles } = await supabase
      .from("profiles")
      .select("email")
      .eq("role", "admin")
      .limit(1);

    const adminEmail = adminProfiles?.[0]?.email || "romain@supertilt.fr";

    let sentCount = 0;

    for (const training of pendingTrainings) {
      const missing: string[] = [];
      if (!training.train_booked) missing.push("Train");
      if (!training.hotel_booked) missing.push("Hôtel");

      const missingList = missing.join(" et ");
      const trainingDate = new Date(training.start_date).toLocaleDateString("fr-FR", {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      });

      const htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <p>Bonjour,</p>
          <p>La formation <strong>${training.training_name}</strong> prévue le <strong>${trainingDate}</strong> à <strong>${training.location}</strong> a encore des réservations en attente :</p>
          <div style="background-color: #FEF3C7; border-left: 4px solid #F59E0B; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
            <p style="margin: 0; font-weight: bold;">${missingList} non réservé${missing.length > 1 ? "s" : ""}</p>
          </div>
          <p>
            <a href="${appUrl}/formations/${training.id}" style="display: inline-block; background-color: #1a1a2e; color: white; padding: 10px 20px; text-decoration: none; border-radius: 6px;">
              Voir la formation
            </a>
          </p>
          <p style="color: #666; font-size: 14px; margin-top: 20px;">
            <strong>Romain Couturier</strong><br/>
            Supertilt - Formation professionnelle
          </p>
        </div>
      `;

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${resendApiKey}`,
          },
          body: JSON.stringify({
            from: "Romain Couturier <romain@supertilt.fr>",
            to: [adminEmail],
            subject: `🔔 Réservation en attente : ${missingList} — ${training.training_name}`,
            html: htmlContent,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`[${VERSION}] Email failed for training ${training.id}:`, errorText);
        } else {
          sentCount++;
          console.log(`[${VERSION}] Reminder sent for training ${training.id}: ${missingList}`);
        }
      } catch (error) {
        console.error(`[${VERSION}] Error sending email for ${training.id}:`, error);
      }

      // Rate limit: 600ms between emails
      if (pendingTrainings.indexOf(training) < pendingTrainings.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    console.log(`[${VERSION}] Completed: ${sentCount} reminder(s) sent`);

    return new Response(
      JSON.stringify({
        success: true,
        checked: pendingTrainings.length,
        sent: sentCount,
        _version: VERSION,
      }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error) {
    console.error(`[${VERSION}] Error:`, error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return new Response(
      JSON.stringify({ success: false, error: errorMessage, _version: VERSION }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
});
