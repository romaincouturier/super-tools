import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createErrorResponse,
  createJsonResponse,
  getSupabaseClient,
  handleCorsPreflightIfNeeded,
} from "../_shared/mod.ts";
import {
  BOAMP_BASE,
  boampExportUrl,
  buildBoampWhere,
  mapBoampRecord,
  type NormalizedTender,
} from "../_shared/boamp.ts";
import {
  dedupKey,
  loadTenderFilterConfig,
  matchTender,
} from "../_shared/tender-tools.ts";

/**
 * Ingestion quotidienne du BOAMP dans `tender_opportunities`.
 *
 * Rien n'est créé dans le CRM ici : les avis arrivent en `to_review` et
 * attendent une décision humaine. Voir docs/marches-publics.md.
 *
 * Deux modes :
 *   POST {}                       → synchronisation normale
 *   POST { "probe": true }        → renvoie les clés d'un enregistrement brut
 *                                   et la requête construite, sans rien écrire.
 *                                   Sert à vérifier le contrat de l'API avant
 *                                   de faire confiance au mapping.
 *
 * Paramètres facultatifs : { since: "2026-07-01", natures: ["APPEL_OFFRE"] }.
 */

const VERSION = "boamp-sync@1.0.0";
/** Recouvrement : le BOAMP publie le matin, un avis peut arriver en retard. */
const OVERLAP_DAYS = 2;
/** Garde-fou : au-delà, c'est que le filtre est trop large, on préfère le savoir. */
const MAX_RECORDS = 2000;

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
    .eq("source", "boamp")
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
        { fn: "boamp-sync" },
      );
    }

    const natures: string[] = body.natures ?? ["APPEL_OFFRE", "ATTRIBUTION", "RECTIFICATIF"];
    const since = await resolveSince(supabase, body.since);
    const where = buildBoampWhere({
      natures,
      since,
      cpvCodes: config.cpvCodes,
      keywords: config.keywords,
    });

    // ── Sonde : le contrat de l'API sans rien écrire ─────────
    if (body.probe) {
      const probeUrl = `${BOAMP_BASE}/records?limit=1`;
      const res = await fetch(probeUrl);
      const json = await res.json();
      const record = json?.results?.[0] ?? {};
      const mapped = mapBoampRecord(record);
      return createJsonResponse({
        _version: VERSION,
        where,
        export_url: boampExportUrl(where),
        record_keys: Object.keys(record).sort(),
        mapped_sample: { ...mapped, raw: undefined },
      });
    }

    // ── Synchronisation ──────────────────────────────────────
    const res = await fetch(boampExportUrl(where));
    if (!res.ok) {
      return createErrorResponse(`BOAMP a répondu ${res.status}`, 502, { fn: "boamp-sync" });
    }
    const payload = await res.json();
    // /exports/json renvoie un tableau nu ; /records renvoie { results }.
    const records: unknown[] = Array.isArray(payload) ? payload : (payload?.results ?? []);

    let kept = 0;
    let excluded = 0;
    let unmatched = 0;
    let failed = 0;
    const parseErrors: string[] = [];

    for (const record of records.slice(0, MAX_RECORDS)) {
      let tender: NormalizedTender;
      try {
        tender = mapBoampRecord(record);
      } catch (e) {
        failed++;
        parseErrors.push(e instanceof Error ? e.message : "mapping impossible");
        continue;
      }
      if (!tender.source_ref) {
        failed++;
        continue;
      }

      // Le filtre plein texte de l'API ramène des avis où le code apparaît
      // ailleurs que dans les CPV : on retranche ici, sur les champs réels.
      const match = matchTender(
        {
          objet: tender.objet,
          cpvCodes: tender.cpv_codes,
          extraText: tender.decision.lots.join(" "),
        },
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

      // Passe par la fonction SQL et non par un upsert PostgREST : un upsert
      // réécrirait `status`, donc remettrait en revue un avis déjà écarté à
      // chaque synchronisation. Un rectificatif met à jour le contenu et la
      // date limite, jamais la décision.
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

    // Rapprochement inter-sources : une alerte PLACE et l'avis BOAMP du même
    // marché portent la même dedup_key. Le plus ancien reste la ligne
    // canonique, les suivants pointent dessus.
    const { data: linked } = await supabase.rpc("link_tender_duplicates");

    const summary = {
      _version: VERSION,
      since,
      records_received: records.length,
      kept,
      excluded,
      unmatched,
      failed,
      duplicates_linked: linked ?? 0,
      truncated: records.length > MAX_RECORDS,
      parse_errors: parseErrors.slice(0, 20),
    };
    console.log(`[${VERSION}]`, JSON.stringify(summary));

    // Une synchronisation qui n'écrit rien alors que le BOAMP a répondu est un
    // échec déguisé. Répondre 500 plutôt que 200 fait échouer le cron
    // visiblement, et createErrorResponse reporte à Sentry (règle [037]) :
    // sans ça, le job se dirait « réussi » tous les matins pendant que la
    // table reste vide.
    if (failed > 0 && kept === 0) {
      return createErrorResponse(
        `Synchronisation sans effet : ${failed} avis en échec, aucun enregistré. ` +
          parseErrors.slice(0, 3).join(" | "),
        500,
        { fn: "boamp-sync" },
      );
    }

    return createJsonResponse({ success: true, ...summary });
  } catch (error) {
    console.error(`[${VERSION}] erreur`, error);
    return createErrorResponse("Erreur de synchronisation BOAMP", 500, {
      cause: error,
      fn: "boamp-sync",
    });
  }
});
