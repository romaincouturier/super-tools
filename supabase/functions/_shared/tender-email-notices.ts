/**
 * Découpage des alertes mail contenant PLUSIEURS avis (AWS / marches-publics.info)
 * et actualisation d'une fiche « Marchés publics » quand le corps du mail
 * arrive après coup.
 *
 * Le webhook Resend ne transporte que des métadonnées : à l'arrivée on ne
 * dispose que du sujet, donc une seule fiche est créée avec le sujet pour
 * objet. Le corps est récupéré plus tard (`refetch-inbound-emails`) : c'est à
 * ce moment que l'on sait combien d'avis le mail contient réellement et qu'on
 * peut les filtrer comme ceux du BOAMP.
 */

import { dedupKey, loadTenderFilterConfig, matchTender } from "./tender-tools.ts";

export interface ParsedNotice {
  reference: string | null;
  acheteur: string | null;
  objet: string;
  ville: string | null;
  cp: string | null;
  url: string | null;
  /** ISO, quand la date limite est lisible. */
  datelimitereponse: string | null;
  /** Bloc source, utilisé comme texte de filtrage. */
  text: string;
}

const MONTHS = [
  "janvier", "fevrier", "mars", "avril", "mai", "juin",
  "juillet", "aout", "septembre", "octobre", "novembre", "decembre",
];

/**
 * `18/09/2026 à 18h00` ou `3 septembre 2026 à 12h00` → ISO.
 * Heure absente : fin de journée.
 */
export function parseFrenchDeadline(value: string | null | undefined): string | null {
  if (!value) return null;
  let m = value.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\D+(\d{1,2})\s*[h:]\s*(\d{2}))?/);
  if (!m) {
    const t = value
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase()
      .match(/(\d{1,2})\s+([a-z]+)\s+(\d{4})(?:\D+?(\d{1,2})\s*[h:]\s*(\d{2}))?/);
    const month = t ? MONTHS.indexOf(t[2]) : -1;
    if (!t || month < 0) return null;
    m = [t[0], t[1], String(month + 1), t[3], t[4], t[5]] as unknown as RegExpMatchArray;
  }
  const [, d, mo, y, h, mi] = m;
  const iso = `${y}-${mo.padStart(2, "0")}-${d.padStart(2, "0")}T${(h ?? "23").padStart(2, "0")}:${mi ?? "59"}:00+02:00`;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Département depuis un code postal (`97261` → `972`, `38307` → `38`). */
export function departementFromCp(cp: string | null): string[] {
  if (!cp) return [];
  const digits = cp.replace(/\D/g, "");
  if (digits.length < 2) return [];
  return [digits.startsWith("97") || digits.startsWith("98") ? digits.slice(0, 3) : digits.slice(0, 2)];
}

const FIELD = (label: string) => new RegExp(`^${label}\\s*:\\s*(.+)$`, "im");

/**
 * Avis contenus dans une alerte AWS. Les blocs sont séparés par une ligne de
 * tirets et chaque bloc porte au minimum une référence et un objet.
 */
export function parseTenderEmailNotices(body: string | null | undefined): ParsedNotice[] {
  const text = (body ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) return [];

  const blocks = text.split(/\n-{10,}\n/).map((b) => b.trim()).filter(Boolean);
  const notices: ParsedNotice[] = [];

  for (const block of blocks) {
    const refMatch = block.match(/^R[ée]f[ée]rence Avis(?: Rectificatif)?\s*:\s*(.+)$/im);
    if (!refMatch) continue;

    // L'objet court sur plusieurs lignes : on s'arrête à la prochaine
    // étiquette connue ou au lien de l'avis.
    const objetMatch = block.match(
      /(?:^|\n)Objet\s*:\s*([\s\S]*?)(?=\n\s*(?:Date limite|R[ée]f[ée]rence|Acheteur|CP)\s*:|\nhttps?:|\n\s*\n|$)/i,
    );
    const objet = (objetMatch?.[1] ?? "").replace(/\s+/g, " ").trim();
    if (!objet) continue;

    const cpVille = block.match(/^CP\s*:\s*([^\-\n]+?)\s*(?:-\s*Ville\s*:\s*(.+))?$/im);
    const url = block.match(/https?:\/\/\S+/)?.[0]?.replace(/[)\]]+$/, "") ?? null;

    notices.push({
      reference: refMatch[1].trim() || null,
      acheteur: block.match(FIELD("Acheteur"))?.[1]?.trim() ?? null,
      objet,
      cp: cpVille?.[1]?.trim() ?? null,
      ville: cpVille?.[2]?.trim() ?? null,
      url,
      datelimitereponse: parseFrenchDeadline(block.match(FIELD("Date limite"))?.[1] ?? null),
      text: block,
    });
  }
  return notices;
}

