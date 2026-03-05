import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import ModuleLayout from "@/components/ModuleLayout";
import { KnowledgeBaseManager } from "@/components/chatbot/KnowledgeBaseManager";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";

export default function ChatbotAdmin() {
  const { user, loading } = useAuth();
  const navigate = useNavigate();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checkingAdmin, setCheckingAdmin] = useState(true);

  useEffect(() => {
    if (!loading && !user) {
      navigate("/auth");
    }
  }, [user, loading, navigate]);

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        setCheckingAdmin(false);
        return;
      }
      
      const { data } = await supabase.rpc("is_admin", { _user_id: user.id });
      setIsAdmin(!!data);
      setCheckingAdmin(false);
    };
    
    if (user) {
      checkAdmin();
    }
  }, [user]);

  if (loading || checkingAdmin) {
    return (
      <ModuleLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </ModuleLayout>
    );
  }

  if (!user) {
    return null;
  }

  if (!isAdmin) {
    return (
      <ModuleLayout>
        <main className="container mx-auto px-4 py-8">
          <div className="text-center py-16">
            <h1 className="text-2xl font-bold text-destructive mb-4">Accès refusé</h1>
            <p className="text-muted-foreground">
              Vous n'avez pas les permissions nécessaires pour accéder à cette page.
            </p>
          </div>
        </main>
      </ModuleLayout>
    );
  }

  return (
    <ModuleLayout>
      <main className="container mx-auto px-4 py-8">
        <KnowledgeBaseManager />
      </main>
    </ModuleLayout>
  );
}
