import { useNavigate } from "react-router-dom";
import { Settings, AlertTriangle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import SupertiltLogo from "@/components/SupertiltLogo";
import UserMenu from "@/components/UserMenu";
import OnboardCollaboratorDialog from "@/components/OnboardCollaboratorDialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";

interface AppHeaderProps {
  showOnboarding?: boolean;
}

const AppHeader = ({ showOnboarding = false }: AppHeaderProps) => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [firstName, setFirstName] = useState<string | null>(null);
  const [failedEmailCount, setFailedEmailCount] = useState(0);

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

  useEffect(() => {
    if (!user) return;
    const checkFailedEmails = async () => {
      // Check scheduled_emails with failed status
      const { count: scheduledCount } = await supabase
        .from("scheduled_emails")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      // Check failed_emails table
      const { count: failedCount } = await (supabase
        .from("failed_emails" as any)
        .select("*", { count: "exact", head: true })
        .eq("status", "failed") as any);

      setFailedEmailCount((scheduledCount || 0) + (failedCount || 0));
    };
    checkFailedEmails();
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
          {failedEmailCount > 0 && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate("/emails-erreur")}
                    className="relative p-2 rounded-lg hover:bg-background/10 transition-colors"
                  >
                    <AlertTriangle className="w-5 h-5 text-red-400" />
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {failedEmailCount > 9 ? "9+" : failedEmailCount}
                    </span>
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>{failedEmailCount} email{failedEmailCount > 1 ? "s" : ""} en erreur</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  onClick={() => navigate("/arena")}
                  className="p-2 rounded-lg hover:bg-background/10 transition-colors"
                >
                  <Sparkles className="w-5 h-5" />
                </button>
              </TooltipTrigger>
              <TooltipContent>
                <p>AI Arena</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
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
          {user && <UserMenu user={user} onLogout={logout} />}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
