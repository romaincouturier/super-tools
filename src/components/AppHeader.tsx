import { useNavigate, useLocation } from "react-router-dom";
import { Settings, AlertTriangle, Sparkles, ArrowLeft, Shield } from "lucide-react";
import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import UserMenu from "@/components/UserMenu";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useUserPreference } from "@/hooks/useUserPreferences";
import { MODULE_ICONS } from "@/components/moduleIcons";

interface ModuleLayout {
  order: string[];
  sizes: Record<string, string>;
  favorites?: string[];
}

const AppHeader = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { hasAccess, isAdmin } = useModuleAccess();
  const [failedEmailCount, setFailedEmailCount] = useState(0);

  const isDashboard = location.pathname === "/";

  // Load saved layout to find favorite modules (shortcuts)
  const { value: savedLayout } = useUserPreference<ModuleLayout>("module_layout", {
    order: [],
    sizes: {},
  });

  const shortcuts = useMemo(() => {
    return savedLayout?.favorites ?? [];
  }, [savedLayout]);

  useEffect(() => {
    if (!user) return;
    const checkFailedEmails = async () => {
      const { count: scheduledCount } = await supabase
        .from("scheduled_emails")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");

      const { count: failedCount } = await (supabase
        .from("failed_emails")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed") as any);

      setFailedEmailCount((scheduledCount || 0) + (failedCount || 0));
    };
    checkFailedEmails();
  }, [user]);

  return (
    <header className="bg-foreground text-background py-3 px-6 shadow-lg">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isDashboard && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate("/dashboard")}
                    className="p-2 rounded-lg hover:bg-background/10 transition-colors"
                  >
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Retour au tableau de bord</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
          <button
            onClick={() => navigate("/dashboard")}
            className="text-xl font-bold hover:opacity-80 transition-opacity"
          >
            SuperTools
          </button>

          {/* Module shortcuts (modules marked as favorite on dashboard) */}
          {shortcuts.length > 0 && (
            <div className="hidden sm:flex items-center gap-1 ml-2 border-l border-background/20 pl-4">
              {shortcuts.map((moduleId) => {
                const moduleInfo = MODULE_ICONS[moduleId];
                if (!moduleInfo) return null;
                const Icon = moduleInfo.icon;
                return (
                  <TooltipProvider key={moduleId}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          onClick={() => navigate(moduleInfo.path)}
                          className="p-1.5 rounded-lg hover:bg-background/10 transition-colors"
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{moduleInfo.label}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                );
              })}
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
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
          {hasAccess("arena") && (
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
          )}
          {isAdmin && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button
                    onClick={() => navigate("/admin")}
                    className="p-2 rounded-lg hover:bg-background/10 transition-colors"
                  >
                    <Shield className="w-5 h-5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent>
                  <p>Administration</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
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
