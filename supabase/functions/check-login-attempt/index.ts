import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

// Configuration des limites
const MAX_ATTEMPTS_PER_IP = 5;
const MAX_ATTEMPTS_PER_EMAIL = 3;
const LOCKOUT_DURATION_MINUTES = 15;

interface RequestBody {
  email: string;
}

serve(async (req: Request) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { email }: RequestBody = await req.json();
    
    // Récupérer l'IP depuis les headers
    const ipAddress = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() 
      || req.headers.get("x-real-ip") 
      || "unknown";

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Calculer le timestamp de début de la fenêtre de temps
    const windowStart = new Date(Date.now() - LOCKOUT_DURATION_MINUTES * 60 * 1000).toISOString();

    // Compter les tentatives échouées par IP dans la fenêtre
    const { data: ipAttempts, error: ipError } = await supabase
      .from("login_attempts")
      .select("attempted_at")
      .eq("ip_address", ipAddress)
      .eq("success", false)
      .gte("attempted_at", windowStart)
      .order("attempted_at", { ascending: false });

    if (ipError) {
      console.error("Error checking IP attempts:", ipError);
      throw ipError;
    }

    // Compter les tentatives échouées par email dans la fenêtre
    const { data: emailAttempts, error: emailError } = await supabase
      .from("login_attempts")
      .select("attempted_at")
      .eq("email", email.toLowerCase())
      .eq("success", false)
      .gte("attempted_at", windowStart)
      .order("attempted_at", { ascending: false });

    if (emailError) {
      console.error("Error checking email attempts:", emailError);
      throw emailError;
    }

    const ipCount = ipAttempts?.length || 0;
    const emailCount = emailAttempts?.length || 0;

    // Vérifier si blocage nécessaire
    const isBlockedByIp = ipCount >= MAX_ATTEMPTS_PER_IP;
    const isBlockedByEmail = emailCount >= MAX_ATTEMPTS_PER_EMAIL;
    const isBlocked = isBlockedByIp || isBlockedByEmail;

    // Calculer le temps restant avant déblocage
    let unlockAt: string | null = null;
    let remainingSeconds = 0;

    if (isBlocked) {
      // Prendre la tentative la plus ancienne dans la fenêtre pour calculer le déblocage
      const relevantAttempts = isBlockedByEmail ? emailAttempts : ipAttempts;
      if (relevantAttempts && relevantAttempts.length > 0) {
        const oldestAttempt = relevantAttempts[relevantAttempts.length - 1];
        const oldestTime = new Date(oldestAttempt.attempted_at).getTime();
        const unlockTime = oldestTime + LOCKOUT_DURATION_MINUTES * 60 * 1000;
        unlockAt = new Date(unlockTime).toISOString();
        remainingSeconds = Math.max(0, Math.ceil((unlockTime - Date.now()) / 1000));
      }
    }

    // Calculer le délai progressif (en secondes)
    const totalAttempts = Math.max(ipCount, emailCount);
    let delaySeconds = 0;
    if (totalAttempts === 3) delaySeconds = 5;
    else if (totalAttempts === 4) delaySeconds = 15;

    // Calculer les tentatives restantes
    const remainingAttemptsByIp = Math.max(0, MAX_ATTEMPTS_PER_IP - ipCount);
    const remainingAttemptsByEmail = Math.max(0, MAX_ATTEMPTS_PER_EMAIL - emailCount);
    const remainingAttempts = Math.min(remainingAttemptsByIp, remainingAttemptsByEmail);

    return new Response(
      JSON.stringify({
        allowed: !isBlocked,
        isBlocked,
        blockedBy: isBlockedByEmail ? "email" : (isBlockedByIp ? "ip" : null),
        remainingAttempts,
        delaySeconds,
        unlockAt,
        remainingSeconds,
        ipCount,
        emailCount,
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Check login attempt error:", error);
    return new Response(
      JSON.stringify({ 
        allowed: true, // En cas d'erreur, on permet la tentative (fail-open)
        error: "Erreur lors de la vérification" 
      }),
      { 
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200, // 200 pour ne pas bloquer le frontend
      }
    );
  }
});
