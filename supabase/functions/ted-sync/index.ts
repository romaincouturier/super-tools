import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  handleCorsPreflightIfNeeded,
} from "../_shared/mod.ts";
import {
  buildTedSearchBody,
  fetchPageWithRetry,
  mapTedNotice,
  noticesOf,
  TED_BASE,
  walkTedPages,
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

const VERSION = "ted-sync@2.0.0";
/** Recouvrement : un avis peut être indexé avec un jour de retard. */
const OVERLAP_DAYS = 2;
/** Garde-fou : au-delà, c'est que le filtre est trop large, on préfère le savoir. */
const MAX_RECORDS = 1000;
/** Second garde-fou : une pagination qui ne se termine pas ne doit pas boucler. */
const MAX_PAGES = 20;
/** Pays surveillés. Vide = tous : le critère de prospection est la langue. */
const COUNTRIES_SETTING = "tender_ted_countries";
/**
 * Codes CPV surveillés sur le TED. Liste propre à la source, vide par défaut :
 * les CPV de formation ramènent des centaines d'avis à l'échelle de l'Europe.
 * Le repérage européen se fait sur les mots-clés seuls.
 */
const CPV_SETTING = "tender_ted_cpv_codes";

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

    const { data: settingRows } = await supabase
      .from("app_settings")
      .select("setting_key, setting_value")
      .in("setting_key", [COUNTRIES_SETTING, CPV_SETTING]);
    const settingOf = (key: string) =>
      (settingRows ?? []).find((r: { setting_key: string }) => r.setting_key === key)
        ?.setting_value;

    // Vide = tous les pays. C'est le réglage par défaut : on prospecte sur la
    // langue de l'avis, pas sur sa géographie. La liste ne sert qu'à resserrer
    // si le volume devient ingérable.
    const countries = parseSettingList(settingOf(COUNTRIES_SETTING)).map((c) => c.toUpperCase());
    const tedCpvCodes = parseSettingList(settingOf(CPV_SETTING));
    // Le filtre appliqué au TED : mots-clés partagés avec le BOAMP, mais sa
    // propre liste de CPV (vide = aucun).
    const tedConfig = { ...config, cpvCodes: tedCpvCodes };

    if (!tedCpvCodes.length && !config.keywords.length) {
      return createErrorResponse(
        "Aucun mot-clé configuré (app_settings : tender_keywords)",
        400,
        { fn: "ted-sync" },
      );
    }

    const since = await resolveSince(supabase, body.since);

    /** Une page de résultats. La forme de l'enveloppe reste à confirmer. */
    // deno-lint-ignore no-explicit-any
    const fetchPage = async (token: string | null): Promise<any> => {
      const searchBody = buildTedSearchBody({
        countries,
        cpvCodes: tedCpvCodes,
        keywords: config.keywords,
        since,
        iterationNextToken: token,
      });
      const page = await fetchPageWithRetry(
        async () => {
          const res = await fetch(`${TED_BASE}/notices/search`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify(searchBody),
          });
          return { status: res.status, payload: await res.json().catch(() => null) };
        },
        token,
        token == null ? "page 1" : `page ${token.slice(0, 16)}`,
      );
      return { searchBody, ...page };
    };

    const firstPage = await fetchPage(null);

    // ── Sonde : le contrat de l'API sans rien écrire ─────────
    if (body.probe) {
      // deno-lint-ignore no-explicit-any
      const first = noticesOf(firstPage.payload)[0] as any;
      return createJsonResponse({
        _version: VERSION,
        countries,
        ted_cpv_codes: tedCpvCodes,
        since,
        request: firstPage.payload?.__searchBody ?? null,
        http_status: firstPage.status,
        response_keys:
          firstPage.payload && typeof firstPage.payload === "object"
            ? Object.keys(firstPage.payload).sort()
            : null,
        notice_keys: first && typeof first === "object" ? Object.keys(first).sort() : null,
        mapped_sample: first ? { ...mapTedNotice(first), raw: undefined } : null,
        // Une requête refusée renvoie une erreur structurée qui nomme le champ
        // fautif : c'est le chemin le plus court pour corriger la requête.
        error_body: firstPage.status >= 400 ? firstPage.payload : null,
      });
    }

    if (firstPage.status < 200 || firstPage.status >= 300) {
      return createErrorResponse(
        `TED a répondu ${firstPage.status} : ${JSON.stringify(firstPage.payload).slice(0, 300)}`,
        502,
        { fn: "ted-sync" },
      );
    }

    // Le parcours des pages vit dans `_shared/ted.ts` : c'est la partie qui se
    // teste, et celle où une erreur avalée coûte le plus cher.
    const walk = await walkTedPages({
      fetchPage: (token) => fetchPage(token).then((p) => ({ status: p.status, payload: p.payload })),
      // La première page est déjà en main : la redemander la paierait deux
      // fois et repartirait sur un autre gel d'index.
      firstPage: { status: firstPage.status, payload: firstPage.payload },
      maxRecords: MAX_RECORDS,
      maxPages: MAX_PAGES,
    });
    const notices = walk.notices;

    if (notices.length === 0) {
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
        tedConfig,
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
      ted_cpv_codes: tedCpvCodes,
      notices_received: notices.length,
      pages_read: walk.pages,
      kept,
      excluded,
      unmatched,
      failed,
      duplicates_linked: linked ?? 0,
      truncated: walk.truncated,
      parse_errors: parseErrors.slice(0, 20),
    };
    console.log(`[${VERSION}]`, JSON.stringify(summary));

    // Une synchronisation qui n'écrit rien alors que le TED a répondu est un
    // échec déguisé : sans ce 500, le cron se dirait réussi tous les matins
    // pendant que rien n'entre.
    // Un parcours interrompu au milieu laisse des avis non lus. Le dire en 502
    // plutôt qu'en succès : sinon le cron se déclare vert tous les matins
    // pendant qu'il manque la moitié du flux, et Sentry ne voit rien.
    if (walk.error) {
      return createErrorResponse(
        `Parcours TED incomplet (${walk.error}) : ${kept} avis enregistrés sur ` +
          `${notices.length} lus, le reste n'a pas été parcouru.`,
        502,
        { fn: "ted-sync" },
      );
    }

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
