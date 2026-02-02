import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

// Fetch Signitic signature for romain@supertilt.fr
async function getSigniticSignature(): Promise<string> {
  const signiticApiKey = Deno.env.get("SIGNITIC_API_KEY");
  
  if (!signiticApiKey) {
    console.warn("SIGNITIC_API_KEY not configured, using default signature");
    return getDefaultSignature();
  }

  try {
    const response = await fetch(
      "https://api.signitic.app/signatures/romain@supertilt.fr/html",
      {
        headers: {
          "x-api-key": signiticApiKey,
        },
      }
    );

    if (response.ok) {
      const htmlContent = await response.text();
      if (htmlContent && !htmlContent.includes("error")) {
        return htmlContent;
      }
    }
    
    return getDefaultSignature();
  } catch (error) {
    console.error("Error fetching Signitic signature:", error);
    return getDefaultSignature();
  }
}

function getDefaultSignature(): string {
  return `<p style="margin-top: 20px; color: #666; font-size: 14px;">
    <strong>Romain Couturier</strong><br/>
    Supertilt - Formation professionnelle<br/>
    <a href="mailto:romain@supertilt.fr">romain@supertilt.fr</a>
  </p>`;
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
    if (!RESEND_API_KEY) {
      throw new Error("RESEND_API_KEY not configured");
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculate the date 3 months from now
    const now = new Date();
    const threeMonthsFromNow = new Date(now);
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);

    // Fetch trainings starting within 3 months where train or hotel is not booked
    const { data: trainings, error: trainingsError } = await supabase
      .from("trainings")
      .select(`
        id,
        training_name,
        start_date,
        end_date,
        location,
        client_name,
        hotel_booked,
        train_booked,
        trainer_id,
        trainers!trainings_trainer_id_fkey (
          id,
          first_name,
          last_name,
          email
        )
      `)
      .gte("start_date", now.toISOString().split("T")[0])
      .lte("start_date", threeMonthsFromNow.toISOString().split("T")[0])
      .or("hotel_booked.is.null,hotel_booked.eq.false,train_booked.is.null,train_booked.eq.false");

    if (trainingsError) {
      console.error("Error fetching trainings:", trainingsError);
      throw trainingsError;
    }

    if (!trainings || trainings.length === 0) {
      console.log("No trainings require booking reminders");
      return new Response(
        JSON.stringify({ success: true, reminders_sent: 0, message: "No trainings require reminders" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Found ${trainings.length} trainings requiring booking reminders`);

    // Get Signitic signature
    const signature = await getSigniticSignature();

    const results: { training_id: string; training_name: string; trainer_email: string; success: boolean; error?: string }[] = [];

    for (const training of trainings) {
      // Check if trainer exists
      // The trainers field can be an object (single relation) or array depending on query
      const trainersData = training.trainers;
      let trainer: { id: string; first_name: string; last_name: string; email: string } | null = null;
      
      if (trainersData) {
        if (Array.isArray(trainersData) && trainersData.length > 0) {
          trainer = trainersData[0] as { id: string; first_name: string; last_name: string; email: string };
        } else if (typeof trainersData === 'object' && !Array.isArray(trainersData)) {
          trainer = trainersData as { id: string; first_name: string; last_name: string; email: string };
        }
      }
      
      if (!trainer || !trainer.email) {
        console.warn(`Training ${training.id} has no trainer or trainer email`);
        results.push({
          training_id: training.id,
          training_name: training.training_name,
          trainer_email: "N/A",
          success: false,
          error: "No trainer email",
        });
        continue;
      }

      // Determine what needs to be booked
      const needsHotel = !training.hotel_booked;
      const needsTrain = !training.train_booked;

      if (!needsHotel && !needsTrain) {
        // Both are booked, skip
        continue;
      }

      // Build the booking list
      const bookingItems: string[] = [];
      if (needsTrain) bookingItems.push("le train");
      if (needsHotel) bookingItems.push("l'hôtel");
      const bookingText = bookingItems.join(" et ");

      // Calculate days until training
      const trainingDate = new Date(training.start_date);
      const daysUntil = Math.ceil((trainingDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      // Build email content
      const subject = `Rappel : Réservation pour la formation "${training.training_name}"`;
      
      const htmlContent = `
        <p>Bonjour ${trainer.first_name},</p>
        
        <p>Ceci est un rappel automatique concernant la formation <strong>"${training.training_name}"</strong> prévue le <strong>${formatDate(training.start_date)}</strong> à <strong>${training.location}</strong> pour ${training.client_name}.</p>
        
        <p style="background-color: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 4px;">
          <strong>⚠️ À réserver :</strong> ${bookingText}<br/>
          <em>La formation a lieu dans ${daysUntil} jour${daysUntil > 1 ? 's' : ''}.</em>
        </p>
        
        <p>Merci de procéder à la réservation dès que possible et de cocher les cases correspondantes dans l'interface de gestion.</p>
        
        <p>Ce rappel sera envoyé chaque lundi jusqu'à ce que les réservations soient confirmées.</p>
        
        ${signature}
      `;

      try {
        const emailResponse = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${RESEND_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            from: "Romain Couturier <romain@supertilt.fr>",
            to: [trainer.email],
            subject,
            html: htmlContent,
          }),
        });

        if (!emailResponse.ok) {
          const errorText = await emailResponse.text();
          console.error(`Resend error for training ${training.id}:`, errorText);
          results.push({
            training_id: training.id,
            training_name: training.training_name,
            trainer_email: trainer.email,
            success: false,
            error: errorText,
          });
        } else {
          console.log(`Reminder sent for training ${training.id} to ${trainer.email}`);
          results.push({
            training_id: training.id,
            training_name: training.training_name,
            trainer_email: trainer.email,
            success: true,
          });
        }

        // Rate limiting: wait 600ms between emails
        await new Promise((resolve) => setTimeout(resolve, 600));
      } catch (error) {
        console.error(`Error sending reminder for training ${training.id}:`, error);
        results.push({
          training_id: training.id,
          training_name: training.training_name,
          trainer_email: trainer.email,
          success: false,
          error: String(error),
        });
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`Booking reminders sent: ${successCount}/${results.length}`);

    return new Response(
      JSON.stringify({
        success: true,
        reminders_sent: successCount,
        total_trainings: results.length,
        details: results,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error in send-booking-reminder:", error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
