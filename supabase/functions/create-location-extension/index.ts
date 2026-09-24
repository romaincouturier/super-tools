// Prolongation d'une location de jeu.
//
// Deux actions :
// - "prepare" : renvoie la fiche client déduite de la commande WooCommerce et
//   la période proposée (début = fin courante de la location), à corriger dans
//   le dialogue avant création.
// - "create"  : enregistre la prolongation (référence d'avenant LOC-…-Pn),
//   crée la facture brouillon Pennylane et repousse la fin de location.
//
// Les lectures et écritures en base passent par le client de l'utilisateur :
// la RLS du module dropshipping décide de qui peut prolonger. Seul le token
// Pennylane est lu en service role.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { handleCorsPreflightIfNeeded, createErrorResponse, createJsonResponse } from "../_shared/cors.ts";
import { createDraftInvoice } from "../_shared/pennylane-invoices.ts";
import type { CustomerInput } from "../_shared/pennylane-quotes.ts";
import {
  extensionInvoiceLine,
  extensionReference,
  suggestedExtensionStart,
  validateExtensionPeriod,
} from "../_shared/location-extension.ts";

const FN = "create-location-extension";

type Body = {
  action?: "prepare" | "create";
  order_item_id?: string;
  start_date?: string;
  end_date?: string;
  amount_ht?: number;
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
    const orderItemId = (body.order_item_id || "").trim();
    if (!orderItemId) return createErrorResponse("order_item_id est requis", 400);

    const { data: item, error: itemError } = await userClient
      .from("order_items")
      .select(`
        id, unit_price, contrat_reference, location_end_date,
        woocommerce_orders!woocommerce_order_id (date_created, customer_email, billing_address),
        games!game_id (title, location_duree_jours)
      `)
      .eq("id", orderItemId)
      .maybeSingle();
    if (itemError) return createErrorResponse(itemError.message, 500, { cause: itemError, fn: FN });
    if (!item) return createErrorResponse("Commande introuvable", 404);

    const joined = item as {
      woocommerce_orders?: { date_created?: string; customer_email?: string; billing_address?: Record<string, string> } | null;
      games?: { title?: string; location_duree_jours?: number | null } | null;
    };
    const order = joined.woocommerce_orders ?? {};
    const game = joined.games ?? {};

    const { data: previous, error: prevError } = await userClient
      .from("location_extensions")
      .select("sequence, end_date")
      .eq("order_item_id", orderItemId)
      .order("sequence", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (prevError) return createErrorResponse(prevError.message, 500, { cause: prevError, fn: FN });

    if (body.action === "prepare") {
      const billing = (order.billing_address ?? {}) as Record<string, string>;
      const person = [billing.first_name, billing.last_name].filter(Boolean).join(" ");
      const customer = {
        type: "company" as const,
        name: billing.company || person,
        email: billing.email || order.customer_email || "",
        address: [billing.address_1, billing.address_2].filter(Boolean).join(", "),
        postal_code: billing.postcode || "",
        city: billing.city || "",
        country: billing.country || "FR",
        reg_no: "",
      };
      return createJsonResponse({
        customer,
        start_date: suggestedExtensionStart({
          lastExtensionEnd: previous?.end_date ?? null,
          locationEndDate: item.location_end_date ?? null,
          orderDate: order.date_created ?? null,
          durationDays: game.location_duree_jours ?? null,
        }),
        amount_ht: item.unit_price ?? null,
      }, 200);
    }

    if (body.action !== "create") return createErrorResponse("action doit valoir prepare ou create", 400);

    const startDate = (body.start_date || "").trim();
    const endDate = (body.end_date || "").trim();
    const amountHt = Number(body.amount_ht);
    const vatRate = (body.vat_rate || "").trim();
    try {
      validateExtensionPeriod(startDate, endDate, previous?.end_date ?? item.location_end_date ?? null);
    } catch (e) {
      return createErrorResponse(e instanceof Error ? e.message : String(e), 400);
    }
    if (!Number.isFinite(amountHt) || amountHt <= 0) return createErrorResponse("Montant HT invalide", 400);
    if (!body.customer) return createErrorResponse("Fiche client manquante", 400);
    if (!item.contrat_reference) {
      return createErrorResponse("Le contrat d'origine n'a pas de référence : générez-le avant de le prolonger", 422);
    }

    const sequence = (previous?.sequence ?? 0) + 1;
    const reference = extensionReference(item.contrat_reference, sequence);
    const line = extensionInvoiceLine({
      gameTitle: game.title || "jeu",
      reference,
      start: startDate,
      end: endDate,
      amountHt,
      vatRate,
    });

    const { data: extension, error: insertError } = await userClient
      .from("location_extensions")
      .insert({
        order_item_id: orderItemId,
        sequence,
        start_date: startDate,
        end_date: endDate,
        amount_ht: amountHt,
        vat_rate: vatRate,
        contrat_reference: reference,
        created_by: user.id,
      })
      .select("id")
      .single();
    if (insertError) return createErrorResponse(insertError.message, 500, { cause: insertError, fn: FN });

    const admin = createClient(supabaseUrl, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    let invoice;
    try {
      invoice = await createDraftInvoice(admin, [line], body.customer);
    } catch (e) {
      // Pas de facture, pas de prolongation : la ligne ne doit pas rester orpheline.
      await userClient.from("location_extensions").delete().eq("id", extension.id);
      return createErrorResponse(e instanceof Error ? e.message : String(e), 422);
    }

    const invoiceNumber = invoice.number ? String(invoice.number) : `Brouillon Pennylane ${invoice.id ?? ""}`.trim();
    const [{ error: extUpdateError }, { error: itemUpdateError }] = await Promise.all([
      userClient
        .from("location_extensions")
        .update({
          pennylane_invoice_id: invoice.id != null ? String(invoice.id) : null,
          invoice_number: invoiceNumber,
          invoice_url: typeof invoice.pdfUrl === "string" ? invoice.pdfUrl : null,
        })
        .eq("id", extension.id),
      userClient.from("order_items").update({ location_end_date: endDate }).eq("id", orderItemId),
    ]);

    console.log(
      `[${FN}] prolongation ${reference} ${startDate}→${endDate} brouillon id=${invoice.id} numero=${invoice.number ?? "-"} client=${invoice.customerId}${invoice.customerCreated ? " (créé)" : ""} par=${user.email}`,
    );

    const updateError = extUpdateError ?? itemUpdateError;
    return createJsonResponse(
      {
        extension_id: extension.id,
        contrat_reference: reference,
        invoice_number: invoiceNumber,
        // Le brouillon existe : un échec ici se signale, il n'annule rien.
        saved: !updateError,
        update_error: updateError?.message ?? null,
      },
      200,
    );
  } catch (err) {
    return createErrorResponse(err instanceof Error ? err.message : "Erreur inconnue", 500, { cause: err, fn: FN });
  }
});
