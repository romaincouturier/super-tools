import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Settings } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import OnboardCollaboratorDialog from "@/components/OnboardCollaboratorDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface AppHeaderProps {
  user: User | null;
  onLogout: () => void;
  showOnboarding?: boolean;
}

const AppHeader = ({ user, onLogout, showOnboarding = false }: AppHeaderProps) => {
  const navigate = useNavigate();
  const [firstName, setFirstName] = useState<string | null>(null);

  useEffect(() => {
    const fetchProfile = async () => {
      if (!user) return;
      
      const { data } = await supabase
        .from("profiles")
        .select("first_name")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (data?.first_name) {
        setFirstName(data.first_name);
      } else {
        // Fallback: extract first name from email
        const emailName = user.email?.split("@")[0] || "";
        const capitalized = emailName.charAt(0).toUpperCase() + emailName.slice(1);
        setFirstName(capitalized);
      }
    };
    
    fetchProfile();
  }, [user]);

  return (
    <header className="bg-foreground text-background py-4 px-6 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-6">
          <button
            onClick={() => navigate("/")}
            className="flex items-center gap-3 hover:opacity-80 transition-opacity"
          >
            <SupertiltLogo className="h-10" invert />
            <span className="text-xl font-bold">SuperTools</span>
          </button>
          {firstName && (
            <span className="text-sm text-background/80 hidden sm:block">
              Bonjour {firstName}, SuperTools te souhaite une bonne journée
            </span>
          )}
        </div>
        <div className="flex items-center gap-3">
          {showOnboarding && <OnboardCollaboratorDialog userEmail={user?.email} />}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/parametres")}
                  className="p-2 rounded-lg hover:bg-background/10 transition-colors"
                >
                  <Settings className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Paramètres</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
          {user && <UserMenu user={user} onLogout={onLogout} />}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
