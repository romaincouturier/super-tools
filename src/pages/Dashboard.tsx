import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, Award, FileText, Calendar, ClipboardCheck, TrendingUp, Star, History } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import OnboardCollaboratorDialog from "@/components/OnboardCollaboratorDialog";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import WeeklyChart from "@/components/dashboard/WeeklyChart";
import StatCard from "@/components/dashboard/StatCard";
import TopImprovements from "@/components/dashboard/TopImprovements";
import { useDashboardStats } from "@/hooks/useDashboardStats";

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

const tools: Tool[] = [
  {
    id: "micro-devis",
    name: "Micro-devis",
    description: "Créer des devis rapides et simplifiés",
    icon: <FileText className="w-10 h-10" />,
    path: "/micro-devis",
  },
  {
    id: "formations",
    name: "Formations",
    description: "Gérer les formations et les participants",
    icon: <Calendar className="w-10 h-10" />,
    path: "/formations",
  },
  {
    id: "evaluations",
    name: "Évaluations",
    description: "Analyser les retours des participants",
    icon: <ClipboardCheck className="w-10 h-10" />,
    path: "/evaluations",
  },
  {
    id: "certificates",
    name: "Certificats",
    description: "Générer et envoyer des certificats de formation",
    icon: <Award className="w-10 h-10" />,
    path: "/certificates",
  },
  {
    id: "ameliorations",
    name: "Améliorations",
    description: "Suivre les axes d'amélioration identifiés",
    icon: <TrendingUp className="w-10 h-10" />,
    path: "/ameliorations",
  },
  {
    id: "historique",
    name: "Historique",
    description: "Consulter l'historique des actions",
    icon: <History className="w-10 h-10" />,
    path: "/historique",
  },
];

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const {
    microDevisWeekly,
    formationsWeekly,
    evaluationsWeekly,
    averageEvaluation,
    topImprovements,
    isLoading: statsLoading,
  } = useDashboardStats();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (!session?.user) {
          navigate("/auth");
        } else {
          const { data: metadata } = await supabase
            .from("user_security_metadata")
            .select("must_change_password")
            .eq("user_id", session.user.id)
            .maybeSingle();

          if (metadata?.must_change_password) {
            navigate("/force-password-change");
          }
        }
      }
    );

    supabase.auth.getSession().then(async ({ data: { session } }) => {
      setUser(session?.user ?? null);
      setLoading(false);
      if (!session?.user) {
        navigate("/auth");
      } else {
        const { data: metadata } = await supabase
          .from("user_security_metadata")
          .select("must_change_password")
          .eq("user_id", session.user.id)
          .maybeSingle();

        if (metadata?.must_change_password) {
          navigate("/force-password-change");
        }
      }
    });

    return () => subscription.unsubscribe();
  }, [navigate]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate("/auth");
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-foreground text-background py-4 px-6 shadow-lg">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <SupertiltLogo className="h-10" invert />
            <span className="text-xl font-bold">SuperTools</span>
          </div>
          <div className="flex items-center gap-3">
            <OnboardCollaboratorDialog userEmail={user?.email} />
            {user && <UserMenu user={user} onLogout={handleLogout} />}
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Dashboard Section */}
        <section>
          <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>
          
          {statsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Charts Row */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <WeeklyChart
                  title="Micro-devis par semaine"
                  data={microDevisWeekly}
                  color="hsl(var(--primary))"
                />
                <WeeklyChart
                  title="Formations par semaine"
                  data={formationsWeekly}
                  color="hsl(var(--chart-2))"
                />
                <WeeklyChart
                  title="Évaluations par semaine"
                  data={evaluationsWeekly}
                  color="hsl(var(--chart-3))"
                />
              </div>

              {/* Stats Row */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <StatCard
                  title="Évaluation moyenne"
                  value={averageEvaluation ? `${averageEvaluation.toFixed(1)}/5` : "N/A"}
                  icon={Star}
                  description="Basée sur toutes les évaluations soumises"
                />
                <TopImprovements improvements={topImprovements} />
              </div>
            </div>
          )}
        </section>

        {/* Tools Section */}
        <section>
          <h2 className="text-xl font-semibold mb-4">Outils</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tools.map((tool) => (
              <Card
                key={tool.id}
                className="border-2 shadow-md hover:shadow-lg hover:border-primary/50 transition-all cursor-pointer group p-5"
                onClick={() => navigate(tool.path)}
              >
                <div className="flex items-center gap-4">
                  <div className="p-3 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    {tool.icon}
                  </div>
                  <div>
                    <CardTitle className="text-lg">{tool.name}</CardTitle>
                    <CardDescription className="text-sm">
                      {tool.description}
                    </CardDescription>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
