import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  handleCorsPreflightIfNeeded,
} from "../_shared/mod.ts";
import {
  buildTedSearchBody,
  mapTedNotice,
  TED_BASE,
  type NormalizedTender,
} from "../_shared/ted.ts";
import {
  dedupKey,
  loadTenderFilterConfig,
  matchTender,
  parseSettingList,
} from "../_shared/tender-tools.ts";

/**
 * Ingestion du TED (marchés publics européens) dans `tender_opportunities`.
 *
 * Même destination et même filtre que le BOAMP : un avis européen arrive en
 * `to_review` et attend une décision humaine. Le rapprochement inter-sources
 * s'occupe des marchés publiés aux deux endroits.
 *
 * Trois modes :
 *   POST {}                  → synchronisation normale
 *   POST { "probe": true }   → n'écrit rien, renvoie la requête envoyée, la
 *                              réponse brute et le mapping côte à côte
 *   POST { "since": "..." }  → fenêtre explicite
 *
 * LE MODE SONDE EST LE PREMIER GESTE À FAIRE. Le contrat de transport de l'API
 * TED n'a pas pu être vérifié à l'écriture : la sonde le confirme ou le
 * corrige en une exécution, sans rien écrire en base. Voir
 * docs/marches-publics.md.
 */

const VERSION = "ted-sync@1.0.0";
/** Recouvrement : un avis peut être indexé avec un jour de retard. */
const OVERLAP_DAYS = 2;
/** Garde-fou : au-delà, c'est que le filtre est trop large, on préfère le savoir. */
const MAX_RECORDS = 1000;
/** Réglage des pays surveillés. La France est exclue : elle arrive par le BOAMP. */
const COUNTRIES_SETTING = "tender_ted_countries";