export interface IngestResult {
  notices: number;
  created: number;
  skipped: number;
  placeholderRemoved: boolean;
}

/**
 * Rejoue le filtrage d'un mail d'alerte à partir de son corps.
 *
 * Digest (plusieurs avis) : une fiche par avis retenu, comme au BOAMP, et la
 * fiche « sujet du mail » créée à l'arrivée est supprimée si personne ne l'a
 * encore traitée. Mail unique : on complète la fiche existante (lien, date
 * limite, mots-clés retenus) au lieu d'en créer une seconde.
 */
export async function ingestTenderEmailNotices(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  email: {
    id: string;
    messageId: string | null;
    subject: string | null;
    from: string | null;
    body: string;
  },
): Promise<IngestResult> {
  const result: IngestResult = { notices: 0, created: 0, skipped: 0, placeholderRemoved: false };

  const { data: existing } = await supabase
    .from("tender_opportunities")
    .select("id, source, source_ref, status, decision, crm_card_id, raw")
    .eq("source_email_id", email.id);

  const source: string = existing?.[0]?.source ?? "mail";
  const config = await loadTenderFilterConfig(supabase);
  const notices = parseTenderEmailNotices(email.body);
  result.notices = notices.length;

  // ── Mail contenant un seul avis (ou aucun bloc reconnu) ───────────────
  if (notices.length < 2) {
    const notice = notices[0] ?? null;
    const target = existing?.[0];
    if (!target) return result;

    const objet = notice?.objet || target.raw?.subject || email.subject || "(alerte sans objet)";
    const match = matchTender({ objet, extraText: email.body }, config);
    const raw = target.raw && typeof target.raw === "object" && !Array.isArray(target.raw)
      ? target.raw
      : {};

    const url = notice?.url ??
      email.body.match(/https?:\/\/[^\s<>"]*(?:achatpublic|marches-publics|boamp|place|maximilien|megalis)[^\s<>"]*/i)?.[0] ??
      null;

    await supabase
      .from("tender_opportunities")
      .update({
        objet,
        acheteur: notice?.acheteur ?? undefined,
        url_avis: url ?? undefined,
        datelimitereponse: notice?.datelimitereponse ??
          parseFrenchDeadline(
            email.body.match(/jusqu[’']?\s*[àa]\s*([^\n*]{0,60})/i)?.[1] ??
              email.body.match(/(?:date limite|remise des offres)[^\n]{0,60}/i)?.[0] ?? null,
          ) ?? undefined,
        code_departement: notice ? departementFromCp(notice.cp) : undefined,
        matched_on: match.matched,
        dedup_key: dedupKey({ objet, acheteur: notice?.acheteur ?? null }),
        raw: { ...raw, body: email.body },
      })
      .eq("id", target.id);

    result.created = 1;
    return result;
  }

  // ── Digest : une fiche par avis retenu ───────────────────────────────
  for (const notice of notices) {
    const match = matchTender({ objet: notice.objet, extraText: notice.text }, config);
    if (!match.keep) {
      result.skipped++;
      continue;
    }

    const { error } = await supabase.rpc("upsert_tender_opportunity", {
      p_source: source,
      // Référence de l'avis (ou son lien) : stable d'une alerte à l'autre,
      // donc un rectificatif met à jour la fiche au lieu d'en créer une.
      p_source_ref: notice.reference ?? notice.url ?? `${email.messageId}#${result.created}`,
      p_initial_status: "to_review",
      p_payload: {
        source_email_id: email.id,
        objet: notice.objet,
        acheteur: notice.acheteur,
        nature: "APPEL_OFFRE",
        url_avis: notice.url,
        datelimitereponse: notice.datelimitereponse,
        code_departement: departementFromCp(notice.cp),
        matched_on: match.matched,
        dedup_key: dedupKey({
          objet: notice.objet,
          acheteur: notice.acheteur,
          datelimitereponse: notice.datelimitereponse,
        }),
        raw: {
          subject: email.subject,
          from: email.from,
          reference: notice.reference,
          ville: notice.ville,
          cp: notice.cp,
          body: notice.text,
        },
      },
    });
    if (error) result.skipped++;
    else result.created++;
  }

  // La fiche créée à l'arrivée portait le sujet du mail, pas un avis : elle
  // n'a plus de sens dès que les avis réels sont extraits. Supprimée seulement
  // si personne ne l'a traitée.
  const placeholder = (existing ?? []).find(
    (t: { source_ref: string | null }) => t.source_ref === email.messageId,
  );
  if (
    result.notices >= 2 && placeholder &&
    placeholder.status === "to_review" && !placeholder.crm_card_id &&
    !Object.keys(placeholder.decision ?? {}).length
  ) {
    const { error } = await supabase
      .from("tender_opportunities")
      .delete()
      .eq("id", placeholder.id);
    result.placeholderRemoved = !error;
  }

  return result;
}
