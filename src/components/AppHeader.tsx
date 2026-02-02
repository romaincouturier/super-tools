import { useNavigate } from "react-router-dom";
import { User } from "@supabase/supabase-js";
import { Settings } from "lucide-react";
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

  return (
    <header className="bg-foreground text-background py-4 px-6 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <button
          onClick={() => navigate("/")}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <SupertiltLogo className="h-10" invert />
          <span className="text-xl font-bold">SuperTools</span>
        </button>
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
