import { Loader2, Award, FileText, Calendar, ClipboardCheck, TrendingUp, History, Newspaper, ClipboardList, Inbox, BarChart3 } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { useModuleAccess, AppModule } from "@/hooks/useModuleAccess";
import { useAuth } from "@/hooks/useAuth";
import { useNavigate } from "react-router-dom";

interface Tool {
  id: string;
  name: string;
  description: string;
  icon: React.ReactNode;
  path: string;
  module: AppModule;
}

const tools: Tool[] = [
  {
    id: "micro-devis",
    name: "Micro-devis",
    description: "Créer des devis rapides et simplifiés",
    icon: <FileText className="w-10 h-10" />,
    path: "/micro-devis",
    module: "micro_devis",
  },
  {
    id: "formations",
    name: "Formations",
    description: "Gérer les formations et les participants",
    icon: <Calendar className="w-10 h-10" />,
    path: "/formations",
    module: "formations",
  },
  {
    id: "evaluations",
    name: "Évaluations",
    description: "Analyser les retours des participants",
    icon: <ClipboardCheck className="w-10 h-10" />,
    path: "/evaluations",
    module: "evaluations",
  },
  {
    id: "certificates",
    name: "Certificats",
    description: "Générer et envoyer des certificats de formation",
    icon: <Award className="w-10 h-10" />,
    path: "/certificates",
    module: "certificates",
  },
  {
    id: "ameliorations",
    name: "Améliorations",
    description: "Suivre les axes d'amélioration identifiés",
    icon: <TrendingUp className="w-10 h-10" />,
    path: "/ameliorations",
    module: "ameliorations",
  },
  {
    id: "besoins",
    name: "Besoins",
    description: "Consulter les besoins exprimés par les participants",
    icon: <ClipboardList className="w-10 h-10" />,
    path: "/besoins",
    module: "besoins",
  },
  {
    id: "historique",
    name: "Historique",
    description: "Consulter l'historique des actions",
    icon: <History className="w-10 h-10" />,
    path: "/historique",
    module: "historique",
  },
  {
    id: "contenu",
    name: "Contenu",
    description: "Gérer le marketing de contenu",
    icon: <Newspaper className="w-10 h-10" />,
    path: "/contenu",
    module: "contenu",
  },
  {
    id: "emails",
    name: "Emails reçus",
    description: "Consulter les emails entrants",
    icon: <Inbox className="w-10 h-10" />,
    path: "/emails",
    module: "emails",
  },
  {
    id: "statistiques",
    name: "Statistiques",
    description: "Visualiser les statistiques et indicateurs",
    icon: <BarChart3 className="w-10 h-10" />,
    path: "/statistiques",
    module: "statistiques",
  },
];
const Dashboard = () => {
  const navigate = useNavigate();
  const { user, loading, logout } = useAuth();
  const { hasAccess, loading: accessLoading } = useModuleAccess();

  // Filter tools based on user access
  const accessibleTools = tools.filter((tool) => hasAccess(tool.module));

  if (loading || accessLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader showOnboarding />

      {/* Main content */}
      <main className="max-w-7xl mx-auto p-6 space-y-8">
        {/* Tools Section */}
        <section>
          <h1 className="text-2xl font-bold mb-6">Tableau de bord</h1>
          {accessibleTools.length === 0 ? (
            <Card className="p-8 text-center text-muted-foreground">
              <p>Aucun module disponible.</p>
              <p className="text-sm mt-2">Contactez l'administrateur pour obtenir des accès.</p>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {accessibleTools.map((tool) => (
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
          )}
        </section>
      </main>
    </div>
  );
};

export default Dashboard;
