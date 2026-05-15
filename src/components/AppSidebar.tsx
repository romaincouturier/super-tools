import { forwardRef, useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Bot, ChevronDown, ChevronLeft, ChevronRight, LayoutDashboard, MailCheck, Settings, Shield } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { MODULE_ICONS } from "@/components/moduleIcons";
import { useAuth } from "@/hooks/useAuth";
import { useModuleAccess, type AppModule } from "@/hooks/useModuleAccess";
import { useSettingsAlerts } from "@/hooks/useSettingsAlerts";
import { useTimeTrackerAlert } from "@/hooks/useTimeTrackerAlert";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { AlertDot } from "@/components/ui/alert-dot";
import UserMenu from "@/components/UserMenu";

const CREAM = "#f7f5f0";
const ANTHRACITE = "#101820";
const YELLOW = "#ffd100";

const COLLAPSED_WIDTH = 72;
const EXPANDED_WIDTH = 240;
const SIDEBAR_EXPANDED_KEY = "supertools.sidebar.expanded";

// ── Nav config ─────────────────────────────────────────────────

interface SubNavItem {
  key: string;
  sectionLabel?: string;
}

interface NavGroupConfig {
  type: "group";
  key: string;
  children: SubNavItem[];
}

interface NavItemConfig {
  type: "item";
  key: string;
}

type NavConfig = NavGroupConfig | NavItemConfig;

const NAV_CONFIG: NavConfig[] = [
  { type: "item", key: "crm" },
  { type: "item", key: "missions" },
  {
    type: "group",
    key: "contenu",
    children: [
      { key: "transcripts" },
      { key: "temoignages" },
    ],
  },
  { type: "item", key: "supertilt" },
  {
    type: "group",
    key: "formations",
    children: [
      { key: "catalogue", sectionLabel: "Statistiques" },
      { key: "evaluations" },
      { key: "besoins" },
      { key: "reclamations" },
      { key: "ameliorations" },
    ],
  },
  { type: "item", key: "okr" },
  { type: "item", key: "finances" },
  { type: "item", key: "events" },
  { type: "item", key: "medias" },
  { type: "item", key: "lms" },
  { type: "item", key: "emails" },
  {
    type: "group",
    key: "monitoring",
    children: [
      { key: "historique" },
    ],
  },
  { type: "item", key: "support" },
  { type: "item", key: "reseau" },
  { type: "item", key: "veille" },
  { type: "item", key: "web-analytics" },
  { type: "item", key: "archives" },
  { type: "item", key: "dropshipping" },
  { type: "item", key: "pictodico" },
  { type: "item", key: "time-tracker" },
];

function toAppModule(key: string): AppModule {
  return key.replace("-", "_") as AppModule;
}

// ── AppSidebar ─────────────────────────────────────────────────

interface AppSidebarProps {
  asDrawer?: boolean;
  onNavigate?: () => void;
}

