import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, Award, FileText, History, Calendar } from "lucide-react";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import OnboardCollaboratorDialog from "@/components/OnboardCollaboratorDialog";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
}

const tools: Tool[] = [
  {
    id: "formations",
    name: "Formations",
    description: "Gérer les formations et les participants",
    icon: <Calendar className="w-12 h-12" />,
    path: "/formations",
  },
  {
    id: "certificates",
    name: "Certificats",
    description: "Générer et envoyer des certificats de formation",
    icon: <Award className="w-12 h-12" />,
    path: "/certificates",
  },
  {
    id: "micro-devis",
    name: "Micro-devis",
    description: "Créer des devis rapides et simplifiés",
    icon: <FileText className="w-12 h-12" />,
    path: "/micro-devis",
  },
  {
    id: "historique",
    name: "Historique",
    description: "Consulter l'historique des activités",
    icon: <History className="w-12 h-12" />,
    path: "/historique",
  },
];

const Dashboard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setUser(session?.user ?? null);
        setLoading(false);
        if (!session?.user) {
          navigate("/auth");
        } else {
          // Check if user must change password
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
        // Check if user must change password
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
        <div className="max-w-4xl mx-auto flex items-center justify-between">
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
      <main className="max-w-4xl mx-auto p-6">
        <div className="text-center mb-10">
          <h1 className="text-3xl font-bold mb-2">Bienvenue sur SuperTools</h1>
          <p className="text-muted-foreground">
            Sélectionnez un outil pour commencer
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tools.map((tool) => (
            <Card
              key={tool.id}
              className="border-2 shadow-lg hover:shadow-xl hover:border-primary/50 transition-all cursor-pointer group p-6"
              onClick={() => navigate(tool.path)}
            >
              <div className="flex flex-col items-center text-center space-y-4">
                <div className="p-4 rounded-full bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  {tool.icon}
                </div>
                <CardTitle className="text-xl">{tool.name}</CardTitle>
                <CardDescription className="text-base">
                  {tool.description}
                </CardDescription>
              </div>
            </Card>
          ))}
        </div>
      </main>
    </div>
  );
};

export default Dashboard;
