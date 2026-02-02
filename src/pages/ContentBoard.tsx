import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Newspaper } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

const ContentBoard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user) {
        navigate("/auth");
        return;
      }
      setUser(session.user);
      setLoading(false);
    };

    checkAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!session?.user) {
          navigate("/auth");
        } else {
          setUser(session.user);
        }
      }
    );

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
      <AppHeader user={user} onLogout={handleLogout} />

      <main className="max-w-7xl mx-auto p-6">
        <div className="flex items-center gap-4 mb-6">
          <Button variant="outline" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
          <div className="flex items-center gap-3">
            <Newspaper className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-2xl font-bold">Gestion du contenu</h1>
              <p className="text-muted-foreground">
                Tableau Kanban pour le marketing de contenu
              </p>
            </div>
          </div>
        </div>

        <Card className="border-dashed">
          <CardHeader className="text-center">
            <CardTitle className="text-xl">Module en cours de développement</CardTitle>
            <CardDescription>
              Le tableau Kanban de gestion de contenu sera bientôt disponible.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col items-center gap-4 py-8">
            <div className="p-6 rounded-full bg-primary/10">
              <Newspaper className="h-16 w-16 text-primary" />
            </div>
            <div className="text-center max-w-md space-y-2">
              <p className="text-muted-foreground">
                Ce module permettra de gérer le marketing de contenu avec un tableau Kanban,
                un système de relecture collaborative et une assistance par IA.
              </p>
              <p className="text-sm text-muted-foreground">
                Fonctionnalités prévues : colonnes personnalisables, cartes de contenu avec images,
                demandes de relecture, commentaires, recherche IA dans les idées, et reformulation automatique.
              </p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ContentBoard;