const AppSidebar = ({ asDrawer = false, onNavigate }: AppSidebarProps) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const { hasAccess, isAdmin } = useModuleAccess();
  const { hasAny: hasSettingsAlert } = useSettingsAlerts();
  const timeTrackerAlert = useTimeTrackerAlert();

  const [expanded, setExpanded] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(SIDEBAR_EXPANDED_KEY) === "true";
  });

  const [openGroups, setOpenGroups] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    NAV_CONFIG.forEach((entry) => {
      if (entry.type !== "group") return;
      const anyChildActive = entry.children.some((c) => {
        const info = MODULE_ICONS[c.key];
        return info && window.location.pathname.startsWith(info.path);
      });
      if (anyChildActive) initial.add(entry.key);
    });
    return initial;
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SIDEBAR_EXPANDED_KEY, expanded ? "true" : "false");
  }, [expanded]);

  // Auto-expand groups when navigating to a child path
  useEffect(() => {
    NAV_CONFIG.forEach((entry) => {
      if (entry.type !== "group") return;
      const anyChildActive = entry.children.some((c) => {
        const info = MODULE_ICONS[c.key];
        return info && location.pathname.startsWith(info.path);
      });
      if (anyChildActive) {
        setOpenGroups((prev) => {
          if (prev.has(entry.key)) return prev;
          return new Set([...prev, entry.key]);
        });
      }
    });
  }, [location.pathname]);

  const showLabels = asDrawer || expanded;

  const isActive = (path: string) => location.pathname.startsWith(path);

  const go = (path: string) => {
    navigate(path);
    onNavigate?.();
  };

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

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
          gap: 2,
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

        {NAV_CONFIG.map((entry) => {
          if (entry.type === "item") {
            const info = MODULE_ICONS[entry.key];
            if (!info) return null;
            if (!hasAccess(toAppModule(entry.key))) return null;
            const alert = entry.key === "time-tracker" ? timeTrackerAlert : undefined;
            return (
              <RailItem
                key={entry.key}
                icon={info.icon}
                label={info.label}
                active={isActive(info.path)}
                alert={alert}
                showLabels={showLabels}
                onClick={() => go(info.path)}
              />
            );
          }

          if (entry.type === "group") {
            const parentInfo = MODULE_ICONS[entry.key];
            if (!parentInfo) return null;
            const parentAccessible = hasAccess(toAppModule(entry.key));
            const accessibleChildren = entry.children.filter((c) => hasAccess(toAppModule(c.key)));
            if (!parentAccessible && accessibleChildren.length === 0) return null;

            const anyChildActive = entry.children.some((c) => {
              const info = MODULE_ICONS[c.key];
              return info && isActive(info.path);
            });
            const isOpen = openGroups.has(entry.key);

            if (!showLabels) {
              return (
                <RailItem
                  key={entry.key}
                  icon={parentInfo.icon}
                  label={parentInfo.label}
                  active={isActive(parentInfo.path) || anyChildActive}
                  showLabels={false}
                  onClick={() => go(parentInfo.path)}
                />
              );
            }

            return (
              <div key={entry.key}>
                {/* Group header */}
                <GroupHeader
                  icon={parentInfo.icon}
                  label={parentInfo.label}
                  active={isActive(parentInfo.path) && !anyChildActive}
                  anyChildActive={anyChildActive}
                  isOpen={isOpen}
                  onNavigate={() => { go(parentInfo.path); setOpenGroups((prev) => new Set([...prev, entry.key])); }}
                  onToggle={() => toggleGroup(entry.key)}
                />

                {/* Sub-items */}
                {isOpen && accessibleChildren.length > 0 && (
                  <div
                    style={{
                      marginLeft: 12,
                      marginTop: 2,
                      paddingLeft: 10,
                      borderLeft: "1px solid rgba(247,245,240,0.12)",
                      display: "flex",
                      flexDirection: "column",
                      gap: 1,
                    }}
                  >
                    {accessibleChildren.map((child) => {
                      const childInfo = MODULE_ICONS[child.key];
                      if (!childInfo) return null;
                      return (
                        <div key={child.key}>
                          {child.sectionLabel && (
                            <p
                              style={{
                                fontSize: 10,
                                fontWeight: 600,
                                letterSpacing: "0.08em",
                                textTransform: "uppercase",
                                color: "rgba(247,245,240,0.3)",
                                padding: "8px 10px 4px",
                              }}
                            >
                              {child.sectionLabel}
                            </p>
                          )}
                          <SubItem
                            icon={childInfo.icon}
                            label={childInfo.label}
                            active={isActive(childInfo.path)}
                            onClick={() => go(childInfo.path)}
                          />
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          return null;
        })}

        {hasAccess("emails") && (
          <RailItem
            icon={MailCheck}
            label="Emails à valider"
            active={isActive("/emails-a-valider")}
            showLabels={showLabels}
            onClick={() => go("/emails-a-valider")}
          />
        )}
      </div>

      {/* Bottom section */}
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
                  {user.email?.trim().charAt(0).toUpperCase() ?? "?"}
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

// ── Group header ───────────────────────────────────────────────

interface GroupHeaderProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  anyChildActive: boolean;
  isOpen: boolean;
  onNavigate: () => void;
  onToggle: () => void;
}

function GroupHeader({ icon: Icon, label, active, anyChildActive, isOpen, onNavigate, onToggle }: GroupHeaderProps) {
  const fg = active ? ANTHRACITE : anyChildActive ? CREAM : "rgba(247,245,240,0.6)";
  const bg = active ? YELLOW : "transparent";

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        borderRadius: 10,
        background: bg,
        overflow: "hidden",
      }}
      onMouseEnter={(e) => {
        if (!active) (e.currentTarget as HTMLDivElement).style.background = "rgba(247,245,240,0.08)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLDivElement).style.background = bg;
      }}
    >
      {/* Navigate to main page */}
      <button
        type="button"
        onClick={onNavigate}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          gap: 12,
          height: 36,
          paddingLeft: 12,
          background: "none",
          border: "none",
          cursor: "pointer",
          color: fg,
          fontSize: 14,
          fontWeight: 500,
          textAlign: "left",
          overflow: "hidden",
        }}
      >
        <Icon size={18} style={{ flexShrink: 0 }} />
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
      </button>

      {/* Toggle chevron */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={isOpen ? "Réduire" : "Développer"}
        style={{
          width: 32,
          height: 36,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "rgba(247,245,240,0.4)",
          flexShrink: 0,
          transition: "color 120ms",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.color = CREAM; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.color = "rgba(247,245,240,0.4)"; }}
      >
        <ChevronDown
          size={14}
          style={{
            transition: "transform 180ms ease",
            transform: isOpen ? "rotate(180deg)" : "rotate(0deg)",
          }}
        />
      </button>
    </div>
  );
}

// ── Sub-item ───────────────────────────────────────────────────

interface SubItemProps {
  icon: LucideIcon;
  label: string;
  active: boolean;
  onClick: () => void;
}

function SubItem({ icon: Icon, label, active, onClick }: SubItemProps) {
  const fg = active ? ANTHRACITE : "rgba(247,245,240,0.6)";
  const bg = active ? YELLOW : "transparent";

  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        width: "100%",
        height: 36,
        paddingLeft: 10,
        paddingRight: 8,
        borderRadius: 8,
        background: bg,
        color: fg,
        border: "none",
        cursor: "pointer",
        fontSize: 13,
        fontWeight: active ? 500 : 400,
        textAlign: "left",
        overflow: "hidden",
        transition: "background 120ms, color 120ms",
      }}
      onMouseEnter={(e) => {
        if (!active) {
          (e.currentTarget as HTMLButtonElement).style.background = "rgba(247,245,240,0.08)";
          (e.currentTarget as HTMLButtonElement).style.color = CREAM;
        }
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.background = bg;
        (e.currentTarget as HTMLButtonElement).style.color = fg;
      }}
    >
      <Icon size={15} style={{ flexShrink: 0 }} />
      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{label}</span>
    </button>
  );
}

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
            ? "flex items-center gap-3 w-full h-9 px-3 rounded-[10px] text-sm font-medium text-left transition-colors"
            : "w-10 h-10 rounded-[10px] flex items-center justify-center transition-colors relative",
        )}
        style={{ background: bg, color: fg, border: "none", cursor: "pointer" }}
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
