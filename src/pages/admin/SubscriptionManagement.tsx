import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Check, Zap, Building2, Rocket, Crown } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  plan: string;
  status: string;
  monthly_training_limit: number;
  current_period_start: string;
  current_period_end: string;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
}

interface Usage {
  trainings_created: number;
  participants_added: number;
  emails_sent: number;
  certificates_generated: number;
}

const plans = [
  {
    id: "free",
    name: "Gratuit",
    price: "0€",
    period: "/mois",
    description: "Pour découvrir SuperTools",
    icon: Zap,
    features: [
      "2 formations par mois",
      "Emails automatiques",
      "Émargement électronique",
      "Certificats PDF",
      "1 formateur",
    ],
    limits: {
      trainings: 2,
      trainers: 1,
    },
  },
  {
    id: "starter",
    name: "Starter",
    price: "29€",
    period: "/mois",
    description: "Pour les formateurs indépendants",
    icon: Rocket,
    popular: false,
    features: [
      "10 formations par mois",
      "Tout du plan Gratuit",
      "Templates personnalisables",
      "3 formateurs",
      "Support email",
    ],
    limits: {
      trainings: 10,
      trainers: 3,
    },
  },
  {
    id: "professional",
    name: "Professionnel",
    price: "79€",
    period: "/mois",
    description: "Pour les organismes de formation",
    icon: Building2,
    popular: true,
    features: [
      "50 formations par mois",
      "Tout du plan Starter",
      "API & Webhooks",
      "Formateurs illimités",
      "Support prioritaire",
      "Export BPF",
    ],
    limits: {
      trainings: 50,
      trainers: -1,
    },
  },
  {
    id: "enterprise",
    name: "Entreprise",
    price: "Sur devis",
    period: "",
    description: "Pour les grandes structures",
    icon: Crown,
    features: [
      "Formations illimitées",
      "Tout du plan Pro",
      "SSO / SAML",
      "SLA garanti",
      "Account manager dédié",
      "Personnalisation avancée",
    ],
    limits: {
      trainings: -1,
      trainers: -1,
    },
  },
];

