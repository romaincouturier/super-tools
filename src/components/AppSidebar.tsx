import { forwardRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bot, LayoutDashboard, Settings, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULE_ICONS } from "@/components/moduleIcons";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess } from "@/hooks/useModuleAccess";
import { useSettingsAlerts } from "@/hooks/useSettingsAlerts";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDot } from "@/components/ui/alert-dot";
import UserMenu from "@/components/UserMenu";

const CREAM = "#f7f5f0";
const ANTHRACITE = "#101820";
const YELLOW = "#ffd100";

/** Module keys in display order for the sidebar. */
const SIDEBAR_MODULE_ORDER = [
  "crm",
  "missions",
  "formations",
  "okr",
  "contenu",
  "events",
  "medias",
  "catalogue",
  "evaluations",
  "besoins",
  "lms",
  "reclamations",
  "emails",
  "historique",
  "monitoring",
  "ameliorations",
  "support",
  "reseau",
  "supertilt",
  "veille",
  "web-analytics",
];

function toAppModule(moduleIconKey: string): string {
  return moduleIconKey.replace("-", "_");
}

function emailInitial(email: string | undefined | null): string {
  if (!email) return "?";
  return email.trim().charAt(0).toUpperCase() || "?";
}

interface AppSidebarProps {
  /** When true, render as an always-expanded drawer (mobile). Tooltips disabled. */
  asDrawer?: boolean;
  /** Called after a nav click (for closing mobile drawer). */
  onNavigate?: () => void;
}

const AppSidebar = ({ asDrawer = false, onNavigate }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { hasAccess, isAdmin } = useModuleAccess();
  const { hasAny: hasSettingsAlert } = useSettingsAlerts();

  const isActive = (path: string) => location.pathname.startsWith(path);

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const moduleItems = SIDEBAR_MODULE_ORDER.map((key) => {
    const info = MODULE_ICONS[key];
    if (!info) return null;
    if (!hasAccess(toAppModule(key) as Parameters<typeof hasAccess>[0])) return null;
    return { key, icon: info.icon, label: info.label, path: info.path };
  }).filter((m): m is { key: string; icon: LucideIcon; label: string; path: string } => !!m);

  return (
    <aside
      style={{
        width: asDrawer ? "100%" : 72,
        minWidth: 72,
        background: ANTHRACITE,
        color: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: asDrawer ? "stretch" : "center",
        padding: asDrawer ? "20px 12px" : "20px 0",
        flexShrink: 0,
        height: "100%",
      }}
    >
      {/* Logo */}
      <button
        type="button"
        onClick={() => go("/dashboard")}
        aria-label="Tableau de bord"
        style={{
          width: 40,
          height: 40,
          borderRadius: 10,
          background: YELLOW,
          color: ANTHRACITE,
          border: "none",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontWeight: 800,
          fontSize: 18,
          letterSpacing: -0.5,
          alignSelf: asDrawer ? "flex-start" : "center",
          marginLeft: asDrawer ? 4 : 0,
        }}
      >
        S
      </button>

      {/* Main nav list */}
      <div
        style={{
          marginTop: 24,
          display: "flex",
          flexDirection: "column",
          gap: 4,
          flex: 1,
          width: "100%",
          alignItems: asDrawer ? "stretch" : "center",
          overflowY: "auto",
          overflowX: "hidden",
          paddingBottom: 8,
        }}
      >
        <RailItem
          icon={Bot}
          label="Agent IA"
          active={isActive("/agent")}
          highlight
          asDrawer={asDrawer}
          onClick={() => go("/agent")}
        />
        <RailItem
          icon={LayoutDashboard}
          label="Tableau de bord"
          active={isActive("/dashboard")}
          asDrawer={asDrawer}
          onClick={() => go("/dashboard")}
        />
        {moduleItems.map((m) => (
          <RailItem
            key={m.key}
            icon={m.icon}
            label={m.label}
            active={isActive(m.path)}
            asDrawer={asDrawer}
            onClick={() => go(m.path)}
          />
        ))}
      </div>

      {/* Bottom section: admin, settings, avatar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: asDrawer ? "stretch" : "center",
          paddingTop: 8,
          borderTop: "1px solid rgba(247,245,240,0.08)",
          width: "100%",
        }}
      >
        {isAdmin && (
          <RailItem
            icon={Shield}
            label="Administration"
            active={isActive("/admin")}
            asDrawer={asDrawer}
            onClick={() => go("/admin")}
          />
        )}
        <RailItem
          icon={Settings}
          label="Paramètres"
          active={isActive("/parametres")}
          asDrawer={asDrawer}
          alert={hasSettingsAlert}
          onClick={() => go("/parametres")}
        />

        {user && (
          <div
            style={{
              marginTop: 4,
              display: "flex",
              justifyContent: asDrawer ? "flex-start" : "center",
              paddingLeft: asDrawer ? 10 : 0,
            }}
          >
            <UserMenu
              user={user}
              onLogout={logout}
              trigger={
                <button
                  type="button"
                  aria-label="Mon compte"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: "50%",
                    background: YELLOW,
                    color: ANTHRACITE,
                    border: "none",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700,
                    fontSize: 14,
                    letterSpacing: -0.3,
                    flexShrink: 0,
                  }}
                >
                  {emailInitial(user.email)}
                </button>
              }
            />
          </div>
        )}
      </div>
    </aside>
  );
};

export default AppSidebar;

// ── Rail item ──────────────────────────────────────────────────

interface RailItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  highlight?: boolean;
  alert?: boolean;
  asDrawer?: boolean;
  onClick: () => void;
}

const RailButton = forwardRef<HTMLButtonElement, RailItemProps>(
  ({ icon: Icon, label, active, highlight, alert, asDrawer, onClick, ...rest }, ref) => {
    const fg = active ? ANTHRACITE : highlight ? YELLOW : "rgba(247,245,240,0.6)";
    const bg = active ? YELLOW : "transparent";
    const hoverBg = active ? YELLOW : "rgba(247,245,240,0.08)";

    return (
      <button
        ref={ref}
        type="button"
        onClick={onClick}
        aria-label={label}
        aria-current={active ? "page" : undefined}
        className={cn(
          asDrawer
            ? "flex items-center gap-3 w-full h-11 px-3 rounded-[10px] text-sm font-medium text-left transition-colors"
            : "w-11 h-11 rounded-[10px] flex items-center justify-center transition-colors relative",
        )}
        style={{
          background: bg,
          color: fg,
          border: "none",
          cursor: "pointer",
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = hoverBg;
          if (!active) (e.currentTarget as HTMLButtonElement).style.color = highlight ? YELLOW : CREAM;
        }}
        onMouseLeave={(e) => {
          (e.currentTarget as HTMLButtonElement).style.background = bg;
          (e.currentTarget as HTMLButtonElement).style.color = fg;
        }}
        {...rest}
      >
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
          <Icon size={18} />
          {alert && <AlertDot active className="top-0 right-0" />}
        </span>
        {asDrawer && <span className="truncate">{label}</span>}
      </button>
    );
  },
);
RailButton.displayName = "RailButton";

function RailItem(props: RailItemProps) {
  if (props.asDrawer) return <RailButton {...props} />;
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <RailButton {...props} />
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={8}>
          {props.label}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
