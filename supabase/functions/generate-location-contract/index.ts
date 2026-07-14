import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { corsHeaders, createErrorResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const PDFMONKEY_API_KEY = Deno.env.get("PDFMONKEY_API_KEY")!;

interface RequestBody {
  orderItemId: string;
}

function formatDateFR(date: Date): string {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
}

function getSetting(settings: Array<{ key: string; value: unknown }>, key: string, fallback = ""): string {
  const row = settings.find((s) => s.key === key);
  if (!row || row.value === null || row.value === undefined) return fallback;
  const v = row.value;
  return typeof v === "string" ? v.replace(/^"|"$/g, "") : String(v);
}

serve(async (req: Request): Promise<Response> => {
  const corsResponse = handleCorsPreflightIfNeeded(req);
  if (corsResponse) return corsResponse;

  try {
    const body: RequestBody = await req.json();
    const { orderItemId } = body;

    if (!orderItemId) {
      return createErrorResponse("orderItemId requis", 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // ── Fetch order item with joins ───────────────────────────────
    const { data: item, error: itemErr } = await supabase
      .from("order_items" as any)
      .select(`
        *,
        woocommerce_orders!woocommerce_order_id (
          wc_order_id, order_number, date_created,
          customer_first_name, customer_last_name, customer_email,
          billing_address, total_ttc, total_ht
        ),
        games!game_id (
          id, title, game_type,
          pdfmonkey_template_id,
          location_duree_libelle, location_duree_jours,
          location_tarif_retard_mois, location_prix_remplacement
        )
      `)
      .eq("id", orderItemId)
      .single();

    if (itemErr || !item) {
      return createErrorResponse("Commande introuvable", 404);
    }

    const order = (item as any).woocommerce_orders;
    const game = (item as any).games;

    if (!game?.pdfmonkey_template_id) {
      return createErrorResponse("Aucun template PDF Monkey configuré sur ce jeu (champ pdfmonkey_template_id)", 422);
    }

    // ── Fetch supertilt settings for bailleur info ────────────────
    const { data: settingsRows } = await supabase
      .from("supertilt_settings" as any)
      .select("key, value");
    const settings = (settingsRows ?? []) as Array<{ key: string; value: unknown }>;

    const bailleurNom = getSetting(settings, "bailleur_nom", "SuperTilt");
    const bailleurAdresse = getSetting(settings, "bailleur_adresse", "");
    const bailleurCodePostal = getSetting(settings, "bailleur_code_postal", "");
    const bailleurVille = getSetting(settings, "bailleur_ville", "");
    const bailleurPays = getSetting(settings, "bailleur_pays", "France");
    const bailleurEmail = getSetting(settings, "bailleur_email", getSetting(settings, "internal_email", ""));

    // ── Generate contrat reference ────────────────────────────────
    const currentYear = new Date().getFullYear();
    const { data: refData } = await supabase.rpc("next_location_contract_ref" as any, {
      p_year: currentYear,
    });
    const contratReference = (refData as string) ?? `LOC-${currentYear}-???`;

    // ── Build billing address fields ──────────────────────────────
    const billing = (order?.billing_address ?? {}) as Record<string, string>;
    const locatairePrenom = billing.first_name ?? order?.customer_first_name ?? "";
    const locataireNom = billing.last_name ?? order?.customer_last_name ?? "";
    const locataireAdresse = billing.address_1 ?? "";
    const locataireCodePostal = billing.postcode ?? "";
    const locataireVille = billing.city ?? "";
    const locatairePays = billing.country ?? "";
    const locataireEmail = order?.customer_email ?? "";

    // ── Build PDF Monkey payload ──────────────────────────────────
    const today = new Date();
    const montantPaye = String(
      Math.round((item as any).line_total ?? (order?.total_ttc ?? 0))
    );

    const payload: Record<string, string> = {
      contrat_reference: contratReference,
      commande_reference: order?.order_number ? `WC-${order.order_number}` : `WC-${(item as any).wc_order_id}`,
      date_emission: formatDateFR(today),

      bailleur_nom: bailleurNom,
      bailleur_adresse: bailleurAdresse,
      bailleur_code_postal: bailleurCodePostal,
      bailleur_ville: bailleurVille,
      bailleur_pays: bailleurPays,
      bailleur_email: bailleurEmail,

      jeu_nom: game.title ?? "",

      locataire_prenom: locatairePrenom,
      locataire_nom: locataireNom,
      locataire_adresse: locataireAdresse,
      locataire_code_postal: locataireCodePostal,
      locataire_ville: locataireVille,
      locataire_pays: locatairePays,
      locataire_email: locataireEmail,

      duree_libelle: game.location_duree_libelle ?? "",
      duree_jours: String(game.location_duree_jours ?? ""),
      montant_paye: montantPaye,

      tarif_retard_mois: String(game.location_tarif_retard_mois ?? ""),
      prix_remplacement: String(game.location_prix_remplacement ?? ""),

      locataire_signature_date: "",
    };

    console.log("PDF Monkey payload:", JSON.stringify(payload));

    // ── Call PDF Monkey ───────────────────────────────────────────
    const createResponse = await fetch("https://api.pdfmonkey.io/api/v1/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${PDFMONKEY_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        document: {
          document_template_id: game.pdfmonkey_template_id,
          payload,
          status: "pending",
        },
      }),
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error("PDF Monkey create error:", errorText);
      throw new Error(`Erreur création PDF: ${errorText}`);
    }

    const createData = await createResponse.json();
    const documentId = createData.document.id;
    console.log("PDF Monkey document created:", documentId);

    // ── Poll for completion ───────────────────────────────────────
    let attempts = 0;
    const maxAttempts = 30;
    let pdfUrl: string | null = null;

    while (attempts < maxAttempts) {
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const statusResponse = await fetch(
        `https://api.pdfmonkey.io/api/v1/documents/${documentId}`,
        { headers: { Authorization: `Bearer ${PDFMONKEY_API_KEY}` } }
      );

      if (!statusResponse.ok) throw new Error("Erreur vérification statut PDF");

      const statusData = await statusResponse.json();
      const status = statusData.document.status;
      console.log(`Document status: ${status}`);

      if (status === "success") {
        pdfUrl = statusData.document.download_url;
        break;
      }

      if (status === "error") {
        throw new Error("PDF Monkey: erreur de génération du document");
      }

      attempts++;
    }

    if (!pdfUrl) {
      throw new Error("Timeout: le PDF n'a pas été généré dans les délais");
    }

    // ── Save to order_items ───────────────────────────────────────
    await supabase
      .from("order_items" as any)
      .update({
        location_contract_file_url: pdfUrl,
        location_document_id: documentId,
        contrat_reference: contratReference,
      })
      .eq("id", orderItemId);

    console.log("Contract URL saved to order_item:", pdfUrl);

    return new Response(
      JSON.stringify({ contractUrl: pdfUrl, documentId, contratReference }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: unknown) {
    console.error("Error:", error);
    return createErrorResponse(error instanceof Error ? error.message : "Erreur inconnue", 500, { cause: error, fn: "generate-location-contract" });
  }
});