const SubscriptionManagement = () => {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [usage, setUsage] = useState<Usage | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [upgrading, setUpgrading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const { data: profile } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();

        if (!profile?.organization_id) {
          setLoading(false);
          return;
        }

        setOrganizationId(profile.organization_id);

        // Fetch subscription
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .single();

        setSubscription(subData);

        // Fetch current month usage
        const monthYear = format(new Date(), "yyyy-MM");
        const { data: usageData } = await supabase
          .from("usage_tracking")
          .select("*")
          .eq("organization_id", profile.organization_id)
          .eq("month_year", monthYear)
          .single();

        setUsage(usageData || {
          trainings_created: 0,
          participants_added: 0,
          emails_sent: 0,
          certificates_generated: 0,
        });
      } catch (error) {
        console.error("Error fetching subscription:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleUpgrade = async (planId: string) => {
    if (!organizationId) return;

    setUpgrading(planId);
    try {
      // In production, this would redirect to Stripe Checkout
      const { data, error } = await supabase.functions.invoke("create-checkout-session", {
        body: {
          organizationId,
          planId,
          successUrl: `${window.location.origin}/admin/subscription?success=true`,
          cancelUrl: `${window.location.origin}/admin/subscription?canceled=true`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      } else {
        // Demo mode - just update the subscription
        toast({
          title: "Mode démo",
          description: "En production, vous seriez redirigé vers Stripe pour le paiement.",
        });
      }
    } catch (error) {
      console.error("Error creating checkout:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer la session de paiement.",
        variant: "destructive",
      });
    } finally {
      setUpgrading(null);
    }
  };

  const handleManageBilling = async () => {
    if (!subscription?.stripe_customer_id) {
      toast({
        title: "Pas de compte de facturation",
        description: "Passez à un plan payant pour accéder à la facturation.",
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("create-portal-session", {
        body: {
          customerId: subscription.stripe_customer_id,
          returnUrl: `${window.location.origin}/admin/subscription`,
        },
      });

      if (error) throw error;

      if (data?.url) {
        window.location.href = data.url;
      }
    } catch (error) {
      console.error("Error creating portal session:", error);
      toast({
        title: "Erreur",
        description: "Impossible d'accéder au portail de facturation.",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AdminLayout>
    );
  }

  const currentPlan = plans.find(p => p.id === subscription?.plan) || plans[0];
  const usagePercent = subscription
    ? Math.min(((usage?.trainings_created || 0) / subscription.monthly_training_limit) * 100, 100)
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Abonnement</h2>
          <p className="text-sm text-muted-foreground">
            Gérez votre abonnement et consultez votre consommation
          </p>
        </div>

        {/* Current Plan & Usage */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>Plan actuel</span>
                <Badge variant={subscription?.plan === "free" ? "outline" : "default"}>
                  {currentPlan.name}
                </Badge>
              </CardTitle>
              <CardDescription>
                {subscription?.current_period_end && (
                  <>
                    Période en cours jusqu'au{" "}
                    {format(new Date(subscription.current_period_end), "d MMMM yyyy", { locale: fr })}
                  </>
                )}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Formations ce mois</span>
                  <span className="text-sm text-muted-foreground">
                    {usage?.trainings_created || 0} / {subscription?.monthly_training_limit || 2}
                  </span>
                </div>
                <Progress value={usagePercent} className="h-2" />
              </div>
              {subscription?.plan !== "free" && (
                <Button variant="outline" className="w-full" onClick={handleManageBilling}>
                  Gérer la facturation
                </Button>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Consommation du mois</CardTitle>
              <CardDescription>
                {format(new Date(), "MMMM yyyy", { locale: fr })}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{usage?.trainings_created || 0}</div>
                  <div className="text-xs text-muted-foreground">Formations</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{usage?.participants_added || 0}</div>
                  <div className="text-xs text-muted-foreground">Participants</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{usage?.emails_sent || 0}</div>
                  <div className="text-xs text-muted-foreground">Emails</div>
                </div>
                <div className="text-center p-3 bg-muted rounded-lg">
                  <div className="text-2xl font-bold">{usage?.certificates_generated || 0}</div>
                  <div className="text-xs text-muted-foreground">Certificats</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Available Plans */}
        <div>
          <h3 className="text-base sm:text-lg font-semibold mb-4">Tous les plans</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {plans.map((plan) => {
              const isCurrentPlan = plan.id === subscription?.plan;
              const Icon = plan.icon;

              return (
                <Card
                  key={plan.id}
                  className={`relative ${plan.popular ? "border-primary shadow-md" : ""} ${
                    isCurrentPlan ? "bg-muted/50" : ""
                  }`}
                >
                  {plan.popular && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <Badge>Plus populaire</Badge>
                    </div>
                  )}
                  <CardHeader className="text-center pb-2">
                    <div className="mx-auto mb-2 p-2 rounded-full bg-primary/10 w-fit">
                      <Icon className="h-6 w-6 text-primary" />
                    </div>
                    <CardTitle>{plan.name}</CardTitle>
                    <div className="mt-2">
                      <span className="text-3xl font-bold">{plan.price}</span>
                      <span className="text-muted-foreground">{plan.period}</span>
                    </div>
                    <CardDescription className="mt-2">{plan.description}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ul className="space-y-2 mb-4">
                      {plan.features.map((feature, idx) => (
                        <li key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                    {isCurrentPlan ? (
                      <Button variant="outline" className="w-full" disabled>
                        Plan actuel
                      </Button>
                    ) : plan.id === "enterprise" ? (
                      <Button variant="outline" className="w-full" asChild>
                        <a href="mailto:contact@supertilt.fr">Nous contacter</a>
                      </Button>
                    ) : (
                      <Button
                        className="w-full"
                        variant={plan.popular ? "default" : "outline"}
                        onClick={() => handleUpgrade(plan.id)}
                        disabled={upgrading === plan.id}
                      >
                        {upgrading === plan.id && (
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        )}
                        {plans.findIndex(p => p.id === plan.id) >
                        plans.findIndex(p => p.id === subscription?.plan)
                          ? "Passer à ce plan"
                          : "Changer de plan"}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* FAQ */}
        <Card>
          <CardHeader>
            <CardTitle>Questions fréquentes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-medium">Que se passe-t-il si je dépasse ma limite mensuelle ?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Vous ne pourrez plus créer de nouvelles formations jusqu'au mois suivant ou jusqu'à
                ce que vous passiez à un plan supérieur.
              </p>
            </div>
            <div>
              <h4 className="font-medium">Puis-je annuler mon abonnement ?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Oui, vous pouvez annuler à tout moment. Votre abonnement reste actif jusqu'à la fin
                de la période payée.
              </p>
            </div>
            <div>
              <h4 className="font-medium">Les données sont-elles conservées si je passe au plan gratuit ?</h4>
              <p className="text-sm text-muted-foreground mt-1">
                Oui, toutes vos données sont conservées. Vous aurez simplement une limite sur les
                nouvelles formations créées.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default SubscriptionManagement;