function isoDay(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function resolveSince(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  explicit: string | undefined,
): Promise<string> {
  if (explicit) return explicit;
  const { data } = await supabase
    .from("tender_opportunities")
    .select("dateparution")
    .eq("source", "ted")
    .order("dateparution", { ascending: false })
    .limit(1)
    .maybeSingle();

  const last = data?.dateparution as string | undefined;
  const base = last ? new Date(last) : new Date(Date.now() - 30 * 86_400_000);
  base.setDate(base.getDate() - (last ? OVERLAP_DAYS : 0));
  return isoDay(base);
}

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
    const supabase = getSupabaseClient();
    const config = await loadTenderFilterConfig(supabase);

    if (!config.cpvCodes.length && !config.keywords.length) {
      return createErrorResponse(
        "Aucun code CPV ni mot-clé configuré (app_settings : tender_cpv_codes, tender_keywords)",
        400,
        { fn: "ted-sync" },
      );
    }

    const { data: countriesRow } = await supabase
      .from("app_settings")
      .select("setting_value")
      .eq("setting_key", COUNTRIES_SETTING)
      .maybeSingle();
    const countries = parseSettingList(countriesRow?.setting_value).map((c) => c.toUpperCase());

    if (!countries.length) {
      // Sans pays, la requête ramènerait toute l'Europe, France comprise, donc
      // des doublons du BOAMP par milliers. On refuse plutôt que d'inonder.
      return createErrorResponse(
        `Aucun pays surveillé (app_settings : ${COUNTRIES_SETTING})`,
        400,
        { fn: "ted-sync" },
      );
    }

    const since = await resolveSince(supabase, body.since);
    const searchBody = buildTedSearchBody({
      countries,
      cpvCodes: config.cpvCodes,
      keywords: config.keywords,
      since,
    });

    const res = await fetch(`${TED_BASE}/notices/search`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(searchBody),
    });
    const payload = await res.json().catch(() => null);

    // ── Sonde : le contrat de l'API sans rien écrire ─────────
    if (body.probe) {
      // deno-lint-ignore no-explicit-any
      const first = (payload?.notices ?? payload?.results ?? payload?.content ?? [])[0] as any;
      return createJsonResponse({
        _version: VERSION,
        countries,
        since,
        request: searchBody,
        http_status: res.status,
        response_keys: payload && typeof payload === "object" ? Object.keys(payload).sort() : null,
        notice_keys: first && typeof first === "object" ? Object.keys(first).sort() : null,
        mapped_sample: first ? { ...mapTedNotice(first), raw: undefined } : null,
      });
    }

    if (!res.ok) {
      return createErrorResponse(`TED a répondu ${res.status}`, 502, { fn: "ted-sync" });
    }

    // La forme de l'enveloppe n'est pas certaine : on accepte les trois noms
    // plausibles plutôt que d'échouer sur un renommage.
    const notices: unknown[] =
      payload?.notices ?? payload?.results ?? payload?.content ??
      (Array.isArray(payload) ? payload : []);

    if (!Array.isArray(notices) || notices.length === 0) {
      console.log(`[${VERSION}] aucune notice`, JSON.stringify({ since, countries }));
    }

    let kept = 0;
    let excluded = 0;
    let unmatched = 0;
    let failed = 0;
    const parseErrors: string[] = [];

    for (const notice of notices.slice(0, MAX_RECORDS)) {
      let tender: NormalizedTender;
      try {
        tender = mapTedNotice(notice);
      } catch (e) {
        failed++;
        parseErrors.push(e instanceof Error ? e.message : "mapping impossible");
        continue;
      }
      if (!tender.source_ref) {
        failed++;
        parseErrors.push("avis sans numéro de publication");
        continue;
      }

      const match = matchTender(
        { objet: tender.objet, cpvCodes: tender.cpv_codes, extraText: tender.full_text },
        config,
      );
      if (match.excludedBy) {
        excluded++;
        continue;
      }
      if (!match.keep) {
        unmatched++;
        continue;
      }

      // Même fonction SQL que le BOAMP : un upsert PostgREST réécrirait
      // `status` et ferait revenir chaque matin les avis déjà écartés.
      const { error } = await supabase.rpc("upsert_tender_opportunity", {
        p_source: tender.source,
        p_source_ref: tender.source_ref,
        p_initial_status: "to_review",
        p_payload: {
          url_avis: tender.url_avis,
          objet: tender.objet,
          acheteur: tender.acheteur,
          nature: tender.nature,
          type_marche: tender.type_marche,
          famille_libelle: tender.famille_libelle,
          code_departement: tender.code_departement,
          cpv_codes: tender.cpv_codes,
          dateparution: tender.dateparution,
          datelimitereponse: tender.datelimitereponse,
          decision: tender.decision,
          matched_on: match.matched,
          dedup_key: dedupKey(tender),
          raw: tender.raw,
          parse_error: tender.parse_error,
        },
      });

      if (error) {
        failed++;
        parseErrors.push(`${tender.source_ref} : ${error.message}`);
        continue;
      }
      if (tender.parse_error) parseErrors.push(`${tender.source_ref} : ${tender.parse_error}`);
      kept++;
    }

    // Un marché français au-dessus du seuil est publié au BOAMP ET au TED :
    // c'est ici que le doublon est ramené sur une seule ligne.
    const { data: linked } = await supabase.rpc("link_tender_duplicates");

    const summary = {
      _version: VERSION,
      since,
      countries,
      notices_received: notices.length,
      kept,
      excluded,
      unmatched,
      failed,
      duplicates_linked: linked ?? 0,
      truncated: notices.length > MAX_RECORDS,
      parse_errors: parseErrors.slice(0, 20),
    };
    console.log(`[${VERSION}]`, JSON.stringify(summary));

    // Une synchronisation qui n'écrit rien alors que le TED a répondu est un
    // échec déguisé : sans ce 500, le cron se dirait réussi tous les matins
    // pendant que rien n'entre.
    if (failed > 0 && kept === 0) {
      return createErrorResponse(
        `Synchronisation sans effet : ${failed} avis en échec, aucun enregistré. ` +
          parseErrors.slice(0, 3).join(" | "),
        500,
        { fn: "ted-sync" },
      );
    }

    return createJsonResponse({ success: true, ...summary });
  } catch (error) {
    return createErrorResponse("Erreur de synchronisation TED", 500, {
      cause: error,
      fn: "ted-sync",
    });
  }
});
