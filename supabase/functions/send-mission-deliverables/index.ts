import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  getSigniticSignature,
  getBccSettings,
  getSupabaseClient,
  sendEmail,
  processTemplate,
  textToHtml,
  wrapEmailHtml,
} from "../_shared/mod.ts";

const DEFAULT_SUBJECT = "Vos livrables sont disponibles - {{mission_title}}";

const DEFAULT_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont prêts pour toi.

Tu peux les consulter et les télécharger à tout moment en cliquant ci-dessous :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésite pas à revenir vers moi si tu as la moindre question.

À très bientôt !`;

const DEFAULT_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

Bonne nouvelle ! Les livrables de la mission "{{mission_title}}" sont disponibles.

Vous pouvez les consulter et les télécharger à tout moment en cliquant ci-dessous :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésitez pas à revenir vers moi si vous avez la moindre question.

Cordialement,`;

const DEFAULT_UPDATE_SUBJECT = "Nouveaux livrables - {{mission_title}}";

const DEFAULT_UPDATE_CONTENT_TU = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

De nouveaux éléments viennent d'être ajoutés aux livrables de la mission "{{mission_title}}".

{{#new_items_html}}Nouveautés depuis mon dernier envoi :
{{new_items_html}}{{/new_items_html}}

Tu retrouves l'ensemble des livrables (anciens et nouveaux) au même endroit :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésite pas à revenir vers moi si tu as la moindre question.

À très bientôt !`;

const DEFAULT_UPDATE_CONTENT_VOUS = `Bonjour{{#first_name}} {{first_name}}{{/first_name}},

De nouveaux éléments viennent d'être ajoutés aux livrables de la mission "{{mission_title}}".

{{#new_items_html}}Nouveautés depuis mon dernier envoi :
{{new_items_html}}{{/new_items_html}}

Vous retrouvez l'ensemble des livrables (anciens et nouveaux) au même endroit :

<p style="margin: 20px 0;"><a href="{{deliverables_link}}" style="display: inline-block; padding: 12px 24px; background-color: #e6bc00; color: #000; text-decoration: none; border-radius: 6px; font-weight: bold;">📦 Accéder aux livrables</a></p>

N'hésitez pas à revenir vers moi si vous avez la moindre question.

Cordialement,`;

function escapeHtmlLabel(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const { mission_id, recipients, subject } = await req.json();

    if (!mission_id || !recipients || !Array.isArray(recipients) || recipients.length === 0) {
      return createErrorResponse("mission_id and recipients[] are required", 400);
    }

    const supabase = getSupabaseClient();

    // Fetch mission title
    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .select("title")
      .eq("id", mission_id)
      .single();

    if (missionError || !mission) {
      return createErrorResponse("Mission not found", 404);
    }

    const missionTitle = mission.title;
    const { getAppUrls } = await import("../_shared/app-urls.ts");
    const urls = await getAppUrls();
    const baseUrl = urls.app_url;
    const deliverablesLink = `${baseUrl}/mission-info/${mission_id}`;

    // Lien personnalisé par destinataire : le token du contact identifie
    // l'auteur des commentaires sur la page publique, sans saisie d'identité.
    const { data: missionContacts } = await supabase
      .from("mission_contacts")
      .select("id, email, access_token")
      .eq("mission_id", mission_id);
    const tokenByContactId = new Map<string, string>();
    const tokenByEmail = new Map<string, string>();
    for (const c of missionContacts || []) {
      if (c.access_token) {
        tokenByContactId.set(c.id, c.access_token);
        if (c.email) tokenByEmail.set(c.email.toLowerCase(), c.access_token);
      }
    }

    // Fetch custom templates for both modes (premier envoi + relance)
    const { data: customTemplates } = await supabase
      .from("email_templates")
      .select("template_type, subject, html_content")
      .in("template_type", [
        "mission_deliverables_tu",
        "mission_deliverables_vous",
        "mission_deliverables_update_tu",
        "mission_deliverables_update_vous",
      ]);

    const findTpl = (t: string) => customTemplates?.find((x: any) => x.template_type === t);
    const customTu = findTpl("mission_deliverables_tu");
    const customVous = findTpl("mission_deliverables_vous");
    const customUpdateTu = findTpl("mission_deliverables_update_tu");
    const customUpdateVous = findTpl("mission_deliverables_update_vous");

    // ── Inventaire des livrables partagés (pages, documents, médias) ──
    const [pagesRes, docsRes, mediaRes, sendsRes] = await Promise.all([
      supabase
        .from("mission_pages")
        .select("id, title, is_deliverable")
        .eq("mission_id", mission_id)
        .eq("is_deliverable", true),
      supabase
        .from("mission_documents")
        .select("id, file_name, is_deliverable")
        .eq("mission_id", mission_id)
        .eq("is_deliverable", true),
      supabase
        .from("media")
        .select("id, title, file_name, is_deliverable")
        .eq("source_type", "mission")
        .eq("source_id", mission_id)
        .eq("is_deliverable", true),
      supabase
        .from("mission_deliverable_sends")
        .select("contact_id, email, item_keys")
        .eq("mission_id", mission_id),
    ]);

    const currentItems: { key: string; label: string }[] = [
      ...((pagesRes.data as any[]) || []).map((p) => ({
        key: `page:${p.id}`,
        label: p.title || "Page sans titre",
      })),
      ...((docsRes.data as any[]) || []).map((d) => ({
        key: `doc:${d.id}`,
        label: d.file_name || "Document",
      })),
      ...((mediaRes.data as any[]) || []).map((m) => ({
        key: `media:${m.id}`,
        label: m.title || m.file_name || "Média",
      })),
    ];
    const currentKeys = currentItems.map((i) => i.key);

    // Historique par destinataire (contact_id prioritaire, sinon email)
    const previousKeysByContact = new Map<string, Set<string>>();
    const previousKeysByEmail = new Map<string, Set<string>>();
    for (const row of ((sendsRes.data as any[]) || [])) {
      const keys: string[] = row.item_keys || [];
      if (row.contact_id) {
        const set = previousKeysByContact.get(row.contact_id) ?? new Set<string>();
        keys.forEach((k) => set.add(k));
        previousKeysByContact.set(row.contact_id, set);
      }
      if (row.email) {
        const e = String(row.email).toLowerCase();
        const set = previousKeysByEmail.get(e) ?? new Set<string>();
        keys.forEach((k) => set.add(k));
        previousKeysByEmail.set(e, set);
      }
    }

    // Fetch BCC and signature in parallel
    const [bccList, signature] = await Promise.all([
      getBccSettings(),
      getSigniticSignature(),
    ]);

    const results: { email: string; success: boolean; error?: string; is_update?: boolean; new_items?: number }[] = [];


    for (const recipient of recipients) {
      const { email, first_name, formal_address, contact_id } = recipient;
      if (!email) continue;

      const contactToken =
        (contact_id ? tokenByContactId.get(contact_id) : undefined) ??
        tokenByEmail.get(email.toLowerCase());
      const recipientLink = contactToken
        ? `${deliverablesLink}?c=${contactToken}`
        : deliverablesLink;

      // Tutoiement par défaut, vouvoiement uniquement si formal_address = true
      const useTu = !formal_address;

      // Historique : 2ème envoi ou plus => template "nouveautés"
      const previousKeys =
        (contact_id ? previousKeysByContact.get(contact_id) : undefined) ??
        previousKeysByEmail.get(email.toLowerCase());
      const isUpdate = !!previousKeys && previousKeys.size > 0;
      const newItems = isUpdate
        ? currentItems.filter((i) => !previousKeys!.has(i.key))
        : currentItems;
      const newItemsHtml = newItems.length
        ? `<ul style="margin: 12px 0; padding-left: 20px;">${newItems
            .map((i) => `<li style="margin: 0 0 4px 0;">${escapeHtmlLabel(i.label)}</li>`)
            .join("")}</ul>`
        : "";

      const custom = isUpdate
        ? (useTu ? customUpdateTu : customUpdateVous)
        : (useTu ? customTu : customVous);
      const defaultContent = isUpdate
        ? (useTu ? DEFAULT_UPDATE_CONTENT_TU : DEFAULT_UPDATE_CONTENT_VOUS)
        : (useTu ? DEFAULT_CONTENT_TU : DEFAULT_CONTENT_VOUS);
      const defaultSubject = isUpdate ? DEFAULT_UPDATE_SUBJECT : DEFAULT_SUBJECT;
      const providedSubject = isUpdate ? (subject_update || undefined) : (subject || undefined);

      const subjectTemplate = providedSubject || custom?.subject || defaultSubject;
      const contentTemplate = custom?.html_content || defaultContent;

      const variables = {
        first_name: first_name || "",
        mission_title: missionTitle,
        deliverables_link: recipientLink,
        new_items_html: newItemsHtml,
        new_items_count: String(newItems.length),
      };


      const processedSubject = processTemplate(subjectTemplate, variables, false);
      const contentText = processTemplate(contentTemplate, variables, false);

      // Check if template already contains HTML tags
      const hasHtml = /<[a-z][\s\S]*>/i.test(contentText);
      // For mixed content (HTML + plain text), convert remaining newlines to <br>
      // For pure plain text, use full textToHtml conversion
      const contentHtml = hasHtml
        ? contentText.split(/\n\n+/).map((p: string) => {
            if (/<[a-z][\s\S]*>/i.test(p)) return p;
            const lines = p.split(/\n/).map((l: string) => l.trim()).filter(Boolean);
            return `<p>${lines.join("<br>")}</p>`;
          }).join("")
        : textToHtml(contentText);

      const fullHtml = wrapEmailHtml(contentHtml, signature);

      console.log("Sending deliverables email to:", email);

      const result = await sendEmail({
        to: [email],
        bcc: bccList,
        subject: processedSubject,
        html: fullHtml,
        _emailType: "mission_deliverables",
      });

      results.push({ email, success: result.success, error: result.error });

      // Rate limit: 600ms between emails
      if (recipients.indexOf(recipient) < recipients.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 600));
      }
    }

    const successCount = results.filter((r) => r.success).length;
    console.log(`Deliverables emails sent: ${successCount}/${results.length}`);

    return createJsonResponse({
      success: true,
      sent: successCount,
      total: results.length,
      results,
    });
  } catch (error) {
    console.error("Error in send-mission-deliverables:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Unknown error", 500);
  }
});
