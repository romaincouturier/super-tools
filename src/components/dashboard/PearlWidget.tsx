import { RefreshCw } from "lucide-react";
import PearlLogo from "@/components/PearlLogo";
import { Button } from "@/components/ui/button";
import { useDemoMode } from "@/contexts/DemoModeContext";
import { maskText } from "@/lib/demoMask";
import { useDashboardPearlPreference } from "@/hooks/useDashboardPearlPreference";
import { useRandomPearl } from "@/hooks/usePearls";
import { pearlAuthorLabel } from "@/services/pearls";
import { formatPearlDate } from "@/lib/pearls";

export default function PearlWidget() {
  const { enabled } = useDashboardPearlPreference();
  const { isDemoMode } = useDemoMode();
  const { pearl, next, loading } = useRandomPearl(enabled);

  if (!enabled || !pearl) return null;

  const author = pearlAuthorLabel(pearl);
  return (
    <section
      style={{
        background: "#fff",
        borderRadius: 14,
        padding: "18px 22px",
        border: "1px solid rgba(16,24,32,0.05)",
        marginBottom: 24,
        display: "flex",
        gap: 16,
        alignItems: "flex-start",
      }}
    >
      <PearlLogo size={40} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15, lineHeight: 1.5, fontStyle: "italic", whiteSpace: "pre-line" }}>
          « {isDemoMode ? maskText(pearl.message) : pearl.message} »
        </p>
        <p style={{ margin: "8px 0 0", fontSize: 12, color: "rgba(16,24,32,0.55)" }}>
          {isDemoMode ? maskText(author) : author} · {formatPearlDate(pearl.pearl_date, pearl.pearl_time)}
        </p>
      </div>
      <Button variant="ghost" size="icon" onClick={next} disabled={loading} aria-label="Une autre perle">
        <RefreshCw className="h-4 w-4" />
      </Button>
    </section>
  );
}
