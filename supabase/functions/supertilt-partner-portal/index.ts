/**
 * supertilt-partner-portal
 *
 * Public endpoint (no auth) for partner access pages.
 *
 * GET  ?token=xxx[&from=YYYY-MM-DD&to=YYYY-MM-DD]
 *   → returns game info, sales, commissions, payments summary
 *
 * POST { token, payment: { amount, payment_date, comment } }
 *   → declares a new partner payment
 *
 * POST { token, action: "verify" | "reject", payment_id, admin_notes? }
 *   → admin action (requires service role in Authorization header)
 */
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders, createErrorResponse, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
import { verifyAuth } from "../_shared/supabase-client.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function calcCommission(
  lineTotal: number,
  commissionType: string | null,
  commissionRate: number | null,
  commissionFixed: number | null,
  includeStripeFees: boolean,
  stripeFeeRate: number,
  stripeFeeFixed: number,
): number {
  let base = lineTotal;
  if (includeStripeFees) {
    // Deduct Stripe fees before computing commission
    base = base - base * stripeFeeRate - stripeFeeFixed;
  }
  if (commissionType === "percentage" && commissionRate != null) {
    return Math.max(0, Math.round(base * commissionRate * 100) / 100);
  }
  if (commissionType === "fixed" && commissionFixed != null) {
    return commissionFixed;
  }
  return 0;
}

Deno.serve(async (req: Request): Promise<Response> => {
  const cors = handleCorsPreflightIfNeeded(req);
  if (cors) return cors;

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const url = new URL(req.url);

  // ── GET — fetch portal data ──────────────────────────────────
  if (req.method === "GET") {
    const token = url.searchParams.get("token");
    if (!token) return createErrorResponse("token required", 400);

    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");

    // Validate token
    const { data: tokenRow } = await (admin as any)
      .from("partner_access_tokens")
      .select("*, games(*, game_authors(name, email))")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow) return createErrorResponse("Lien invalide ou expiré", 404);
    if (tokenRow.expires_at && new Date(tokenRow.expires_at) < new Date()) {
      return createErrorResponse("Ce lien a expiré", 403);
    }

    const game = (tokenRow as any).games;
    const gameId = game?.id;

    // Load Stripe settings for commission computation
    const { data: settingsRows } = await (admin as any)
      .from("supertilt_settings")
      .select("key, value")
      .in("key", ["stripe_fee_rate", "stripe_fee_fixed"]);
    const getSetting = (k: string, def: number) => {
      const v = (settingsRows as Array<{ key: string; value: unknown }>)?.find((s) => s.key === k)?.value;
      return v != null ? parseFloat(String(v)) : def;
    };
    const stripeFeeRate = getSetting("stripe_fee_rate", 0.014);
    const stripeFeeFixed = getSetting("stripe_fee_fixed", 0.25);

    // Load sales (order_items) for this game
    let salesQuery = (admin as any)
      .from("order_items")
      .select("id, quantity, line_total, commission_amount, created_at, woocommerce_orders(order_number, date_created, customer_first_name, customer_last_name)")
      .eq("game_id", gameId)
      .not("kanban_status", "eq", "to_validate")
      .order("created_at", { ascending: false });

    if (from) salesQuery = salesQuery.gte("created_at", from);
    if (to) salesQuery = salesQuery.lte("created_at", to + "T23:59:59Z");

    const { data: sales } = await salesQuery;
    const salesList = (sales ?? []) as Array<Record<string, unknown>>;

    // Compute totals
    let totalTtc = 0;
    let totalCommission = 0;
    const salesWithCommission = salesList.map((s) => {
      const lineTotal = (s.line_total as number) ?? 0;
      const commission = (s.commission_amount as number) ??
        calcCommission(
          lineTotal,
          game?.commission_type,
          game?.commission_rate,
          game?.commission_fixed,
          game?.include_stripe_fees ?? false,
          stripeFeeRate,
          stripeFeeFixed,
        );
      totalTtc += lineTotal;
      totalCommission += commission;
      return { ...s, commission_amount: commission };
    });

    // Load payments
    let paymentsQuery = (admin as any)
      .from("partner_payments")
      .select("*")
      .eq("game_id", gameId)
      .order("payment_date", { ascending: false });

    if (from) paymentsQuery = paymentsQuery.gte("payment_date", from);
    if (to) paymentsQuery = paymentsQuery.lte("payment_date", to);

    const { data: payments } = await paymentsQuery;

    const totalPaid = ((payments ?? []) as Array<{ amount: number; status: string }>)
      .filter((p) => p.status === "verified")
      .reduce((s, p) => s + p.amount, 0);

    return json({
      game: {
        id: game?.id,
        title: game?.title,
        game_type: game?.game_type,
        partner_name: game?.partner_name,
        commission_type: game?.commission_type,
        commission_rate: game?.commission_rate,
        commission_fixed: game?.commission_fixed,
      },
      token_label: tokenRow.label,
      summary: {
        total_sales: salesWithCommission.length,
        total_ttc: Math.round(totalTtc * 100) / 100,
        total_commission: Math.round(totalCommission * 100) / 100,
        total_paid: Math.round(totalPaid * 100) / 100,
        remaining: Math.round((totalCommission - totalPaid) * 100) / 100,
      },
      sales: salesWithCommission,
      payments: payments ?? [],
    });
  }

  // ── POST — declare payment or admin action ───────────────────
  if (req.method === "POST") {
    const body = await req.json() as Record<string, unknown>;
    const token = body.token as string;

    if (!token) return createErrorResponse("token required", 400);

    // Validate token
    const { data: tokenRow } = await (admin as any)
      .from("partner_access_tokens")
      .select("game_id, expires_at")
      .eq("token", token)
      .maybeSingle();

    if (!tokenRow) return createErrorResponse("Lien invalide", 404);
    if ((tokenRow as any).expires_at && new Date((tokenRow as any).expires_at) < new Date()) {
      return createErrorResponse("Ce lien a expiré", 403);
    }

    const gameId = (tokenRow as any).game_id;

    // Admin action (verify / reject)
    if (body.action === "verify" || body.action === "reject") {
      const authHeader = req.headers.get("Authorization") ?? "";
      const user = await verifyAuth(authHeader);
      if (!user) return createErrorResponse("Unauthorized", 401);
      const { data: isAdminData } = await (admin as any).rpc("is_admin", { _user_id: user.id });
      if (!isAdminData) return createErrorResponse("Action admin non autorisée", 403);
      const newStatus = body.action === "verify" ? "verified" : "rejected";
      const { error } = await (admin as any)
        .from("partner_payments")
        .update({ status: newStatus, admin_notes: body.admin_notes ?? null })
        .eq("id", body.payment_id)
        .eq("game_id", gameId);
      if (error) return createErrorResponse(error.message, 500, { cause: error, fn: "supertilt-partner-portal" });
      return json({ ok: true, status: newStatus });
    }

    // Declare new payment
    const payment = body.payment as { amount: number; payment_date: string; comment?: string };
    if (!payment?.amount || !payment?.payment_date) {
      return createErrorResponse("amount et payment_date requis", 400);
    }

    const { data: newPayment, error } = await (admin as any)
      .from("partner_payments")
      .insert({
        game_id: gameId,
        amount: payment.amount,
        payment_date: payment.payment_date,
        comment: payment.comment ?? null,
        status: "declared",
        declared_by: "partner",
      })
      .select()
      .single();

    if (error) return createErrorResponse(error.message, 500, { cause: error, fn: "supertilt-partner-portal" });
    return json({ ok: true, payment: newPayment });
  }

  return createErrorResponse("Method not allowed", 405);
});
