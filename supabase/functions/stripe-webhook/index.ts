import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import Stripe from "https://esm.sh/stripe@14.21.0?target=deno";

import { corsHeaders, handleCorsPreflightIfNeeded } from "../_shared/cors.ts";
async function getStripeKeys(): Promise<{ secretKey: string | null; webhookSecret: string | null }> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(url, key);
  const { data } = await supabase
    .from("app_settings")
    .select("setting_key, setting_value")
    .in("setting_key", ["stripe_secret_key", "stripe_webhook_secret"]);

  const keys: Record<string, string | null> = { stripe_secret_key: null, stripe_webhook_secret: null };
  data?.forEach((s: any) => { keys[s.setting_key] = s.setting_value; });
  return { secretKey: keys.stripe_secret_key, webhookSecret: keys.stripe_webhook_secret };
}

Deno.serve(async (req) => {
  const corsResponse = handleCorsPreflightIfNeeded(req);

  if (corsResponse) return corsResponse;

  try {
    const { secretKey, webhookSecret } = await getStripeKeys();
    if (!secretKey) {
      return new Response(JSON.stringify({ error: "Stripe not configured" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripe = new Stripe(secretKey, { apiVersion: "2023-10-16" });
    const body = await req.text();
    const sig = req.headers.get("stripe-signature");

    let event: Stripe.Event;

    if (webhookSecret && sig) {
      event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
    } else {
      event = JSON.parse(body);
      console.warn("⚠️ Webhook signature not verified — configure stripe_webhook_secret");
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const orgId = session.metadata?.org_id;
        if (!orgId || !session.subscription) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0]?.price.id;

        // Find matching plan
        const { data: plan } = await supabase
          .from("billing_plans")
          .select("id")
          .eq("stripe_price_id", priceId)
          .maybeSingle();

        // Upsert subscription
        await supabase.from("subscriptions").upsert({
          org_id: orgId,
          plan_id: plan?.id,
          stripe_customer_id: session.customer as string,
          stripe_subscription_id: subscription.id,
          status: subscription.status,
          current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
          current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
          cancel_at_period_end: subscription.cancel_at_period_end,
        }, { onConflict: "org_id" });

        // Update org plan
        if (plan) {
          const { data: planData } = await supabase
            .from("billing_plans")
            .select("slug")
            .eq("id", plan.id)
            .single();
          if (planData) {
            await supabase.from("organizations").update({ plan: planData.slug }).eq("id", orgId);
          }
        }
        break;
      }

      case "customer.subscription.updated": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.org_id;
        if (!orgId) break;

        await supabase
          .from("subscriptions")
          .update({
            status: subscription.status,
            current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
            current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
            cancel_at_period_end: subscription.cancel_at_period_end,
          })
          .eq("stripe_subscription_id", subscription.id);
        break;
      }

      case "customer.subscription.deleted": {
        const subscription = event.data.object as Stripe.Subscription;
        const orgId = subscription.metadata?.org_id;

        await supabase
          .from("subscriptions")
          .update({ status: "canceled" })
          .eq("stripe_subscription_id", subscription.id);

        if (orgId) {
          await supabase.from("organizations").update({ plan: "free" }).eq("id", orgId);
        }
        break;
      }

      default:
        console.log(`Unhandled event: ${event.type}`);
    }

    return new Response(JSON.stringify({ received: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error: unknown) {
    console.error("Webhook error:", error);
    return new Response(JSON.stringify({ error: error instanceof Error ? error.message : "Unknown error" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
