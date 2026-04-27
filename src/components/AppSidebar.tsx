import { forwardRef, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bot, ChevronLeft, ChevronRight, LayoutDashboard, Settings, Shield } from "lucide-react";
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

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 232;
const SIDEBAR_EXPANDED_KEY = "supertools.sidebar.expanded";

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

  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_EXPANDED_KEY) === "true";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, expanded ? "true" : "false");
  }, [expanded]);

  // Drawer (mobile) is always full-width with labels. On desktop, labels show only when expanded.
  const showLabels = asDrawer || expanded;

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
        width: asDrawer ? "100%" : expanded ? EXPANDED_WIDTH : COLLAPSED_WIDTH,
        minWidth: asDrawer ? undefined : COLLAPSED_WIDTH,
        background: ANTHRACITE,
        color: CREAM,
        display: "flex",
        flexDirection: "column",
        alignItems: showLabels ? "stretch" : "center",
        padding: showLabels ? "20px 12px" : "20px 0",
        flexShrink: 0,
        height: "100%",
        transition: asDrawer ? undefined : "width 180ms ease",
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
          alignSelf: showLabels ? "flex-start" : "center",
          marginLeft: showLabels ? 4 : 0,
          flexShrink: 0,
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
          alignItems: showLabels ? "stretch" : "center",
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <RailItem
          icon={Bot}
          label="Agent IA"
          active={isActive("/agent")}
          highlight
          showLabels={showLabels}
          onClick={() => go("/agent")}
        />
        <RailItem
          icon={LayoutDashboard}
          label="Tableau de bord"
          active={isActive("/dashboard")}
          showLabels={showLabels}
          onClick={() => go("/dashboard")}
        />
        {moduleItems.map((m) => (
          <RailItem
            key={m.key}
            icon={m.icon}
            label={m.label}
            active={isActive(m.path)}
            showLabels={showLabels}
            onClick={() => go(m.path)}
          />
        ))}
      </div>

      {/* Bottom section: admin, settings, expand toggle, avatar */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 4,
          alignItems: showLabels ? "stretch" : "center",
          width: "100%",
        }}
      >
        {isAdmin && (
          <RailItem
            icon={Shield}
            label="Administration"
            active={isActive("/admin")}
            showLabels={showLabels}
            onClick={() => go("/admin")}
          />
        )}
        <RailItem
          icon={Settings}
          label="Paramètres"
          active={isActive("/parametres")}
          showLabels={showLabels}
          alert={hasSettingsAlert}
          onClick={() => go("/parametres")}
        />

        {!asDrawer && (
          <RailItem
            icon={expanded ? ChevronLeft : ChevronRight}
            label={expanded ? "Réduire" : "Agrandir"}
            active={false}
            showLabels={showLabels}
            onClick={() => setExpanded((e) => !e)}
          />
        )}

        {user && (
          <div
            style={{
              marginTop: 4,
              display: "flex",
              justifyContent: showLabels ? "flex-start" : "center",
              paddingLeft: showLabels ? 10 : 0,
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
  showLabels?: boolean;
  onClick: () => void;
}

const RailButton = forwardRef<HTMLButtonElement, RailItemProps>(
  ({ icon: Icon, label, active, highlight, alert, showLabels, onClick, ...rest }, ref) => {
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
          showLabels
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
        <span style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
          <Icon size={18} />
          {alert && <AlertDot active className="top-0 right-0" />}
        </span>
        {showLabels && <span className="truncate">{label}</span>}
      </button>
    );
  },
);
RailButton.displayName = "RailButton";

function RailItem(props: RailItemProps) {
  if (props.showLabels) return <RailButton {...props} />;
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
