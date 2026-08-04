import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  createErrorResponse,
  createJsonResponse,
  handleCorsPreflightIfNeeded,
} from "../_shared/cors.ts";
import { getSupabaseClient, verifyAuth } from "../_shared/supabase-client.ts";
import { aiChat } from "../_shared/ai.ts";
import { extractDocument } from "../_shared/document-extract.ts";
import { mapBoampRecord } from "../_shared/boamp.ts";
import {
  buildDocumentPrompt,
  buildNoticePrompt,
  DOCUMENT_SYSTEM,
  NOTICE_SYSTEM,
  parseAiJson,
  type DocumentAnalysis,
  type NoticeSummary,
} from "../_shared/tender-ai.ts";

/**
 * Analyse d'un appel d'offres, à la demande depuis la fiche de revue.
 *
 *   POST { "tender_id": "…" }    → synthèse de l'AVIS
 *   POST { "document_id": "…" }  → analyse d'une pièce du DCE déposée
 *
 * À la demande et jamais à l'ingestion : à une trentaine d'avis par mois dont
 * 98 % finissent en No Go, résumer tout le flux serait payer un appel de modèle
 * pour des marchés qu'on écarte en lisant le titre.
 *
 * Le résultat est stocké. Rouvrir une fiche ne repaye rien ; le bouton reste
 * disponible pour refaire l'analyse.
 */

const VERSION = "tender-analyze@1.0.0";
const BUCKET = "tender-documents";

/**
 * Prose de l'avis, reconstituée depuis `raw`.
 *
 * `full_text` n'est pas stocké en colonne : il sert au filtrage à l'ingestion
 * et pèse lourd. Le rejouer depuis le brut coûte moins qu'une colonne dupliquée
 * sur toute la table. Les avis venus d'une alerte mail n'ont pas ce brut : on
 * se rabat alors sur ce que la fiche porte.
 */
function noticeFullText(row: { source: string; raw: unknown }): string | null {
  if (row.source !== "boamp" || !row.raw) return null;
  try {
    // deno-lint-ignore no-explicit-any
    return mapBoampRecord(row.raw as any).full_text || null;
  } catch {
    // Un brut illisible ne doit pas empêcher la synthèse : le modèle
    // travaillera sur les champs structurés seuls.
    return null;
  }
}

serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const user = await verifyAuth(req);
    if (!user?.id) {
      return createErrorResponse("Authentification requise", 401, { fn: "tender-analyze" });
    }

    const body = await req.json().catch(() => ({}));
    const tenderId: string | undefined = body.tender_id;
    const documentId: string | undefined = body.document_id;

    if (!tenderId && !documentId) {
      return createErrorResponse("tender_id ou document_id requis", 400, { fn: "tender-analyze" });
    }

    const supabase = getSupabaseClient();

    // ── Analyse d'une pièce du DCE ───────────────────────────
    if (documentId) {
      const { data: doc } = await supabase
        .from("tender_documents")
        .select("id, tender_id, file_name, storage_path, mime_type")
        .eq("id", documentId)
        .maybeSingle();

      if (!doc) {
        return createErrorResponse("Document introuvable", 404, { fn: "tender-analyze" });
      }

      const { data: tender } = await supabase
        .from("tender_opportunities")
        .select("objet, acheteur")
        .eq("id", doc.tender_id)
        .maybeSingle();

      const { data: file, error: downloadError } = await supabase.storage
        .from(BUCKET)
        .download(doc.storage_path);

      if (downloadError || !file) {
        return createErrorResponse("Fichier introuvable dans le stockage", 404, {
          cause: downloadError,
          fn: "tender-analyze",
        });
      }

      const bytes = new Uint8Array(await file.arrayBuffer());
      const { parts, note } = await extractDocument(
        bytes,
        doc.mime_type ?? "application/octet-stream",
        doc.file_name,
      );
      const text = parts
        .filter((p) => p.kind === "text" && p.text)
        .map((p) => p.text as string)
        .join("\n\n")
        .trim();

      // Un PDF scanné ne rend que des images, que ce chemin ne sait pas
      // envoyer au modèle. On le dit au lieu de rendre une analyse vide.
      if (!text) {
        const reason =
          "Aucun texte exploitable dans ce document (PDF scanné ou format non lisible). " +
          "Déposez une version texte pour l'analyser.";
        // `ai_analysis` n'est pas remis à null : si une analyse existait, elle
        // reste valable, seule la tentative du jour a échoué.
        await supabase
          .from("tender_documents")
          .update({ ai_error: reason })
          .eq("id", doc.id);
        return createJsonResponse({ _version: VERSION, analysis: null, error: reason });
      }

      const raw = await aiChat({
        system: DOCUMENT_SYSTEM,
        messages: [
          {
            role: "user",
            content: buildDocumentPrompt({
              fileName: doc.file_name,
              objet: tender?.objet ?? null,
              acheteur: tender?.acheteur ?? null,
              text,
              note,
            }),
          },
        ],
        tier: "smart",
        maxTokens: 2000,
        origin: "tender-analyze",
        operation: "dce-document",
        trigger: "user",
        userId: user.id,
      });

      let analysis: DocumentAnalysis;
      try {
        analysis = parseAiJson<DocumentAnalysis>(raw);
      } catch (e) {
        const reason = e instanceof Error ? e.message : "Réponse du modèle illisible";
        await supabase
          .from("tender_documents")
          .update({ ai_error: reason, ai_analysis_at: new Date().toISOString() })
          .eq("id", doc.id);
        return createErrorResponse(reason, 502, { cause: e, fn: "tender-analyze" });
      }

      const { error: saveError } = await supabase
        .from("tender_documents")
        .update({
          ai_analysis: analysis,
          ai_analysis_at: new Date().toISOString(),
          ai_analysis_model: "smart",
          ai_error: null,
        })
        .eq("id", doc.id);
      if (saveError) {
        return createErrorResponse("Analyse produite mais non enregistrée", 500, {
          cause: saveError,
          fn: "tender-analyze",
        });
      }

      return createJsonResponse({ _version: VERSION, analysis });
    }

    // ── Synthèse de l'avis ───────────────────────────────────
    const { data: row } = await supabase
      .from("tender_opportunities")
      .select(
        "id, source, objet, acheteur, nature, datelimitereponse, cpv_codes, decision, raw",
      )
      .eq("id", tenderId)
      .maybeSingle();

    if (!row) {
      return createErrorResponse("Avis introuvable", 404, { fn: "tender-analyze" });
    }

    const raw = await aiChat({
      system: NOTICE_SYSTEM,
      messages: [
        {
          role: "user",
          content: buildNoticePrompt({
            objet: row.objet,
            acheteur: row.acheteur,
            nature: row.nature,
            datelimitereponse: row.datelimitereponse,
            cpv_codes: row.cpv_codes,
            decision: row.decision,
            fullText: noticeFullText(row),
          }),
        },
      ],
      tier: "smart",
      maxTokens: 2000,
      origin: "tender-analyze",
      operation: "notice-summary",
      trigger: "user",
      userId: user.id,
    });

    let summary: NoticeSummary;
    try {
      summary = parseAiJson<NoticeSummary>(raw);
    } catch (e) {
      return createErrorResponse(
        e instanceof Error ? e.message : "Réponse du modèle illisible",
        502,
        { cause: e, fn: "tender-analyze" },
      );
    }

    const { error: saveError } = await supabase
      .from("tender_opportunities")
      .update({
        ai_summary: summary,
        ai_summary_at: new Date().toISOString(),
        ai_summary_model: "smart",
      })
      .eq("id", row.id);
    if (saveError) {
      return createErrorResponse("Synthèse produite mais non enregistrée", 500, {
        cause: saveError,
        fn: "tender-analyze",
      });
    }

    return createJsonResponse({ _version: VERSION, summary });
  } catch (error) {
    return createErrorResponse("Erreur d'analyse de l'appel d'offres", 500, {
      cause: error,
      fn: "tender-analyze",
    });
  }
});
