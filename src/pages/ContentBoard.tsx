import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";
import { Loader2, ArrowLeft, Newspaper } from "lucide-react";
import AppHeader from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import KanbanBoard from "@/components/content/KanbanBoard";
import ContentDashboard from "@/components/content/ContentDashboard";
import AiIdeasSearch from "@/components/content/AiIdeasSearch";
import NotificationBell from "@/components/content/NotificationBell";

const ContentBoard = () => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const openCardId = searchParams.get("card");

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

  const handleSelectCard = (cardId: string) => {
    setSearchParams({ card: cardId });
  };

  const handleCloseCard = () => {
    setSearchParams({});
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <AppHeader user={user} onLogout={handleLogout} />

      <main className="flex-1 max-w-full mx-auto p-6 overflow-hidden">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
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
          <NotificationBell />
        </div>

        <ContentDashboard />

        <div className="mb-6">
          <AiIdeasSearch onSelectCard={handleSelectCard} />
        </div>

        <KanbanBoard openCardId={openCardId} onCloseCard={handleCloseCard} />
      </main>
    </div>
  );
};

export default ContentBoard;
