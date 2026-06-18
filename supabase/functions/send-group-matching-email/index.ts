import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  corsHeaders,
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  sendEmail,
  escapeHtml,
  getSupabaseClient,
} from "../_shared/mod.ts";
import { getBccList } from "../_shared/email-settings.ts";

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const supabase = getSupabaseClient();
    const { group_id } = await req.json() as { group_id: string };
    if (!group_id) return createErrorResponse("group_id required", 400);

    // Fetch group + members
    const { data: group, error: gErr } = await supabase
      .from("group_matching_groups")
      .select("id, post_id, wave, email_sent_at")
      .eq("id", group_id)
      .single();
    if (gErr || !group) return createErrorResponse("Group not found", 404);

    if ((group as any).email_sent_at) {
      return createJsonResponse({ ok: true, skipped: true });
    }

    const { data: members, error: mErr } = await supabase
      .from("group_matching_members")
      .select("learner_email")
      .eq("group_id", group_id);
    if (mErr || !members?.length) return createErrorResponse("No members", 400);

    const emails = (members as Array<{ learner_email: string }>).map((m) => m.learner_email);

    // Fetch learner profiles for names
    const { data: profiles } = await supabase
      .from("learner_profiles")
      .select("email, first_name, last_name")
      .in("email", emails);

    const profileMap = new Map<string, { first_name: string | null; last_name: string | null }>();
    for (const p of (profiles ?? []) as Array<{ email: string; first_name: string | null; last_name: string | null }>) {
      profileMap.set(p.email, p);
    }

    const displayName = (email: string) => {
      const p = profileMap.get(email);
      if (p?.first_name && p.last_name) return `${p.first_name} ${p.last_name}`;
      if (p?.first_name) return p.first_name;
      return email.split("@")[0];
    };

    // Fetch post content for context
    const { data: post } = await supabase
      .from("practice_posts")
      .select("content")
      .eq("id", (group as any).post_id)
      .single();
    const postSnippet = (post as any)?.content
      ? escapeHtml(((post as any).content as string).slice(0, 120)) + (((post as any).content as string).length > 120 ? "…" : "")
      : null;

    const membersHtml = emails
      .map((e) => `<li style="margin-bottom:4px">${escapeHtml(displayName(e))} — <a href="mailto:${escapeHtml(e)}" style="color:#101820">${escapeHtml(e)}</a></li>`)
      .join("");

    // Send one email per member
    const bccList = await getBccList();

    for (const recipientEmail of emails) {
      const firstName = profileMap.get(recipientEmail)?.first_name;
      const greeting = firstName ? `Bonjour ${escapeHtml(firstName)},` : "Bonjour,";

      const otherEmails = emails.filter((e) => e !== recipientEmail);
      const mailtoTo = otherEmails.join(",");
      const mailtoSubject = encodeURIComponent("Retrouvons-nous ensemble bientôt");
      const otherNames = otherEmails.map(displayName);
      const isSingular = otherEmails.length === 1;
      const mailtoBody = isSingular
        ? encodeURIComponent(`Salut,\n\nJe suis ravi(e) qu'on puisse travailler ensemble. Quand es-tu disponible ?\n\nBonne journée !`)
        : encodeURIComponent(`Bonjour,\n\nJe suis ravi(e) qu'on puisse travailler ensemble. Quand êtes-vous disponibles ?\n\nBonne journée !`);

      const mailtoHref = `mailto:${mailtoTo}?subject=${mailtoSubject}&body=${mailtoBody}`;

      const html = `
<p>${greeting}</p>
<p>Bonne nouvelle : votre groupe est constitué !</p>
${postSnippet ? `<p style="border-left:3px solid #FFD100;padding-left:12px;color:#555;font-style:italic">${postSnippet}</p>` : ""}
<p><strong>Membres du groupe :</strong></p>
<ul style="padding-left:20px">${membersHtml}</ul>
<p>On vous laisse vous organiser pour trouver des créneaux ensemble. Vous pouvez vous retrouver via WhatsApp, par téléphone ou en visio (Jitsi, Google Meet, etc.).</p>
<p>On vous invite à publier vos travaux sur la communauté.</p>
<p style="margin-top:24px">
  <a href="${mailtoHref}"
     style="display:inline-block;padding:12px 24px;background:#FFD100;color:#101820;font-weight:600;text-decoration:none;border-radius:8px;font-size:15px">
    Contacter le groupe
  </a>
</p>
<p style="margin-top:24px">À très bientôt,<br>L'équipe SuperTilt</p>
`;

      await sendEmail({
        to: [recipientEmail],
        bcc: bccList,
        subject: "Votre groupe est formé 🎉",
        html,
        _emailType: "group_matching",
      });
      await new Promise((r) => setTimeout(r, 400));
    }

    // Mark email_sent_at
    await supabase
      .from("group_matching_groups")
      .update({ email_sent_at: new Date().toISOString() })
      .eq("id", group_id);

    // Mark registrations as assigned
    const { data: memberRows } = await supabase
      .from("group_matching_members")
      .select("registration_id")
      .eq("group_id", group_id);

    if (memberRows?.length) {
      const regIds = (memberRows as Array<{ registration_id: string }>).map((r) => r.registration_id);
      await supabase
        .from("group_matching_registrations")
        .update({ status: "assigned" })
        .in("id", regIds);
    }

    return createJsonResponse({ ok: true, sent_to: emails.length });
  } catch (err) {
    console.error(err);
    return createErrorResponse("Internal error", 500);
  }
});
