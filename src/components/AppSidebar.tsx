import { useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { PanelLeftClose, PanelLeft, Bot } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULE_ICONS } from "@/components/moduleIcons";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Separator } from "@/components/ui/separator";

interface AppSidebarProps {
  collapsed: boolean;
  onToggle: () => void;
}

/** Module keys in display order for the sidebar */
const SIDEBAR_MODULE_ORDER = [
  "crm",
  "missions",
  "formations",
  "micro-devis",
  "okr",
  "contenu",
  "events",
  "medias",
  "catalogue",
  "evaluations",
  "certificates",
  "besoins",
  "lms",
  "reclamations",
  "emails",
  "historique",
  "statistiques",
  "monitoring",
  "ameliorations",
  "support",
  "reseau",
  "veille",
  "arena",
];

/** Map MODULE_ICONS keys to AppModule keys (handles underscore vs hyphen) */
function toAppModule(moduleIconKey: string): string {
  return moduleIconKey.replace("-", "_");
}

const AppSidebar = ({ collapsed, onToggle }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { hasAccess } = useModuleAccess();

  const isActive = (path: string) => location.pathname.startsWith(path);

  return (
    <aside
      className={cn(
        "h-full bg-muted/40 border-r flex flex-col transition-all duration-200 shrink-0",
        collapsed ? "w-0 overflow-hidden" : "w-56",
      )}
    >
      {/* Top: Agent */}
      <div className="p-2 space-y-1">
        <SidebarItem
          icon={Bot}
          label="Agent IA"
          path="/agent"
          active={isActive("/agent")}
          collapsed={collapsed}
          onClick={() => navigate("/agent")}
          highlight
        />
      </div>

      <Separator className="mx-2" />

      {/* Module list */}
      <ScrollArea className="flex-1 px-2 py-1">
        <div className="space-y-0.5">
          {SIDEBAR_MODULE_ORDER.map((moduleKey) => {
            const info = MODULE_ICONS[moduleKey];
            if (!info) return null;

            const appModule = toAppModule(moduleKey);
            if (!hasAccess(appModule as Parameters<typeof hasAccess>[0])) return null;

            return (
              <SidebarItem
                key={moduleKey}
                icon={info.icon}
                label={info.label}
                path={info.path}
                active={isActive(info.path)}
                collapsed={collapsed}
                onClick={() => navigate(info.path)}
              />
            );
          })}
        </div>
      </ScrollArea>

      {/* Collapse toggle */}
      <div className="p-2 border-t">
        <button
          onClick={onToggle}
          className="w-full flex items-center justify-center p-2 rounded-md hover:bg-muted transition-colors text-muted-foreground"
        >
          {collapsed ? <PanelLeft className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
        </button>
      </div>
    </aside>
  );
};

// ── Sidebar item component ───────────────────────────────────

interface SidebarItemProps {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  path: string;
  active: boolean;
  collapsed: boolean;
  onClick: () => void;
  highlight?: boolean;
}

function SidebarItem({ icon: Icon, label, active, collapsed, onClick, highlight }: SidebarItemProps) {
  const button = (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 rounded-md px-2.5 py-2 text-sm font-medium transition-colors",
        active
          ? "bg-primary text-primary-foreground"
          : highlight
            ? "text-primary hover:bg-primary/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        collapsed && "justify-center px-0",
      )}
    >
      <Icon className={cn("w-4 h-4 shrink-0", collapsed && "w-5 h-5")} />
      {!collapsed && <span className="truncate">{label}</span>}
    </button>
  );

  if (collapsed) {
    return (
      <TooltipProvider delayDuration={0}>
        <Tooltip>
          <TooltipTrigger asChild>{button}</TooltipTrigger>
          <TooltipContent side="right" sideOffset={8}>
            {label}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  return button;
}

export default AppSidebar;
