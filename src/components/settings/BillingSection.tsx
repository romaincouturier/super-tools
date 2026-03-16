import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { CreditCard, Check, Loader2, ExternalLink, Zap, Crown, Rocket } from "lucide-react";
import { toast } from "sonner";

interface BillingPlan {
  id: string;
  name: string;
  slug: string;
  stripe_price_id: string | null;
  price_monthly: number;
  price_yearly: number | null;
  currency: string;
  max_trainings: number | null;
  max_participants: number | null;
  max_storage_mb: number | null;
  max_emails_per_month: number | null;
  features: string[];
  display_order: number;
}

interface Subscription {
  id: string;
  status: string;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  plan_id: string;
  stripe_subscription_id: string | null;
}

const PLAN_ICONS: Record<string, React.ReactNode> = {
  free: <Zap className="h-6 w-6" />,
  pro: <Rocket className="h-6 w-6" />,
  business: <Crown className="h-6 w-6" />,
};

export default function BillingSection() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const [plans, setPlans] = useState<BillingPlan[]>([]);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [currentOrgPlan, setCurrentOrgPlan] = useState<string>("free");
  const [loading, setLoading] = useState(true);
  const [checkoutLoading, setCheckoutLoading] = useState<string | null>(null);
  const [portalLoading, setPortalLoading] = useState(false);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");

  useEffect(() => {
    if (!user) return;
    loadData();
  }, [user]);

  const loadData = async () => {
    setLoading(true);
    const [plansRes, subRes] = await Promise.all([
      supabase.from("billing_plans").select("*").eq("is_active", true).order("display_order"),
      supabase.from("subscriptions").select("*").maybeSingle(),
    ]);

    if (plansRes.data) {
      setPlans(plansRes.data.map((p) => ({
        ...p,
        features: Array.isArray(p.features) ? p.features : [],
      })));
    }

    if (subRes.data) {
      setSubscription(subRes.data as any);
    }

    // Get current org plan
    const { data: orgData } = await supabase.rpc("get_user_org_id", { _user_id: user!.id });
    if (orgData) {
      const { data: org } = await supabase
        .from("organizations")
        .select("plan")
        .eq("id", orgData)
        .single();
      if (org) setCurrentOrgPlan(org.plan);
    }

    setLoading(false);
  };

  const handleCheckout = async (plan: BillingPlan) => {
    if (!plan.stripe_price_id) {
      toast.error(t("billing.stripeNotConfigured"));
      return;
    }

    setCheckoutLoading(plan.id);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-checkout", {
        body: {
          price_id: plan.stripe_price_id,
          success_url: `${window.location.origin}/parametres?billing=success`,
          cancel_url: `${window.location.origin}/parametres?billing=cancel`,
        },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur lors de la création du paiement");
    } finally {
      setCheckoutLoading(null);
    }
  };

  const handlePortal = async () => {
    setPortalLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("stripe-portal", {
        body: { return_url: `${window.location.origin}/parametres` },
      });

      if (error) throw error;
      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Erreur");
    } finally {
      setPortalLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Current subscription status */}
      {subscription && subscription.status !== "canceled" && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CreditCard className="h-5 w-5" />
              {t("billing.subscriptionActive")}
            </CardTitle>
          </CardHeader>
          <CardContent className="flex items-center justify-between">
            <div className="space-y-1">
              <p className="text-sm text-muted-foreground">
                {subscription.cancel_at_period_end
                  ? t("billing.expiresOn")
                  : t("billing.renewsOn")}{" "}
                {subscription.current_period_end
                  ? new Date(subscription.current_period_end).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <Button variant="outline" onClick={handlePortal} disabled={portalLoading}>
              {portalLoading ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <ExternalLink className="h-4 w-4 mr-2" />
              )}
              {t("billing.billingPortal")}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Billing cycle toggle */}
      <div className="flex justify-center">
        <div className="inline-flex items-center gap-2 rounded-full border p-1">
          <Button
            size="sm"
            variant={billingCycle === "monthly" ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => setBillingCycle("monthly")}
          >
            {t("billing.monthly")}
          </Button>
          <Button
            size="sm"
            variant={billingCycle === "yearly" ? "default" : "ghost"}
            className="rounded-full"
            onClick={() => setBillingCycle("yearly")}
          >
            {t("billing.yearly")}
            <Badge variant="secondary" className="ml-1 text-xs">-17%</Badge>
          </Button>
        </div>
      </div>

      {/* Plan cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {plans.map((plan) => {
          const isCurrent = currentOrgPlan === plan.slug;
          const isPopular = plan.slug === "pro";
          const price = billingCycle === "yearly" && plan.price_yearly != null
            ? plan.price_yearly
            : plan.price_monthly;
          const priceLabel = billingCycle === "yearly" ? t("billing.perYear") : t("billing.perMonth");

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${isPopular ? "border-primary shadow-lg" : ""} ${isCurrent ? "ring-2 ring-primary" : ""}`}
            >
              {isPopular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="bg-primary text-primary-foreground">{t("billing.popular")}</Badge>
                </div>
              )}
              <CardHeader className="text-center pb-2">
                <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10 text-primary">
                  {PLAN_ICONS[plan.slug] || <CreditCard className="h-6 w-6" />}
                </div>
                <CardTitle className="text-xl">{plan.name}</CardTitle>
                <CardDescription>
                  <span className="text-3xl font-bold text-foreground">
                    {price === 0 ? t("billing.free") : `${price}€`}
                  </span>
                  {price > 0 && (
                    <span className="text-muted-foreground">{priceLabel}</span>
                  )}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col">
                <Separator className="mb-4" />
                <p className="text-sm font-medium mb-3">{t("billing.features")}</p>
                <ul className="space-y-2 mb-6 flex-1">
                  {plan.features.map((feature, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>

                {isCurrent ? (
                  <Button variant="outline" disabled className="w-full">
                    {t("billing.currentPlanBadge")}
                  </Button>
                ) : plan.slug === "free" ? (
                  <Button variant="ghost" disabled className="w-full">
                    {t("billing.free")}
                  </Button>
                ) : (
                  <Button
                    className="w-full"
                    variant={isPopular ? "default" : "outline"}
                    onClick={() => handleCheckout(plan)}
                    disabled={!!checkoutLoading}
                  >
                    {checkoutLoading === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    {t("billing.selectPlan")}
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
