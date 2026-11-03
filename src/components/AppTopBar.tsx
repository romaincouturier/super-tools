import { useNavigate } from "react-router-dom";
import { Bell } from "lucide-react";
import { useFailedEmailsCount } from "@/hooks/useEmailAlerts";
import { useIsMobile } from "@/hooks/use-mobile";
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
  const failedEmailCount = useFailedEmailsCount();
  const hasAlert = failedEmailCount > 0;
  const isMobile = useIsMobile();

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: isMobile ? 8 : 16,
        padding: isMobile ? "8px 12px" : "18px 40px",
        borderBottom: "1px solid rgba(16,24,32,0.06)",
        background: CREAM,
        color: ANTHRACITE,
        flexShrink: 0,
      }}
    >
      {mobileSlot}

      <div style={{ flex: 1 }} />

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
                width: isMobile ? 32 : 36,
                height: isMobile ? 32 : 36,
                borderRadius: 8,
                border: "none",
                background: "transparent",
                cursor: hasAlert ? "pointer" : "default",
                position: "relative",
                color: ANTHRACITE,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <Bell size={isMobile ? 16 : 17} />
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
