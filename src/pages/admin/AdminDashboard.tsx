import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "@/components/admin/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Users, BookOpen, Mail, Award, TrendingUp } from "lucide-react";
import { format } from "date-fns";
import { fr } from "date-fns/locale";

interface OrganizationData {
  id: string;
  name: string;
  slug: string;
  created_at: string;
}

interface SubscriptionData {
  plan: string;
  status: string;
  monthly_training_limit: number;
  current_period_end: string;
}

interface UsageData {
  trainings_created: number;
  participants_added: number;
  emails_sent: number;
  certificates_generated: number;
}

const AdminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [organization, setOrganization] = useState<OrganizationData | null>(null);
  const [subscription, setSubscription] = useState<SubscriptionData | null>(null);
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [userCount, setUserCount] = useState(0);
  const [trainerCount, setTrainerCount] = useState(0);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Get current user's organization
        const { data: profile } = await supabase
          .from("user_profiles")
          .select("organization_id")
          .eq("id", (await supabase.auth.getUser()).data.user?.id)
          .single();

        if (!profile?.organization_id) {
          setLoading(false);
          return;
        }

        const orgId = profile.organization_id;

        // Fetch organization details
        const { data: orgData } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", orgId)
          .single();

        setOrganization(orgData);

        // Fetch subscription
        const { data: subData } = await supabase
          .from("subscriptions")
          .select("*")
          .eq("organization_id", orgId)
          .single();

        setSubscription(subData);

        // Fetch current month usage
        const monthYear = format(new Date(), "yyyy-MM");
        const { data: usageData } = await supabase
          .from("usage_tracking")
          .select("*")
          .eq("organization_id", orgId)
          .eq("month_year", monthYear)
          .single();

        setUsage(usageData || {
          trainings_created: 0,
          participants_added: 0,
          emails_sent: 0,
          certificates_generated: 0,
        });

        // Count users
        const { count: users } = await supabase
          .from("user_profiles")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId);

        setUserCount(users || 0);

        // Count trainers
        const { count: trainers } = await supabase
          .from("trainers")
          .select("*", { count: "exact", head: true })
          .eq("organization_id", orgId)
          .eq("is_active", true);

        setTrainerCount(trainers || 0);
      } catch (error) {
        console.error("Error fetching admin data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getPlanLabel = (plan: string) => {
    const labels: Record<string, string> = {
      free: "Gratuit",
      starter: "Starter",
      professional: "Professionnel",
      enterprise: "Entreprise",
    };
    return labels[plan] || plan;
  };

  const getPlanVariant = (plan: string): "default" | "secondary" | "outline" => {
    if (plan === "enterprise") return "default";
    if (plan === "professional") return "secondary";
    return "outline";
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

  if (!organization) {
    return (
      <AdminLayout>
        <Card>
          <CardContent className="pt-6">
            <p className="text-center text-muted-foreground">
              Aucune organisation trouvée. Veuillez contacter le support.
            </p>
          </CardContent>
        </Card>
      </AdminLayout>
    );
  }

  const usagePercent = subscription
    ? Math.min(((usage?.trainings_created || 0) / subscription.monthly_training_limit) * 100, 100)
    : 0;

  return (
    <AdminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h2 className="text-2xl font-bold">{organization.name}</h2>
          <p className="text-muted-foreground">
            Organisation créée le {format(new Date(organization.created_at), "d MMMM yyyy", { locale: fr })}
          </p>
        </div>

        {/* Subscription Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Abonnement actuel
                </CardTitle>
                <CardDescription>
                  Période en cours jusqu'au{" "}
                  {subscription?.current_period_end
                    ? format(new Date(subscription.current_period_end), "d MMMM yyyy", { locale: fr })
                    : "-"}
                </CardDescription>
              </div>
              <Badge variant={getPlanVariant(subscription?.plan || "free")}>
                {getPlanLabel(subscription?.plan || "free")}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium">Formations ce mois</span>
                  <span className="text-sm text-muted-foreground">
                    {usage?.trainings_created || 0} / {subscription?.monthly_training_limit || 2}
                  </span>
                </div>
                <Progress value={usagePercent} className="h-2" />
              </div>
              {usagePercent >= 80 && subscription?.plan === "free" && (
                <p className="text-sm text-amber-600">
                  Vous approchez de votre limite mensuelle. Passez à un forfait supérieur pour créer plus de formations.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Users className="h-4 w-4" />
                Utilisateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{userCount}</div>
              <p className="text-xs text-muted-foreground">membres de l'équipe</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Formateurs
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{trainerCount}</div>
              <p className="text-xs text-muted-foreground">formateurs actifs</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Mail className="h-4 w-4" />
                Emails envoyés
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{usage?.emails_sent || 0}</div>
              <p className="text-xs text-muted-foreground">ce mois-ci</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                <Award className="h-4 w-4" />
                Certificats
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{usage?.certificates_generated || 0}</div>
              <p className="text-xs text-muted-foreground">générés ce mois</p>
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Actions rapides</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <a
                href="/admin/users"
                className="p-4 border rounded-lg hover:bg-muted transition-colors"
              >
                <Users className="h-6 w-6 mb-2 text-primary" />
                <h3 className="font-medium">Inviter un utilisateur</h3>
                <p className="text-sm text-muted-foreground">
                  Ajoutez un membre à votre équipe
                </p>
              </a>
              <a
                href="/admin/trainers"
                className="p-4 border rounded-lg hover:bg-muted transition-colors"
              >
                <BookOpen className="h-6 w-6 mb-2 text-primary" />
                <h3 className="font-medium">Gérer les formateurs</h3>
                <p className="text-sm text-muted-foreground">
                  Configurez vos formateurs
                </p>
              </a>
              <a
                href="/admin/email-templates"
                className="p-4 border rounded-lg hover:bg-muted transition-colors"
              >
                <Mail className="h-6 w-6 mb-2 text-primary" />
                <h3 className="font-medium">Personnaliser les emails</h3>
                <p className="text-sm text-muted-foreground">
                  Modifiez vos templates
                </p>
              </a>
            </div>
          </CardContent>
        </Card>
      </div>
    </AdminLayout>
  );
};

export default AdminDashboard;
