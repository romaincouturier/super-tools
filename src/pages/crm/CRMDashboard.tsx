import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import CRMLayout from "@/components/crm/CRMLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Loader2,
  TrendingUp,
  TrendingDown,
  Users,
  Euro,
  Calendar,
  Phone,
  Mail,
  ArrowRight,
} from "lucide-react";
import { format, subDays, startOfMonth, endOfMonth } from "date-fns";
import { fr } from "date-fns/locale";

interface DashboardStats {
  totalLeads: number;
  newLeadsThisMonth: number;
  totalRevenue: number;
  revenueThisMonth: number;
  wonDeals: number;
  wonDealsThisMonth: number;
  pendingActivities: number;
  overdueActivities: number;
}

interface RecentLead {
  id: string;
  title: string;
  company_name: string | null;
  contact_email: string | null;
  amount: number;
  created_at: string;
  stage: {
    name: string;
    color: string;
  } | null;
}

interface UpcomingActivity {
  id: string;
  title: string;
  activity_type: string;
  scheduled_at: string;
  lead: {
    title: string;
    company_name: string | null;
  } | null;
}

const CRMDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>({
    totalLeads: 0,
    newLeadsThisMonth: 0,
    totalRevenue: 0,
    revenueThisMonth: 0,
    wonDeals: 0,
    wonDealsThisMonth: 0,
    pendingActivities: 0,
    overdueActivities: 0,
  });
  const [recentLeads, setRecentLeads] = useState<RecentLead[]>([]);
  const [upcomingActivities, setUpcomingActivities] = useState<UpcomingActivity[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchDashboardData = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          navigate("/auth");
          return;
        }

        const monthStart = startOfMonth(new Date()).toISOString();
        const monthEnd = endOfMonth(new Date()).toISOString();
        const today = new Date().toISOString();

        // Fetch leads count
        const { count: totalLeads } = await supabase
          .from("crm_leads")
          .select("*", { count: "exact", head: true });

        const { count: newLeadsThisMonth } = await supabase
          .from("crm_leads")
          .select("*", { count: "exact", head: true })
          .gte("created_at", monthStart)
          .lte("created_at", monthEnd);

        // Fetch won deals and revenue
        const { data: wonDealsData } = await supabase
          .from("crm_leads")
          .select("amount, created_at, stage_id")
          .not("stage_id", "is", null);

        // Get won stage ids
        const { data: wonStages } = await supabase
          .from("crm_pipeline_stages")
          .select("id")
          .eq("is_won", true);

        const wonStageIds = wonStages?.map(s => s.id) || [];

        const wonDeals = wonDealsData?.filter(d => wonStageIds.includes(d.stage_id)) || [];
        const totalRevenue = wonDeals.reduce((sum, d) => sum + (d.amount || 0), 0);

        const wonDealsThisMonth = wonDeals.filter(d =>
          d.created_at >= monthStart && d.created_at <= monthEnd
        );
        const revenueThisMonth = wonDealsThisMonth.reduce((sum, d) => sum + (d.amount || 0), 0);

        // Fetch activities
        const { count: pendingActivities } = await supabase
          .from("crm_activities")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .gte("scheduled_at", today);

        const { count: overdueActivities } = await supabase
          .from("crm_activities")
          .select("*", { count: "exact", head: true })
          .eq("status", "pending")
          .lt("scheduled_at", today);

        setStats({
          totalLeads: totalLeads || 0,
          newLeadsThisMonth: newLeadsThisMonth || 0,
          totalRevenue,
          revenueThisMonth,
          wonDeals: wonDeals.length,
          wonDealsThisMonth: wonDealsThisMonth.length,
          pendingActivities: pendingActivities || 0,
          overdueActivities: overdueActivities || 0,
        });

        // Fetch recent leads
        const { data: leadsData } = await supabase
          .from("crm_leads")
          .select(`
            id,
            title,
            company_name,
            contact_email,
            amount,
            created_at,
            stage:crm_pipeline_stages(name, color)
          `)
          .order("created_at", { ascending: false })
          .limit(5);

        setRecentLeads(leadsData as unknown as RecentLead[] || []);

        // Fetch upcoming activities
        const { data: activitiesData } = await supabase
          .from("crm_activities")
          .select(`
            id,
            title,
            activity_type,
            scheduled_at,
            lead:crm_leads(title, company_name)
          `)
          .eq("status", "pending")
          .gte("scheduled_at", today)
          .order("scheduled_at", { ascending: true })
          .limit(5);

        setUpcomingActivities(activitiesData as unknown as UpcomingActivity[] || []);
      } catch (error) {
        console.error("Error fetching dashboard:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDashboardData();
  }, [navigate]);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("fr-FR", {
      style: "currency",
      currency: "EUR",
      maximumFractionDigits: 0,
    }).format(amount);
  };

  const getActivityIcon = (type: string) => {
    switch (type) {
      case "call":
        return <Phone className="h-4 w-4" />;
      case "email":
        return <Mail className="h-4 w-4" />;
      case "meeting":
        return <Calendar className="h-4 w-4" />;
      default:
        return <Calendar className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <CRMLayout>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </CRMLayout>
    );
  }

  return (
    <CRMLayout>
      <div className="space-y-6">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold">Tableau de bord CRM</h2>
          <p className="text-sm text-muted-foreground">
            Vue d'ensemble de votre activite commerciale
          </p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                Leads
              </CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{stats.totalLeads}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                +{stats.newLeadsThisMonth} ce mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription className="flex items-center gap-2">
                <Euro className="h-4 w-4" />
                CA Total
              </CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{formatCurrency(stats.totalRevenue)}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <TrendingUp className="h-3 w-3 text-green-500" />
                +{formatCurrency(stats.revenueThisMonth)} ce mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Affaires gagnees</CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{stats.wonDeals}</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                +{stats.wonDealsThisMonth} ce mois
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Activites</CardDescription>
              <CardTitle className="text-2xl sm:text-3xl">{stats.pendingActivities}</CardTitle>
            </CardHeader>
            <CardContent>
              {stats.overdueActivities > 0 ? (
                <p className="text-xs text-destructive flex items-center gap-1">
                  <TrendingDown className="h-3 w-3" />
                  {stats.overdueActivities} en retard
                </p>
              ) : (
                <p className="text-xs text-green-600">Tout a jour</p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Recent Leads */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Leads recents</CardTitle>
                <CardDescription>Dernieres opportunites creees</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/crm/leads")}>
                Voir tout
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {recentLeads.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucun lead pour le moment
                </p>
              ) : (
                <div className="space-y-3">
                  {recentLeads.map((lead) => (
                    <div
                      key={lead.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/crm/leads/${lead.id}`)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{lead.title}</p>
                        <p className="text-sm text-muted-foreground truncate">
                          {lead.company_name || lead.contact_email || "Sans entreprise"}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {lead.stage && (
                          <Badge
                            variant="outline"
                            style={{ borderColor: lead.stage.color, color: lead.stage.color }}
                          >
                            {lead.stage.name}
                          </Badge>
                        )}
                        <span className="text-sm font-medium">
                          {formatCurrency(lead.amount || 0)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Upcoming Activities */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Activites a venir</CardTitle>
                <CardDescription>Prochains rendez-vous et taches</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => navigate("/crm/activities")}>
                Voir tout
                <ArrowRight className="h-4 w-4 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              {upcomingActivities.length === 0 ? (
                <p className="text-center text-muted-foreground py-8">
                  Aucune activite planifiee
                </p>
              ) : (
                <div className="space-y-3">
                  {upcomingActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 p-3 rounded-lg border hover:bg-muted/50 cursor-pointer"
                      onClick={() => navigate(`/crm/activities/${activity.id}`)}
                    >
                      <div className="p-2 rounded-full bg-muted">
                        {getActivityIcon(activity.activity_type)}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-medium truncate">{activity.title}</p>
                        {activity.lead && (
                          <p className="text-sm text-muted-foreground truncate">
                            {activity.lead.title} - {activity.lead.company_name}
                          </p>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground whitespace-nowrap">
                        {format(new Date(activity.scheduled_at), "d MMM HH:mm", { locale: fr })}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </CRMLayout>
  );
};

export default CRMDashboard;
