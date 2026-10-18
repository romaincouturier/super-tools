// Facture Pennylane en brouillon depuis les activités d'une mission.
//
// Deux actions :
// - "prepare" : renvoie la fiche client déduite de la mission (carte CRM liée,
//   sinon nom client de la mission et contact principal), à corriger dans le
//   dialogue avant création.
// - "create"  : crée le brouillon (une ligne par activité, échéance J+30) et
//   marque les activités comme facturées.
//
// Les lectures et écritures en base passent par le client de l'utilisateur :
// la RLS des missions décide de qui peut facturer quoi. Seul le token
// Pennylane est lu en service role. Écrire dans Pennylane exige en plus le
// droit Finances (canUsePennylane), comme pennylane-proxy.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { createMissionDraftInvoice, type InvoiceActivity } from "../_shared/pennylane-invoices.ts";
import type { CustomerInput } from "../_shared/pennylane-quotes.ts";
import { canUsePennylane } from "../_shared/pennylane-access.ts";

const FN = "create-mission-invoice";

type Body = {
  action?: "prepare" | "create";
  mission_id?: string;
  activity_ids?: string[];
  vat_rate?: string;
  customer?: CustomerInput;
};

Deno.serve(async (req) => {
  const preflight = handleCorsPreflightIfNeeded(req);
  if (preflight) return preflight;

  try {
    const authHeader = req.headers.get("Authorization") || "";
    if (!authHeader.startsWith("Bearer ")) return createErrorResponse("Missing Authorization header", 401);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return createErrorResponse("Invalid or expired session", 401);

    const body = (await req.json().catch(() => ({}))) as Body;
    const missionId = (body.mission_id || "").trim();
    if (!missionId) return createErrorResponse("mission_id est requis", 400);

    const { data: mission, error: missionError } = await userClient
      .from("missions")
      .select("id, title, client_name")
      .eq("id", missionId)
      .maybeSingle();
    if (missionError) return createErrorResponse(missionError.message, 500, { cause: missionError, fn: FN });
    if (!mission) return createErrorResponse("Mission introuvable", 404);

    if (body.action === "prepare") {
      const [{ data: card }, { data: contacts }] = await Promise.all([
        userClient
          .from("crm_cards")
          .select("company, first_name, last_name, email, address, postal_code, city, country, siren")
          .eq("linked_mission_id", missionId)
          .order("updated_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        userClient
          .from("mission_contacts")
          .select("first_name, last_name, email, is_primary, is_sponsor, position")
          .eq("mission_id", missionId)
          .order("position", { ascending: true }),
      ]);
      const contact =
        (contacts ?? []).find((c: { is_sponsor: boolean }) => c.is_sponsor) ??
        (contacts ?? []).find((c: { is_primary: boolean }) => c.is_primary) ??
        (contacts ?? [])[0];

      const customer: CustomerInput = {
        type: "company",
        name: card?.company || mission.client_name || "",
        email: card?.email || contact?.email || "",
        address: card?.address || "",
        postal_code: card?.postal_code || "",
        city: card?.city || "",
        country: card?.country || "FR",
        reg_no: card?.siren || "",
      };
      return createJsonResponse({ customer, source: card ? "crm" : "mission" }, 200);
    }

    if (body.action !== "create") return createErrorResponse("action doit valoir prepare ou create", 400);

    const activityIds = Array.isArray(body.activity_ids) ? body.activity_ids : [];
    if (activityIds.length === 0) return createErrorResponse("Sélectionner au moins une activité", 400);
    if (!body.customer) return createErrorResponse("Fiche client manquante", 400);
    const vatRate = (body.vat_rate || "").trim();

    const { data: rows, error: actError } = await userClient
      .from("mission_activities")
      .select("id, description, activity_date, duration, duration_type, billable_amount, is_billed, invoice_number, credit_id")
      .eq("mission_id", missionId)
      .in("id", activityIds)
      .order("activity_date", { ascending: true });
    if (actError) return createErrorResponse(actError.message, 500, { cause: actError, fn: FN });
    if ((rows ?? []).length !== activityIds.length) {
      return createErrorResponse("Certaines activités sont introuvables sur cette mission", 400);
    }
    const alreadyBilled = (rows ?? []).filter(
      (r: { is_billed: boolean; invoice_number: string | null; credit_id: string | null }) =>
        r.is_billed || r.invoice_number || r.credit_id,
    );
    if (alreadyBilled.length > 0) {
      return createErrorResponse("Certaines activités sont déjà facturées ou imputées sur un crédit", 409);
    }

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    if (!(await canUsePennylane(admin, user.id))) {
      return createErrorResponse("Accès Pennylane réservé au module Finances", 403);
    }
    let invoice;
    try {
      invoice = await createMissionDraftInvoice(admin, rows as InvoiceActivity[], body.customer, vatRate);
    } catch (e) {
      // Refus Pennylane ou entrée invalide : message exploitable, pas une panne.
      return createErrorResponse(e instanceof Error ? e.message : String(e), 422);
    }

    const invoiceNumber = invoice.number ? String(invoice.number) : `Brouillon Pennylane ${invoice.id ?? ""}`.trim();
    const { error: updateError } = await userClient
      .from("mission_activities")
      .update({
        invoice_number: invoiceNumber,
        invoice_url: typeof invoice.pdfUrl === "string" ? invoice.pdfUrl : null,
        is_billed: true,
      })
      .in("id", activityIds);

    console.log(
      `[${FN}] brouillon id=${invoice.id} numero=${invoice.number ?? "-"} mission=${missionId} activites=${activityIds.length} client=${invoice.customerId}${invoice.customerCreated ? " (créé)" : ""} par=${user.email}`,
    );

    return createJsonResponse(
      {
        invoice_id: invoice.id,
        invoice_number: invoiceNumber,
        pdf_url: invoice.pdfUrl ?? null,
        customer_created: invoice.customerCreated,
        // Le brouillon existe : un échec ici se signale, il n'annule rien.
        activities_updated: !updateError,
        update_error: updateError?.message ?? null,
      },
      200,
    );
  } catch (err) {
    return createErrorResponse(err instanceof Error ? err.message : "Erreur inconnue", 500, { cause: err, fn: FN });
  }
});
