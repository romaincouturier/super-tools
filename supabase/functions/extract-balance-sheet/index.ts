// Use case 5 BalanceSheetAnalyzer : extrait les données structurées
// d'un bilan comptable PDF via Claude Sonnet (support PDF natif),
// puis upsert le résultat dans balance_sheets.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  handleCorsPreflightIfNeeded,
  createErrorResponse,
  createJsonResponse,
  verifyAuth,
} from "../_shared/mod.ts";
import { CLAUDE_ADVANCED } from "../_shared/claude-models.ts";

const ANTHROPIC_API_KEY = Deno.env.get("ANTHROPIC_API_KEY");

const SYSTEM_PROMPT = `Tu es un expert-comptable français spécialisé dans l'analyse de bilans comptables au format PCG (Plan Comptable Général).

Ton rôle : extraire les données chiffrées d'un bilan comptable PDF au format JSON strict, sans omettre ni inventer de rubriques.

Règles :
- Toutes les valeurs sont des nombres en euros (convertir les k€ en € : multiplier par 1000).
- Si une rubrique est absente du bilan, mettre 0.
- Si une rubrique est négative (perte par exemple), conserver le signe négatif.
- Pour le compte de résultat, "résultat net" = résultat de l'exercice (après IS).
- Réponds UNIQUEMENT avec un objet JSON valide, sans markdown, sans bloc \`\`\`, sans commentaire avant ou après.

Schéma JSON attendu :
{
  "annee": number,
  "actif": {
    "immobilisations_incorporelles": number,
    "immobilisations_corporelles": number,
    "immobilisations_financieres": number,
    "stocks": number,
    "creances_clients": number,
    "autres_creances": number,
    "disponibilites": number,
    "valeurs_mobilieres_placement": number,
    "total_actif": number
  },
  "passif": {
    "capital_social": number,
    "reserves": number,
    "resultat_exercice": number,
    "capitaux_propres": number,
    "provisions": number,
    "dettes_financieres_long_terme": number,
    "dettes_financieres_court_terme": number,
    "dettes_fournisseurs_court_terme": number,
    "dettes_fiscales_sociales_court_terme": number,
    "autres_dettes_court_terme": number,
    "total_passif": number
  },
  "compte_resultat": {
    "chiffre_affaires": number,
    "charges_exploitation": number,
    "resultat_exploitation": number,
    "resultat_financier": number,
    "resultat_exceptionnel": number,
    "impot_societes": number,
    "resultat_net": number
  }
}`;

interface ExtractRequest {
  storage_path: string;
  annee: number;
  pdf_filename?: string;
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const uint8Array = new Uint8Array(buffer);
  const CHUNK_SIZE = 8192;
  let binary = "";
  for (let i = 0; i < uint8Array.length; i += CHUNK_SIZE) {
    const chunk = uint8Array.subarray(i, Math.min(i + CHUNK_SIZE, uint8Array.length));
    binary += String.fromCharCode.apply(null, Array.from(chunk));
  }
  return btoa(binary);
}

interface BalanceData {
  annee?: number;
  actif?: { total_actif?: number; [k: string]: unknown };
  passif?: { total_passif?: number; [k: string]: unknown };
  compte_resultat?: Record<string, unknown>;
}

function stripCodeFences(text: string): string {
  return text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();
}

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const user = await verifyAuth(req.headers.get("Authorization"));
    if (!user) {
      return createErrorResponse("Invalid or expired session", 401);
    }

    if (!ANTHROPIC_API_KEY) {
      return createErrorResponse("ANTHROPIC_API_KEY non configurée côté Supabase", 500);
    }

    const body = (await req.json().catch(() => ({}))) as Partial<ExtractRequest>;
    const storagePath = (body.storage_path || "").toString();
    const annee = Number(body.annee);
    const pdfFilename = body.pdf_filename || null;

    if (!storagePath) {
      return createErrorResponse("Body must include `storage_path`", 400);
    }
    if (!Number.isFinite(annee) || annee < 2000 || annee > 2100) {
      return createErrorResponse("Body must include a valid `annee` (2000-2100)", 400);
    }

    // Le path doit être préfixé par l'user_id (cohérent avec la RLS du bucket).
    if (!storagePath.startsWith(`${user.id}/`)) {
      return createErrorResponse("storage_path doit être préfixé par l'user id", 403);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const admin = createClient(supabaseUrl, serviceKey);

    const { data: pdfBlob, error: dlErr } = await admin.storage.from("balance-sheets").download(storagePath);
    if (dlErr || !pdfBlob) {
      console.error("[extract-balance-sheet] download error", dlErr);
      return createErrorResponse(`Téléchargement du PDF impossible : ${dlErr?.message ?? "blob vide"}`, 404);
    }

    const buffer = await pdfBlob.arrayBuffer();
    if (buffer.byteLength < 200) {
      return createErrorResponse("PDF vide ou invalide", 400);
    }
    const base64 = arrayBufferToBase64(buffer);

    const userPrompt = `Voici le bilan comptable de l'année ${annee}. Extrait les données au format JSON strict défini dans le system prompt.`;

    const aiResp = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: CLAUDE_ADVANCED,
        max_tokens: 4096,
        system: [
          {
            type: "text",
            text: SYSTEM_PROMPT,
            cache_control: { type: "ephemeral" },
          },
        ],
        messages: [
          {
            role: "user",
            content: [
              {
                type: "document",
                source: { type: "base64", media_type: "application/pdf", data: base64 },
              },
              { type: "text", text: userPrompt },
            ],
          },
        ],
      }),
    });

    if (!aiResp.ok) {
      const errText = await aiResp.text();
      console.error("[extract-balance-sheet] Anthropic error", aiResp.status, errText.slice(0, 500));
      return createErrorResponse(`Anthropic API ${aiResp.status}`, aiResp.status >= 500 ? 502 : 400);
    }

    const aiJson = await aiResp.json();
    const rawText: string = aiJson?.content?.[0]?.text ?? "";
    if (!rawText) {
      return createErrorResponse("Réponse IA vide", 502);
    }

    let data: BalanceData;
    try {
      data = JSON.parse(stripCodeFences(rawText));
    } catch (e) {
      console.error("[extract-balance-sheet] JSON parse error", rawText.slice(0, 500));
      return createErrorResponse(`Sortie IA non parsable : ${e instanceof Error ? e.message : "unknown"}`, 502);
    }

    // Force l'année (l'IA peut s'embrouiller sur le millésime).
    data.annee = annee;

    const warnings: string[] = [];
    const totalActif = Number(data.actif?.total_actif ?? 0);
    const totalPassif = Number(data.passif?.total_passif ?? 0);
    if (Math.abs(totalActif - totalPassif) > 1) {
      warnings.push(`Total actif (${totalActif}€) ≠ Total passif (${totalPassif}€) — vérifier l'extraction.`);
    }

    const { error: upsertErr } = await admin.from("balance_sheets").upsert(
      {
        user_id: user.id,
        annee,
        data,
        pdf_filename: pdfFilename,
        pdf_storage_path: storagePath,
        extracted_at: new Date().toISOString(),
      },
      { onConflict: "user_id,annee" },
    );
    if (upsertErr) {
      console.error("[extract-balance-sheet] upsert error", upsertErr);
      return createErrorResponse(`Persist failed: ${upsertErr.message}`, 500);
    }

    return createJsonResponse({ result: { ...data, warnings } }, 200);
  } catch (err) {
    console.error("[extract-balance-sheet] error:", err);
    return createErrorResponse(err instanceof Error ? err.message : "Unknown error", 500);
  }
});
