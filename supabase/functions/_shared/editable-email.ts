/**
 * Editable email rendering.
 *
 * Every automatic email reads its subject/body from `email_templates`
 * (editable in Paramètres > Emails), falling back to the default text kept in
 * code. Templates are plain text with {{variables}}; technical blocks
 * (buttons, tokenised links, tables) are passed as `blocks` and injected as
 * protected HTML so editors can move them but never alter their markup.
 */
import { SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { processTemplate, templateTextToHtml, type TemplateVariables } from "./templates.ts";

export interface EditableEmailOptions {
  type: string;
  defaultSubject: string;
  defaultContent: string;
  vars?: TemplateVariables;
  blocks?: Record<string, string>;
  /** false = tutoiement, true/undefined = vouvoiement */
  formal?: boolean | null;
}

const SENTINEL = (k: string) => `@@BLOCK_${k}@@`;

export async function loadEditableTemplate(
  supabase: SupabaseClient,
  type: string,
  formal?: boolean | null,
): Promise<{ subject: string; html_content: string } | null> {
  const suffix = formal === false ? "tu" : "vous";
  const candidates = [`${type}_${suffix}`, type];
  const { data } = await supabase
    .from("email_templates")
    .select("template_type, subject, html_content")
    .in("template_type", candidates);
  if (!data?.length) return null;
  for (const c of candidates) {
    const row = data.find((r: any) => r.template_type === c);
    if (row?.subject && row?.html_content) return row;
  }
  return null;
}

export function renderEmailText(
  subjectTpl: string,
  contentTpl: string,
  vars: TemplateVariables = {},
  blocks: Record<string, string> = {},
): { subject: string; html: string } {
  const subject = processTemplate(subjectTpl, vars, false);
  let content = contentTpl;
  for (const k of Object.keys(blocks)) {
    content = content.split(`{{${k}}}`).join(SENTINEL(k));
  }
  let html = templateTextToHtml(processTemplate(content, vars, true));
  for (const [k, v] of Object.entries(blocks)) {
    html = html.split(`<p>${SENTINEL(k)}</p>`).join(v).split(SENTINEL(k)).join(v);
  }
  return { subject, html };
}

export async function renderEditableEmail(
  supabase: SupabaseClient,
  opts: EditableEmailOptions,
): Promise<{ subject: string; html: string; fromTemplate: boolean }> {
  let tpl: { subject: string; html_content: string } | null = null;
  try {
    tpl = await loadEditableTemplate(supabase, opts.type, opts.formal);
  } catch (e) {
    console.warn(`[editable-email] ${opts.type}: template read failed, using default`, e);
  }
  const r = renderEmailText(
    tpl?.subject ?? opts.defaultSubject,
    tpl?.html_content ?? opts.defaultContent,
    opts.vars,
    opts.blocks,
  );
  return { ...r, fromTemplate: !!tpl };
}

export function ctaButton(label: string, url: string): string {
  return `<p style="margin: 24px 0;"><a href="${url}" style="display:inline-block;padding:12px 24px;background-color:#ffd100;color:#101820;text-decoration:none;border-radius:8px;font-weight:bold;">${label}</a></p>`;
}
