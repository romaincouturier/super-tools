import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Bell, Plus, Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import type { ReactNode } from "react";

const CREAM = "#f7f5f0";
const ANTHRACITE = "#101820";
const YELLOW = "#ffd100";

interface AppTopBarProps {
  /** Optional mobile hamburger slot rendered on the left. */
  mobileSlot?: ReactNode;
}

const AppTopBar = ({ mobileSlot }: AppTopBarProps) => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [failedEmailCount, setFailedEmailCount] = useState(0);

  useEffect(() => {
    if (!user) return;
    const check = async () => {
      const { count: scheduledCount } = await supabase
        .from("scheduled_emails")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");
      const { count: failedCount } = await supabase
        .from("failed_emails")
        .select("*", { count: "exact", head: true })
        .eq("status", "failed");
      setFailedEmailCount((scheduledCount || 0) + (failedCount || 0));
    };
    check();
  }, [user]);

  const hasAlert = failedEmailCount > 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 16,
        padding: "18px 40px",
        borderBottom: "1px solid rgba(16,24,32,0.06)",
        background: CREAM,
        color: ANTHRACITE,
        flexShrink: 0,
      }}
    >
      {mobileSlot}

      <button
        type="button"
        onClick={() => navigate("/agent")}
        aria-label="Rechercher"
        style={{
          flex: 1,
          maxWidth: 480,
          display: "flex",
          alignItems: "center",
          gap: 10,
          background: "rgba(16,24,32,0.04)",
          border: "none",
          borderRadius: 10,
          padding: "9px 14px",
          cursor: "pointer",
          fontFamily: "inherit",
          color: "inherit",
          textAlign: "left",
        }}
      >
        <Search size={16} style={{ opacity: 0.5 }} />
        <span style={{ fontSize: 13.5, color: "rgba(16,24,32,0.5)", flex: 1 }}>
          Rechercher un module, un client, une formation…
        </span>
        <span style={{ display: "flex", gap: 3 }}>
          <kbd
            style={{
              fontSize: 10.5,
              padding: "2px 6px",
              background: "#fff",
              borderRadius: 4,
              fontFamily: "ui-monospace, monospace",
              boxShadow: "0 1px 0 rgba(16,24,32,0.08)",
            }}
          >
            ⌘
          </kbd>
          <kbd
            style={{
              fontSize: 10.5,
              padding: "2px 6px",
              background: "#fff",
              borderRadius: 4,
              fontFamily: "ui-monospace, monospace",
              boxShadow: "0 1px 0 rgba(16,24,32,0.08)",
            }}
          >
            K
          </kbd>
        </span>
      </button>

      <div style={{ flex: 1 }} />

      <button
        type="button"
        onClick={() => navigate("/agent")}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 6,
          padding: "8px 12px",
          background: "transparent",
          border: "1px solid rgba(16,24,32,0.1)",
          borderRadius: 8,
          cursor: "pointer",
          fontSize: 13,
          color: ANTHRACITE,
          fontWeight: 500,
          fontFamily: "inherit",
        }}
      >
        <Plus size={14} /> Nouveau
      </button>

      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <button
              type="button"
              onClick={() => (hasAlert ? navigate("/emails-erreur") : undefined)}
              aria-label={
                hasAlert
                  ? `${failedEmailCount} email${failedEmailCount > 1 ? "s" : ""} en erreur`
                  : "Notifications"
              }
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                cursor: hasAlert ? "pointer" : "default",
                position: "relative",
                color: ANTHRACITE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bell size={17} />
              {hasAlert && (
                <span
                  aria-hidden
                  style={{
                    position: "absolute",
                    top: 8,
                    right: 8,
                    width: 7,
                    height: 7,
                    borderRadius: "50%",
                    background: YELLOW,
                    boxShadow: `0 0 0 2px ${CREAM}`,
                  }}
                />
              )}
            </button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {hasAlert
              ? `${failedEmailCount} email${failedEmailCount > 1 ? "s" : ""} en erreur`
              : "Rien de neuf"}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

export default AppTopBar;
