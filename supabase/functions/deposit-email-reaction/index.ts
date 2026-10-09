import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

/**
 * Lien « J'aime » des mails de publication communauté.
 * GET ?t=<token> : enregistre la réaction du formateur (sans connexion) puis
 * redirige vers la publication. Token lié à une publication et un formateur,
 * valable 30 jours ; un second clic ne crée pas de doublon.
 */
serve(async (req) => {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { getAppUrls } = await import("../_shared/app-urls.ts");
  const APP_URL = (await getAppUrls()).app_url;
  const redirect = (path: string) => new Response(null, { status: 302, headers: { Location: `${APP_URL}${path}` } });

  const token = new URL(req.url).searchParams.get("t") || "";
  if (!/^[a-f0-9]{64}$/.test(token)) return redirect("/lms/deposits?reaction=invalid");

  const { data: row } = await supabase
    .from("deposit_reaction_tokens")
    .select("deposit_id, trainer_email, expires_at")
    .eq("token", token)
    .maybeSingle();
  if (!row) return redirect("/lms/deposits?reaction=invalid");

  const target = `/lms/deposits?deposit=${encodeURIComponent(row.deposit_id)}`;
  if (Date.parse(row.expires_at) < Date.now()) return redirect(`${target}&reaction=expired`);

  const { data: deposit } = await supabase
    .from("lms_work_deposits")
    .select("visibility, publication_status")
    .eq("id", row.deposit_id)
    .maybeSingle();
  if (!deposit || deposit.visibility !== "shared" || deposit.publication_status !== "published") {
    return redirect(`${target}&reaction=unavailable`);
  }

  // Le travail partagé est une publication communauté : la réaction y est
  // enregistrée (👍), comme depuis l'écran Communauté, et compte comme traitement.
  const { data: post } = await supabase
    .from("practice_posts")
    .select("id")
    .eq("deposit_id", row.deposit_id)
    .maybeSingle();
  const trainerEmail = String(row.trainer_email).toLowerCase();
  const { error } = post
    ? await supabase
      .from("practice_post_reactions")
      .upsert({ post_id: post.id, author_email: trainerEmail, reaction_type: "👍" }, { onConflict: "post_id,author_email,reaction_type", ignoreDuplicates: true })
    : await supabase
      .from("lms_deposit_reactions")
      .upsert({ deposit_id: row.deposit_id, author_email: row.trainer_email }, { onConflict: "deposit_id,author_email", ignoreDuplicates: true });
  if (!error && post) {
    await supabase.from("practice_posts").update({ is_staff_treated: true }).eq("id", post.id);
  }
  if (error) {
    console.error("deposit-email-reaction upsert failed", error);
    return redirect(`${target}&reaction=error`);
  }
  await supabase.from("deposit_reaction_tokens").update({ used_at: new Date().toISOString() }).eq("token", token);
  return redirect(`${target}&reaction=ok`);
});
