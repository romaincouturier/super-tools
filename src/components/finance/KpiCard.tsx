import { Info } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface KpiCardProps {
  title: string;
  value: string;
  hint?: string;
  info?: string;
  icon: React.ComponentType<{ className?: string }>;
  tone?: "default" | "positive" | "negative";
}

export default function KpiCard({ title, value, hint, info, icon: Icon, tone = "default" }: KpiCardProps) {
  const toneClass =
    tone === "positive" ? "text-emerald-600" : tone === "negative" ? "text-rose-600" : "text-foreground";
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <div className="flex items-center gap-1.5">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          {info && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="text-muted-foreground/60 hover:text-muted-foreground transition-colors"
                  aria-label={`Info ${title}`}
                >
                  <Info className="h-3.5 w-3.5" />
                </button>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-xs leading-relaxed">
                {info}
              </TooltipContent>
            </Tooltip>
          )}
        </div>
        <Icon className={`h-4 w-4 ${toneClass}`} />
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${toneClass}`}>{value}</div>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  );
}
